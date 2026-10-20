'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/navigation';
import { usePathname } from 'next/navigation';
import {
  HardDrive,
  FolderClosed,
  Clock,
  Star,
  Share2,
  Trash2,
  PieChart,
  Settings,
  LogOut,
  Plus,
  Cloud,
  FolderPlus,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api, formatBytes } from '@/lib/api';
import { StorageUsageResponse } from '@/types';

interface SidebarProps {
  onNewFolderClick?: () => void;
  onUploadClick?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onNewFolderClick,
  onUploadClick,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [usage, setUsage] = useState<StorageUsageResponse | null>(null);
  const [showNewMenu, setShowNewMenu] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function fetchUsage() {
      try {
        const data = await api.getStorageUsage();
        if (mounted) setUsage(data);
      } catch {}
    }
    fetchUsage();
    return () => {
      mounted = false;
    };
  }, [pathname]);

  const navItems = [
    { label: 'Dashboard', href: '/', icon: HardDrive },
    { label: 'My Files', href: '/files', icon: FolderClosed },
    { label: 'Recent', href: '/recent', icon: Clock },
    { label: 'Starred', href: '/starred', icon: Star },
    { label: 'Shared Files', href: '/shares', icon: Share2 },
    { label: 'Trash', href: '/trash', icon: Trash2 },
    { label: 'Storage', href: '/storage', icon: PieChart },
    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', href: '/admin', icon: ShieldCheck }] : []),
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const usagePercent = usage ? Math.min(100, Math.max(0, usage.user_usage_percentage)) : 0;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 border-r border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-[#0c1222]/95 backdrop-blur-xl flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 flex flex-col h-full overflow-y-auto">
          {/* Logo Branding */}
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-vault-600 to-vault-400 flex items-center justify-center text-white shadow-lg shadow-vault-500/25">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                LocalVault
              </span>
              <span className="block text-[11px] text-vault-600 dark:text-vault-400 font-medium">
                Self-Hosted SSD Cloud
              </span>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="relative mb-6">
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-vault-600 hover:bg-vault-500 text-white font-medium shadow-lg shadow-vault-600/25 transition-all active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>New Item</span>
            </button>

            {/* Dropdown Menu */}
            {showNewMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowNewMenu(false)}
                />
                <div className="absolute top-14 left-0 right-0 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-2 animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      onUploadClick?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <Upload className="w-4 h-4 text-vault-500" />
                    <span>Upload File</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowNewMenu(false);
                      onNewFolderClick?.();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <FolderPlus className="w-4 h-4 text-amber-500" />
                    <span>New Folder</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                    active
                      ? 'bg-vault-50 dark:bg-vault-500/10 text-vault-700 dark:text-vault-300 font-semibold border-l-4 border-vault-500 pl-3'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-vault-500' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </a>
              );
            })}
          </nav>

          {/* Storage Gauge */}
          <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
              <span className="font-medium">Storage Quota</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  usagePercent > 90
                    ? 'bg-rose-500'
                    : usagePercent > 70
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-vault-500 to-vault-400'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {usage ? (
                <>
                  {formatBytes(usage.user_used_bytes)} used of {formatBytes(usage.user_quota_bytes)}
                </>
              ) : (
                'Calculating quota...'
              )}
            </div>
          </div>

          {/* User profile & Logout */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 uppercase">
                {user?.username ? user.username.substring(0, 2) : 'LV'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {user?.username || 'User'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.role === 'admin' ? 'Administrator' : 'Standard User'}
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
