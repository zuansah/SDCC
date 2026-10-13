import { useState, useEffect, useCallback } from 'react';
import { ref, getBytes, getBlob } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { AssurancePayload, AssuranceMeta } from '../types/assurance';
import { checkInventoryStaleness } from '../utils/inventoryUtils';
import { getFallbackAssurancePayload } from '../utils/fallbackAssuranceData';

// Module-level cache to keep parsed data across tab changes
let cachedPayload: AssurancePayload | null = null;
let cachedDataAsOf: string | null = null;
let activeFetchPromise: Promise<AssurancePayload> | null = null;

export function useAssuranceData() {
  const [data, setData] = useState<AssurancePayload | null>(cachedPayload);
  const [loading, setLoading] = useState<boolean>(!cachedPayload);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const downloadFromStorage = async (): Promise<AssurancePayload> => {
    const storageRef = ref(storage, 'assurance/sdwan-live.json');
    let text = '';
    try {
      const bytes = await getBytes(storageRef, 35 * 1024 * 1024);
      text = new TextDecoder('utf-8').decode(bytes);
    } catch (bytesErr: any) {
      console.warn('getBytes fallback to getBlob for assurance:', bytesErr);
      const blob = await getBlob(storageRef, 35 * 1024 * 1024);
      text = await blob.text();
    }

    const parsed: AssurancePayload = JSON.parse(text);
    return parsed;
  };

  const fetchAssurance = useCallback(async (force = false) => {
    if (activeFetchPromise && !force) {
      try {
        const payload = await activeFetchPromise;
        setData(payload);
        return;
      } catch (err: any) {
        setError(err.message || 'Failed to load assurance data');
        return;
      }
    }

    if (cachedPayload) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const task = (async () => {
      try {
        // 1. Cheap check on Firestore assurance/meta
        let remoteMeta: AssuranceMeta | null = null;
        let remoteDataAsOf: string | null = null;

        try {
          const metaSnap = await getDoc(doc(db, 'assurance', 'meta'));
          if (metaSnap.exists()) {
            remoteMeta = metaSnap.data() as AssuranceMeta;
            remoteDataAsOf = remoteMeta?.dataAsOf || null;
          }
        } catch (metaErr) {
          console.warn('Firestore assurance/meta read skipped or rule pending:', metaErr);
        }

        // If we already have cached data and dataAsOf hasn't changed, reuse cache!
        if (!force && cachedPayload && remoteDataAsOf && cachedDataAsOf === remoteDataAsOf) {
          return cachedPayload;
        }

        // 2. Fetch full file from Storage using getBytes()
        let payload: AssurancePayload;
        try {
          payload = await downloadFromStorage();
        } catch (storageErr: any) {
          console.warn('Storage assurance feed unavailable (falling back to Firestore assurance/meta baseline):', storageErr?.message);
          payload = getFallbackAssurancePayload(remoteMeta);
        }

        cachedPayload = payload;
        cachedDataAsOf = payload.meta?.dataAsOf || remoteDataAsOf;
        return payload;
      } finally {
        activeFetchPromise = null;
      }
    })();

    activeFetchPromise = task;

    try {
      const result = await task;
      setData(result);
      setLastChecked(new Date());
      setError(null);
    } catch (err: any) {
      console.warn('Recovered assurance fetch error with fallback:', err);
      const fallback = getFallbackAssurancePayload(null);
      cachedPayload = fallback;
      setData(fallback);
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAssurance(false);

    // Auto-refresh every 15 minutes as specified
    const interval = setInterval(() => {
      fetchAssurance(false);
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchAssurance]);

  // Check if dataAsOf is more than 45 minutes old
  const { isStale, staleMinutes } = (() => {
    if (!data?.meta?.dataAsOf) return { isStale: false, staleMinutes: 0 };
    // dataAsOf is WIB string, e.g. "2026-09-25T16:52:24"
    let d: Date | null = null;
    const clean = data.meta.dataAsOf.trim();
    if (clean.includes('+') || clean.endsWith('Z')) {
      d = new Date(clean);
    } else {
      d = new Date(clean.replace(' ', 'T') + '+07:00');
    }

    if (!d || isNaN(d.getTime())) return { isStale: false, staleMinutes: 0 };
    const ageMs = Date.now() - d.getTime();
    const mins = Math.floor(ageMs / (60 * 1000));
    return {
      isStale: mins > 45,
      staleMinutes: Math.max(0, mins)
    };
  })();

  return {
    data,
    loading,
    refreshing,
    error,
    isStale,
    staleMinutes,
    lastChecked,
    refetch: () => fetchAssurance(true),
  };
}
