import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  Award,
  FileText,
  Handshake,
  Megaphone,
  Shield,
  Users,
  BookOpen,
  FolderOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadCount } from '@/hooks/useAnnouncements';
import { Badge } from '@/components/ui/Badge';

// ─── Nav config (same structure as Sidebar) ───────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  badge?: number;
  children?: NavItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Training Academy', href: '/academy', icon: GraduationCap },
  { label: 'Certifications', href: '/certifications', icon: Award },
  { label: 'Resources', href: '/resources', icon: FileText },
  { label: 'Deal Registration', href: '/deals', icon: Handshake },
  { label: 'Announcements', href: '/announcements', icon: Megaphone },
  {
    label: 'Admin Panel',
    href: '/admin',
    icon: Shield,
    adminOnly: true,
    children: [
      { label: 'Users', href: '/admin/users', icon: Users },
      { label: 'Courses', href: '/admin/courses', icon: BookOpen },
      { label: 'Resources', href: '/admin/resources', icon: FolderOpen },
      { label: 'Announcements', href: '/admin/announcements', icon: Megaphone },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  vendor_admin: 'Vendor Admin',
  partner_admin: 'Partner Admin',
  partner_user: 'Partner User',
};

// ─── MobileNavItem ────────────────────────────────────────────────────────────

function MobileNavItem({
  item,
  onClose,
  depth = 0,
}: {
  item: NavItem;
  onClose: () => void;
  depth?: number;
}) {
  const location = useLocation();
  const [open, setOpen] = useState(
    () => item.children?.some((c) => location.pathname.startsWith(c.href)) ?? false,
  );

  const isActive = item.children
    ? location.pathname.startsWith(item.href)
    : location.pathname === item.href ||
      (item.href !== '/dashboard' && location.pathname.startsWith(item.href));

  const Icon = item.icon;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
          )}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden ml-4 border-l border-gray-200 dark:border-gray-700 pl-3 mt-0.5 space-y-0.5"
            >
              {item.children.map((child) => (
                <MobileNavItem
                  key={child.href}
                  item={child}
                  onClose={onClose}
                  depth={depth + 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <NavLink
      to={item.href}
      end={item.href === '/dashboard'}
      onClick={onClose}
      className={({ isActive: navActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          navActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
          depth > 0 && 'py-2 text-xs',
        )
      }
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
          {item.badge > 99 ? '99+' : item.badge}
        </Badge>
      )}
    </NavLink>
  );
}

// ─── MobileSidebar ────────────────────────────────────────────────────────────

export function MobileSidebar({ onClose }: { onClose: () => void }) {
  const { user, isVendorAdmin, logout } = useAuth();
  const { data: unreadCount = 0 } = useUnreadCount();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isVendorAdmin,
  ).map((item) =>
    item.href === '/announcements' ? { ...item, badge: unreadCount } : item,
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
        {visibleItems.map((item) => (
          <MobileNavItem key={item.href} item={item} onClose={onClose} />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        {user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="h-9 w-9 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center overflow-hidden flex-shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user.fullName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
            <NavLink
              to="/profile"
              onClick={onClose}
              className="p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <Settings className="h-4 w-4" />
            </NavLink>
          </div>
        )}

        <button
          onClick={() => { logout(); onClose(); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default MobileSidebar;
