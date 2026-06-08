import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Bell,
  Package,
  Megaphone,
  Info,
  Pin,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnnouncementFormModal } from '@/components/announcements/AnnouncementFormModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  useAnnouncement,
  useMarkAnnouncementRead,
  useDeleteAnnouncement,
  useAnnouncements,
} from '@/hooks/useAnnouncements';
import type { AnnouncementType } from '@/types';

// ─── Type config ───────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  AnnouncementType,
  { label: string; icon: React.ReactElement; badgeVariant: 'destructive' | 'blue' | 'success' | 'secondary' }
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

// ─── Simple HTML sanitizer ─────────────────────────────────────────────────────

/**
 * Basic allow-list sanitization: strips <script>, <iframe>, on* attributes,
 * javascript: hrefs. For production, use DOMPurify or rehype-sanitize.
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, 'void:');
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isVendorAdmin } = useAuth();
  const { data: announcement, isLoading, isError } = useAnnouncement(id!);
  const markRead = useMarkAnnouncementRead();
  const deleteMutation = useDeleteAnnouncement();
  const [formOpen, setFormOpen] = useState(false);

  // Fetch neighbor announcements for prev/next navigation
  const { data: listData } = useAnnouncements({ pageSize: 100, isPublished: true });
  const allAnnouncements = listData?.data ?? [];
  const currentIndex = allAnnouncements.findIndex((a) => a.id === id);
  const prevAnnouncement = currentIndex > 0 ? allAnnouncements[currentIndex - 1] : null;
  const nextAnnouncement =
    currentIndex >= 0 && currentIndex < allAnnouncements.length - 1
      ? allAnnouncements[currentIndex + 1]
      : null;

  // Mark as read on mount
  useEffect(() => {
    if (announcement && !announcement.isRead) {
      markRead.mutate(announcement.id);
    }
  }, [announcement?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    await deleteMutation.mutateAsync(id!);
    navigate('/announcements');
  };

  if (isLoading) {
    return <LoadingSpinner className="py-40" />;
  }

  if (isError || !announcement) {
    return (
      <EmptyState
        title="Announcement not found"
        description="This announcement may have been removed."
        action={<Button onClick={() => navigate('/announcements')}>Back to Announcements</Button>}
      />
    );
  }

  const config = TYPE_CONFIG[announcement.type] ?? TYPE_CONFIG.general;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-3xl mx-auto">
      {/* Back */}
      <Link
        to="/announcements"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Announcements
      </Link>

      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant={config.badgeVariant} className="flex items-center gap-1">
              {config.icon}
              {config.label}
            </Badge>
            {announcement.isPinned && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <Pin className="h-3 w-3" />
                Pinned
              </span>
            )}
            {!announcement.isPublished && (
              <Badge variant="secondary">Draft</Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-3">
            {announcement.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            {announcement.publishedAt && (
              <time dateTime={announcement.publishedAt}>
                {format(parseISO(announcement.publishedAt), 'MMMM d, yyyy')}
              </time>
            )}
            {announcement.createdBy && (
              <>
                <span>&bull;</span>
                <span>By {announcement.createdBy}</span>
              </>
            )}
          </div>

          {/* Admin actions */}
          {isVendorAdmin && (
            <div className="flex items-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFormOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <div
            className="prose prose-sm sm:prose dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(announcement.bodyHtml) }}
          />
        </div>

        {/* Navigation */}
        <div className="px-8 py-5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4">
          {prevAnnouncement ? (
            <button
              onClick={() => navigate(`/announcements/${prevAnnouncement.id}`)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors max-w-[45%] text-left"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{prevAnnouncement.title}</span>
            </button>
          ) : (
            <div />
          )}

          {nextAnnouncement ? (
            <button
              onClick={() => navigate(`/announcements/${nextAnnouncement.id}`)}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors max-w-[45%] text-right ml-auto"
            >
              <span className="line-clamp-1">{nextAnnouncement.title}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          ) : (
            <div />
          )}
        </div>
      </motion.article>

      {/* Edit modal */}
      <AnnouncementFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        announcement={announcement}
      />
    </div>
  );
}
