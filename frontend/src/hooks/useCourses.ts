import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { courseApi, type CourseFilters } from '../lib/api';
import type { Course, Lesson, PaginatedResponse } from '../types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (filters: CourseFilters) => [...courseKeys.lists(), filters] as const,
  details: () => [...courseKeys.all, 'detail'] as const,
  detail: (id: string) => [...courseKeys.details(), id] as const,
  lessons: (courseId: string) => [...courseKeys.detail(courseId), 'lessons'] as const,
  progress: (courseId: string) => [...courseKeys.detail(courseId), 'progress'] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useCourses(
  filters: CourseFilters = {},
): UseQueryResult<PaginatedResponse<Course>> {
  return useQuery({
    queryKey: courseKeys.list(filters),
    queryFn: () => courseApi.list(filters),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourse(id: string): UseQueryResult<Course> {
  return useQuery({
    queryKey: courseKeys.detail(id),
    queryFn: () => courseApi.get(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseLessons(courseId: string): UseQueryResult<Lesson[]> {
  return useQuery({
    queryKey: courseKeys.lessons(courseId),
    queryFn: () => courseApi.listLessons(courseId),
    enabled: Boolean(courseId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseProgress(
  courseId: string,
): UseQueryResult<{ progressPct: number; completedLessons: string[] }> {
  return useQuery({
    queryKey: courseKeys.progress(courseId),
    queryFn: () => courseApi.getProgress(courseId),
    enabled: Boolean(courseId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateCourse(): UseMutationResult<Course, Error, Partial<Course>> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Course>) => courseApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.lists() });
    },
  });
}

export function useUpdateCourse(): UseMutationResult<
  Course,
  Error,
  { id: string; data: Partial<Course> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => courseApi.update(id, data),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: courseKeys.lists() });
      qc.setQueryData(courseKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteCourse(): UseMutationResult<unknown, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => courseApi.delete(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: courseKeys.lists() });
      qc.removeQueries({ queryKey: courseKeys.detail(id) });
    },
  });
}

export function useCompleteLesson(): UseMutationResult<
  { progressPct: number },
  Error,
  { courseId: string; lessonId: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, lessonId }) =>
      courseApi.completeLesson(courseId, lessonId),
    onSuccess: (_data, { courseId }) => {
      qc.invalidateQueries({ queryKey: courseKeys.progress(courseId) });
      qc.invalidateQueries({ queryKey: courseKeys.lessons(courseId) });
      qc.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
    },
  });
}
