import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, DollarSign, Calendar, User, Building2, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useDeal, useUpdateDealStatus } from '@/hooks/useDeals';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/Toast';

export default function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const { data: deal, isLoading } = useDeal(dealId!);
  const updateStatus = useUpdateDealStatus();
  const { isVendorAdmin } = useAuth();
  const { success, error: showError } = useToast();

  const handleStatusChange = async (status: string) => {
    try {
      await updateStatus.mutateAsync({ id: dealId!, status });
      success(`Deal ${status}`, `The deal has been ${status}.`);
    } catch {
      showError('Failed to update status', 'Please try again.');
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!deal) return <div className="text-center py-20 text-gray-500">Deal not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/deals" className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to Deals
      </Link>

      <PageHeader
        title={deal.companyName}
        subtitle={`Deal registered on ${format(parseISO(deal.createdAt), 'MMMM d, yyyy')}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={deal.status} />
            {isVendorAdmin && deal.status === 'submitted' && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('under_review')}>Mark Under Review</Button>
                <Button size="sm" onClick={() => handleStatusChange('approved')}>Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => handleStatusChange('rejected')}>Reject</Button>
              </>
            )}
            {deal.status === 'draft' && (
              <Button size="sm" onClick={() => handleStatusChange('submitted')}>Submit for Review</Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle>Deal Information</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Company', value: deal.companyName, icon: Building2 },
                  { label: 'Contact', value: deal.contactName, icon: User },
                  { label: 'Email', value: deal.contactEmail, icon: FileText },
                  { label: 'Vertical', value: deal.vertical, icon: FileText },
                  { label: 'Opportunity Value', value: `$${deal.opportunityValueUsd.toLocaleString()}`, icon: DollarSign },
                  { label: 'Expected Close', value: format(parseISO(deal.expectedCloseDate), 'MMM d, yyyy'), icon: Calendar },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
                      <dd className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              {deal.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Notes</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{deal.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History */}
          {deal.history && deal.history.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Status History</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {deal.history.map((h) => (
                    <li key={h.id} className="flex items-start gap-3 text-sm">
                      <div className="h-2 w-2 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-gray-900 dark:text-white">
                          <span className="capitalize">{h.fromStatus ?? 'Created'}</span>
                          {' → '}
                          <span className="font-medium capitalize">{h.toStatus}</span>
                        </p>
                        {h.comment && <p className="text-gray-500 dark:text-gray-400">{h.comment}</p>}
                        <p className="text-xs text-gray-400">{format(parseISO(h.createdAt), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardContent className="p-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <StatusBadge status={deal.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="font-medium">{format(parseISO(deal.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span className="font-medium">{format(parseISO(deal.updatedAt), 'MMM d, yyyy')}</span>
              </div>
              {deal.reviewerComment && (
                <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-xs text-gray-500 mb-1">Reviewer Comment</p>
                  <p className="text-gray-700 dark:text-gray-300 text-xs">{deal.reviewerComment}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
