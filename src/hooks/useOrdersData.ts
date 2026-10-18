import { useState, useEffect, useCallback } from 'react';
import { ref, getBytes, getBlob, getDownloadURL } from 'firebase/storage';
import { doc, getDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { OrdersPayload } from '../types/orders';
import { parseWibDate } from '../utils/orderUtils';
import { getFallbackOrdersPayload } from '../utils/fallbackOrdersData';

let cachedOrdersPayload: OrdersPayload | null = null;
let activeFetchPromise: Promise<OrdersPayload> | null = null;

const timeoutPromise = (ms: number, label: string) =>
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Storage timeout after ${ms}ms (${label})`)), ms)
  );

export function useOrdersData() {
  const [data, setData] = useState<OrdersPayload | null>(cachedOrdersPayload);
  const [loading, setLoading] = useState<boolean>(!cachedOrdersPayload);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const downloadFromStorage = async (): Promise<OrdersPayload | null> => {
    const storageRef = ref(storage, 'orders/sdwan-live.json');
    let text = '';

    // Attempt 1: getBytes() with 3.5s timeout
    try {
      const bytes = await Promise.race([
        getBytes(storageRef, 35 * 1024 * 1024),
        timeoutPromise(3500, 'getBytes'),
      ]);
      text = new TextDecoder('utf-8').decode(bytes);
      return JSON.parse(text);
    } catch (bytesErr: any) {
      console.warn('Orders getBytes failed, trying getDownloadURL:', bytesErr?.message);
    }

    // Attempt 2: getDownloadURL + browser fetch with 3.5s timeout
    try {
      const url = await Promise.race([
        getDownloadURL(storageRef),
        timeoutPromise(3500, 'getDownloadURL'),
      ]);
      const res = await fetch(url, { cache: 'default' });
      if (res.ok) {
        return await res.json();
      }
    } catch (urlErr: any) {
      console.warn('Orders getDownloadURL failed, trying getBlob:', urlErr?.message);
    }

    // Attempt 3: getBlob() with 3.5s timeout
    try {
      const blob = await Promise.race([
        getBlob(storageRef, 35 * 1024 * 1024),
        timeoutPromise(3500, 'getBlob'),
      ]);
      text = await blob.text();
      return JSON.parse(text);
    } catch (blobErr: any) {
      console.warn('Orders getBlob failed:', blobErr?.message);
    }

    return null;
  };

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (activeFetchPromise && !isRefresh) {
      try {
        const payload = await activeFetchPromise;
        setData(payload);
        return;
      } catch {
        // Fall back to cached or default
        const fallback = cachedOrdersPayload || getFallbackOrdersPayload();
        setData(fallback);
        return;
      }
    }

    if (cachedOrdersPayload) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const task = (async (): Promise<OrdersPayload> => {
      try {
        // 1. Try download from Storage with strict per-attempt timeouts
        let payload = await downloadFromStorage();

        // 2. If storage returned data, verify and use
        if (payload && payload.orders && Array.isArray(payload.orders)) {
          cachedOrdersPayload = payload;
          return payload;
        }

        // 3. Try reading Firestore orders/meta if storage was empty
        try {
          const metaSnap = await getDoc(doc(db, 'orders', 'meta'));
          if (metaSnap.exists()) {
            const metaData = metaSnap.data();
            const fallback = getFallbackOrdersPayload();
            if (metaData) {
              fallback.meta = { ...fallback.meta, ...metaData };
            }
            cachedOrdersPayload = fallback;
            return fallback;
          }
        } catch (fsErr: any) {
          console.warn('Firestore orders/meta check skipped:', fsErr?.message);
        }

        // 4. Clean operational fallback
        const fallback = cachedOrdersPayload || getFallbackOrdersPayload();
        cachedOrdersPayload = fallback;
        return fallback;
      } catch (err: any) {
        console.warn('Recovered from orders fetch error with baseline:', err?.message);
        const fallback = cachedOrdersPayload || getFallbackOrdersPayload();
        cachedOrdersPayload = fallback;
        return fallback;
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
    } catch {
      const fallback = cachedOrdersPayload || getFallbackOrdersPayload();
      setData(fallback);
      setError(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(false);

    // Re-fetch every 5 minutes (300,000 ms) as specified
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Check if feed is stale (> 20 minutes) based on meta.dataAsOf in the parsed file
  const isStale = (() => {
    if (!data?.meta?.dataAsOf) return false;
    const asOfDate = parseWibDate(data.meta.dataAsOf);
    if (!asOfDate) return false;
    const ageMinutes = (Date.now() - asOfDate.getTime()) / (60 * 1000);
    return ageMinutes > 20;
  })();

  const staleMinutes = (() => {
    if (!data?.meta?.dataAsOf) return 0;
    const asOfDate = parseWibDate(data.meta.dataAsOf);
    if (!asOfDate) return 0;
    return Math.max(0, Math.floor((Date.now() - asOfDate.getTime()) / (60 * 1000)));
  })();

  return {
    data,
    loading,
    refreshing,
    error,
    isStale,
    staleMinutes,
    lastChecked,
    refetch: () => fetchOrders(true),
  };
}
