import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// ─── PrivateRoute ─────────────────────────────────────────────────────────────

/**
 * Wraps protected routes.
 * - If auth is still loading, shows a full-page spinner.
 * - If not authenticated, redirects to /login (preserving current path as `from` state).
 * - If authenticated but profile not completed, redirects to /onboarding
 *   (unless the user is already on /onboarding or /profile).
 */
export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" label="Loading your session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If the user hasn't completed their profile, redirect to onboarding
  // (but not in a redirect loop — skip if already on /onboarding or /profile)
  const isOnboardingOrProfile =
    location.pathname === '/onboarding' || location.pathname.startsWith('/profile');

  if (!user.profileCompleted && !isOnboardingOrProfile) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

// ─── AdminRoute ───────────────────────────────────────────────────────────────

/**
 * Extends PrivateRoute with vendor_admin role check.
 * Non-admin users are redirected to /dashboard.
 */
export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isVendorAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
        <LoadingSpinner size="lg" label="Verifying permissions…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isVendorAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default PrivateRoute;
