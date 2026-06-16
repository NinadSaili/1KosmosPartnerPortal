import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, isPast, parseISO } from 'date-fns';
import {
  ArrowLeft,
  Building2,
  Mail,
  User,
  DollarSign,
  Calendar,
  FileText,
  ExternalLink,
  Pencil,
  CheckCircle,
  XCircle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusTimeline } from '@/components/deals/StatusTimeline';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useDeal, useUpdateDealStatus } from '@/hooks/useDeals';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Info Row ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-gray-500">{icon}</span>
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`text-sm font-medium text-gray-900 dark:text-white mt-0.5 ${valueClassName ?? ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Status Action Card ────────────────────────────────────────────────────────

interface StatusActionCardProps {
  dealId: string;
  status: string;
  submitterId: string;
  currentUserId: string;
  isVendorAdmin: boolean;
}

function StatusActionCard({
  dealId,
  status,
  submitterId,
  currentUserId,
  isVendorAdmin,
}: StatusActionCardProps) {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const updateStatus = useUpdateDealStatus();
  const [comment, setComment] = useState('');

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id: dealId, status: newStatus, comment: comment || undefined });
      success(`Status updated`, `Deal is now ${newStatus.replace('_', ' ')}.`);
      setComment('');
    } catch (err: unknown) {
      showError('Update failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const isOwner = submitterId === currentUserId;
  const isPending = updateStatus.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actions</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {status === 'draft' && (isOwner || isVendorAdmin) && (
          <>
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate(`/deals/new`)}>
              <Pencil className="h-4 w-4" />
              Edit Deal
            </Button>
            <Button className="w-full gap-2" onClick={() => handleStatusChange('submitted')} disabled={isPending}>
              <ChevronRight className="h-4 w-4" />
              {isPending ? 'Submitting…' : 'Submit for Review'}
            </Button>
          </>
        )}

        {isVendorAdmin && status === 'submitted' && (
          <Button variant="outline" className="w-full gap-2" onClick={() => handleStatusChange('under_review')} disabled={isPending}>
            <Clock className="h-4 w-4" />
            {isPending ? 'Moving…' : 'Move to Under Review'}
          </Button>
        )}

        {isVendorAdmin && status === 'under_review' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Review Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Add a comment for the partner…"
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <Button variant="success" className="w-full gap-2" onClick={() => handleStatusChange('approved')} disabled={isPending}>
              <CheckCircle className="h-4 w-4" />
              {isPending ? 'Approving…' : 'Approve Deal'}
            </Button>
            <Button variant="destructive" className="w-full gap-2" onClick={() => handleStatusChange('rejected')} disabled={isPending}>
              <XCircle className="h-4 w-4" />
              {isPending ? 'Rejecting…' : 'Reject Deal'}
            </Button>
          </>
        )}

        {(status === 'approved' || status === 'rejected') && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            This deal is <strong>{status}</strong>. No further actions available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isVendorAdmin, user } = useAuth();
  const { data: deal, isLoading, isError } = useDeal(id!);

  if (isLoading) {
    return <LoadingSpinner className="py-40" />;
  }

  if (isError || !deal) {
    return (
      <EmptyState
        title="Deal not found"
        description="This deal may have been removed or you don't have access."
        action={<Button onClick={() => window.history.back()}>Go Back</Button>}
      />
    );
  }

  const closeDatePast =
    isPast(parseISO(deal.expectedCloseDate)) &&
    deal.status !== 'approved' &&
    deal.status !== 'rejected';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <Link
        to="/deals"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Deals
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{deal.companyName}</h1>
            <StatusBadge status={deal.status} />
            <Badge variant="outline">{deal.vertical}</Badge>
          </div>
          <p className="mt-1 text-xl font-semibold text-indigo-600 dark:text-indigo-400">
            {formatCurrency(deal.opportunityValueUsd)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: main content */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-2 space-y-6"
        >
          {/* Contact */}
          <Card>
            <CardHeader><CardTitle className="text-base">Contact Information</CardTitle></CardHeader>
            <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<User className="h-4 w-4" />} label="Contact Name" value={deal.contactName} />
              <InfoRow
                icon={<Mail className="h-4 w-4" />}
                label="Contact Email"
                value={
                  <a href={`mailto:${deal.contactEmail}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                    {deal.contactEmail}
                  </a>
                }
              />
              <InfoRow icon={<Building2 className="h-4 w-4" />} label="Vertical" value={deal.vertical} />
            </CardContent>
          </Card>

          {/* Opportunity */}
          <Card>
            <CardHeader><CardTitle className="text-base">Opportunity Details</CardTitle></CardHeader>
            <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Opportunity Value" value={formatCurrency(deal.opportunityValueUsd)} />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Expected Close"
                value={format(parseISO(deal.expectedCloseDate), 'MMMM d, yyyy')}
                valueClassName={closeDatePast ? 'text-red-600 dark:text-red-400' : undefined}
              />
              {deal.competingVendors.length > 0 && (
                <div className="sm:col-span-2">
                  <InfoRow
                    icon={<Building2 className="h-4 w-4" />}
                    label="Competing Vendors"
                    value={
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {deal.competingVendors.map((v) => <Badge key={v} variant="secondary">{v}</Badge>)}
                      </div>
                    }
                  />
                </div>
              )}
              {deal.notes && (
                <div className="sm:col-span-2">
                  <InfoRow
                    icon={<FileText className="h-4 w-4" />}
                    label="Notes"
                    value={<span className="leading-relaxed">{deal.notes}</span>}
                  />
                </div>
              )}
              {deal.reviewerComment && (
                <div className="sm:col-span-2">
                  <InfoRow
                    icon={<FileText className="h-4 w-4" />}
                    label="Reviewer Comment"
                    value={<em>"{deal.reviewerComment}"</em>}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          {deal.documents && deal.documents.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Supporting Documents</CardTitle></CardHeader>
              <CardContent className="pt-0 space-y-2">
                {deal.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.storagePath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                  >
                    <FileText className="h-5 w-5 text-indigo-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 truncate">
                      {doc.fileName || doc.storagePath}
                    </span>
                    <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-indigo-500 shrink-0" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Status timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base">Status History</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <StatusTimeline history={deal.statusHistory ?? []} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: sidebar */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="space-y-6"
        >
          {user && (
            <StatusActionCard
              dealId={deal.id}
              status={deal.status}
              submitterId={deal.submitterId}
              currentUserId={user.id}
              isVendorAdmin={isVendorAdmin}
            />
          )}

          {/* Metadata */}
          <Card>
            <CardHeader><CardTitle className="text-base">Deal Metadata</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-4">
              <InfoRow icon={<User className="h-4 w-4" />} label="Submitted By" value={deal.submitterId} />
              <InfoRow
                icon={<Calendar className="h-4 w-4" />}
                label="Submitted Date"
                value={format(parseISO(deal.createdAt), 'MMM d, yyyy')}
              />
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="Last Updated"
                value={format(parseISO(deal.updatedAt), 'MMM d, yyyy h:mm a')}
              />
              {deal.reviewerId && (
                <InfoRow icon={<User className="h-4 w-4" />} label="Reviewer" value={deal.reviewerId} />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
