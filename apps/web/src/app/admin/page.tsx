'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Users,
  HardDrive,
  FileText,
  Search,
  Trash2,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  File,
  AlertCircle,
  Filter,
  ArrowUpDown,
  Lock,
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api, formatBytes, formatDate } from '@/lib/api';
import {
  AdminAuditLogItem,
  AdminFileItem,
  AdminStatsResponse,
  AdminUserItem,
} from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'files' | 'users' | 'audit'>('files');

  // Stats
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Files tab state
  const [files, setFiles] = useState<AdminFileItem[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [deletedFilter, setDeletedFilter] = useState<string>('active'); // 'active', 'deleted', 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Users tab state
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Audit logs tab state
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Deletion Confirmation Modal State
  const [targetFile, setTargetFile] = useState<AdminFileItem | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'permanent'>('soft');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Protect route client-side (server-side enforced on every API request)
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await api.adminGetStats();
      setStats(data);
    } catch (err: any) {
      error(err.message || 'Failed to load system stats');
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await api.adminListUsers();
      setUsers(data);
    } catch (err: any) {
      error(err.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchFiles = async (currentPage = page) => {
    setLoadingFiles(true);
    try {
      const deletedParam =
        deletedFilter === 'active' ? false : deletedFilter === 'deleted' ? true : undefined;
      const res = await api.adminListFiles({
        user_id: selectedUserId || undefined,
        deleted: deletedParam,
        query: searchQuery.trim() || undefined,
        page: currentPage,
        page_size: pageSize,
      });
      setFiles(res.items);
      setTotalFiles(res.total);
      setPage(res.page);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      error(err.message || 'Failed to load file list');
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const data = await api.adminGetAuditLogs(100);
      setAuditLogs(data);
    } catch (err: any) {
      error(err.message || 'Failed to load audit logs');
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchStats();
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin') {
      if (activeTab === 'files') {
        fetchFiles(1);
      } else if (activeTab === 'users') {
        fetchUsers();
      } else if (activeTab === 'audit') {
        fetchAuditLogs();
      }
    }
  }, [activeTab, selectedUserId, deletedFilter, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles(1);
  };

  const handleOpenDelete = (file: AdminFileItem, mode: 'soft' | 'permanent') => {
    setTargetFile(file);
    setDeleteMode(mode);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetFile) return;
    setIsDeleting(true);
    try {
      const isPermanent = deleteMode === 'permanent';
      const res = await api.adminDeleteFile(targetFile.id, isPermanent, true);
      success(res.message);
      setDeleteModalOpen(false);
      setTargetFile(null);
      // Refresh files and stats
      fetchFiles(page);
      fetchStats();
    } catch (err: any) {
      error(err.message || 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreFile = async (file: AdminFileItem) => {
    try {
      const res = await api.adminRestoreFile(file.id);
      success(res.message);
      fetchFiles(page);
      fetchStats();
    } catch (err: any) {
      error(err.message || 'Failed to restore file');
    }
  };

  if (authLoading || (user && user.role !== 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14]">
        <div className="text-center text-slate-400">
          <ShieldCheck className="w-10 h-10 mx-auto text-vault-500 animate-pulse mb-3" />
          <p className="text-sm">Verifying administrator authorization...</p>
        </div>
      </div>
    );
  }

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
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-vault-500/10 text-vault-500 flex items-center justify-center border border-vault-500/20 shadow-sm">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">System Administration</h1>
                <p className="text-xs text-slate-400">
                  Manage registered users, inspect local SSD file storage, and audit administrative actions
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                fetchStats();
                if (activeTab === 'files') fetchFiles(page);
                if (activeTab === 'users') fetchUsers();
                if (activeTab === 'audit') fetchAuditLogs();
              }}
              className="self-start sm:self-auto p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Refresh all"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Registered Users</span>
                <Users className="w-4 h-4 text-vault-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {stats?.total_users ?? '—'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Total Active Files</span>
                <FileText className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {stats?.total_files ?? '—'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>Local SSD Usage</span>
                <HardDrive className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {stats ? formatBytes(stats.total_storage_bytes) : '—'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span>SSD Free Space</span>
                <HardDrive className="w-4 h-4 text-vault-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
                {stats ? formatBytes(stats.disk_free_bytes) : '—'}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
            <button
              onClick={() => setActiveTab('files')}
              className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'files'
                  ? 'border-vault-500 text-vault-600 dark:text-vault-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <File className="w-4 h-4" />
              <span>User Files Storage</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'users'
                  ? 'border-vault-500 text-vault-600 dark:text-vault-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Registered Users ({users.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'audit'
                  ? 'border-vault-500 text-vault-600 dark:text-vault-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Audit Trail</span>
            </button>
          </div>

          {/* TAB 1: User Files Storage */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by filename or owner username..."
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-vault-500"
                  />
                </form>

                <div className="flex gap-2">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-vault-500"
                  >
                    <option value="">All Users</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        @{u.username} ({u.email})
                      </option>
                    ))}
                  </select>

                  <select
                    value={deletedFilter}
                    onChange={(e) => setDeletedFilter(e.target.value)}
                    className="px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-vault-500"
                  >
                    <option value="active">Active Files</option>
                    <option value="deleted">Trash / Deleted</option>
                    <option value="all">All Files</option>
                  </select>
                </div>
              </div>

              {/* Files Table */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
                {loadingFiles ? (
                  <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                    <RefreshCw className="w-7 h-7 animate-spin text-vault-500 mb-2" />
                    <span className="text-xs">Loading storage files...</span>
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">
                    <File className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
                    <p className="text-xs">No files match your query.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Filename</th>
                          <th className="py-3 px-4">Owner</th>
                          <th className="py-3 px-4">Size</th>
                          <th className="py-3 px-4">Uploaded</th>
                          <th className="py-3 px-4">Storage Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {files.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2.5 max-w-xs truncate">
                              <File className="w-4 h-4 text-vault-500 shrink-0" />
                              <span className="truncate" title={f.original_name}>
                                {f.original_name}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              <div className="font-medium text-slate-800 dark:text-slate-200">
                                @{f.owner_username}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                {f.owner_email}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {formatBytes(f.size_bytes)}
                            </td>
                            <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                              {formatDate(f.created_at)}
                            </td>
                            <td className="py-3 px-4">
                              {f.is_deleted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  In Trash
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {f.is_deleted ? (
                                  <>
                                    <button
                                      onClick={() => handleRestoreFile(f)}
                                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                                      title="Restore to active storage"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenDelete(f, 'permanent')}
                                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                                      title="Permanently erase from SSD"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleOpenDelete(f, 'soft')}
                                      className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
                                      title="Move to user's trash"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleOpenDelete(f, 'permanent')}
                                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                                      title="Permanently erase file"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      Page {page} of {totalPages} ({totalFiles} files total)
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        disabled={page <= 1}
                        onClick={() => fetchFiles(page - 1)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => fetchFiles(page + 1)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Registered Users */}
          {activeTab === 'users' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
              {loadingUsers ? (
                <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                  <RefreshCw className="w-7 h-7 animate-spin text-vault-500 mb-2" />
                  <span className="text-xs">Loading user accounts...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4">Files</th>
                        <th className="py-3 px-4">SSD Storage Used</th>
                        <th className="py-3 px-4">Registered Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {users.map((u) => {
                        const pct = u.quota_bytes > 0 ? Math.min(100, Math.round((u.used_storage_bytes / u.quota_bytes) * 100)) : 0;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                              @{u.username}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              {u.email}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                  u.role === 'admin'
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                              {u.file_count} file(s)
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {formatBytes(u.used_storage_bytes)}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  / {formatBytes(u.quota_bytes)}
                                </span>
                              </div>
                              <div className="w-24 h-1 rounded-full bg-slate-100 dark:bg-slate-800 mt-1 overflow-hidden">
                                <div
                                  className="h-full bg-vault-500 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {formatDate(u.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Audit Trail */}
          {activeTab === 'audit' && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
              {loadingAudit ? (
                <div className="py-20 text-center text-slate-400 flex flex-col items-center">
                  <RefreshCw className="w-7 h-7 animate-spin text-vault-500 mb-2" />
                  <span className="text-xs">Loading audit trail...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-60 text-slate-400" />
                  <p className="text-xs">No administrative actions logged yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Administrator</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Target File & User</th>
                        <th className="py-3 px-4">Result</th>
                        <th className="py-3 px-4">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                            {formatDate(log.timestamp)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            @{log.admin_username}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                log.action.includes('PERMANENT')
                                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                  : log.action.includes('RESTORE')
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            <div className="font-medium truncate max-w-xs">{log.filename}</div>
                            <div className="text-[10px] text-slate-400">
                              Owner: @{log.target_username || 'Unknown'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {log.result === 'SUCCESS' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Success
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-500 font-medium">
                                <XCircle className="w-3.5 h-3.5" />
                                Failure
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate" title={log.details || ''}>
                            {log.details || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Explicit Confirmation Deletion Modal */}
      {deleteModalOpen && targetFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100 mb-2">
              {deleteMode === 'permanent'
                ? 'Permanently Delete User File?'
                : 'Move User File to Trash?'}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              {deleteMode === 'permanent' ? (
                <>
                  This will permanently erase <strong className="text-slate-800 dark:text-slate-200">{targetFile.original_name}</strong> from your laptop&apos;s physical SSD storage and remove all database records. This action <strong>cannot be undone</strong>.
                </>
              ) : (
                <>
                  This will move <strong className="text-slate-800 dark:text-slate-200">{targetFile.original_name}</strong> belonging to @{targetFile.owner_username} to their trash folder. The file remains on SSD storage and can be restored later.
                </>
              )}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs mb-5 space-y-1">
              <div>
                <span className="text-slate-400">File: </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{targetFile.original_name}</span>
              </div>
              <div>
                <span className="text-slate-400">Owner: </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">@{targetFile.owner_username}</span>
              </div>
              <div>
                <span className="text-slate-400">Size: </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{formatBytes(targetFile.size_bytes)}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModalOpen(false)}
                className="px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl text-white shadow-md transition-all active:scale-95 ${
                  deleteMode === 'permanent'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                }`}
              >
                {isDeleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {deleteMode === 'permanent' ? 'Confirm Permanent Purge' : 'Move to Trash'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
