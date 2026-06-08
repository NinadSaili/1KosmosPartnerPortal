import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { resourceApi, type ResourceFilters } from '../lib/api';
import type { Resource, PaginatedResponse } from '../types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const resourceKeys = {
  all: ['resources'] as const,
  lists: () => [...resourceKeys.all, 'list'] as const,
  list: (filters: ResourceFilters) => [...resourceKeys.lists(), filters] as const,
  details: () => [...resourceKeys.all, 'detail'] as const,
  detail: (id: string) => [...resourceKeys.details(), id] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useResources(
  filters: ResourceFilters = {},
): UseQueryResult<PaginatedResponse<Resource>> {
  return useQuery({
    queryKey: resourceKeys.list(filters),
    queryFn: () => resourceApi.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useResource(id: string): UseQueryResult<Resource> {
  return useQuery({
    queryKey: resourceKeys.detail(id),
    queryFn: () => resourceApi.get(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateResource(): UseMutationResult<Resource, Error, FormData> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) => resourceApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: resourceKeys.lists() });
    },
  });
}

export function useUpdateResource(): UseMutationResult<
  Resource,
  Error,
  { id: string; data: Partial<Resource> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => resourceApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: resourceKeys.lists() });
      qc.setQueryData(resourceKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteResource(): UseMutationResult<unknown, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resourceApi.delete(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: resourceKeys.lists() });
      qc.removeQueries({ queryKey: resourceKeys.detail(id) });
    },
  });
}

export function useDownloadResource(): UseMutationResult<Blob, Error, string> {
  return useMutation({
    mutationFn: (id: string) => resourceApi.download(id),
    onSuccess: (blob, id) => {
      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = id;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    },
  });
}
