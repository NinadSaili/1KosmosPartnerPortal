import React, { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import {
  Camera,
  User,
  Briefcase,
  Phone,
  Building2,
  Award,
  Lock,
  Save,
  CheckCircle2,
  Calendar,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, certApi } from '@/lib/api';
import type { IssuedCertificate } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  title: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

// ─── Avatar ───────────────────────────────────────────────────────────────────

interface AvatarSectionProps {
  avatarUrl: string | null;
  fullName: string;
  userId: string;
  onAvatarChange: (url: string) => void;
}

function AvatarSection({ avatarUrl, fullName, userId, onAvatarChange }: AvatarSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const objectUrl = URL.createObjectURL(file);
      if (userId) {
        await authApi.updateProfile(userId, { avatarUrl: objectUrl });
      }
      onAvatarChange(objectUrl);
    } catch {
      // swallow — parent toast handles it
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName}
            className="h-24 w-24 rounded-full object-cover border-4 border-white dark:border-gray-700 shadow-md"
          />
        ) : (
          <div className="h-24 w-24 rounded-full bg-indigo-100 dark:bg-indigo-900 border-4 border-white dark:border-gray-700 shadow-md flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {initials}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
          aria-label="Upload avatar"
        >
          {uploading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
      >
        Change photo
      </button>
    </div>
  );
}

// ─── Role badge helper ────────────────────────────────────────────────────────

const ROLE_DISPLAY: Record<string, { label: string; variant: 'default' | 'blue' | 'purple' }> = {
  vendor_admin: { label: 'Vendor Admin', variant: 'purple' },
  partner_admin: { label: 'Partner Admin', variant: 'blue' },
  partner_user: { label: 'Partner User', variant: 'default' },
};

// ─── Certification row ────────────────────────────────────────────────────────

function CertRow({ cert }: { cert: IssuedCertificate }) {
  const isExpired = cert.expiresAt ? new Date(cert.expiresAt) < new Date() : false;
  const isExpiringSoon =
    !isExpired &&
    cert.expiresAt &&
    new Date(cert.expiresAt) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        cert.isRevoked
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40'
      }`}
    >
      <BadgeCheck
        className={`h-6 w-6 flex-shrink-0 ${
          cert.isRevoked
            ? 'text-red-400'
            : isExpired
            ? 'text-gray-400'
            : 'text-green-500'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${cert.isRevoked ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
          #{cert.certNumber}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Issued {format(new Date(cert.issuedAt), 'MMM d, yyyy')}
          {cert.expiresAt && ` · Expires ${format(new Date(cert.expiresAt), 'MMM d, yyyy')}`}
        </p>
      </div>
      <div>
        {cert.isRevoked ? (
          <Badge variant="destructive">Revoked</Badge>
        ) : isExpired ? (
          <Badge variant="secondary">Expired</Badge>
        ) : isExpiringSoon ? (
          <Badge variant="warning">Expiring Soon</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        )}
      </div>
      {cert.pdfUrl && !cert.isRevoked && (
        <a
          href={cert.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0"
        >
          PDF
        </a>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);

  const roleConfig = user ? ROLE_DISPLAY[user.role] : null;

  // ── Certifications ──────────────────────────────────────────────────────────

  const { data: certsData, isLoading: certsLoading } = useQuery({
    queryKey: ['certificates', user?.id],
    queryFn: () => certApi.listCertificates({ userId: user!.id }),
    enabled: !!user,
  });

  // ── Profile form ────────────────────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName ?? '',
      title: user?.title ?? '',
      phone: user?.phone ?? '',
    },
  });

  const profileMutation = useMutation({
    mutationFn: (data: ProfileFormData) =>
      authApi.updateProfile(user!.id, {
        fullName: data.fullName,
        title: data.title ?? null,
        phone: data.phone ?? null,
      }),
    onSuccess: (updated) => {
      updateUser(updated);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toastSuccess('Profile saved', 'Your profile has been updated.');
    },
    onError: (err: unknown) => {
      toastError('Failed to save', err instanceof Error ? err.message : 'Unknown error');
    },
  });

  // ── Password form ───────────────────────────────────────────────────────────

  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    reset: resetPw,
    formState: { errors: pwErrors, isSubmitting: pwSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const [pwApiError, setPwApiError] = useState<string | null>(null);

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setPwApiError(null);
    try {
      await authApi.updatePassword(user!.id, data.newPassword);
      toastSuccess('Password changed', 'Your password has been updated.');
      resetPw();
    } catch (err: unknown) {
      setPwApiError(err instanceof Error ? err.message : 'Failed to change password.');
    }
  };

  if (!user) return <LoadingSpinner className="min-h-screen" />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-3xl space-y-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Profile</h1>

        {/* ── Avatar + meta card ── */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <AvatarSection
                avatarUrl={localAvatarUrl}
                fullName={user.fullName}
                userId={user.id}
                onAvatarChange={(url) => {
                  setLocalAvatarUrl(url);
                  updateUser({ avatarUrl: url });
                }}
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{user.fullName}</h2>
                {user.title && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user.title}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {roleConfig && (
                    <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
                  )}
                  {user.organization && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {user.organization.name}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Joined {format(new Date(user.createdAt), 'MMM yyyy')}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Profile edit form ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-indigo-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((data) => profileMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Jane Smith"
                      className="pl-9"
                      aria-invalid={!!profileErrors.fullName}
                      {...register('fullName')}
                    />
                  </div>
                  {profileErrors.fullName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {profileErrors.fullName.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Job Title
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input placeholder="Sales Engineer" className="pl-9" {...register('title')} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="tel"
                      placeholder="+1 (555) 000-0000"
                      className="pl-9"
                      {...register('phone')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Company
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={user.organization?.name ?? ''}
                      readOnly
                      className="pl-9 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Contact support to change your company.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={profileSubmitting || profileMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {profileMutation.isSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Saved
                    </>
                  ) : profileSubmitting || profileMutation.isPending ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Certifications ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-600" />
              Certifications Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            {certsLoading ? (
              <LoadingSpinner className="py-8" />
            ) : !certsData?.data.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                No certifications yet. Complete training courses to become eligible.
              </p>
            ) : (
              <div className="space-y-2">
                {certsData.data.map((cert) => (
                  <CertRow key={cert.id} cert={cert} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Change Password ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-indigo-600" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmitPw(handlePasswordSubmit)}
              className="space-y-4 max-w-sm"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Min. 8 characters"
                    className="pl-9"
                    aria-invalid={!!pwErrors.newPassword}
                    {...registerPw('newPassword')}
                  />
                </div>
                {pwErrors.newPassword && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {pwErrors.newPassword.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    placeholder="Re-enter new password"
                    className="pl-9"
                    aria-invalid={!!pwErrors.confirmPassword}
                    {...registerPw('confirmPassword')}
                  />
                </div>
                {pwErrors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {pwErrors.confirmPassword.message}
                  </p>
                )}
              </div>

              {pwApiError && (
                <div
                  role="alert"
                  className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                >
                  {pwApiError}
                </div>
              )}

              <Button type="submit" disabled={pwSubmitting} variant="outline">
                {pwSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                    Updating...
                  </span>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
