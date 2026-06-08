import React, { createContext, useCallback, useContext, useState } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const typeConfig: Record<ToastType, { icon: React.ReactNode; containerClass: string }> = {
  success: {
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    containerClass: 'border-l-4 border-green-500',
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
    containerClass: 'border-l-4 border-red-500',
  },
  info: {
    icon: <Info className="h-5 w-5 text-blue-500" />,
    containerClass: 'border-l-4 border-blue-500',
  },
  warning: {
    icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
    containerClass: 'border-l-4 border-yellow-500',
  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { ...item, id }]);
  }, []);

  const success = useCallback(
    (title: string, description?: string) => toast({ type: 'success', title, description }),
    [toast],
  );

  const error = useCallback(
    (title: string, description?: string) => toast({ type: 'error', title, description }),
    [toast],
  );

  const info = useCallback(
    (title: string, description?: string) => toast({ type: 'info', title, description }),
    [toast],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, success, error, info }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => {
          const config = typeConfig[t.type];
          return (
            <ToastPrimitive.Root
              key={t.id}
              open
              onOpenChange={(open) => { if (!open) removeToast(t.id); }}
              duration={4000}
              className={cn(
                'flex items-start gap-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg px-4 py-3 max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full data-[swipe=end]:slide-out-to-right-full',
                config.containerClass,
              )}
            >
              <div className="shrink-0 mt-0.5">{config.icon}</div>
              <div className="flex-1 min-w-0">
                <ToastPrimitive.Title className="text-sm font-semibold text-gray-900 dark:text-white">
                  {t.title}
                </ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close asChild>
                <button className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X className="h-4 w-4" />
                </button>
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
