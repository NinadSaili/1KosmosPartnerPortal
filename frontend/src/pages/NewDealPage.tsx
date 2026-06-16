import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  Building2,
  Mail,
  User,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useCreateDeal } from '@/hooks/useDeals';
import { dealApi } from '@/lib/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const VERTICALS: { label: string; value: string }[] = [
  { label: 'Financial Services', value: 'financial_services' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Government', value: 'government' },
  { label: 'Retail', value: 'retail' },
  { label: 'Manufacturing', value: 'manufacturing' },
  { label: 'Other', value: 'other' },
];

const STEPS = ['Company Info', 'Opportunity', 'Review & Submit'];

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const step1Schema = z.object({
  companyName: z.string().min(1, 'Company name is required').max(200),
  contactName: z.string().min(1, 'Contact name is required').max(200),
  contactEmail: z.string().email('Invalid email address'),
  vertical: z.string().min(1, 'Please select a vertical'),
});

const step2Schema = z.object({
  opportunityValueUsd: z
    .number({ invalid_type_error: 'Value must be a number' })
    .min(1, 'Value must be greater than 0'),
  expectedCloseDate: z
    .string()
    .min(1, 'Close date is required')
    .refine((val) => new Date(val) > new Date(), 'Close date must be in the future'),
  competingVendors: z.array(z.object({ name: z.string() })).max(5),
  notes: z.string().optional(),
});

const step3Schema = z.object({
  documents: z.array(z.object({ url: z.string() })).optional(),
  submitForReview: z.boolean().default(false),
});

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema);
type FullFormData = z.infer<typeof fullSchema>;

// ─── Step Progress ────────────────────────────────────────────────────────────

function StepProgress({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center min-w-0">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${
                  isCompleted
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : isCurrent
                    ? 'border-indigo-600 text-indigo-600 bg-white dark:bg-gray-900'
                    : 'border-gray-300 text-gray-400 bg-white dark:bg-gray-900'
                }`}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < labels.length - 1 && (
              <div
                className={`flex-1 h-0.5 mt-[-1rem] ${
                  stepNum < current ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600 dark:text-red-400">{message}</p>;
}

// ─── Steps ────────────────────────────────────────────────────────────────────

interface StepProps {
  form: ReturnType<typeof useForm<FullFormData>>;
}

function Step1({ form }: StepProps) {
  const { register, formState: { errors } } = form;
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel required>Company Name</FieldLabel>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input {...register('companyName')} placeholder="Acme Corporation" className="pl-9" />
        </div>
        <FieldError message={errors.companyName?.message} />
      </div>
      <div>
        <FieldLabel required>Contact Name</FieldLabel>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input {...register('contactName')} placeholder="Jane Smith" className="pl-9" />
        </div>
        <FieldError message={errors.contactName?.message} />
      </div>
      <div>
        <FieldLabel required>Contact Email</FieldLabel>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input {...register('contactEmail')} type="email" placeholder="jane@acme.com" className="pl-9" />
        </div>
        <FieldError message={errors.contactEmail?.message} />
      </div>
      <div>
        <FieldLabel required>Vertical / Industry</FieldLabel>
        <Select {...register('vertical')} placeholder="Select a vertical">
          {VERTICALS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </Select>
        <FieldError message={errors.vertical?.message} />
      </div>
    </div>
  );
}

function Step2({ form }: StepProps) {
  const { register, control, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'competingVendors' });
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel required>Opportunity Value (USD)</FieldLabel>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            {...register('opportunityValueUsd', { valueAsNumber: true })}
            type="number"
            min={1}
            placeholder="150000"
            className="pl-9"
          />
        </div>
        <FieldError message={errors.opportunityValueUsd?.message} />
      </div>
      <div>
        <FieldLabel required>Expected Close Date</FieldLabel>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            {...register('expectedCloseDate')}
            type="date"
            min={format(new Date(), 'yyyy-MM-dd')}
            className="pl-9"
          />
        </div>
        <FieldError message={errors.expectedCloseDate?.message} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Competing Vendors</FieldLabel>
          {fields.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={() => append({ name: '' })}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2">
              <Input {...register(`competingVendors.${idx}.name`)} placeholder={`Vendor ${idx + 1}`} />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} className="text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-sm text-gray-400 py-2">No competing vendors added.</p>
          )}
        </div>
      </div>
      <div>
        <FieldLabel>Notes</FieldLabel>
        <textarea
          {...register('notes')}
          rows={4}
          placeholder="Additional context about this opportunity…"
          className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </div>
    </div>
  );
}

