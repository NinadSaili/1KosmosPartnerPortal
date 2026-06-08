import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useResources, useDeleteResource, useCreateResource } from '@/hooks/useResources';
import { useToast } from '@/components/ui/Toast';
import type { Resource } from '@/types';

export default function AdminResourcesPage() {
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { data, isLoading } = useResources({ page, pageSize: 20 });
  const deleteResource = useDeleteResource();
  const createResource = useCreateResource();
  const { success, error: showError } = useToast();

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await deleteResource.mutateAsync(id);
      success('Resource deleted');
    } catch {
      showError('Delete failed', 'Unable to delete this resource.');
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Resource',
      cell: (row: Resource) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.title}</p>
          <p className="text-xs text-gray-500">{row.language} · v{row.version}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row: Resource) => <Badge variant="secondary" className="capitalize">{row.type.replace('_', ' ')}</Badge>,
    },
    {
      key: 'isPublished',
      header: 'Status',
      cell: (row: Resource) => <StatusBadge status={row.isPublished ? 'published' : 'unpublished'} />,
    },
    {
      key: 'createdAt',
      header: 'Added',
      cell: (row: Resource) => format(parseISO(row.createdAt), 'MMM d, yyyy'),
    },
    {
      key: 'actions',
      header: '',
      cell: (row: Resource) => (
        <Button variant="destructive" size="sm" onClick={() => handleDelete(row.id, row.title)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manage Resources"
        subtitle="Upload and manage partner resources."
        actions={<Button onClick={() => setUploadOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Upload Resource</Button>}
      />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage="No resources found."
        pagination={data ? { page, pageSize: 20, total: data.total, onPageChange: setPage } : undefined}
      />
      <Modal open={uploadOpen} onOpenChange={setUploadOpen} title="Upload Resource">
        <p className="text-sm text-gray-500 dark:text-gray-400">Upload form coming soon.</p>
        <div className="flex justify-end mt-4"><Button variant="outline" onClick={() => setUploadOpen(false)}>Close</Button></div>
      </Modal>
    </div>
  );
}
