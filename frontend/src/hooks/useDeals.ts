import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { dealApi, type DealFilters } from '../lib/api';
import type { Deal, DealDocument, DealStatusHistory, PaginatedResponse } from '../types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const dealKeys = {
  all: ['deals'] as const,
  lists: () => [...dealKeys.all, 'list'] as const,
  list: (filters: DealFilters) => [...dealKeys.lists(), filters] as const,
  details: () => [...dealKeys.all, 'detail'] as const,
  detail: (id: string) => [...dealKeys.details(), id] as const,
};

// ─── Types ────────────────────────────────────────────────────────────────────

type DealDetail = Deal & {
  documents: DealDocument[];
  statusHistory: DealStatusHistory[];
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDeals(
  filters: DealFilters = {},
): UseQueryResult<PaginatedResponse<Deal>> {
  return useQuery({
    queryKey: dealKeys.list(filters),
    queryFn: () => dealApi.list(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function useDeal(id: string): UseQueryResult<DealDetail> {
  return useQuery({
    queryKey: dealKeys.detail(id),
    queryFn: () => dealApi.get(id),
    enabled: Boolean(id),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateDeal(): UseMutationResult<Deal, Error, Partial<Deal>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Deal>) => dealApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dealKeys.lists() });
    },
  });
}

export function useUpdateDeal(): UseMutationResult<
  Deal,
  Error,
  { id: string; data: Partial<Deal> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => dealApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: dealKeys.lists() });
      qc.invalidateQueries({ queryKey: dealKeys.detail(updated.id) });
    },
  });
}

export function useUpdateDealStatus(): UseMutationResult<
  Deal,
  Error,
  { id: string; status: string; comment?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, comment }) => dealApi.updateStatus(id, status, comment),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: dealKeys.lists() });
      qc.invalidateQueries({ queryKey: dealKeys.detail(updated.id) });
    },
  });
}
