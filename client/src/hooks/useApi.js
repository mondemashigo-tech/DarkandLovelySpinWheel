import { useState, useCallback } from 'react';

export function useApi(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const call = useCallback(async (bypass = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = bypass ? `${endpoint}?refresh=1` : endpoint;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  return { data, loading, error, fetch: call };
}
