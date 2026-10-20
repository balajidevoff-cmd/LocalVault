'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Cloud,
  Download,
  Lock,
  File,
  FileText,
  AlertCircle,
  Eye,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { api, formatBytes, formatDate } from '@/lib/api';
import { PublicShareMetadata } from '@/types';

export default function PublicSharePage() {
  const params = useParams();
  const token = params.token as string;

  const [metadata, setMetadata] = useState<PublicShareMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function loadMeta() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const meta = await api.getPublicShareMetadata(token);
        setMetadata(meta);
        if (!meta.requires_password) {
          setAuthenticated(true);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Share link not found or expired.');
      } finally {
        setLoading(false);
      }
    }
    if (token) loadMeta();
  }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setAuthenticated(true);
  };

  const downloadUrl = api.getPublicDownloadUrl(token, authenticated ? password : '');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0c1222]/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-vault-600 to-vault-400 flex items-center justify-center text-white shadow-md">
            <Cloud className="w-4 h-4" />
          </div>
          <span className="font-bold text-base bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            LocalVault Shared File
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-vault-500" />
            <span className="text-sm">Retrieving shared file...</span>
          </div>
        ) : errorMsg ? (
          <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-bold mb-2">Link Unavailable</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{errorMsg}</p>
          </div>
        ) : metadata ? (
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
            {/* File Header */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-vault-500/10 text-vault-500 flex items-center justify-center mx-auto mb-4">
                <File className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate px-2">
                {metadata.filename}
              </h2>
              <div className="text-xs text-slate-400 mt-1">
                {formatBytes(metadata.size_bytes)} &bull; {metadata.mime_type}
              </div>
            </div>

            {/* Password required prompt */}
            {metadata.requires_password && !authenticated ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>This share link is password-protected by the owner.</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Enter Password
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-vault-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-vault-600 hover:bg-vault-500 text-white font-medium text-xs shadow-md transition-all"
                >
                  Unlock File
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <a
                  href={downloadUrl}
                  download={metadata.filename}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-vault-600 hover:bg-vault-500 text-white font-semibold text-sm shadow-lg shadow-vault-600/25 transition-all active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File ({formatBytes(metadata.size_bytes)})</span>
                </a>

                {metadata.permission === 'view' && metadata.mime_type.startsWith('image/') && (
                  <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-2 bg-slate-50 dark:bg-slate-950">
                    <img
                      src={downloadUrl}
                      alt={metadata.filename}
                      className="max-h-60 mx-auto object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
