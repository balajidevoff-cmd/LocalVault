'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, HealthResponse } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  firstRunRequired: boolean;
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

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
      api.setToken(null);
    }
  }, []);

  // Check server health & auth session on mount
  useEffect(() => {
    let mounted = true;
    async function initAuth() {
      setLoading(true);
      try {
        const health = await api.checkHealth();
        if (mounted && health.first_run_setup_required) {
          setFirstRunRequired(true);
        }

        const me = await api.getMe();
        if (mounted) setUser(me);
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

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
