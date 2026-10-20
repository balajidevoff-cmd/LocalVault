'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Cloud,
  Download,
  Lock,
  File,
  AlertCircle,
  Loader2,
  Server,
  Settings,
  RefreshCw,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { api, formatBytes, formatDate } from '@/lib/api';
import { PublicShareMetadata } from '@/types';
import { useAuth } from '@/context/AuthContext';

function PublicShareContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const backendParam = searchParams.get('backend');

  const { testAndSaveServerUrl, serverUrl } = useAuth();

  const [metadata, setMetadata] = useState<PublicShareMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  // Server URL configuration drawer state
  const [showConfig, setShowConfig] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // If ?backend= is provided in the URL and differs from current base, update api client
  useEffect(() => {
    if (backendParam && backendParam.trim()) {
      const decoded = decodeURIComponent(backendParam.trim());
      api.setServerUrl(decoded);
    }
  }, [backendParam]);

  const loadMeta = async () => {
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
  };

  useEffect(() => {
    if (token) {
      loadMeta();
    }
  }, [token, backendParam]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setAuthenticated(true);
  };

  const handleSaveServerUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingConnection(true);
    setConfigError(null);
    setConfigSuccess(null);

    const result = await testAndSaveServerUrl(customUrlInput);
    setTestingConnection(false);

    if (result.success) {
      setConfigSuccess(`Connected to LocalVault (${result.data?.database || 'healthy'})`);
      setTimeout(() => {
        setShowConfig(false);
        setConfigSuccess(null);
        loadMeta();
      }, 1500);
    } else {
      setConfigError(result.error || 'Connection failed');
    }
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

        <button
          onClick={() => {
            setCustomUrlInput(api.getBaseUrl());
            setShowConfig(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Server Connection</span>
        </button>
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

            <div className="flex flex-col gap-2">
              <button
                onClick={loadMeta}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-vault-600 hover:bg-vault-500 text-white font-medium text-xs shadow-md transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>

              <button
                onClick={() => {
                  setCustomUrlInput(api.getBaseUrl());
                  setShowConfig(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs transition-colors"
              >
                Configure Server URL
              </button>
            </div>
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
              {metadata.expires_at && (
                <div className="text-[11px] text-amber-500 mt-1">
                  Expires {formatDate(metadata.expires_at)}
                </div>
              )}
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
                {metadata.permission === 'download' ? (
                  <a
                    href={downloadUrl}
                    download={metadata.filename}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-vault-600 hover:bg-vault-500 text-white font-semibold text-sm shadow-lg shadow-vault-600/25 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download File ({formatBytes(metadata.size_bytes)})</span>
                  </a>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
                    This file is shared for viewing only.
                  </div>
                )}

                {metadata.mime_type.startsWith('image/') && (
                  <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-2 bg-slate-50 dark:bg-slate-950">
                    <img
                      src={downloadUrl}
                      alt={metadata.filename}
                      className="max-h-72 mx-auto object-contain rounded-lg"
                    />
                  </div>
                )}

                {metadata.mime_type.startsWith('video/') && (
                  <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-2 bg-slate-50 dark:bg-slate-950">
                    <video
                      controls
                      preload="auto"
                      playsInline
                      src={downloadUrl}
                      className="max-h-72 w-full mx-auto rounded-lg"
                    />
                  </div>
                )}

                {metadata.mime_type.startsWith('audio/') && (
                  <div className="mt-4 p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950">
                    <audio controls src={downloadUrl} className="w-full" />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* Server Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Server className="w-4 h-4 text-vault-500" />
              Configure LocalVault Server
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Enter the active HTTPS URL of your LocalVault server or Cloudflare Tunnel:
            </p>

            <form onSubmit={handleSaveServerUrl} className="space-y-4">
              <input
                type="text"
                required
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://your-tunnel.trycloudflare.com/api/v1"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-vault-500"
              />

              {configError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-500">
                  {configError}
                </div>
              )}

              {configSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{configSuccess}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testingConnection}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-vault-600 hover:bg-vault-500 text-white font-medium shadow-sm transition-all"
                >
                  {testingConnection && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Test & Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicSharePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14]">
          <Loader2 className="w-8 h-8 animate-spin text-vault-500" />
        </div>
      }
    >
      <PublicShareContent />
    </Suspense>
  );
}
