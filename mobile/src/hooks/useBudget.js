import { useApi } from './useApi';
export function useBudget() {
  const { data, loading, refetch } = useApi('/api/budget', 60000);
  return { budget: data, loading, refetch };
}
