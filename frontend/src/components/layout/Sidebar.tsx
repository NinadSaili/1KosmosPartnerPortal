import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadCount } from '@/hooks/useAnnouncements';
import { Badge } from '@/components/ui/Badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  badge?: number;
  children?: NavItem[];
}

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}

// ─── Nav config ───────────────────────────────────────────────────────────────

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

// ─── NavItem component ────────────────────────────────────────────────────────

function NavItemComponent({
  item,
  collapsed,
  depth = 0,
}: {
  item: NavItem;
  collapsed: boolean;
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
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
          )}
          aria-expanded={open}
        >
          <Icon className="h-5 w-5 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </>
          )}
        </button>

        <AnimatePresence initial={false}>
          {open && !collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="ml-4 mt-1 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
                {item.children.map((child) => (
                  <NavItemComponent
                    key={child.href}
                    item={child}
                    collapsed={collapsed}
                    depth={depth + 1}
                  />
                ))}
              </div>
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
      className={({ isActive: navActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative',
          navActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
          depth > 0 && 'py-2 text-xs',
        )
      }
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && (
        <span className="flex-1 truncate">{item.label}</span>
      )}
      {!collapsed && item.badge != null && item.badge > 0 && (
        <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1.5 text-xs">
          {item.badge > 99 ? '99+' : item.badge}
        </Badge>
      )}
      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-3 px-2 py-1 rounded-md bg-gray-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
          {item.label}
        </div>
      )}
    </NavLink>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  vendor_admin: 'Vendor Admin',
  partner_admin: 'Partner Admin',
  partner_user: 'Partner User',
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onCollapsedChange }: SidebarProps) {
  const { user, isVendorAdmin, logout } = useAuth();
  const { data: unreadCount } = useUnreadCount();

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isVendorAdmin).map(
    (item) =>
      item.href === '/announcements'
        ? { ...item, badge: unreadCount ?? 0 }
        : item,
  );

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="hidden lg:flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-700 min-h-[65px]">
        <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-brand-600 shadow-sm">
          <span className="text-white text-sm font-extrabold tracking-tight">1K</span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col min-w-0"
            >
              <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
                1Kosmos
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                Partner Portal
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapse toggle */}
        <button
          onClick={() => onCollapsedChange(!collapsed)}
          className={cn(
            'flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ml-auto',
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin">
        {visibleItems.map((item) => (
          <NavItemComponent
            key={item.href}
            item={item}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3">
        {user && (
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg p-2',
              !collapsed && 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-default',
            )}
          >
            {/* Avatar */}
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            <AnimatePresence>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {!collapsed && (
              <NavLink
                to="/profile"
                className="flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Profile settings"
              >
                <Settings className="h-4 w-4" />
              </NavLink>
            )}
          </div>
        )}

        {/* Logout button */}
        {!collapsed && (
          <button
            onClick={logout}
            className="mt-1 w-full text-left text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded transition-colors"
          >
            Sign out
          </button>
        )}
      </div>
    </motion.aside>
  );
}

export default Sidebar;
