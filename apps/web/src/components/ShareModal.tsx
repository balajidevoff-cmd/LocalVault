'use client';

import React, { useState } from 'react';
import { Share2, X, Copy, Check, Lock, Clock, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { FileItem, ShareResponse } from '@/types';
import { useToast } from '@/context/ToastContext';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, file }) => {
  const [permission, setPermission] = useState<'view' | 'download'>('view');
  const [password, setPassword] = useState('');
  const [expiryHours, setExpiryHours] = useState<number | undefined>(undefined);
  const [createdShare, setCreatedShare] = useState<ShareResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  if (!isOpen || !file) return null;

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const share = await api.createShare({
        file_id: file.id,
        permission,
        password: password.trim() || undefined,
        expires_in_hours: expiryHours,
      });
      setCreatedShare(share);
      success('Public share link generated');
    } catch (err: any) {
      error(err.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const getFullShareUrl = (rawToken?: string | null) => {
    if (!rawToken) return '';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/share/${rawToken}`;
    }
    return `/share/${rawToken}`;
  };

  const copyToClipboard = () => {
    if (!createdShare?.raw_token) return;
    const url = getFullShareUrl(createdShare.raw_token);
    navigator.clipboard.writeText(url);
    setCopied(true);
    success('Link copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-vault-500" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Share File</h3>
          </div>
          <button
            onClick={() => {
              setCreatedShare(null);
              onClose();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">File to share</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
              {file.original_name}
            </div>
          </div>

          {!createdShare ? (
            <form onSubmit={handleCreateShare} className="space-y-4">
              {/* Permission */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Access Permission
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPermission('view')}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                      permission === 'view'
                        ? 'border-vault-500 bg-vault-50 dark:bg-vault-500/10 text-vault-700 dark:text-vault-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    View Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermission('download')}
                    className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                      permission === 'download'
                        ? 'border-vault-500 bg-vault-50 dark:bg-vault-500/10 text-vault-700 dark:text-vault-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Allow Download
                  </button>
                </div>
              </div>

              {/* Optional Password */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Password Protection (Optional)</span>
                  </div>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for no password"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none transition-all"
                />
              </div>

              {/* Optional Expiration */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expiration</span>
                  </div>
                </label>
                <select
                  value={expiryHours || ''}
                  onChange={(e) => setExpiryHours(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none transition-all"
                >
                  <option value="">Never Expires</option>
                  <option value="24">24 Hours</option>
                  <option value="168">7 Days</option>
                  <option value="720">30 Days</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-vault-600 hover:bg-vault-500 text-white text-sm font-medium shadow-md shadow-vault-600/20 transition-all active:scale-98"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Generate Link</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                Link generated! Anyone with this link can {createdShare.permission} this file
                {createdShare.has_password && ' (password required)'}.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Public Share URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getFullShareUrl(createdShare.raw_token)}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 select-all outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-vault-600 hover:bg-vault-500 text-white text-xs font-medium shadow-sm transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setCreatedShare(null);
                    onClose();
                  }}
                  className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
