import { useState, useEffect, useCallback } from 'react';
import { API_URL, POLL_INTERVAL } from '../config';

export function useApi(path, intervalMs = POLL_INTERVAL) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, intervalMs);
    return () => clearInterval(t);
  }, [fetchData, intervalMs]);

  return { data, loading, error, refetch: fetchData };
}
