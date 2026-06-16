import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type {
  AuthTokens,
  AuthUser,
  Course,
  Lesson,
  Certification,
  AssessmentSchedule,
  IssuedCertificate,
  Resource,
  Deal,
  DealDocument,
  DealStatusHistory,
  Announcement,
  DashboardStats,
  OnboardingChecklist,
  PaginatedResponse,
  User,
  AIQueryRequest,
} from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
const ACCESS_TOKEN_KEY = 'pp_access_token';
const REFRESH_TOKEN_KEY = 'pp_refresh_token';

// ─── Key transform utilities ──────────────────────────────────────────────────

function snakeToCamelKey(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function camelToSnakeKey(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function camelizeKeys(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(camelizeKeys);
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [
        snakeToCamelKey(k),
        camelizeKeys(v),
      ]),
    );
  }
  return data;
}

function decamelizeKeys(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(decamelizeKeys);
  if (data !== null && typeof data === 'object' && !(data instanceof FormData)) {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([k, v]) => [
        camelToSnakeKey(k),
        decamelizeKeys(v),
      ]),
    );
  }
  return data;
}

// ─── Axios Instance ───────────────────────────────────────────────────────────

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Track whether a refresh is already in-flight
let refreshPromise: Promise<string> | null = null;

// ─── Request Interceptor ──────────────────────────────────────────────────────
// Attaches JWT and converts camelCase body keys and query param keys to snake_case.

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data && !(config.data instanceof FormData)) {
      config.data = decamelizeKeys(config.data);
    }
    if (config.params) {
      config.params = decamelizeKeys(config.params);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptors ────────────────────────────────────────────────────
// 1. Camelize all response keys so TypeScript camelCase types are satisfied.
// 2. Retry 401 errors with a fresh access token.

axiosInstance.interceptors.response.use(
  (response) => {
    response.data = camelizeKeys(response.data);
    return response;
  },
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post<{ access_token: string; refresh_token: string }>(
              `${BASE_URL}/auth/refresh`,
              { refresh_token: refreshToken },
            )
            .then((res) => {
              const newToken = res.data.access_token;
              localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
              localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refresh_token);
              refreshPromise = null;
              return newToken;
            })
            .catch((err) => {
              refreshPromise = null;
              clearAuthAndRedirect();
              throw err;
            });
        }

        const newToken = await refreshPromise;
        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        } else {
          originalRequest.headers = { Authorization: `Bearer ${newToken}` };
        }
        return axiosInstance(originalRequest);
      } catch {
        clearAuthAndRedirect();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

function clearAuthAndRedirect(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.location.href = '/login';
}

// ─── Auth API ─────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  organizationName?: string;
  inviteToken?: string;
}

// Shape after camelization by the response interceptor
interface LoginResponseCamel {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<{ tokens: AuthTokens; user: AuthUser }> => {
    // Body is decamelized by request interceptor (email/password have no uppercase, unchanged).
    const raw = await axiosInstance
      .post<LoginResponseCamel>('/auth/login', data)
      .then((r) => r.data);
    return {
      tokens: { accessToken: raw.accessToken, refreshToken: raw.refreshToken },
      user: raw.user,
    };
  },

  register: async (data: RegisterRequest): Promise<void> => {
    // Account is created; Supabase sends a verification email.
    // The user must confirm their email before they can log in.
    await axiosInstance.post('/auth/register', {
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      organizationName: data.organizationName,
    });
  },
  magicLink: (email: string) =>
    axiosInstance.post<{ message: string }>('/auth/magic-link', { email }).then((r) => r.data),

