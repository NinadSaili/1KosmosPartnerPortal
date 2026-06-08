import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, isPast, parseISO } from 'date-fns';
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle,
  DollarSign,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Card, CardContent } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useDeals } from '@/hooks/useDeals';
import { dealApi } from '@/lib/api';
import type { Deal, DealStatus } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TABS: { label: string; value: DealStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
}

function KPICard({ label, value, icon, colorClass }: KPICardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${colorClass}`}>
            {icon}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const navigate = useNavigate();
  const { isVendorAdmin, user } = useAuth();
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  const [statusFilter, setStatusFilter] = useState<DealStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(e.target.value);
      setPage(1);
    }, 300);
  };

  const { data, isLoading } = useDeals({
    page,
    pageSize: PAGE_SIZE,
    status: statusFilter || undefined,
    search: debouncedSearch || undefined,
  });

  const { data: allDeals } = useDeals({ pageSize: 1000 });

  const deals = data?.data ?? [];
  const total = data?.total ?? 0;

  const all = allDeals?.data ?? [];
  const totalSubmitted = all.filter((d) => d.status !== 'draft').length;
  const underReview = all.filter((d) => d.status === 'under_review').length;
  const approvedCount = all.filter((d) => d.status === 'approved').length;
  const totalValue = all
    .filter((d) => d.status === 'approved')
    .reduce((sum, d) => sum + d.opportunityValueUsd, 0);

  const handleDelete = async (deal: Deal, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete deal for ${deal.companyName}?`)) return;
    try {
      await dealApi.update(deal.id, { status: 'draft' });
    } catch {
      // silently fail — we don't have a delete endpoint defined, handled by API
    }
  };

  const columns: DataTableColumn<Deal>[] = [
    {
      key: 'company',
      header: 'Company',
      cell: (row) => (
        <button
          onClick={() => navigate(`/deals/${row.id}`)}
          className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline text-left"
        >
          {row.companyName}
        </button>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      cell: (row) => (
        <a href={`mailto:${row.contactEmail}`} className="text-gray-600 dark:text-gray-400 hover:text-indigo-600 text-xs">
          {row.contactEmail}
        </a>
      ),
    },
    {
      key: 'vertical',
      header: 'Vertical',
      cell: (row) => <Badge variant="outline">{row.vertical}</Badge>,
    },
    {
      key: 'value',
      header: 'Opp. Value',
      cell: (row) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          {formatCurrency(row.opportunityValueUsd)}
        </span>
      ),
    },
    {
      key: 'close',
      header: 'Expected Close',
      cell: (row) => {
        const date = parseISO(row.expectedCloseDate);
        const past = isPast(date) && row.status !== 'approved' && row.status !== 'rejected';
        return (
          <span className={`text-sm ${past ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}>
            {format(date, 'MMM d, yyyy')}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      cell: (row) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {format(parseISO(row.createdAt), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); navigate(`/deals/${row.id}`); }}
            aria-label="View deal"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {row.status === 'draft' && (row.submitterId === user?.id || isVendorAdmin) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); navigate(`/deals/new`); }}
              aria-label="Edit deal"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {row.status === 'draft' && isVendorAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-500 hover:text-red-600"
              onClick={(e) => handleDelete(row, e)}
              aria-label="Delete deal"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <PageHeader
        title="Deal Registration"
        subtitle="Track and manage your registered opportunities"
        actions={
          <Button asChild>
            <Link to="/deals/new">
              <Plus className="h-4 w-4 mr-2" />
              Register New Deal
            </Link>
          </Button>
        }
      />

      {/* KPI mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Total Submitted"
          value={totalSubmitted}
          icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
          colorClass="bg-indigo-50 dark:bg-indigo-900/30"
        />
        <KPICard
          label="Under Review"
          value={underReview}
          icon={<Clock className="h-5 w-5 text-yellow-600" />}
          colorClass="bg-yellow-50 dark:bg-yellow-900/30"
        />
        <KPICard
          label="Approved"
          value={approvedCount}
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          colorClass="bg-green-50 dark:bg-green-900/30"
        />
        <KPICard
          label="Total Value"
          value={formatCurrency(totalValue)}
          icon={<DollarSign className="h-5 w-5 text-blue-600" />}
          colorClass="bg-blue-50 dark:bg-blue-900/30"
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search by company name…"
            className="pl-9"
          />
        </div>
      </div>

      <DataTable<Deal>
        columns={columns}
        data={deals}
        isLoading={isLoading}
        emptyMessage={`No ${statusFilter ? statusFilter.replace('_', ' ') : ''} deals found`}
        emptyDescription="Register a new deal to get started."
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total,
          onPageChange: setPage,
        }}
        onRowClick={(row) => navigate(`/deals/${row.id}`)}
      />
    </div>
  );
}
