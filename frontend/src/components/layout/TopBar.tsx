import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Menu,
  Bell,
  Sun,
  Moon,
  User,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnreadCount } from '@/hooks/useAnnouncements';

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

const PATH_LABELS: Record<string, string> = {
  '': 'Home',
  dashboard: 'Dashboard',
  academy: 'Training Academy',
  certifications: 'Certifications',
  resources: 'Resources',
  deals: 'Deal Registration',
  announcements: 'Announcements',
  profile: 'Profile',
  onboarding: 'Onboarding',
  admin: 'Admin',
  users: 'Users',
  courses: 'Courses',
  settings: 'Settings',
  new: 'New',
};

function useBreadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return [{ label: 'Dashboard', href: '/dashboard' }];

  return segments.map((seg, i) => {
    const href = '/' + segments.slice(0, i + 1).join('/');
    // If it looks like a UUID/id, label as "Detail"
    const isId = /^[0-9a-f-]{8,}$/i.test(seg);
    const label = isId ? 'Detail' : (PATH_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1));
    return { label, href };
  });
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

interface TopBarProps {
  onMenuClick: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { data: unreadCount = 0 } = useUnreadCount();
  const breadcrumbs = useBreadcrumbs();

  return (
    <header className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMenuClick}
          className="lg:hidden flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.href}>
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
              )}
              {i === breadcrumbs.length - 1 ? (
                <span className="font-semibold text-gray-900 dark:text-white truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Mobile: just show current page title */}
        <span className="sm:hidden font-semibold text-gray-900 dark:text-white truncate">
          {breadcrumbs[breadcrumbs.length - 1]?.label}
        </span>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>

        {/* Notifications bell */}
        <Link
          to="/announcements"
          className="relative p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label={`Announcements${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* User dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="User menu"
            >
              {/* Avatar */}
              <div className="h-7 w-7 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                    {user?.fullName?.charAt(0).toUpperCase() ?? 'U'}
                  </span>
                )}
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
                {user?.fullName ?? 'Account'}
              </span>
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className={cn(
                'z-50 min-w-[180px] rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg py-1',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              )}
            >
              {/* User info header */}
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.fullName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>

              <DropdownMenu.Item asChild>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer outline-none rounded-md mx-1 transition-colors"
                >
                  <User className="h-4 w-4 text-gray-400" />
                  Profile
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60 cursor-pointer outline-none rounded-md mx-1 transition-colors"
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  Settings
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-700 mx-2" />

              <DropdownMenu.Item
                onSelect={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer outline-none rounded-md mx-1 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}

export default TopBar;
