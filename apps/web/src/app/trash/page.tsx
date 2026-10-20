'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { FileExplorer } from '@/components/FileExplorer';

export default function TrashPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col">
          <div className="mb-4">
            <h1 className="text-xl font-bold tracking-tight">Trash</h1>
            <p className="text-xs text-slate-400">
              Files in trash can be restored back to your vault or permanently purged from your SSD
            </p>
          </div>
          <FileExplorer
            mode="trash"
            refreshTrigger={refreshTrigger}
          />
        </main>
      </div>
    </div>
  );
}
