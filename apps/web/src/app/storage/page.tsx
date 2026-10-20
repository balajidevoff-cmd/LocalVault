'use client';

import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Server,
  Database,
  CheckCircle2,
  AlertCircle,
  PieChart,
  ShieldCheck,
  RefreshCw,
  FolderClosed,
  File,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { api, formatBytes } from '@/lib/api';
import { StorageStatusResponse, StorageUsageResponse } from '@/types';

export default function StoragePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [status, setStatus] = useState<StorageStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([
        api.getStorageUsage(),
        api.getStorageStatus(),
      ]);
      setUsage(u);
      setStatus(s);
    } catch (err) {
      console.error('Failed to load storage status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const usagePercent = usage ? Math.min(100, Math.max(0, usage.user_usage_percentage)) : 0;
  const diskUsedPercent = status && status.disk_total_bytes > 0
    ? Math.round((status.disk_used_bytes / status.disk_total_bytes) * 100)
    : 0;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Storage Analytics & Host Health</h1>
              <p className="text-xs text-slate-400">
                Live metrics from your host Windows laptop filesystem and SQLite database
              </p>
            </div>
            <button
              onClick={loadData}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Health Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Host Disk Health */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                <Server className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">Host Local SSD</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {status ? (
                    <>
                      {formatBytes(status.disk_free_bytes)} free of {formatBytes(status.disk_total_bytes)}
                    </>
                  ) : (
                    'Checking...'
                  )}
                </p>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${diskUsedPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Storage Root Engine */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-vault-500/10 text-vault-500 flex items-center justify-center shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">Storage Directory</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold uppercase">
                    Writable
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sub-sharded local objects repository with SHA-256 verification
                </p>
              </div>
            </div>

            {/* Database Engine */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                <Database className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">Metadata Database</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  SQLite with WAL mode and foreign key integrity enforcement
                </p>
              </div>
            </div>
          </div>

          {/* User Quota vs Physical Capacity */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">User Quota Allocation</span>
                <span className="text-xs font-semibold text-vault-600 dark:text-vault-400">
                  {usagePercent}% utilized
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-vault-500 transition-all duration-500 rounded-full"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{usage ? formatBytes(usage.user_used_bytes) : '0 B'} used</span>
                <span>{usage ? formatBytes(usage.user_quota_bytes) : '250 GB'} limit</span>
              </div>
            </div>

            {/* Category breakdown table */}
            {usage && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
                  Distribution by Category
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {usage.categories.map((cat) => (
                    <div
                      key={cat.category}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold capitalize text-sm block">
                          {cat.category}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {cat.count} {cat.count === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatBytes(cat.size_bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Architecture notes */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 text-white shadow-lg space-y-3">
            <div className="flex items-center gap-2 text-vault-400 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Host SSD Data Storage Architecture</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Uploaded files are stored directly on the Windows laptop disk in the configured storage root, sharded by SHA-256 keys. No data is sent to external cloud providers. Database records maintain only metadata, checksums, and folder hierarchies.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
