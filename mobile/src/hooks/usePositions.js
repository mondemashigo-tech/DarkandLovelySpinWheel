import { useApi } from './useApi';
export function usePositions() {
  const { data, loading, error, refetch } = useApi('/api/positions');
  return { positions: data || [], loading, error, refetch };
}
