import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileSidebar } from './MobileSidebar';

// ─── Page transition config ───────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

const pageTransition = {
  duration: 0.2,
  ease: 'easeInOut' as const,
};

// ─── AppLayout ────────────────────────────────────────────────────────────────

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* Mobile sidebar sheet */}
      <Dialog.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-72 bg-white dark:bg-gray-900 shadow-2xl focus:outline-none"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-brand-600 flex items-center justify-center">
                  <span className="text-white text-xs font-extrabold">1K</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">1Kosmos</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Partner Portal</p>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            <MobileSidebar onClose={() => setMobileMenuOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onMenuClick={() => setMobileMenuOpen(true)} />

        {/* Scrollable content with page transitions */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="h-full"
            >
              <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
                <Outlet />
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
