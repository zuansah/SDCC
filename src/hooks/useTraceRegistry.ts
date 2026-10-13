import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  runTransaction,
  updateDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TraceMapping, IssueCandidate } from '../types/trace';
import { normalizeTraceDoc, generateTraceId } from '../utils/traceUtils';

const CACHE_KEY = 'telkom_trace_mappings_cache';

function getInitialCachedMappings(): TraceMapping[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse cached trace mappings', e);
  }
  return [];
}

export function useTraceRegistry() {
  const initialCache = useMemo(() => getInitialCachedMappings(), []);
  const [mappings, setMappings] = useState<TraceMapping[]>(initialCache);
  const [loading, setLoading] = useState(initialCache.length === 0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Failsafe timeout so loading state never hangs indefinitely
    const failsafe = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const colRef = collection(db, 'traceMappings');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        clearTimeout(failsafe);
        const list: TraceMapping[] = [];
        snapshot.forEach((d) => {
          list.push(normalizeTraceDoc(d.id, d.data()));
        });
        setMappings(list);
        setLoading(false);
        setError(null);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(list));
        } catch (e) {
          // ignore quota error
        }
      },
      (err) => {
        clearTimeout(failsafe);
        console.error('Error listening to traceMappings:', err);
        setError(err.message || 'Failed to load trace mappings from cloud. Using local cache.');
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(failsafe);
      unsubscribe();
    };
  }, []);

  // Fast lookups by hostname and by trace ID
  const { traceByHostname, activeTraceByHostname, traceById } = useMemo(() => {
    const byHostname = new Map<string, TraceMapping>();
    const activeByHostname = new Map<string, TraceMapping>();
    const byId = new Map<string, TraceMapping>();

    for (const m of mappings) {
      if (m.trace) {
        byId.set(m.trace.toUpperCase().trim(), m);
      }
      if (m.hostname) {
        const hostKey = m.hostname.toUpperCase().trim();
        byHostname.set(hostKey, m);
        if (m.status !== 'void') {
          activeByHostname.set(hostKey, m);
        }
      }
    }

    return {
      traceByHostname: byHostname,
      activeTraceByHostname: activeByHostname,
      traceById: byId,
    };
  }, [mappings]);

  /**
   * Issues a new Trace ID uniquely in a transaction with up to 5 retries.
   * Ensures one label per device.
   */
  const issueSingleTrace = useCallback(
    async (
      candidate: IssueCandidate,
      campaign: string,
      customer: string,
      userEmail: string
    ): Promise<TraceMapping> => {
      const hostKey = candidate.hostname.toUpperCase().trim();

      // Check client-side map first to avoid issuing second label
      const existing = activeTraceByHostname.get(hostKey);
      if (existing) {
        throw new Error(
          `Device ${candidate.hostname} already has an active label (${existing.trace}). Use Reprint instead.`
        );
      }

      let issuedDoc: TraceMapping | null = null;
      let lastErr: any = null;

      // Retry candidate generation up to 5 times in transaction
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidateId = generateTraceId();
        const docRef = doc(db, 'traceMappings', candidateId);

        try {
          await runTransaction(db, async (txn) => {
            const existingSnap = await txn.get(docRef);
            if (existingSnap.exists()) {
              throw new Error('COLLISION');
            }

            const now = new Date().toISOString();
            const docData = {
              trace: candidateId,
              hostname: candidate.hostname.trim(),
              orderNumber: candidate.orderNumber || '',
              kota: candidate.kota || '',
              pengadaan: candidate.pengadaan || '',
              siteCode: candidate.siteCode || null,
              siteName: candidate.siteName || null,
              serial: candidate.serial || null,
              sid: candidate.sid || null,
              customer: customer.trim() || 'INDOMARET',
              campaign: campaign.trim() || 'General',
              source: 'app',
              status: 'issued',
              issuedBy: userEmail,
              issuedAt: now,
            };

            txn.set(docRef, docData);
            issuedDoc = normalizeTraceDoc(candidateId, docData);
          });

          // Transaction succeeded
          break;
        } catch (err: any) {
          if (err.message === 'COLLISION') {
            console.warn(`Collision on candidate ${candidateId}, retrying...`);
            continue;
          }
          lastErr = err;
          throw err;
        }
      }

      if (!issuedDoc) {
        throw lastErr || new Error('Failed to generate unique Trace ID after 5 attempts.');
      }

      return issuedDoc;
    },
    [activeTraceByHostname]
  );

  /**
   * Batch issue for multiple candidates with progress reporting
   */
  const batchIssueTraceLabels = useCallback(
    async (
      candidates: IssueCandidate[],
      campaign: string,
      customer: string,
      userEmail: string,
      onProgress?: (current: number, total: number) => void
    ): Promise<{ success: TraceMapping[]; errors: { hostname: string; error: string }[] }> => {
      const success: TraceMapping[] = [];
      const errors: { hostname: string; error: string }[] = [];
      let processed = 0;

      for (const cand of candidates) {
        try {
          const doc = await issueSingleTrace(cand, campaign, customer, userEmail);
          success.push(doc);
        } catch (err: any) {
          errors.push({
            hostname: cand.hostname,
            error: err.message || 'Failed to issue Trace ID',
          });
        }
        processed++;
        if (onProgress) {
          onProgress(processed, candidates.length);
        }
      }

      return { success, errors };
    },
    [issueSingleTrace]
  );

  /**
   * Marks a set of trace IDs as printed
   */
  const markAsPrinted = useCallback(
    async (traceIds: string[], userEmail: string): Promise<void> => {
      const now = new Date().toISOString();
      const promises = traceIds.map((id) => {
        const ref = doc(db, 'traceMappings', id);
        return updateDoc(ref, {
          status: 'printed',
          printedAt: now,
          printedBy: userEmail,
        });
      });
      await Promise.all(promises);
    },
    []
  );

  /**
   * Voids an active label (never deletes)
   */
  const voidTraceLabel = useCallback(
    async (traceId: string, userEmail: string): Promise<void> => {
      const ref = doc(db, 'traceMappings', traceId);
      const now = new Date().toISOString();
      await updateDoc(ref, {
        status: 'void',
        voidedAt: now,
        voidedBy: userEmail,
      });
    },
    []
  );

  /**
   * Updates an existing trace label with fresh metadata (e.g. on re-upload)
   */
  const updateTraceLabel = useCallback(
    async (traceId: string, updates: Partial<TraceMapping>, userEmail: string): Promise<void> => {
      const ref = doc(db, 'traceMappings', traceId);
      const now = new Date().toISOString();
      await updateDoc(ref, {
        ...updates,
        updatedAt: now,
        updatedBy: userEmail,
      });
    },
    []
  );

  /**
   * Permanently deletes a single trace label by trace ID
   */
  const deleteSingleTraceLabel = useCallback(
    async (traceId: string): Promise<void> => {
      const ref = doc(db, 'traceMappings', traceId);
      await deleteDoc(ref);
      setMappings((prev) => prev.filter((m) => m.trace !== traceId));
    },
    []
  );

  /**
   * Permanently deletes multiple trace labels in batches of up to 450
   */
  const batchDeleteTraceLabels = useCallback(
    async (
      traceIds: string[],
      onProgress?: (processed: number, total: number) => void
    ): Promise<{ deletedCount: number; errors: string[] }> => {
      const BATCH_SIZE = 450;
      let processed = 0;
      const errors: string[] = [];

      for (let i = 0; i < traceIds.length; i += BATCH_SIZE) {
        const chunk = traceIds.slice(i, i + BATCH_SIZE);
        try {
          const batch = writeBatch(db);
          for (const id of chunk) {
            batch.delete(doc(db, 'traceMappings', id));
          }
          await batch.commit();
          processed += chunk.length;
          if (onProgress) {
            onProgress(processed, traceIds.length);
          }
        } catch (err: any) {
          console.error('Batch delete error:', err);
          errors.push(err.message || 'Error deleting batch');
        }
      }

      const idSet = new Set(traceIds);
      setMappings((prev) => prev.filter((m) => !idSet.has(m.trace)));

      return { deletedCount: processed, errors };
    },
    []
  );

  return {
    mappings,
    loading,
    error,
    traceByHostname,
    activeTraceByHostname,
    traceById,
    issueSingleTrace,
    batchIssueTraceLabels,
    updateTraceLabel,
    markAsPrinted,
    voidTraceLabel,
    deleteSingleTraceLabel,
    batchDeleteTraceLabels,
  };
}
