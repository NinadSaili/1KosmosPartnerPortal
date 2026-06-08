import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  Bell,
  Package,
  Megaphone,
  Info,
  Pin,
  Plus,
  Pencil,
  Trash2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AnnouncementFormModal } from '@/components/announcements/AnnouncementFormModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAnnouncements,
  useMarkAnnouncementRead,
  useDeleteAnnouncement,
  useUnreadCount,
} from '@/hooks/useAnnouncements';
import { announcementApi } from '@/lib/api';
import type { Announcement, AnnouncementType } from '@/types';

// ─── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  AnnouncementType,
  {
    label: string;
    icon: React.ReactElement;
    badgeVariant: 'destructive' | 'blue' | 'success' | 'secondary';
  }
> = {
  security_advisory: {
    label: 'Security Advisory',
    icon: <Bell className="h-4 w-4" />,
    badgeVariant: 'destructive',
  },
  product_update: {
    label: 'Product Update',
    icon: <Package className="h-4 w-4" />,
    badgeVariant: 'blue',
  },
  vendor_news: {
    label: 'Vendor News',
    icon: <Megaphone className="h-4 w-4" />,
    badgeVariant: 'success',
  },
  general: {
    label: 'General',
    icon: <Info className="h-4 w-4" />,
    badgeVariant: 'secondary',
  },
};

const TYPE_FILTER_TABS: { label: string; value: AnnouncementType | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Vendor News', value: 'vendor_news' },
  { label: 'Product Updates', value: 'product_update' },
  { label: 'Security Advisories', value: 'security_advisory' },
];

function stripHtml(html: string, maxChars = 150): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

// ─── Announcement Row ─────────────────────────────────────────────────────────

interface AnnouncementRowProps {
  announcement: Announcement;
  isAdmin: boolean;
  onEdit: (a: Announcement) => void;
  onDelete: (id: string) => void;
  onClick: (a: Announcement) => void;
}

function AnnouncementRow({ announcement, isAdmin, onEdit, onDelete, onClick }: AnnouncementRowProps) {
  const config = TYPE_CONFIG[announcement.type] ?? TYPE_CONFIG.general;
  const isUnread = !announcement.isRead;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <button
        className="w-full text-left flex items-start gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors group border-b border-gray-100 dark:border-gray-800 last:border-0"
        onClick={() => onClick(announcement)}
      >
        <div className="flex-shrink-0 mt-2">
          <span
            className={`block h-2 w-2 rounded-full transition-opacity ${
              isUnread ? 'bg-indigo-500' : 'opacity-0'
            }`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant={config.badgeVariant} className="flex items-center gap-1 text-xs">
              {config.icon}
              {config.label}
            </Badge>
            {announcement.isPinned && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            )}
          </div>

          <p
            className={`text-sm leading-snug mb-1 ${
              isUnread
                ? 'font-semibold text-gray-900 dark:text-white'
                : 'font-normal text-gray-700 dark:text-gray-300'
            }`}
          >
            {announcement.title}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {stripHtml(announcement.bodyHtml)}
          </p>

          <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
            {announcement.publishedAt
              ? formatDistanceToNow(parseISO(announcement.publishedAt), { addSuffix: true })
              : 'Not published'}
          </p>
        </div>

        {isAdmin && (
          <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onEdit(announcement); }}
              aria-label="Edit announcement"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600"
              onClick={(e) => { e.stopPropagation(); onDelete(announcement.id); }}
              aria-label="Delete announcement"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </button>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const { isVendorAdmin } = useAuth();
  const [typeFilter, setTypeFilter] = useState<AnnouncementType | ''>('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData ?? 0;

  const { data, isLoading } = useAnnouncements({
    page,
    pageSize: PAGE_SIZE,
    type: typeFilter || undefined,
    isPublished: isVendorAdmin ? undefined : true,
  });

  const markRead = useMarkAnnouncementRead();
  const deleteMutation = useDeleteAnnouncement();

  const allItems = data?.data ?? [];
  const pinned = allItems.filter((a) => a.isPinned);
  const regular = allItems.filter((a) => !a.isPinned);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleRowClick = (a: Announcement) => {
    if (!a.isRead) markRead.mutate(a.id);
    navigate(`/announcements/${a.id}`);
  };

  const handleEdit = (a: Announcement) => {
    setEditingAnnouncement(a);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    await deleteMutation.mutateAsync(id);
  };

  const handleMarkAllRead = () => {
    const unread = allItems.filter((a) => !a.isRead);
    Promise.all(unread.map((a) => announcementApi.markRead(a.id)));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
      <PageHeader
        title="Announcements"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'Stay up to date with the latest news'}
        actions={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark all read
              </Button>
            )}
            {isVendorAdmin && (
              <Button onClick={() => { setEditingAnnouncement(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Announcement
              </Button>
            )}
          </div>
        }
      />

      {/* Type tabs */}
      <div className="flex overflow-x-auto gap-1 mb-6 pb-1">
        {TYPE_FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setTypeFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              typeFilter === tab.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-20" />
      ) : allItems.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="No announcements"
          description="Check back later for updates."
        />
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5" />
                Pinned
              </h2>
              <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10 overflow-hidden">
                {pinned.map((a) => (
                  <AnnouncementRow
                    key={a.id}
                    announcement={a}
                    isAdmin={isVendorAdmin}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClick={handleRowClick}
                  />
                ))}
              </div>
            </div>
          )}

          {regular.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Latest
                </h2>
              )}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
                {regular.map((a) => (
                  <AnnouncementRow
                    key={a.id}
                    announcement={a}
                    isAdmin={isVendorAdmin}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onClick={handleRowClick}
                  />
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <AnnouncementFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        announcement={editingAnnouncement}
        onSuccess={() => setEditingAnnouncement(null)}
      />
    </div>
  );
}
