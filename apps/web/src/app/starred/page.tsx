'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { FileExplorer } from '@/components/FileExplorer';
import { UploadModal } from '@/components/UploadModal';
import { CreateFolderModal } from '@/components/CreateFolderModal';

export default function StarredPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onUploadClick={() => setUploadOpen(true)}
        onNewFolderClick={() => setFolderOpen(true)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col">
          <div className="mb-4">
            <h1 className="text-xl font-bold tracking-tight">Starred Files</h1>
            <p className="text-xs text-slate-400">Quick access to your bookmarked and favorite documents</p>
          </div>
          <FileExplorer
            mode="starred"
            refreshTrigger={refreshTrigger}
          />
        </main>
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={() => {
          setUploadOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
      <CreateFolderModal
        isOpen={folderOpen}
        onClose={() => setFolderOpen(false)}
        onSuccess={() => {
          setFolderOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
}
