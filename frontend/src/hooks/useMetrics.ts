import { useState, useEffect, useCallback } from 'react';
import { fetchMetrics } from '../api/endpoints';
import type { MetricRow } from '../types/api';

export function useMetrics(monitorId: number | null, from?: string, to?: string) {
  const [data, setData] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!monitorId) return;
    setLoading(true);
    try {
      const res = await fetchMetrics(monitorId, from, to);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    } finally {
      setLoading(false);
    }
  }, [monitorId, from, to]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, refresh: fetch };
}
