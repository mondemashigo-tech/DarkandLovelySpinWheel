import { useState, useEffect } from 'react';
export function useBudget() {
  const [budget, setBudget] = useState(null);
  const fetchBudget = async () => {
    try {
      const r = await window.fetch('http://localhost:3001/api/budget');
      setBudget(await r.json());
    } catch (e) { console.error(e); }
  };
  useEffect(() => { fetchBudget(); const t = setInterval(fetchBudget, 60000); return () => clearInterval(t); }, []);
  return { budget, refetch: fetchBudget };
}
