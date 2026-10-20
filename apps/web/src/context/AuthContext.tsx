'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, HealthResponse } from '@/types';
import { api, TestConnectionResult } from '@/lib/api';

export type ServerStatus = 'checking' | 'connected' | 'unreachable' | 'unconfigured';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  firstRunRequired: boolean;
  serverStatus: ServerStatus;
  serverUrl: string;
  testAndSaveServerUrl: (candidateUrl: string) => Promise<TestConnectionResult>;
  resetServerUrl: () => Promise<void>;
  setServerUrl: (url: string | null) => Promise<boolean>;
  recheckConnection: () => Promise<void>;
  darkMode: boolean;
  toggleDarkMode: () => void;
  login: (usernameOrEmail: string, pass: string) => Promise<void>;
  register: (username: string, email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [firstRunRequired, setFirstRunRequired] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
  const [serverUrl, setServerUrlState] = useState<string>('');
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('localvault_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('localvault_theme', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  }, []);

  const initAuth = useCallback(async () => {
    setLoading(true);
    const currentUrl = api.getBaseUrl();
    setServerUrlState(currentUrl);

    if (!currentUrl) {
      setServerStatus('unconfigured');
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const health = await api.checkHealth();
      setServerStatus('connected');
      if (health.first_run_setup_required) {
        setFirstRunRequired(true);
      } else {
        setFirstRunRequired(false);
      }

      // Check current user session if token exists
      if (api.getToken()) {
        try {
          const me = await api.getMe();
          setUser(me);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('not configured')) {
        setServerStatus('unconfigured');
      } else {
        setServerStatus('unreachable');
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check server health & auth session on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
      api.setTokens(null, null);
    }
  }, []);

  /**
   * Tests candidate URL against /health first.
   * Only saves to localStorage if the health check passes with HTTP 200.
   */
  const testAndSaveServerUrl = useCallback(
    async (candidateUrl: string): Promise<TestConnectionResult> => {
      const result = await api.testServerUrl(candidateUrl);
      if (result.success && result.normalizedUrl) {
        api.setServerUrl(result.normalizedUrl);
        setServerUrlState(result.normalizedUrl);
        setServerStatus('connected');
        if (result.data?.first_run_setup_required) {
          setFirstRunRequired(true);
        } else {
          setFirstRunRequired(false);
        }
        await refreshUser();
      }
      return result;
    },
    [refreshUser]
  );

  const resetServerUrl = useCallback(async () => {
    api.setServerUrl(null);
    const defaultUrl = api.getBaseUrl();
    setServerUrlState(defaultUrl);
    await initAuth();
  }, [initAuth]);

  const setServerUrl = useCallback(
    async (url: string | null): Promise<boolean> => {
      if (url) {
        const res = await testAndSaveServerUrl(url);
        return res.success;
      } else {
        await resetServerUrl();
        return true;
      }
    },
    [testAndSaveServerUrl, resetServerUrl]
  );

  const recheckConnection = useCallback(async () => {
    await initAuth();
  }, [initAuth]);

  // Protect pages
  useEffect(() => {
    if (loading) return;
    const publicPages = ['/login', '/share'];
    const isPublic = publicPages.some((p) => pathname.startsWith(p));

    if (!user && !isPublic) {
      router.push('/login');
    } else if (user && pathname === '/login') {
      router.push('/');
    }
  }, [user, loading, pathname, router]);

  const login = async (usernameOrEmail: string, pass: string) => {
    const res = await api.login({ username_or_email: usernameOrEmail, password: pass });
    setUser(res.user);
    setFirstRunRequired(false);
    router.push('/');
  };

  const register = async (username: string, email: string, pass: string) => {
    await api.register({ username, email, password: pass });
    // After register, auto login
    await login(username, pass);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        firstRunRequired,
        serverStatus,
        serverUrl,
        testAndSaveServerUrl,
        resetServerUrl,
        setServerUrl,
        recheckConnection,
        darkMode,
        toggleDarkMode,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
