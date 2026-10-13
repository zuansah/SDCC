import { useState, useEffect, useCallback } from 'react';
import { ref, getBytes, getBlob } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { OrdersPayload } from '../types/orders';
import { parseWibDate } from '../utils/orderUtils';

let activeFetchPromise: Promise<OrdersPayload> | null = null;

export function useOrdersData() {
  const [data, setData] = useState<OrdersPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const downloadFromStorage = async (): Promise<OrdersPayload> => {
    const storageRef = ref(storage, 'orders/sdwan-live.json');
    let text = '';
    try {
      // Use getBytes() with 35MB buffer allowance as specified
      const bytes = await getBytes(storageRef, 35 * 1024 * 1024);
      text = new TextDecoder('utf-8').decode(bytes);
    } catch (bytesErr: any) {
      console.warn('getBytes fallback to getBlob:', bytesErr);
      const blob = await getBlob(storageRef, 35 * 1024 * 1024);
      text = await blob.text();
    }

    const parsed: OrdersPayload = JSON.parse(text);
    return parsed;
  };

  const fetchOrders = useCallback(async (isRefresh = false) => {
    // If an identical fetch is already in flight, reuse it
    if (activeFetchPromise && !isRefresh) {
      try {
        const payload = await activeFetchPromise;
        setData(payload);
        return;
      } catch (err: any) {
        setError(err.message || 'Failed to load order data');
        return;
      }
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const task = (async () => {
      try {
        // Direct download using getBytes()
        const payload = await downloadFromStorage();
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
      console.error('Error fetching orders data:', err);
      setError(err.message || 'Failed to load order data from storage.');
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
