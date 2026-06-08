import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authApi } from '../lib/api';
import type { AuthTokens, AuthUser, User } from '../types';

// ─── Token storage keys ───────────────────────────────────────────────────────

const ACCESS_TOKEN_KEY = 'pp_access_token';
const REFRESH_TOKEN_KEY = 'pp_refresh_token';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const decoded = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  // Add a 30-second buffer to account for clock skew
  return payload.exp * 1000 < Date.now() - 30_000;
}

function storeTokens(tokens: AuthTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function loadTokens(): AuthTokens | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return null;
}

function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  organization?: string;
  organizationName?: string;
  inviteToken?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithMagicLink: (email: string) => Promise<void>;
  /** Alias for loginWithMagicLink — used by some pages */
  sendMagicLink: (email: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
  isVendorAdmin: boolean;
  isPartnerAdmin: boolean;
  isPartnerUser: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    async function restoreSession() {
      setIsLoading(true);
      try {
        const stored = loadTokens();
        if (!stored) return;

        // If access token is still valid, fetch profile
        if (!isTokenExpired(stored.accessToken)) {
          setTokens(stored);
          const profile = await authApi.getProfile();
          setUser(profile);
          return;
        }

        // Access token expired — try to refresh
        if (!isTokenExpired(stored.refreshToken)) {
          const newTokens = await authApi.refresh(stored.refreshToken);
          storeTokens(newTokens);
          setTokens(newTokens);
          const profile = await authApi.getProfile();
          setUser(profile);
          return;
        }

        // Both tokens expired
        clearTokens();
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    storeTokens(result.tokens);
    setTokens(result.tokens);
    setUser(result.user);
  }, []);

  const loginWithMagicLink = useCallback(async (email: string) => {
    await authApi.magicLink(email);
    // Magic link sends an email; the actual auth happens when user clicks the link
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const result = await authApi.register({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      organizationName: data.organization ?? data.organizationName,
      inviteToken: data.inviteToken,
    });
    storeTokens(result.tokens);
    setTokens(result.tokens);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setTokens(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tokens,
      isLoading,
      login,
      loginWithMagicLink,
      sendMagicLink: loginWithMagicLink,
      register,
      logout,
      updateUser,
      isVendorAdmin: user?.role === 'vendor_admin',
      isPartnerAdmin: user?.role === 'partner_admin',
      isPartnerUser: user?.role === 'partner_user',
    }),
    [user, tokens, isLoading, login, loginWithMagicLink, register, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook (exported for convenience — see also hooks/useAuth.ts) ──────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within <AuthProvider>');
  }
  return ctx;
}

/**
 * Alias so pages can import useAuth directly from this module.
 * The canonical hook lives in hooks/useAuth.ts but many pages import from here.
 */
export const useAuth = useAuthContext;
