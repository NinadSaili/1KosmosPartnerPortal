import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PrivateRoute, AdminRoute } from '@/components/PrivateRoute';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// ─── Lazy page imports ────────────────────────────────────────────────────────

// Public
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const MagicLinkPage = lazy(() => import('@/pages/MagicLinkPage'));

// Protected
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const AcademyPage = lazy(() => import('@/pages/AcademyPage'));
const CourseDetailPage = lazy(() => import('@/pages/CourseDetailPage'));
const CertificationsPage = lazy(() => import('@/pages/CertificationsPage'));
const CertificationDetailPage = lazy(() => import('@/pages/CertificationDetailPage'));
const ResourcesPage = lazy(() => import('@/pages/ResourcesPage'));
const ResourceDetailPage = lazy(() => import('@/pages/ResourceDetailPage'));
const DealsPage = lazy(() => import('@/pages/DealsPage'));
const NewDealPage = lazy(() => import('@/pages/NewDealPage'));
const DealDetailPage = lazy(() => import('@/pages/DealDetailPage'));
const AnnouncementsPage = lazy(() => import('@/pages/AnnouncementsPage'));
const AnnouncementDetailPage = lazy(() => import('@/pages/AnnouncementDetailPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'));

// Admin
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'));
const AdminCoursesPage = lazy(() => import('@/pages/admin/AdminCoursesPage'));
const AdminResourcesPage = lazy(() => import('@/pages/admin/AdminResourcesPage'));
const AdminAnnouncementsPage = lazy(() => import('@/pages/admin/AdminAnnouncementsPage'));

// Not found
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// ─── Suspense wrapper ─────────────────────────────────────────────────────────

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SuspenseWrapper>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/magic-link" element={<MagicLinkPage />} />

        {/* Protected routes — wrapped in AppLayout */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          {/* Root redirect */}
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard */}
          <Route path="dashboard" element={<SuspenseWrapper><DashboardPage /></SuspenseWrapper>} />

          {/* Academy */}
          <Route path="academy" element={<SuspenseWrapper><AcademyPage /></SuspenseWrapper>} />
          <Route path="academy/:courseId" element={<SuspenseWrapper><CourseDetailPage /></SuspenseWrapper>} />

          {/* Certifications */}
          <Route path="certifications" element={<SuspenseWrapper><CertificationsPage /></SuspenseWrapper>} />
          <Route path="certifications/:certId" element={<SuspenseWrapper><CertificationDetailPage /></SuspenseWrapper>} />

          {/* Resources */}
          <Route path="resources" element={<SuspenseWrapper><ResourcesPage /></SuspenseWrapper>} />
          <Route path="resources/:resourceId" element={<SuspenseWrapper><ResourceDetailPage /></SuspenseWrapper>} />

          {/* Deals */}
          <Route path="deals" element={<SuspenseWrapper><DealsPage /></SuspenseWrapper>} />
          <Route path="deals/new" element={<SuspenseWrapper><NewDealPage /></SuspenseWrapper>} />
          <Route path="deals/:dealId" element={<SuspenseWrapper><DealDetailPage /></SuspenseWrapper>} />

          {/* Announcements */}
          <Route path="announcements" element={<SuspenseWrapper><AnnouncementsPage /></SuspenseWrapper>} />
          <Route path="announcements/:id" element={<SuspenseWrapper><AnnouncementDetailPage /></SuspenseWrapper>} />

          {/* Profile & Onboarding */}
          <Route path="profile" element={<SuspenseWrapper><ProfilePage /></SuspenseWrapper>} />
          <Route path="onboarding" element={<SuspenseWrapper><OnboardingPage /></SuspenseWrapper>} />

          {/* Admin routes */}
          <Route
            path="admin/users"
            element={
              <AdminRoute>
                <SuspenseWrapper><AdminUsersPage /></SuspenseWrapper>
              </AdminRoute>
            }
          />
          <Route
            path="admin/courses"
            element={
              <AdminRoute>
                <SuspenseWrapper><AdminCoursesPage /></SuspenseWrapper>
              </AdminRoute>
            }
          />
          <Route
            path="admin/resources"
            element={
              <AdminRoute>
                <SuspenseWrapper><AdminResourcesPage /></SuspenseWrapper>
              </AdminRoute>
            }
          />
          <Route
            path="admin/announcements"
            element={
              <AdminRoute>
                <SuspenseWrapper><AdminAnnouncementsPage /></SuspenseWrapper>
              </AdminRoute>
            }
          />
        </Route>

        {/* 404 */}
        <Route path="*" element={<SuspenseWrapper><NotFoundPage /></SuspenseWrapper>} />
      </Routes>
    </SuspenseWrapper>
  );
}
