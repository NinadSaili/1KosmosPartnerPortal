import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import * as Tabs from '@radix-ui/react-tabs';
import { Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';

// ─── Schemas ────────────────────────────────────────────────────────────────

const emailPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const magicLinkSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type EmailPasswordFormData = z.infer<typeof emailPasswordSchema>;
type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

// ─── Sub-components ─────────────────────────────────────────────────────────

function EmailPasswordForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailPasswordFormData>({
    resolver: zodResolver(emailPasswordSchema),
  });

  const onSubmit = async (data: EmailPasswordFormData) => {
    setApiError(null);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid email or password.';
      setApiError(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="ep-email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="ep-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="pl-9"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="ep-password"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="ep-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="pl-9"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </div>
        {errors.password && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.password.message}
          </p>
        )}
      </div>

      {apiError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
        >
          {apiError}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Signing in…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Sign in
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </form>
  );
}

function MagicLinkForm() {
  const { sendMagicLink } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
  });

  const onSubmit = async (data: MagicLinkFormData) => {
    setApiError(null);
    try {
      await sendMagicLink(data.email);
      setSent(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send magic link. Please try again.';
      setApiError(message);
    }
  };

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 py-6 text-center"
      >
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Check your inbox
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          We've sent a magic link to your email address. Click it to sign in instantly.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2"
        >
          Send to a different address
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="ml-email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Email address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="ml-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="pl-9"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {errors.email.message}
          </p>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        We'll email you a secure, one-click sign-in link. No password required.
      </p>

      {apiError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
        >
          {apiError}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Sending link…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Send magic link
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-gray-950 dark:to-indigo-950 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <span className="text-white text-xl font-extrabold tracking-tight">1K</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            1Kosmos Partner Portal
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sign in to your partner account
          </p>
        </div>

        <Card className="shadow-xl border-0 dark:bg-gray-900">
          <CardHeader className="pb-0">
            <CardTitle className="sr-only">Sign in</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Tabs.Root defaultValue="password" className="w-full">
              <Tabs.List className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 mb-6">
                {(['password', 'magic'] as const).map((tab) => (
                  <Tabs.Trigger
                    key={tab}
                    value={tab}
                    className="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all
                      text-gray-600 dark:text-gray-400
                      data-[state=active]:bg-white data-[state=active]:text-gray-900
                      dark:data-[state=active]:bg-gray-700 dark:data-[state=active]:text-white
                      data-[state=active]:shadow-sm"
                  >
                    {tab === 'password' ? 'Email & Password' : 'Magic Link'}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <Tabs.Content value="password">
                <EmailPasswordForm />
              </Tabs.Content>

              <Tabs.Content value="magic">
                <MagicLinkForm />
              </Tabs.Content>
            </Tabs.Root>

            <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Create account
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
