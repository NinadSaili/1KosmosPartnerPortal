import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

const ROLE_LABELS: Record<string, string> = {
  vendor_admin: 'Vendor Admin',
  partner_admin: 'Partner Admin',
  partner_user: 'Partner User',
};

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => authApi.listUsers({ page, pageSize: 20 }),
    staleTime: 2 * 60 * 1000,
  });

  const columns = [
    {
      key: 'fullName',
      header: 'User',
      cell: (row: User) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center flex-shrink-0">
            {row.avatarUrl
              ? <img src={row.avatarUrl} alt={row.fullName} className="h-full w-full rounded-full object-cover" />
              : <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">{row.fullName.charAt(0)}</span>
            }
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.fullName}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      cell: (row: User) => <Badge variant="secondary">{ROLE_LABELS[row.role] ?? row.role}</Badge>,
    },
    {
      key: 'isActive',
      header: 'Status',
      cell: (row: User) => <StatusBadge status={row.isActive ? 'active' : 'suspended'} />,
    },
    {
      key: 'profileCompleted',
      header: 'Profile',
      cell: (row: User) => (
        <Badge variant={row.profileCompleted ? 'success' : 'warning'}>
          {row.profileCompleted ? 'Complete' : 'Incomplete'}
        </Badge>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      cell: (row: User) => row.lastLoginAt
        ? format(parseISO(row.lastLoginAt), 'MMM d, yyyy')
        : <span className="text-gray-400">Never</span>,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      cell: (row: User) => format(parseISO(row.createdAt), 'MMM d, yyyy'),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Users" subtitle="Manage all portal users." />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage="No users found."
        pagination={data ? { page, pageSize: 20, total: data.total, onPageChange: setPage } : undefined}
      />
    </div>
  );
}
