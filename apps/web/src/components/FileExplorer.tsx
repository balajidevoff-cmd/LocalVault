'use client';

import React, { useState, useEffect } from 'react';
import {
  Folder,
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  MoreVertical,
  Star,
  Download,
  Share2,
  Trash2,
  Eye,
  Edit2,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  ArrowUpDown,
  RefreshCw,
  FolderPlus,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { api, formatBytes, formatDate } from '@/lib/api';
import { FileItem, FolderItem, BreadcrumbItem } from '@/types';
import { useToast } from '@/context/ToastContext';
import { FilePreviewModal } from './FilePreviewModal';
import { ShareModal } from './ShareModal';

interface FileExplorerProps {
  initialFolderId?: string | null;
  mode?: 'all' | 'folder' | 'recent' | 'starred' | 'trash';
  searchQuery?: string;
  onFolderChange?: (folderId: string | null) => void;
  onUploadClick?: () => void;
  onNewFolderClick?: () => void;
  refreshTrigger?: number;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  initialFolderId = null,
  mode = 'folder',
  searchQuery = '',
  onFolderChange,
  onUploadClick,
  onNewFolderClick,
  refreshTrigger = 0,
}) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(initialFolderId);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'Home' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  // Modals state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Rename prompt state
  const [renamingItem, setRenamingItem] = useState<{ id: string; type: 'file' | 'folder'; name: string } | null>(null);
  const [newName, setNewName] = useState('');

  const { success, error } = useToast();

  const fetchItems = async () => {
    setLoading(true);
    try {
      if (mode === 'trash') {
        const fileRes = await api.listFiles({ deleted: true, sort_by: sortBy, sort_order: sortOrder });
        setFiles(fileRes.items);
        setFolders([]);
      } else if (mode === 'starred') {
        const fileRes = await api.listFiles({ starred: true, sort_by: sortBy, sort_order: sortOrder });
        setFiles(fileRes.items);
        setFolders([]);
      } else if (mode === 'recent') {
        const fileRes = await api.listFiles({ all_files: true, sort_by: 'created_at', sort_order: 'desc', page_size: 30 });
        setFiles(fileRes.items);
        setFolders([]);
      } else {
        // Standard folder view or search
        const [folderList, fileRes] = await Promise.all([
          searchQuery ? Promise.resolve([]) : api.listFolders(currentFolderId),
          api.listFiles({
            folder_id: currentFolderId,
            query: searchQuery || undefined,
            sort_by: sortBy,
            sort_order: sortOrder,
          }),
        ]);
        setFolders(folderList);
        setFiles(fileRes.items);

        if (currentFolderId) {
          const folderObj = await api.getFolder(currentFolderId);
          if (folderObj.breadcrumbs) {
            setBreadcrumbs(folderObj.breadcrumbs);
          }
        } else {
          setBreadcrumbs([{ id: null, name: 'Home' }]);
        }
      }
    } catch (err: any) {
      error(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [currentFolderId, mode, searchQuery, sortBy, sortOrder, refreshTrigger]);

  const navigateToFolder = (fId: string | null) => {
    setCurrentFolderId(fId);
    onFolderChange?.(fId);
  };

  const handleStarToggle = async (file: FileItem) => {
    try {
      const updated = await api.updateFile(file.id, { is_starred: !file.is_starred });
      setFiles((prev) => prev.map((f) => (f.id === file.id ? updated : f)));
      success(updated.is_starred ? 'Starred file' : 'Unstarred file');
    } catch (err: any) {
      error(err.message || 'Failed to update star');
    }
  };

  const handleTrashFile = async (file: FileItem) => {
    try {
      await api.updateFile(file.id, { is_deleted: true });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      success('Moved to Trash');
    } catch (err: any) {
      error(err.message || 'Failed to trash file');
    }
  };

  const handleRestoreFile = async (file: FileItem) => {
    try {
      await api.updateFile(file.id, { is_deleted: false });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      success('Restored from Trash');
    } catch (err: any) {
      error(err.message || 'Failed to restore file');
    }
  };

  const handlePurgeFile = async (file: FileItem) => {
    if (!confirm(`Permanently delete "${file.original_name}"? This cannot be undone.`)) return;
    try {
      await api.deleteFile(file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      success('Permanently deleted');
    } catch (err: any) {
      error(err.message || 'Failed to delete file');
    }
  };

  const handleDeleteFolder = async (folder: FolderItem) => {
    if (!confirm(`Delete folder "${folder.name}" and all its contents?`)) return;
    try {
      await api.deleteFolder(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      success('Folder deleted');
    } catch (err: any) {
      error(err.message || 'Failed to delete folder');
    }
  };

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !newName.trim()) return;

    try {
      if (renamingItem.type === 'file') {
        const updated = await api.updateFile(renamingItem.id, { original_name: newName.trim() });
        setFiles((prev) => prev.map((f) => (f.id === renamingItem.id ? updated : f)));
        success('File renamed');
      } else {
        const updated = await api.updateFolder(renamingItem.id, { name: newName.trim() });
        setFolders((prev) => prev.map((f) => (f.id === renamingItem.id ? updated : f)));
        success('Folder renamed');
      }
      setRenamingItem(null);
    } catch (err: any) {
      error(err.message || 'Failed to rename');
    }
  };

  const getFileIcon = (mime: string) => {
    mime = mime.toLowerCase();
    if (mime.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    if (mime.startsWith('video/')) return <Video className="w-5 h-5 text-violet-500" />;
    if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-amber-500" />;
    if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-rose-500" />;
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar'))
      return <Archive className="w-5 h-5 text-amber-600" />;
    return <File className="w-5 h-5 text-sky-500" />;
  };

  return (
    <div className="flex-1 flex flex-col min-w-0" onClick={() => setActiveMenuId(null)}>
      {/* Action Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
        {/* Breadcrumb path */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-sm max-w-full">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id || 'home'}>
              {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              <button
                onClick={() => navigateToFolder(crumb.id || null)}
                className={`px-2 py-1 rounded-lg transition-colors truncate max-w-[150px] ${
                  idx === breadcrumbs.length - 1
                    ? 'font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/60'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* View and Sort Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          {/* Refresh button */}
          <button
            onClick={fetchItems}
            title="Refresh"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Sort dropdown */}
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
            <select
              value={`${sortBy}_${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('_');
                setSortBy(sb);
                setSortOrder(so);
              }}
              className="px-2.5 py-2 bg-transparent text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="created_at_desc" className="dark:bg-slate-900">Newest First</option>
              <option value="created_at_asc" className="dark:bg-slate-900">Oldest First</option>
              <option value="original_name_asc" className="dark:bg-slate-900">Name (A-Z)</option>
              <option value="original_name_desc" className="dark:bg-slate-900">Name (Z-A)</option>
              <option value="size_bytes_desc" className="dark:bg-slate-900">Largest First</option>
              <option value="size_bytes_asc" className="dark:bg-slate-900">Smallest First</option>
            </select>
          </div>

          {/* Grid vs List toggle */}
          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 bg-slate-100 dark:bg-slate-900">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-vault-600 dark:text-vault-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-vault-600 dark:text-vault-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-vault-500 mb-3" />
          <p className="text-sm">Loading contents...</p>
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
            <Folder className="w-10 h-10" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {mode === 'trash'
              ? 'Trash is empty'
              : mode === 'starred'
              ? 'No starred files yet'
              : searchQuery
              ? 'No matching files or folders found'
              : 'This folder is empty'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6">
            {mode === 'trash'
              ? 'Files deleted from your vault will appear here.'
              : mode === 'starred'
              ? 'Star important files to quickly access them here anytime.'
              : 'Upload files or create subfolders to start organizing your files.'}
          </p>

          {mode === 'folder' && !searchQuery && (
            <div className="flex items-center gap-3">
              <button
                onClick={onUploadClick}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-vault-600 hover:bg-vault-500 text-white text-xs font-medium shadow-md shadow-vault-600/20"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
              <button
                onClick={onNewFolderClick}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                <FolderPlus className="w-3.5 h-3.5 text-amber-500" />
                <span>New Folder</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Folders Section */}
          {folders.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Folders ({folders.length})
              </h4>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3'
                    : 'space-y-1.5'
                }
              >
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    onDoubleClick={() => navigateToFolder(folder.id)}
                    className={`group relative flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-vault-500/50 hover:shadow-md transition-all cursor-pointer ${
                      viewMode === 'list' ? 'px-4 py-2.5' : ''
                    }`}
                  >
                    <div
                      onClick={() => navigateToFolder(folder.id)}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                        <Folder className="w-5 h-5 fill-amber-500/20" />
                      </div>
                      <div className="min-w-0 truncate">
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate block">
                          {folder.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {formatDate(folder.updated_at)}
                        </span>
                      </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {activeMenuId === folder.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 z-30 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs text-slate-700 dark:text-slate-200"
                        >
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              setRenamingItem({ id: folder.id, type: 'folder', name: folder.name });
                              setNewName(folder.name);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Rename</span>
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              handleDeleteFolder(folder);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {files.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Files ({files.length})
              </h4>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3'
                    : 'space-y-1.5'
                }
              >
                {files.map((file) => (
                  <div
                    key={file.id}
                    onDoubleClick={() => setPreviewFile(file)}
                    className={`group relative flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-vault-500/50 hover:shadow-md transition-all cursor-pointer ${
                      viewMode === 'list'
                        ? 'flex-row items-center py-2.5 px-4'
                        : 'h-40'
                    }`}
                  >
                    {/* Top row (icon & menu) */}
                    <div className="flex items-start justify-between gap-2 w-full mb-2">
                      <div
                        onClick={() => setPreviewFile(file)}
                        className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center shrink-0"
                      >
                        {getFileIcon(file.mime_type)}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Star icon */}
                        {mode !== 'trash' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStarToggle(file);
                            }}
                            className={`p-1 rounded-lg transition-colors ${
                              file.is_starred
                                ? 'text-amber-400'
                                : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${file.is_starred ? 'fill-amber-400' : ''}`} />
                          </button>
                        )}

                        {/* More Menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === file.id ? null : file.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === file.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-8 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs text-slate-700 dark:text-slate-200"
                            >
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setPreviewFile(file);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Eye className="w-3.5 h-3.5 text-vault-500" />
                                <span>Preview</span>
                              </button>
                              <a
                                href={api.getFileDownloadUrl(file.id)}
                                download={file.original_name}
                                onClick={() => setActiveMenuId(null)}
                                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <Download className="w-3.5 h-3.5 text-sky-500" />
                                <span>Download</span>
                              </a>
                              {mode !== 'trash' ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      setShareFile(file);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <Share2 className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Share Link</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      setRenamingItem({ id: file.id, type: 'file', name: file.original_name });
                                      setNewName(file.original_name);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Rename</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleTrashFile(file);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Move to Trash</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handleRestoreFile(file);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-500/10 text-emerald-600"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Restore File</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      handlePurgeFile(file);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-rose-500/10 text-rose-500"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Purge Permanently</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* File Details */}
                    <div
                      onClick={() => setPreviewFile(file)}
                      className="min-w-0 w-full"
                    >
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate block">
                        {file.original_name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span>{formatBytes(file.size_bytes)}</span>
                        <span>&bull;</span>
                        <span>{formatDate(file.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="font-semibold text-sm mb-4">Rename {renamingItem.type}</h3>
            <form onSubmit={submitRename}>
              <input
                type="text"
                autoFocus
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 mb-4 outline-none focus:border-vault-500"
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRenamingItem(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-vault-600 hover:bg-vault-500 text-white font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
      <ShareModal
        isOpen={!!shareFile}
        onClose={() => setShareFile(null)}
        file={shareFile}
      />
    </div>
  );
};
