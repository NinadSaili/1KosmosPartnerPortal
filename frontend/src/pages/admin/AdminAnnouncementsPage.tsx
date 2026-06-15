import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Select } from '@/components/ui/Select';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { AnnouncementFormModal } from '@/components/announcements/AnnouncementFormModal';
import { useToast } from '@/components/ui/Toast';
import {
  useAnnouncements,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
} from '@/hooks/useAnnouncements';
import type { Announcement } from '@/types';
import type { AnnouncementType } from '@/types';

// ─── Type badge helper ─────────────────────────────────────────────────────────

const TYPE_VARIANT: Record<AnnouncementType, 'destructive' | 'blue' | 'success' | 'secondary'> = {
  security_advisory: 'destructive',
  product_update: 'blue',
  vendor_news: 'success',
  general: 'secondary',
};

const TYPE_LABELS: Record<AnnouncementType, string> = {
  security_advisory: 'Security Advisory',
  product_update: 'Product Update',
  vendor_news: 'Vendor News',
  general: 'General',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TYPE_FILTER_OPTIONS: { value: AnnouncementType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'vendor_news', label: 'Vendor News' },
  { value: 'product_update', label: 'Product Update' },
  { value: 'security_advisory', label: 'Security Advisory' },
  { value: 'general', label: 'General' },
];

const PAGE_SIZE = 20;

export default function AdminAnnouncementsPage() {
  const { success, error: showError } = useToast();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<AnnouncementType | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);

  const { data, isLoading } = useAnnouncements({
    page,
    pageSize: PAGE_SIZE,
    category: typeFilter || undefined,
  });

  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();

  const handleTogglePublish = async (announcement: Announcement) => {
    try {
      const isCurrentlyPublished = announcement.publishedAt !== null;
      await updateMutation.mutateAsync({
        id: announcement.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { publishedAt: isCurrentlyPublished ? '' : new Date().toISOString() } as any,
      });
      success(
        isCurrentlyPublished ? 'Unpublished' : 'Published',
        `"${announcement.title}" is now ${isCurrentlyPublished ? 'a draft' : 'live'}.`,
      );
    } catch {
      showError('Failed to update announcement');
    }
  };

  const handleDelete = async (announcement: Announcement) => {
    if (!confirm(`Delete "${announcement.title}"? This cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(announcement.id);
      success('Deleted', 'Announcement has been deleted.');
    } catch {
      showError('Failed to delete announcement');
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormOpen(true);
  };

  const announcements = data?.data ?? [];
  const total = data?.total ?? 0;

  const columns: DataTableColumn<Announcement>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-xs mb-0.5">
            {row.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {row.body.replace(/<[^>]*>/g, ' ').trim().slice(0, 80)}…
          </p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Type',
      cell: (row) => (
        <Badge variant={TYPE_VARIANT[row.category as AnnouncementType] ?? 'secondary'}>
          {TYPE_LABELS[row.category as AnnouncementType] ?? row.category}
        </Badge>
      ),
    },
    {
      key: 'publishedAt',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.publishedAt !== null ? 'published' : 'unpublished'} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
      cell: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {row.publishedAt ? format(parseISO(row.publishedAt), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'views',
      header: 'Views',
      cell: () => (
        <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${row.publishedAt !== null ? 'text-yellow-600' : 'text-green-600'}`}
            onClick={() => handleTogglePublish(row)}
            title={row.publishedAt !== null ? 'Unpublish' : 'Publish'}
          >
            {row.publishedAt !== null ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleEdit(row)}
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-red-500 hover:text-red-600"
            onClick={() => handleDelete(row)}
            aria-label="Delete"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Manage Announcements"
        subtitle={`${total} announcement${total !== 1 ? 's' : ''} total`}
        actions={
          <Button onClick={() => { setEditingAnnouncement(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <Select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as AnnouncementType | ''); setPage(1); }}
          className="w-48"
        >
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
      </div>

      <DataTable<Announcement>
        columns={columns}
        data={announcements}
        isLoading={isLoading}
        emptyMessage="No announcements found"
        emptyDescription="Create your first announcement."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
      />

      <AnnouncementFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        announcement={editingAnnouncement}
        onSuccess={() => setEditingAnnouncement(null)}
      />
    </div>
  );
}
