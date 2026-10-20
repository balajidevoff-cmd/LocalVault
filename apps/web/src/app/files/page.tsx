'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { FileExplorer } from '@/components/FileExplorer';
import { UploadModal } from '@/components/UploadModal';
import { CreateFolderModal } from '@/components/CreateFolderModal';
import { RefreshCw } from 'lucide-react';

function FilesContent() {
  const searchParams = useSearchParams();
  const folderParam = searchParams.get('folder_id');
  const queryParam = searchParams.get('query') || '';

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(folderParam);
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
        <Topbar
          onMenuClick={() => setMobileMenuOpen(true)}
          initialQuery={queryParam}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col">
          <FileExplorer
            initialFolderId={currentFolderId}
            mode="folder"
            searchQuery={queryParam}
            onFolderChange={(id) => setCurrentFolderId(id)}
            onUploadClick={() => setUploadOpen(true)}
            onNewFolderClick={() => setFolderOpen(true)}
            refreshTrigger={refreshTrigger}
          />
        </main>
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={currentFolderId}
        onUploadSuccess={() => {
          setUploadOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
      <CreateFolderModal
        isOpen={folderOpen}
        onClose={() => setFolderOpen(false)}
        parentFolderId={currentFolderId}
        onSuccess={() => {
          setFolderOpen(false);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
}

export default function FilesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14] text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-vault-500" />
        </div>
      }
    >
      <FilesContent />
    </Suspense>
  );
}