function Step3({ form }: StepProps) {
  const { register, control, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'documents' });
  const values = watch();
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Review Summary</h3>
        </div>
        <dl className="divide-y divide-gray-100 dark:divide-gray-800">
          {[
            { label: 'Company', value: values.companyName },
            { label: 'Contact', value: `${values.contactName} — ${values.contactEmail}` },
            { label: 'Vertical', value: values.vertical },
            {
              label: 'Opp. Value',
              value: values.opportunityValueUsd > 0
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(values.opportunityValueUsd)
                : '—',
            },
            {
              label: 'Expected Close',
              value: values.expectedCloseDate
                ? format(new Date(values.expectedCloseDate), 'MMMM d, yyyy')
                : '—',
            },
            {
              label: 'Competing Vendors',
              value: (values.competingVendors ?? []).map((v) => v.name).filter(Boolean).join(', ') || 'None',
            },
            { label: 'Notes', value: values.notes || 'None' },
          ].map(({ label, value }) => (
            <div key={label} className="flex gap-4 px-4 py-2.5">
              <dt className="w-36 shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="text-sm text-gray-900 dark:text-white flex-1 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Documents */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Supporting Documents</FieldLabel>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ url: '' })}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add URL
          </Button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Add Supabase Storage URLs for supporting documents</p>
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2">
              <div className="relative flex-1">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input {...register(`documents.${idx}.url`)} placeholder="https://…" className="pl-9" />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} className="text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-sm text-gray-400 py-2">No documents added.</p>
          )}
        </div>
      </div>

      {/* Submit toggle */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
        <Controller
          name="submitForReview"
          control={control}
          render={({ field }) => (
            <input
              type="checkbox"
              id="submitForReview"
              checked={field.value}
              onChange={field.onChange}
              className="mt-0.5 rounded border-gray-300 text-indigo-600"
            />
          )}
        />
        <label htmlFor="submitForReview" className="cursor-pointer">
          <p className="text-sm font-medium text-gray-900 dark:text-white">Submit for review</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Uncheck to save as draft and submit later.
          </p>
        </label>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewDealPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const createDeal = useCreateDeal();

  const form = useForm<FullFormData>({
    resolver: zodResolver(fullSchema),
    mode: 'onTouched',
    defaultValues: {
      companyName: '',
      contactName: '',
      contactEmail: '',
      vertical: '',
      opportunityValueUsd: 0,
      expectedCloseDate: '',
      competingVendors: [],
      notes: '',
      documents: [],
      submitForReview: false,
    },
  });

  const getStepFields = (step: number): (keyof FullFormData)[] => {
    switch (step) {
      case 1: return ['companyName', 'contactName', 'contactEmail', 'vertical'];
      case 2: return ['opportunityValueUsd', 'expectedCloseDate'];
      default: return [];
    }
  };

  const advanceStep = async () => {
    const fields = getStepFields(currentStep);
    const valid = await form.trigger(fields as Parameters<typeof form.trigger>[0]);
    if (valid) setCurrentStep((s) => s + 1);
  };

  const onSubmit = async (data: FullFormData) => {
    try {
      const deal = await createDeal.mutateAsync({
        companyName: data.companyName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        vertical: data.vertical,
        opportunityValueUsd: data.opportunityValueUsd,
        expectedCloseDate: data.expectedCloseDate,
        competingVendors: data.competingVendors?.map((v) => v.name).filter(Boolean) ?? [],
        notes: data.notes || null,
      });
      if (data.submitForReview) {
        await dealApi.updateStatus(deal.id, 'submitted');
      }
      success('Deal registered!', data.submitForReview ? 'Submitted for review.' : 'Saved as draft.');
      navigate(`/deals/${deal.id}`);
    } catch (err: unknown) {
      showError('Failed to create deal', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-2xl mx-auto">
      <Link
        to="/deals"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Deals
      </Link>

      <PageHeader title="Register New Deal" subtitle="Submit a new sales opportunity for review." />

      <StepProgress current={currentStep} labels={STEPS} />

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1]}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.18 }}
              >
                {currentStep === 1 && <Step1 form={form} />}
                {currentStep === 2 && <Step2 form={form} />}
                {currentStep === 3 && <Step3 form={form} />}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-5 border-t border-gray-100 dark:border-gray-800">
              {currentStep > 1 ? (
                <Button type="button" variant="outline" onClick={() => setCurrentStep((s) => s - 1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                <div />
              )}

              {currentStep < 3 ? (
                <Button type="button" onClick={advanceStep}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={createDeal.isPending}>
                  {createDeal.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Submitting…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {form.watch('submitForReview') ? 'Submit for Review' : 'Save as Draft'}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
