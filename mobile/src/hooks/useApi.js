import { useState, useEffect, useCallback } from 'react';
import { POLL_INTERVAL } from '../config';
import { useApiUrl } from '../context/ApiUrlContext';

export function useApi(path, intervalMs = POLL_INTERVAL) {
  const { apiUrl } = useApiUrl();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, path]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, intervalMs);
    return () => clearInterval(t);
  }, [fetchData, intervalMs]);

  return { data, loading, error, refetch: fetchData };
}
