import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, HealthResponse } from '../types';
import { androidApi } from '../lib/api';

interface AuthContextType {
  user: User | null;
  serverUrl: string;
  loading: boolean;
  updateServerUrl: (url: string) => Promise<boolean>;
  testConnection: (url?: string) => Promise<HealthResponse>;
  login: (u: string, p: string) => Promise<void>;
  register: (u: string, e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [serverUrl, setServerUrl] = useState<string>(androidApi.getServerUrl());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        await androidApi.init();
        setServerUrl(androidApi.getServerUrl());
        const me = await androidApi.getMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const updateServerUrl = async (newUrl: string): Promise<boolean> => {
    try {
      await androidApi.testConnection(newUrl);
      await androidApi.setServerUrl(newUrl);
      setServerUrl(androidApi.getServerUrl());
      return true;
    } catch {
      return false;
    }
  };

  const testConnection = async (url?: string): Promise<HealthResponse> => {
    return androidApi.testConnection(url);
  };

  const login = async (u: string, p: string) => {
    const res = await androidApi.login({ username_or_email: u, password: p });
    setUser(res.user);
  };

  const register = async (u: string, e: string, p: string) => {
    await androidApi.register({ username: u, email: e, password: p });
    await login(u, p);
  };

  const logout = async () => {
    await androidApi.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const me = await androidApi.getMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        serverUrl,
        loading,
        updateServerUrl,
        testConnection,
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