  refresh: async (refreshToken: string): Promise<AuthTokens> => {
    // Use raw axios to avoid the camelizeKeys interceptor (we read raw snake_case).
    const raw = await axios
      .post<{ access_token: string; refresh_token: string }>(
        `${BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
      )
      .then((r) => r.data);
    return { accessToken: raw.access_token, refreshToken: raw.refresh_token };
  },

  getProfile: (userId: string) =>
    axiosInstance.get<User>(`/users/${userId}`).then((r) => r.data),

  updateProfile: (userId: string, data: Partial<User>) =>
    axiosInstance.put<User>(`/users/${userId}`, data).then((r) => r.data),

  updatePassword: (userId: string, password: string) =>
    axiosInstance.put<{ message: string }>(`/users/${userId}/password`, { password }).then((r) => r.data),

  listUsers: (params?: { page?: number; pageSize?: number; orgId?: string }) =>
    axiosInstance.get<PaginatedResponse<User>>('/users', { params }).then((r) => r.data),
};

// ─── Course API ───────────────────────────────────────────────────────────────

export interface CourseFilters {
  page?: number;
  pageSize?: number;
  level?: string;
  tag?: string;
  search?: string;
  isPublished?: boolean;
}

export const courseApi = {
  list: (params?: CourseFilters) =>
    axiosInstance.get<PaginatedResponse<Course>>('/courses', { params }).then((r) => r.data),

  get: (id: string) =>
    axiosInstance.get<Course>(`/courses/${id}`).then((r) => r.data),

  create: (data: Partial<Course>) =>
    axiosInstance.post<Course>('/courses', data).then((r) => r.data),

  update: (id: string, data: Partial<Course>) =>
    axiosInstance.patch<Course>(`/courses/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    axiosInstance.delete(`/courses/${id}`).then((r) => r.data),

  listLessons: (courseId: string) =>
    axiosInstance.get<Lesson[]>(`/courses/${courseId}/lessons`).then((r) => r.data),

  createLesson: (courseId: string, data: Partial<Lesson>) =>
    axiosInstance.post<Lesson>(`/courses/${courseId}/lessons`, data).then((r) => r.data),

  // Body { lessonId } → decamelized → { lesson_id } as backend expects.
  completeLesson: (courseId: string, lessonId: string) =>
    axiosInstance
      .post<{ progressPct: number }>(`/courses/${courseId}/progress/complete-lesson`, { lessonId })
      .then((r) => r.data),

  getProgress: (courseId: string, userId: string) =>
    axiosInstance
      .get<{ progressPct: number; completedLessons: string[] }>(
        `/courses/${courseId}/progress/${userId}`,
      )
      .then((r) => r.data),
};

// ─── Certification API ────────────────────────────────────────────────────────

export const certApi = {
  listCertifications: (params?: { page?: number; pageSize?: number; type?: string }) =>
    axiosInstance.get<PaginatedResponse<Certification>>('/certifications', { params }).then((r) => r.data),

  getCertification: (id: string) =>
    axiosInstance.get<Certification>(`/certifications/${id}`).then((r) => r.data),

  scheduleAssessment: (data: Partial<AssessmentSchedule>) =>
    axiosInstance.post<AssessmentSchedule>('/assessments', data).then((r) => r.data),

  updateAssessment: (id: string, data: Partial<AssessmentSchedule>) =>
    axiosInstance.put<AssessmentSchedule>(`/assessments/${id}`, data).then((r) => r.data),

  listCertificates: (params?: { userId?: string; page?: number; pageSize?: number }) =>
    axiosInstance.get<PaginatedResponse<IssuedCertificate>>('/certificates', { params }).then((r) => r.data),

  getCertificate: (id: string) =>
    axiosInstance.get<IssuedCertificate>(`/certificates/${id}`).then((r) => r.data),
};

// ─── Resource API ─────────────────────────────────────────────────────────────

export interface ResourceFilters {
  page?: number;
  pageSize?: number;
  type?: string;
  language?: string;
  tag?: string;
  search?: string;
  isPublished?: boolean;
}

export const resourceApi = {
  list: (params?: ResourceFilters) =>
    axiosInstance.get<PaginatedResponse<Resource>>('/resources', { params }).then((r) => r.data),

  get: (id: string) =>
    axiosInstance.get<Resource>(`/resources/${id}`).then((r) => r.data),

  create: (data: FormData) =>
    axiosInstance.post<Resource>('/resources', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data),

  update: (id: string, data: Partial<Resource>) =>
    axiosInstance.patch<Resource>(`/resources/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    axiosInstance.delete(`/resources/${id}`).then((r) => r.data),

  download: (id: string) =>
    axiosInstance.get<Blob>(`/resources/${id}/download`, { responseType: 'blob' }).then((r) => r.data),
};

// ─── Deal API ─────────────────────────────────────────────────────────────────

export interface DealFilters {
  page?: number;
  pageSize?: number;
  status?: string;
  organizationId?: string;
  search?: string;
}

export const dealApi = {
  list: (params?: DealFilters) =>
    axiosInstance.get<PaginatedResponse<Deal>>('/deals', { params }).then((r) => r.data),

  get: (id: string) =>
    axiosInstance.get<Deal & { documents: DealDocument[]; statusHistory: DealStatusHistory[] }>(`/deals/${id}`).then((r) => r.data),

  create: (data: Partial<Deal>) =>
    axiosInstance.post<Deal>('/deals', data).then((r) => r.data),

  update: (id: string, data: Partial<Deal>) =>
    axiosInstance.patch<Deal>(`/deals/${id}`, data).then((r) => r.data),

  // PATCH /deals/{id}/status (was incorrectly POST)
  updateStatus: (id: string, status: string, comment?: string) =>
    axiosInstance.patch<Deal>(`/deals/${id}/status`, { status, comment }).then((r) => r.data),
};

// ─── Announcement API ─────────────────────────────────────────────────────────

export interface AnnouncementFilters {
  page?: number;
  pageSize?: number;
  category?: string;
  isPublished?: boolean;
}

export const announcementApi = {
  list: (params?: AnnouncementFilters) =>
    axiosInstance.get<PaginatedResponse<Announcement>>('/announcements', { params }).then((r) => r.data),

  get: (id: string) =>
    axiosInstance.get<Announcement>(`/announcements/${id}`).then((r) => r.data),

  create: (data: Partial<Announcement>) =>
    axiosInstance.post<Announcement>('/announcements', data).then((r) => r.data),

  // PUT (not PATCH) to match backend router
  update: (id: string, data: Partial<Announcement>) =>
    axiosInstance.put<Announcement>(`/announcements/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    axiosInstance.delete(`/announcements/${id}`).then((r) => r.data),

  markRead: (id: string) =>
    axiosInstance.post<void>(`/announcements/${id}/read`).then((r) => r.data),
};

// ─── Dashboard API ────────────────────────────────────────────────────────────

export interface TeamProgressEntry {
  userId: string;
  fullName: string;
  email: string;
  completedLessons: number;
  totalLessons: number;
  lastActivityAt: string | null;
}

export const dashboardApi = {
  getStats: () =>
    axiosInstance.get<DashboardStats>('/dashboard/stats').then((r) => r.data),

  getTeamProgress: (params?: { pageSize?: number }) =>
    axiosInstance.get<{ orgId: string; data: TeamProgressEntry[] }>('/dashboard/team-progress', { params }).then((r) => r.data),
};

// ─── AI API ───────────────────────────────────────────────────────────────────

export const aiApi = {
  query: (data: AIQueryRequest): EventSource => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const params = new URLSearchParams({
      intent: data.intent,
      query: data.query,
      ...(data.context ? { context: JSON.stringify(data.context) } : {}),
      ...(token ? { token } : {}),
    });
    return new EventSource(`${BASE_URL}/ai/query?${params.toString()}`);
  },
};

// ─── Organization API ─────────────────────────────────────────────────────────

export const organizationApi = {
  get: (id: string) =>
    axiosInstance.get<import('../types').Organization>(`/organizations/${id}`).then((r) => r.data),
};

// ─── Onboarding API ───────────────────────────────────────────────────────────

export const onboardingApi = {
  get: (organizationId: string) =>
    axiosInstance.get<OnboardingChecklist>(`/onboarding/${organizationId}`).then((r) => r.data),

  // PUT (not PATCH) to match backend router; keys decamelized by request interceptor
  update: (organizationId: string, data: Partial<OnboardingChecklist>) =>
    axiosInstance.put<OnboardingChecklist>(`/onboarding/${organizationId}`, data).then((r) => r.data),
};
