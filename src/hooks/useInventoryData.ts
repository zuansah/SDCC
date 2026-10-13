import { useState, useEffect, useCallback, useMemo } from 'react';
import { ref, getBytes, getBlob, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, collection, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { storage, db, auth } from '../lib/firebase';
import { InventoryPayload, InventoryMeta, AssetItem } from '../types/inventory';
import { checkInventoryStaleness } from '../utils/inventoryUtils';

// Helper to sanitize Firestore document ID for asset serial numbers
export function sanitizeAssetDocId(serial: string): string {
  return encodeURIComponent(serial.trim().toUpperCase().replace(/\//g, '_SLASH_'));
}

// Module-level in-memory cache to keep parsed data across tab switches
let cachedPayload: InventoryPayload | null = null;
let cachedDataAsOf: string | null = null;
let activeFetchPromise: Promise<InventoryPayload> | null = null;

export function useInventoryData() {
  const [rawPayload, setRawPayload] = useState<InventoryPayload | null>(cachedPayload);
  const [editsMap, setEditsMap] = useState<Map<string, Partial<AssetItem>>>(new Map());
  const [loading, setLoading] = useState<boolean>(!cachedPayload);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const downloadFromStorage = async (): Promise<InventoryPayload> => {
    const storageRef = ref(storage, 'assets/sdwan-live.json');
    let text = '';
    let lastError: any = null;

    const timeoutPromise = (ms: number, desc: string) =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${desc} timed out after ${ms}ms`)), ms)
      );

    // Attempt 1: getBytes() with 35MB buffer allowance and 3.5s timeout
    try {
      const bytes = await Promise.race([
        getBytes(storageRef, 35 * 1024 * 1024),
        timeoutPromise(3500, 'getBytes')
      ]);
      text = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(text);
    } catch (bytesErr: any) {
      console.warn('getBytes failed, attempting getDownloadURL fallback:', bytesErr?.message);
      lastError = bytesErr;
    }

    // Attempt 2: getDownloadURL + browser streaming fetch with 3.5s timeout
    try {
      const url = await Promise.race([
        getDownloadURL(storageRef),
        timeoutPromise(3500, 'getDownloadURL')
      ]);
      const res = await fetch(url, { cache: 'default' });
      if (res.ok) {
        return await res.json();
      }
    } catch (urlErr: any) {
      console.warn('getDownloadURL fetch failed, attempting getBlob:', urlErr?.message);
      lastError = urlErr;
    }

    // Attempt 3: getBlob fallback with 3.5s timeout
    try {
      const blob = await Promise.race([
        getBlob(storageRef, 35 * 1024 * 1024),
        timeoutPromise(3500, 'getBlob')
      ]);
      text = await blob.text();
      return JSON.parse(text);
    } catch (blobErr: any) {
      console.warn('getBlob failed for assets:', blobErr?.message);
      lastError = blobErr;
    }

    throw lastError || new Error('Failed to download assets/sdwan-live.json from storage');
  };

  const fetchInventory = useCallback(async (force = false) => {
    // If an identical fetch is in flight and not force, reuse it
    if (activeFetchPromise && !force) {
      try {
        const payload = await activeFetchPromise;
        setRawPayload(payload);
        return;
      } catch (err: any) {
        setError(err.message || 'Failed to load inventory data');
        return;
      }
    }

    if (cachedPayload) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const task = (async (): Promise<InventoryPayload> => {
      // 1. Check Firestore assets/meta first (reliable, instant)
      let remoteMeta: InventoryMeta | null = null;
      let remoteDataAsOf: string | null = null;

      try {
        const metaSnap = await getDoc(doc(db, 'assets', 'meta'));
        if (metaSnap.exists()) {
          remoteMeta = metaSnap.data() as InventoryMeta;
          remoteDataAsOf = remoteMeta?.dataAsOf || null;
        }
      } catch (metaErr) {
        console.warn('Firestore assets/meta read failed or rule pending, fallback to storage:', metaErr);
      }

      // If we already have cached data with devices and dataAsOf hasn't changed, reuse cache!
      if (
        !force &&
        cachedPayload &&
        cachedPayload.assets?.length > 0 &&
        remoteDataAsOf &&
        cachedDataAsOf === remoteDataAsOf
      ) {
        return cachedPayload;
      }

      // 2. Fetch full file from Storage with multiple resilient attempts
      try {
        const payload = await downloadFromStorage();
        cachedPayload = payload;
        cachedDataAsOf = payload.meta?.dataAsOf || remoteDataAsOf;
        return payload;
      } catch (storageErr: any) {
        console.warn('Storage sync failed, checking fallbacks:', storageErr?.message);

        // Fallback A: If we already have a previous cached payload, keep serving it
        if (cachedPayload) {
          return cachedPayload;
        }

        // Fallback B: If Firestore assets/meta succeeded, synthesize valid payload with metadata
        if (remoteMeta) {
          const fallbackPayload: InventoryPayload = {
            meta: remoteMeta,
            assets: [],
          };
          cachedPayload = fallbackPayload;
          cachedDataAsOf = remoteMeta.dataAsOf;
          return fallbackPayload;
        }

        throw storageErr;
      }
    })();

    activeFetchPromise = task;

    try {
      const result = await task;
      setRawPayload(result);
      setLastChecked(new Date());
      setError(null);
    } catch (err: any) {
      console.warn('Error fetching inventory data:', err?.message);
      if (cachedPayload) {
        setRawPayload(cachedPayload);
        setError('Cloud Storage sync timed out. Displaying cached inventory data.');
      } else {
        setError(err.message || 'Failed to load inventory data from storage.');
      }
    } finally {
      activeFetchPromise = null;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Real-time synchronization of asset modifications & validations
  useEffect(() => {
    const colRef = collection(db, 'asset_edits');
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const nextMap = new Map<string, Partial<AssetItem>>();
        snapshot.forEach((d) => {
          const item = d.data() as AssetItem;
          const key = (item.serial_number || d.id).trim().toUpperCase();
          nextMap.set(key, item);
        });
        setEditsMap(nextMap);
      },
      (err) => {
        console.warn('Error listening to asset_edits:', err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchInventory(false);

    // Auto retry when auth state changes (e.g. login completes)
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && (!cachedPayload || cachedPayload.assets.length === 0)) {
        fetchInventory(true);
      }
    });

    // Re-fetch every 15 minutes as specified
    const interval = setInterval(() => {
      fetchInventory(false);
    }, 15 * 60 * 1000);

    return () => {
      unsubscribeAuth();
      clearInterval(interval);
    };
  }, [fetchInventory]);

  // Merge raw storage assets with Firestore live user edits & validation marks
  const data = useMemo<InventoryPayload | null>(() => {
    if (!rawPayload) return null;
    if (editsMap.size === 0) return rawPayload;

    const matchedKeys = new Set<string>();
    const mergedAssets: AssetItem[] = rawPayload.assets.map((base) => {
      const key = base.serial_number?.trim().toUpperCase();
      if (key && editsMap.has(key)) {
        matchedKeys.add(key);
        const edit = editsMap.get(key)!;
        return {
          ...base,
          ...edit,
          is_modified: true,
        };
      }
      return base;
    });

    // Prepend newly added custom assets that weren't in base payload
    for (const [key, edit] of editsMap.entries()) {
      if (!matchedKeys.has(key)) {
        mergedAssets.unshift({
          serial_number: key,
          platform: 'CISCO',
          position_category: 'EDGES',
          is_modified: true,
          is_custom_added: true,
          ...edit,
        });
      }
    }

    return {
      ...rawPayload,
      assets: mergedAssets,
    };
  }, [rawPayload, editsMap]);

  // Persist asset updates & validations in Firestore
  const saveAssetEdit = useCallback(
    async (serial: string, updates: Partial<AssetItem>, userEmail?: string): Promise<void> => {
      const cleanSerial = serial.trim().toUpperCase();
      const docId = sanitizeAssetDocId(cleanSerial);
      const now = new Date().toISOString();
      const payload: Partial<AssetItem> = {
        ...updates,
        serial_number: cleanSerial,
        is_modified: true,
        last_modified_by: userEmail || 'User',
        last_modified_at: now,
      };
      await setDoc(doc(db, 'asset_edits', docId), payload, { merge: true });
    },
    []
  );

  // Revert user edits and restore pristine master inventory feed
  const revertAssetEdit = useCallback(async (serial: string): Promise<void> => {
    const docId = sanitizeAssetDocId(serial);
    await deleteDoc(doc(db, 'asset_edits', docId));
  }, []);

  // Add a brand new asset not present in original storage feed
  const addCustomAsset = useCallback(
    async (asset: AssetItem, userEmail?: string): Promise<void> => {
      const cleanSerial = asset.serial_number.trim().toUpperCase();
      const docId = sanitizeAssetDocId(cleanSerial);
      const now = new Date().toISOString();
      const payload: AssetItem = {
        ...asset,
        serial_number: cleanSerial,
        is_modified: true,
        is_custom_added: true,
        last_modified_by: userEmail || 'User',
        last_modified_at: now,
        validation_status: asset.validation_status || 'VALIDATED',
        validated_by: userEmail || 'User',
        validated_at: now,
      };
      await setDoc(doc(db, 'asset_edits', docId), payload, { merge: true });
    },
    []
  );

  // Staleness check (> 7 days)
  const { isStale, daysOld } = checkInventoryStaleness(data?.meta?.dataAsOf);

  return {
    data,
    loading,
    refreshing,
    error,
    isStale,
    daysOld,
    lastChecked,
    editsCount: editsMap.size,
    refetch: () => fetchInventory(true),
    saveAssetEdit,
    revertAssetEdit,
    addCustomAsset,
  };
}
