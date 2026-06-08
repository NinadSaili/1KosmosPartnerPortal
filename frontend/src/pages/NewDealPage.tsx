import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCreateDeal } from '@/hooks/useDeals';
import { useToast } from '@/components/ui/Toast';

const dealSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  contactName: z.string().min(2, 'Contact name is required'),
  contactEmail: z.string().email('Valid email required'),
  vertical: z.string().min(1, 'Vertical is required'),
  opportunityValueUsd: z.coerce.number().min(1, 'Opportunity value must be positive'),
  expectedCloseDate: z.string().min(1, 'Close date is required'),
  notes: z.string().optional(),
});

type DealFormData = z.infer<typeof dealSchema>;

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

const VERTICALS = ['Financial Services', 'Healthcare', 'Government', 'Education', 'Technology', 'Retail', 'Manufacturing', 'Other'];

export default function NewDealPage() {
  const navigate = useNavigate();
  const createDeal = useCreateDeal();
  const { success, error: showError } = useToast();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
  });

  const onSubmit = async (data: DealFormData) => {
    try {
      const deal = await createDeal.mutateAsync({
        ...data,
        status: 'draft',
        competingVendors: [],
      });
      success('Deal registered!', 'Your deal has been saved as a draft.');
      navigate(`/deals/${deal.id}`);
    } catch {
      showError('Failed to create deal', 'Please check your input and try again.');
    }
  };

  return (
    <div className="space-y-6">
      <Link to="/deals" className="text-sm text-gray-500 hover:text-brand-600 flex items-center gap-1">
        <ChevronLeft className="h-4 w-4" /> Back to Deals
      </Link>
      <PageHeader title="Register New Deal" subtitle="Submit a deal for registration and approval." />

      <Card className="max-w-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Company Name" error={errors.companyName?.message}>
                <Input placeholder="Acme Corp" {...register('companyName')} />
              </FormField>
              <FormField label="Contact Name" error={errors.contactName?.message}>
                <Input placeholder="John Smith" {...register('contactName')} />
              </FormField>
            </div>

            <FormField label="Contact Email" error={errors.contactEmail?.message}>
              <Input type="email" placeholder="john@acme.com" {...register('contactEmail')} />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Vertical" error={errors.vertical?.message}>
                <select {...register('vertical')} className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                  <option value="">Select vertical</option>
                  {VERTICALS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </FormField>
              <FormField label="Opportunity Value (USD)" error={errors.opportunityValueUsd?.message}>
                <Input type="number" placeholder="50000" {...register('opportunityValueUsd')} />
              </FormField>
            </div>

            <FormField label="Expected Close Date" error={errors.expectedCloseDate?.message}>
              <Input type="date" {...register('expectedCloseDate')} />
            </FormField>

            <FormField label="Notes (optional)" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Any additional context..."
                className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white placeholder:text-gray-400 resize-none"
              />
            </FormField>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/deals')}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save as Draft'}
              </Button>
              <Button
                type="submit"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => {}}
              >
                Submit for Review
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
