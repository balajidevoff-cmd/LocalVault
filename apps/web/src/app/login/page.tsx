'use client';

import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Lock,
  User,
  Mail,
  ShieldAlert,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Server,
  Settings,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export default function LoginPage() {
  const {
    login,
    register,
    firstRunRequired,
    loading,
    serverStatus,
    serverUrl,
    setServerUrl,
    recheckConnection,
  } = useAuth();

  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Server URL configuration drawer state
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const { error, success } = useToast();

  const isSetupMode = firstRunRequired || isRegister;

  useEffect(() => {
    if (serverUrl) {
      setCustomUrlInput(serverUrl);
    }
  }, [serverUrl]);

  const handleSaveServerUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingConnection(true);
    setConfigError(null);
    setConfigSuccess(null);

    const targetUrl = customUrlInput.trim();
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && targetUrl.startsWith('http://')) {
      setConfigError('Mixed Content: This site is HTTPS. Modern browsers block HTTP API connections. Please use an HTTPS tunnel URL.');
      setTestingConnection(false);
      return;
    }

    const ok = await setServerUrl(targetUrl);
    setTestingConnection(false);

    if (ok) {
      setConfigSuccess('Successfully connected to LocalVault server!');
      success('Connected to backend server');
      setTimeout(() => {
        setShowServerConfig(false);
        setConfigSuccess(null);
      }, 1200);
    } else {
      setConfigError(
        'Could not reach server at this URL. Make sure FastAPI is running on your laptop and your HTTPS tunnel is active.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (isSetupMode && password !== confirmPassword) {
      error('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      if (isSetupMode) {
        await register(username.trim(), email.trim(), password);
        success('Account created successfully');
      } else {
        await login(username.trim(), password);
        success('Signed in successfully');
      }
    } catch (err: any) {
      const msg = err.message || 'Authentication failed';
      error(msg);
      if (msg.includes('Cannot reach') || msg.includes('not configured')) {
        setShowServerConfig(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-slate-50 to-vault-50/20 dark:from-[#060a14] dark:via-[#0c1222] dark:to-[#08151f]">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur-xl">
        {/* Logo and Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-vault-600 to-vault-400 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-vault-500/25">
            <Cloud className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {firstRunRequired ? 'Setup LocalVault' : isRegister ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {firstRunRequired
              ? 'Initialize the first administrator account for your local SSD server.'
              : isRegister
              ? 'Register a personal account on your local cloud server.'
              : 'Sign in to access your self-hosted files and folders.'}
          </p>
        </div>

        {/* Server Connection Status Banner */}
        <div className="mb-5">
          {serverStatus === 'connected' ? (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate font-medium">Server Connected</span>
              </div>
              <button
                type="button"
                onClick={() => setShowServerConfig(!showServerConfig)}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 ml-2 font-medium"
              >
                {showServerConfig ? 'Hide' : 'Configure'}
              </button>
            </div>
          ) : serverStatus === 'checking' ? (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-vault-500" />
                <span>Checking backend connection...</span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">
                      {serverStatus === 'unconfigured' ? 'Backend Not Configured' : 'Backend Server Unreachable'}
                    </span>
                    <span className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                      {serverStatus === 'unconfigured'
                        ? 'Set NEXT_PUBLIC_API_URL in Vercel or configure your HTTPS tunnel URL below.'
                        : 'Cannot reach your laptop backend. Ensure FastAPI and your tunnel are running.'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowServerConfig(!showServerConfig)}
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-medium text-[11px] text-amber-900 dark:text-amber-200 shrink-0 transition-colors"
                >
                  {showServerConfig ? 'Close' : 'Configure'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Server URL Configuration Form */}
        {showServerConfig && (
          <form
            onSubmit={handleSaveServerUrl}
            className="mb-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-vault-500" />
                Backend Connection URL
              </span>
              <button
                type="button"
                onClick={recheckConnection}
                disabled={testingConnection}
                className="text-[11px] text-slate-500 hover:text-vault-500 flex items-center gap-1"
                title="Re-check connection"
              >
                <RefreshCw className={`w-3 h-3 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>Retry</span>
              </button>
            </div>

            <div>
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://your-tunnel.trycloudflare.com/api/v1"
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none font-mono"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 leading-normal">
                Enter your secure Cloudflare Tunnel, Tailscale Funnel, or reverse-proxy HTTPS URL. Defaults to{' '}
                <code className="text-vault-600 dark:text-vault-400">/api/v1</code> for local development.
              </p>
            </div>

            {configError && (
              <div className="text-[11px] text-red-600 dark:text-red-400 leading-snug">
                {configError}
              </div>
            )}

            {configSuccess && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{configSuccess}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setServerUrl(null);
                  setCustomUrlInput('/api/v1');
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Reset Default
              </button>
              <button
                type="submit"
                disabled={testingConnection}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vault-600 hover:bg-vault-500 text-white font-medium text-xs shadow-md shadow-vault-600/20 disabled:opacity-50"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <span>Test & Save</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* First Run Alert Banner */}
        {firstRunRequired && (
          <div className="mb-6 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">First-Run Administrator Setup</span>
              This initial account will automatically be granted full administrator access.
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none transition-all"
              />
            </div>
          </div>

          {isSetupMode && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@localvault.internal"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none transition-all"
              />
            </div>
          </div>

          {isSetupMode && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-vault-600 hover:bg-vault-500 text-white font-medium text-sm shadow-lg shadow-vault-600/25 transition-all active:scale-[0.98] mt-2 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{firstRunRequired ? 'Complete Setup' : isRegister ? 'Register' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Toggle Register / Login */}
        {!firstRunRequired && (
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-vault-600 dark:text-vault-400 hover:underline font-medium"
            >
              {isRegister
                ? 'Already have an account? Sign in instead'
                : "Don't have an account? Register here"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
