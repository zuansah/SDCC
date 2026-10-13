import { useState, useEffect } from 'react';
import { ref, getBytes, getBlob, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

let cachedData: any = null;
let cachedFetchTime: Date | null = null;
let isFetching = false;
let fetchPromise: Promise<any> | null = null;

export function useControllerData() {
  const [data, setData] = useState<any>(cachedData);
  const [loading, setLoading] = useState<boolean>(!cachedData);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(cachedFetchTime);

  const fetchData = async (force = false) => {
    if (!force && cachedData) {
      setData(cachedData);
      setLoading(false);
      return;
    }
    
    if (isFetching && fetchPromise) {
      try {
        const result = await fetchPromise;
        setData(result);
        setLastFetch(new Date());
      } catch (err: any) {
        setError(err.message);
      }
      return;
    }

    isFetching = true;
    setLoading(true);
    
    fetchPromise = (async () => {
      const storageRef = ref(storage, 'controllers/live.json');
      try {
        const bytes = await getBytes(storageRef, 15 * 1024 * 1024);
        const text = new TextDecoder('utf-8').decode(bytes);
        const payload = JSON.parse(text);
        if (payload?.controllers) {
          payload.controllers.forEach((c: any) => {
            if (c.reason && (c.reason.includes('HTTPSConnectionPool') || c.reason.includes('ConnectTimeoutError') || c.reason.includes('urllib3') || c.reason.includes('Max retries'))) {
              c.reason = '';
            }
          });
        }
        return payload;
      } catch (bytesErr) {
        try {
          const url = await getDownloadURL(storageRef);
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) throw new Error('Failed to fetch data');
          const payload = await res.json();
          if (payload?.controllers) {
            payload.controllers.forEach((c: any) => {
              if (c.reason && (c.reason.includes('HTTPSConnectionPool') || c.reason.includes('ConnectTimeoutError') || c.reason.includes('urllib3') || c.reason.includes('Max retries'))) {
                c.reason = '';
              }
            });
          }
          return payload;
        } catch (downloadErr: any) {
          console.warn('Could not load controllers/live.json from storage:', downloadErr?.message);
          return cachedData || {
            meta: { generatedAt: new Date().toISOString(), source: 'empty', totals: { total: 0, up: 0, down: 0, critical: 0, license: 0 }, byOwnership: {}, thresholds: {} },
            controllers: []
          };
        }
      }
    })();

    try {
      const payload = await fetchPromise;
      cachedData = payload;
      cachedFetchTime = new Date();
      setData(payload);
      setLastFetch(cachedFetchTime);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching controller data');
      console.error(err);
    } finally {
      isFetching = false;
      setLoading(false);
      fetchPromise = null;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, lastFetch, refetch: () => fetchData(true) };
}
