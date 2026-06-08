import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { announcementApi, type AnnouncementFilters } from '../lib/api';
import type { Announcement, PaginatedResponse } from '../types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const announcementKeys = {
  all: ['announcements'] as const,
  lists: () => [...announcementKeys.all, 'list'] as const,
  list: (filters: AnnouncementFilters) => [...announcementKeys.lists(), filters] as const,
  details: () => [...announcementKeys.all, 'detail'] as const,
  detail: (id: string) => [...announcementKeys.details(), id] as const,
  unreadCount: () => [...announcementKeys.all, 'unreadCount'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAnnouncements(
  filters: AnnouncementFilters = {},
): UseQueryResult<PaginatedResponse<Announcement>> {
  return useQuery({
    queryKey: announcementKeys.list(filters),
    queryFn: () => announcementApi.list(filters),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAnnouncement(id: string): UseQueryResult<Announcement> {
  return useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: () => announcementApi.get(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnreadCount(): UseQueryResult<number> {
  return useQuery({
    queryKey: announcementKeys.unreadCount(),
    queryFn: async () => {
      const result = await announcementApi.list({ isPublished: true });
      return result.data.filter((a) => !a.isRead).length;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Poll every 5 minutes
  });
}

export function useMarkAnnouncementRead(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementApi.markRead(id),
    onSuccess: (_data, id) => {
      // Update the detail cache to mark as read
      qc.setQueryData<Announcement>(announcementKeys.detail(id), (prev) =>
        prev ? { ...prev, isRead: true } : prev,
      );
      // Invalidate list and unread count
      qc.invalidateQueries({ queryKey: announcementKeys.lists() });
      qc.invalidateQueries({ queryKey: announcementKeys.unreadCount() });
    },
  });
}

export function useCreateAnnouncement(): UseMutationResult<
  Announcement,
  Error,
  Partial<Announcement>
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Announcement>) => announcementApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: announcementKeys.lists() });
      qc.invalidateQueries({ queryKey: announcementKeys.unreadCount() });
    },
  });
}

export function useUpdateAnnouncement(): UseMutationResult<
  Announcement,
  Error,
  { id: string; data: Partial<Announcement> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => announcementApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: announcementKeys.lists() });
      qc.setQueryData(announcementKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteAnnouncement(): UseMutationResult<unknown, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => announcementApi.delete(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: announcementKeys.lists() });
      qc.removeQueries({ queryKey: announcementKeys.detail(id) });
      qc.invalidateQueries({ queryKey: announcementKeys.unreadCount() });
    },
  });
}
