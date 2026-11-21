import { useCallback, useEffect, useState } from 'react';
import type { DashboardFilters } from '../types/dashboard';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function buildFilterQueryString(filters?: DashboardFilters): string {
  if (!filters) return '';
  const params = new URLSearchParams();
  if (filters.mes) params.set('mes', filters.mes);
  if (filters.modalidade) params.set('modalidade', filters.modalidade);
  if (filters.orgao) params.set('orgao', filters.orgao);
  if (filters.tipoItem) params.set('tipoItem', filters.tipoItem);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useDashboardApi<T>(
  endpoint: string,
  filters?: DashboardFilters
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number>(0);

  const qs = buildFilterQueryString(filters);
  const url = `${endpoint}${qs}`;

  const refetch = useCallback(() => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Erro HTTP ${res.status}`);
        }
        return res.json() as Promise<T>;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Erro ao consultar dados.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [url, nonce]);

  return { data, loading, error, refetch };
}
