import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from '@/hooks/useAnnouncements';
import { useToast } from '@/components/ui/Toast';
import type { Announcement } from '@/types';

export default function AdminAnnouncementsPage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const { data, isLoading } = useAnnouncements({ page, pageSize: 20 });
  const createAnn = useCreateAnnouncement();
  const deleteAnn = useDeleteAnnouncement();
  const { success, error: showError } = useToast();

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createAnn.mutateAsync({ title: newTitle, bodyHtml: newBody, type: 'general', isPinned: false, isPublished: false, createdBy: '' });
      success('Announcement created', `"${newTitle}" saved as draft.`);
      setCreateOpen(false);
      setNewTitle('');
      setNewBody('');
    } catch {
      showError('Create failed', 'Could not create announcement.');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteAnn.mutateAsync(id);
      success('Announcement deleted');
    } catch {
      showError('Delete failed', 'Unable to delete this announcement.');
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Title',
      cell: (row: Announcement) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.title}</p>
          {row.isPinned && <span className="text-xs text-brand-600 dark:text-brand-400">Pinned</span>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row: Announcement) => <StatusBadge status={row.type} />,
    },
    {
      key: 'isPublished',
      header: 'Status',
      cell: (row: Announcement) => <StatusBadge status={row.isPublished ? 'published' : 'unpublished'} />,
    },
    {
      key: 'publishedAt',
      header: 'Published',
      cell: (row: Announcement) => row.publishedAt
        ? format(parseISO(row.publishedAt), 'MMM d, yyyy')
        : <span className="text-gray-400">-</span>,
    },
    {
      key: 'actions',
      header: '',
      cell: (row: Announcement) => (
        <Button variant="destructive" size="sm" onClick={() => handleDelete(row.id, row.title)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Announcements"
        subtitle="Create and publish partner announcements."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New Announcement</Button>}
      />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage="No announcements found."
        pagination={data ? { page, pageSize: 20, total: data.total, onPageChange: setPage } : undefined}
      />

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="New Announcement" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Announcement title..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Body (HTML)</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={6}
              placeholder="<p>Announcement content...</p>"
              className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white resize-none font-mono text-xs"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createAnn.isPending}>
              {createAnn.isPending ? 'Creating...' : 'Save as Draft'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
