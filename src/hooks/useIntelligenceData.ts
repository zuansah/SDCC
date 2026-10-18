import { useState, useEffect, useCallback } from 'react';
import { getIntelligenceData } from '../services/intelligenceService';
import { IntelligencePayload } from '../types/intelligence';

export function useIntelligenceData() {
  const [data, setData] = useState<IntelligencePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const payload = await getIntelligenceData(isManualRefresh);
      setData(payload);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching intelligence data:', err);
      setError(err?.message || 'Failed to load intelligence data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Re-fetch automatically every 15 minutes (15 * 60 * 1000 ms)
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const interval = setInterval(() => {
      fetchData(true);
    }, FIFTEEN_MINUTES_MS);

    return () => clearInterval(interval);
  }, [fetchData]);

  const refresh = useCallback(() => {
    return fetchData(true);
  }, [fetchData]);

  return {
    data,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  };
}
