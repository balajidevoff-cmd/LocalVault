'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  User as UserIcon,
  Lock,
  Shield,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api, formatBytes, formatDate } from '@/lib/api';
import { User } from '@/types';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'admin'>('account');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Admin users state
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const { success, error } = useToast();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      error('Password must be at least 8 characters');
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      error(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const loadAdminUsers = React.useCallback(async () => {
    if (user?.role !== 'admin') return;
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      setUsersList(data);
    } catch (err: any) {
      error(err.message || 'Failed to load user accounts');
    } finally {
      setLoadingUsers(false);
    }
  }, [user?.role, error]);

  useEffect(() => {
    if (activeTab === 'admin' && user?.role === 'admin') {
      loadAdminUsers();
    }
  }, [activeTab, user?.role, loadAdminUsers]);

  const toggleUserActive = async (targetUser: User) => {
    try {
      const updated = await api.updateUser(targetUser.id, { is_active: !targetUser.is_active });
      setUsersList((prev) => prev.map((u) => (u.id === targetUser.id ? updated : u)));
      success(`User ${updated.username} ${updated.is_active ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      error(err.message || 'Failed to update user');
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

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-vault-500" />
            <h1 className="text-xl font-bold tracking-tight">Settings & Security</h1>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 text-sm font-medium gap-6">
            <button
              onClick={() => setActiveTab('account')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'account'
                  ? 'border-vault-500 text-vault-600 dark:text-vault-400 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Account & Password
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`pb-3 border-b-2 transition-colors ${
                  activeTab === 'admin'
                    ? 'border-vault-500 text-vault-600 dark:text-vault-400 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Administrator Controls
              </button>
            )}
          </div>

          {activeTab === 'account' ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-vault-500" />
                  <span>Profile Overview</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Username</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {user?.username}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Email</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {user?.email}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Role</span>
                    <span className="font-semibold capitalize text-vault-600 dark:text-vault-400 text-sm">
                      {user?.role}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block mb-0.5">Member Since</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                      {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Password Change Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-vault-500" />
                  <span>Change Password</span>
                </h3>

                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      New Password (Min 8 characters)
                    </label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-vault-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-vault-600 hover:bg-vault-500 rounded-xl shadow-md shadow-vault-600/20 active:scale-95 disabled:opacity-50"
                  >
                    {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Update Password</span>
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Admin Tab */
            <div className="space-y-6">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="w-4 h-4 text-vault-500" />
                    <span>Registered Vault Users ({usersList.length})</span>
                  </h3>
                  <button
                    onClick={loadAdminUsers}
                    className="text-xs text-vault-600 dark:text-vault-400 hover:underline"
                  >
                    Refresh List
                  </button>
                </div>

                {loadingUsers ? (
                  <div className="py-8 text-center text-slate-400">Loading users...</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {usersList.map((u) => (
                      <div
                        key={u.id}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {u.username}{' '}
                            {u.role === 'admin' && (
                              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] bg-vault-500/10 text-vault-600 dark:text-vault-400 border border-vault-500/20 uppercase font-bold">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 text-[11px]">{u.email}</div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleUserActive(u)}
                            disabled={u.id === user?.id}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                              u.is_active
                                ? 'bg-emerald-500/10 text-emerald-600 hover:bg-rose-500/10 hover:text-rose-600'
                                : 'bg-rose-500/10 text-rose-600 hover:bg-emerald-500/10 hover:text-emerald-600'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Deactivated'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
