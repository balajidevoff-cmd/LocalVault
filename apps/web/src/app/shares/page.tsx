'use client';

import React, { useState, useEffect } from 'react';
import { Share2, Trash2, Copy, Check, Lock, Clock, ExternalLink, RefreshCw } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { api, formatDate } from '@/lib/api';
import { ShareResponse } from '@/types';
import { useToast } from '@/context/ToastContext';

export default function SharesPage() {
  const [shares, setShares] = useState<ShareResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { success, error } = useToast();

  const loadShares = async () => {
    setLoading(true);
    try {
      const data = await api.listShares();
      setShares(data);
    } catch (err: any) {
      error(err.message || 'Failed to load shared links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShares();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this share link? Visitors will no longer be able to access the file.')) return;
    try {
      await api.revokeShare(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
      success('Share link revoked');
    } catch (err: any) {
      error(err.message || 'Failed to revoke share link');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Active Share Links</h1>
              <p className="text-xs text-slate-400">
                Manage public links generated for sharing files with others
              </p>
            </div>
            <button
              onClick={loadShares}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-200"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-vault-500 mb-3" />
              <p className="text-xs">Loading shared links...</p>
            </div>
          ) : shares.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <Share2 className="w-8 h-8 text-vault-500" />
              </div>
              <h3 className="font-semibold text-sm mb-1">No Active Share Links</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You haven&apos;t shared any files yet. To share a file, open its context menu in My Files and select &quot;Share Link&quot;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-vault-500/10 text-vault-600 dark:text-vault-400 border border-vault-500/20">
                        {share.permission} permission
                      </span>
                      <span className="text-xs text-slate-400">
                        {share.access_count} downloads/views
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" />
                        <span>{share.has_password ? 'Password Protected' : 'No Password'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {share.expires_at ? `Expires ${formatDate(share.expires_at)}` : 'Permanent Link'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      Created {formatDate(share.created_at)}
                    </span>
                    <button
                      onClick={() => handleRevoke(share.id)}
                      className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 font-medium p-1 hover:bg-rose-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revoke</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
