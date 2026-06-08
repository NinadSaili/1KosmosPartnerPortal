import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { axiosInstance } from '@/lib/api';
import type { AuthTokens, AuthUser } from '@/types';

const ACCESS_TOKEN_KEY = 'pp_access_token';
const REFRESH_TOKEN_KEY = 'pp_refresh_token';

export default function MagicLinkPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing magic link token.');
      return;
    }

    axiosInstance
      .post<{ tokens: AuthTokens; user: AuthUser }>('/auth/magic-link/verify', { token })
      .then((res) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, res.data.tokens.accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, res.data.tokens.refreshToken);
        setStatus('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err?.response?.data?.message ?? 'This magic link is invalid or has expired.',
        );
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-sm"
      >
        {status === 'loading' && (
          <>
            <LoadingSpinner size="lg" className="mb-6" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Verifying your magic link…</h2>
            <p className="mt-2 text-sm text-gray-500">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">You're signed in!</h2>
            <p className="mt-2 text-sm text-gray-500">Redirecting you to the dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sign-in failed</h2>
            <p className="mt-2 text-sm text-gray-500">{message}</p>
            <Button asChild className="mt-6">
              <Link to="/login">Return to Login</Link>
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
}
