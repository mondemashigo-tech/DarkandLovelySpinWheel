import { useState, useCallback } from 'react';
import { apiFetch } from '../api';

export function useApi(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback(async (bypass = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = bypass ? `${path}?refresh=1` : path;
      const result = await apiFetch(url);
      setData(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  return { data, loading, error, fetch: call };
}
