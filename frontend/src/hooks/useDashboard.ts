import {
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { dashboardApi, type TeamProgressEntry } from '../lib/api';
import type { DashboardStats, PaginatedResponse } from '../types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  teamProgress: (params: { page?: number; pageSize?: number }) =>
    [...dashboardKeys.all, 'teamProgress', params] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDashboardStats(): UseQueryResult<DashboardStats> {
  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: () => dashboardApi.getStats(),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useTeamProgress(
  params: { page?: number; pageSize?: number } = {},
): UseQueryResult<PaginatedResponse<TeamProgressEntry>> {
  return useQuery({
    queryKey: dashboardKeys.teamProgress(params),
    queryFn: () => dashboardApi.getTeamProgress(params),
    staleTime: 5 * 60 * 1000,
  });
}
