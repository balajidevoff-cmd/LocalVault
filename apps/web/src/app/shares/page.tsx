'use client';

import React, { useState, useEffect } from 'react';
import {
  Share2,
  Trash2,
  Lock,
  Clock,
  RefreshCw,
  UserCheck,
  Globe,
  Download,
  Eye,
  File,
  User,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { FilePreviewModal } from '@/components/FilePreviewModal';
import { api, formatBytes, formatDate } from '@/lib/api';
import { FileItem, ShareResponse, SharedWithMeItem } from '@/types';
import { useToast } from '@/context/ToastContext';

export default function SharesPage() {
  const [tab, setTab] = useState<'received' | 'created'>('received');
  const [receivedShares, setReceivedShares] = useState<SharedWithMeItem[]>([]);
  const [createdShares, setCreatedShares] = useState<ShareResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const { success, error } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [received, created] = await Promise.all([
        api.listSharedWithMe(),
        api.listShares(),
      ]);
      setReceivedShares(received);
      setCreatedShares(created);
    } catch (err: any) {
      error(err.message || 'Failed to load shares');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke access? The recipient or public visitors will no longer be able to access this file.')) return;
    try {
      await api.revokeShare(id);
      setCreatedShares((prev) => prev.filter((s) => s.id !== id));
      success('Share access revoked');
    } catch (err: any) {
      error(err.message || 'Failed to revoke share');
    }
  };

  const handleOpenPreview = (item: SharedWithMeItem) => {
    const dummyFileItem: FileItem = {
      id: item.file_id,
      owner_id: item.owner_id,
      original_name: item.file_name,
      mime_type: item.mime_type,
      size_bytes: item.size_bytes,
      checksum_sha256: '',
      is_starred: false,
      is_deleted: false,
      created_at: item.created_at,
      updated_at: item.created_at,
    };
    setPreviewFile(dummyFileItem);
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
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Shared Files</h1>
              <p className="text-xs text-slate-400">
                Manage files shared with you and links you have shared with others
              </p>
            </div>
            <button
              onClick={loadData}
              className="self-start sm:self-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-200"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
            <button
              onClick={() => setTab('received')}
              className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                tab === 'received'
                  ? 'border-vault-500 text-vault-600 dark:text-vault-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Shared with Me ({receivedShares.length})</span>
            </button>

            <button
              onClick={() => setTab('created')}
              className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                tab === 'created'
                  ? 'border-vault-500 text-vault-600 dark:text-vault-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Shared by Me ({createdShares.length})</span>
            </button>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-vault-500 mb-3" />
              <p className="text-xs">Loading shared files...</p>
            </div>
          ) : tab === 'received' ? (
            /* Shared with Me */
            receivedShares.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <UserCheck className="w-8 h-8 text-vault-500" />
                </div>
                <h3 className="font-semibold text-sm mb-1">No Files Shared With You</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When another LocalVault user grants you access to their files, they will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {receivedShares.map((item) => (
                  <div
                    key={item.share_id}
                    className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-vault-500/10 text-vault-500 flex items-center justify-center shrink-0">
                          <File className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate" title={item.file_name}>
                            {item.file_name}
                          </h4>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatBytes(item.size_bytes)} &bull; {item.mime_type}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 mb-4 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <User className="w-3.5 h-3.5" />
                            Owner:
                          </span>
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            @{item.owner_username}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Permission:</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-vault-500/10 text-vault-600 dark:text-vault-400">
                            {item.permission}
                          </span>
                        </div>
                        {item.expires_at && (
                          <div className="flex items-center justify-between text-amber-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expires:
                            </span>
                            <span>{formatDate(item.expires_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenPreview(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>

                      {item.permission === 'download' && (
                        <a
                          href={api.getFileDownloadUrl(item.file_id)}
                          download={item.file_name}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vault-600 hover:bg-vault-500 text-white text-xs font-medium shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Shared by Me */
            createdShares.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 mx-auto mb-3">
                  <Share2 className="w-8 h-8 text-vault-500" />
                </div>
                <h3 className="font-semibold text-sm mb-1">No Active Shares</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  You haven&apos;t shared any files yet. To share a file, open its context menu in My Files and choose &quot;Share File&quot;.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {createdShares.map((share) => (
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
                          {share.access_count} access(es)
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mb-2">
                        {share.file_name || 'Shared File'}
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4">
                        <div className="flex items-center gap-2">
                          {share.shared_with_username ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-vault-500" />
                              <span>Shared with @{share.shared_with_username}</span>
                            </>
                          ) : (
                            <>
                              <Globe className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Public Link ({share.has_password ? 'Password Protected' : 'No Password'})</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {share.expires_at ? `Expires ${formatDate(share.expires_at)}` : 'Permanent'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {formatDate(share.created_at)}
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
            )
          )}
        </main>
      </div>

      {previewFile && (
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          file={previewFile}
        />
      )}
    </div>
  );
}

