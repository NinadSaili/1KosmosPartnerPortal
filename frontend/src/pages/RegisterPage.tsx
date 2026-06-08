import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';

// ─── Schema ──────────────────────────────────────────────────────────────────

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
    email: z.string().email('Please enter a valid email address'),
    organization: z.string().min(2, 'Company/Organization is required').max(150),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Field wrapper ───────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, login } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setApiError(null);
    try {
      await registerUser({
        fullName: data.fullName,
        email: data.email,
        organization: data.organization,
        password: data.password,
      });
      // Auto-login after registration
      await login(data.email, data.password);
      navigate('/onboarding');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setApiError(message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-indigo-950 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <span className="text-white text-xl font-extrabold tracking-tight">1K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Join the 1Kosmos Partner Portal
          </p>
        </div>

        <Card className="shadow-xl border-0 dark:bg-gray-900">
          <CardHeader className="pb-2">
            <CardTitle className="sr-only">Register</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Full Name */}
              <Field label="Full name" error={errors.fullName?.message}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    autoComplete="name"
                    placeholder="Jane Smith"
                    className="pl-9"
                    aria-invalid={!!errors.fullName}
                    {...register('fullName')}
                  />
                </div>
              </Field>

              {/* Email */}
              <Field label="Email address" error={errors.email?.message}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="jane@company.com"
                    className="pl-9"
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                </div>
              </Field>

              {/* Organization */}
              <Field label="Company / Organization" error={errors.organization?.message}>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    autoComplete="organization"
                    placeholder="Acme Corp"
                    className="pl-9"
                    aria-invalid={!!errors.organization}
                    {...register('organization')}
                  />
                </div>
              </Field>

              {/* Password */}
              <Field label="Password" error={errors.password?.message}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    className="pl-9"
                    aria-invalid={!!errors.password}
                    {...register('password')}
                  />
                </div>
              </Field>

              {/* Confirm Password */}
              <Field label="Confirm password" error={errors.confirmPassword?.message}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    className="pl-9"
                    aria-invalid={!!errors.confirmPassword}
                    {...register('confirmPassword')}
                  />
                </div>
              </Field>

              {/* API error */}
              {apiError && (
                <div
                  role="alert"
                  className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                >
                  {apiError}
                </div>
              )}

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating account…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                By creating an account you agree to our{' '}
                <a href="/terms" className="underline hover:text-indigo-600">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="underline hover:text-indigo-600">
                  Privacy Policy
                </a>
                .
              </p>
            </form>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
