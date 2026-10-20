'use client';

import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  FolderClosed,
  File,
  Upload,
  FolderPlus,
  ArrowRight,
  TrendingUp,
  Server,
  PieChart,
  Clock,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { UploadModal } from '@/components/UploadModal';
import { CreateFolderModal } from '@/components/CreateFolderModal';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { useAuth } from '@/context/AuthContext';
import { api, formatBytes, formatDate } from '@/lib/api';
import { FileItem, FolderItem, StorageUsageResponse } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [topFolders, setTopFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [usageData, filesData, foldersData] = await Promise.all([
        api.getStorageUsage(),
        api.listFiles({ all_files: true, sort_by: 'created_at', sort_order: 'desc', page_size: 8 }),
        api.listFolders(null),
      ]);
      setUsage(usageData);
      setRecentFiles(filesData.items);
      setTopFolders(foldersData.slice(0, 4));
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const usagePercent = usage ? Math.min(100, Math.max(0, usage.user_usage_percentage)) : 0;

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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Welcome Banner */}
          <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-vault-900 via-slate-900 to-slate-950 text-white shadow-xl border border-vault-500/20">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vault-500/20 text-vault-300 text-xs font-semibold mb-3 border border-vault-500/30">
                <Server className="w-3.5 h-3.5" />
                Windows Host Storage Server
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {user?.username || 'User'}!
              </h1>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Your personal cloud vault is actively serving files directly from your host SSD. Total privacy, no cloud subscription limits.
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-5">
                <button
                  onClick={() => setUploadOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-vault-500 hover:bg-vault-400 text-slate-950 font-semibold text-xs shadow-lg shadow-vault-500/30 transition-all active:scale-95"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Files</span>
                </button>
                <button
                  onClick={() => setFolderOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs backdrop-blur-md border border-white/10 transition-all active:scale-95"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>New Folder</span>
                </button>
              </div>
            </div>

            {/* Decorative background glow */}
            <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-vault-500/10 to-transparent pointer-events-none" />
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Storage Quota Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Storage Used</span>
                <HardDrive className="w-5 h-5 text-vault-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight">
                {usage ? formatBytes(usage.user_used_bytes) : '...'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                of {usage ? formatBytes(usage.user_quota_bytes) : '250 GB'} quota ({usagePercent}%)
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                <div
                  className="h-full bg-vault-500 rounded-full"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </div>

            {/* Total Files Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Files</span>
                <File className="w-5 h-5 text-sky-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight">
                {usage ? usage.file_count : 0}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Stored securely on local disk
              </div>
            </div>

            {/* Total Folders Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Folders</span>
                <FolderClosed className="w-5 h-5 text-amber-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight">
                {usage ? usage.folder_count : 0}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Custom hierarchies
              </div>
            </div>

            {/* Host Disk Free Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider">Host SSD Free</span>
                <Server className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {usage ? formatBytes(usage.disk_free_bytes) : '...'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Physical drive capacity available
              </div>
            </div>
          </div>

          {/* Category Distribution Bar */}
          {usage && usage.categories.length > 0 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-vault-500" />
                  <span>Storage Breakdown by File Type</span>
                </h3>
                <span className="text-xs text-slate-400">
                  {formatBytes(usage.user_used_bytes)} total
                </span>
              </div>

              {/* Progress Distribution Bar */}
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden mb-4">
                {usage.categories.map((cat, idx) => {
                  const widthPct = usage.user_used_bytes > 0
                    ? (cat.size_bytes / usage.user_used_bytes) * 100
                    : 0;
                  if (widthPct === 0) return null;
                  const colors = [
                    'bg-emerald-500',
                    'bg-violet-500',
                    'bg-sky-500',
                    'bg-amber-500',
                    'bg-rose-500',
                    'bg-slate-400',
                  ];
                  return (
                    <div
                      key={cat.category}
                      className={`h-full ${colors[idx % colors.length]}`}
                      style={{ width: `${widthPct}%` }}
                      title={`${cat.category}: ${formatBytes(cat.size_bytes)} (${Math.round(widthPct)}%)`}
                    />
                  );
                })}
              </div>

              {/* Legend */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2 text-xs">
                {usage.categories.map((cat, idx) => {
                  const dotColors = [
                    'bg-emerald-500',
                    'bg-violet-500',
                    'bg-sky-500',
                    'bg-amber-500',
                    'bg-rose-500',
                    'bg-slate-400',
                  ];
                  return (
                    <div key={cat.category} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColors[idx % dotColors.length]}`} />
                      <div className="truncate">
                        <span className="font-medium capitalize text-slate-800 dark:text-slate-200 block truncate">
                          {cat.category}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatBytes(cat.size_bytes)} ({cat.count})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Folders & Recent Files Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Folders (1 col) */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FolderClosed className="w-4 h-4 text-amber-500" />
                  <span>Folders</span>
                </h3>
                <a
                  href="/files"
                  className="text-xs text-vault-600 dark:text-vault-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {topFolders.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-slate-400">
                  <p className="text-xs mb-3">No folders created yet</p>
                  <button
                    onClick={() => setFolderOpen(true)}
                    className="text-xs font-semibold text-vault-500 hover:underline"
                  >
                    + Create First Folder
                  </button>
                </div>
              ) : (
                <div className="space-y-2 flex-1">
                  {topFolders.map((f) => (
                    <a
                      key={f.id}
                      href={`/files?folder_id=${f.id}`}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <FolderClosed className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-semibold truncate text-slate-900 dark:text-slate-100">
                          {f.name}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Uploads (2 cols) */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-vault-500" />
                  <span>Recent Files</span>
                </h3>
                <a
                  href="/recent"
                  className="text-xs text-vault-600 dark:text-vault-400 hover:underline flex items-center gap-1 font-medium"
                >
                  <span>See More</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>

              {recentFiles.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs mb-3">No files uploaded yet</p>
                  <button
                    onClick={() => setUploadOpen(true)}
                    className="text-xs font-semibold text-vault-500 hover:underline"
                  >
                    + Upload your first file
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentFiles.map((file) => (
                    <div
                      key={file.id}
                      onClick={() => setPreviewFile(file)}
                      className="py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 text-slate-500">
                          <File className="w-4 h-4 text-vault-500" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                            {file.original_name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatBytes(file.size_bytes)} &bull; {formatDate(file.created_at)}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs text-vault-600 dark:text-vault-400 font-medium shrink-0">
                        View
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadSuccess={() => {
          setUploadOpen(false);
          loadDashboardData();
        }}
      />
      <CreateFolderModal
        isOpen={folderOpen}
        onClose={() => setFolderOpen(false)}
        onSuccess={() => {
          setFolderOpen(false);
          loadDashboardData();
        }}
      />
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
}
