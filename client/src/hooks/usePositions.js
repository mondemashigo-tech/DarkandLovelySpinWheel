import { useState, useEffect } from 'react';
export function usePositions() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchPositions = async () => {
    try {
      const r = await window.fetch('http://localhost:3001/api/positions');
      setPositions(await r.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchPositions(); const t = setInterval(fetchPositions, 30000); return () => clearInterval(t); }, []);
  return { positions, loading, refetch: fetchPositions };
}
