'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, File, Loader2 } from 'lucide-react';
import { api, formatBytes } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId?: string | null;
  onUploadSuccess: () => void;
}

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  folderId,
  onUploadSuccess,
}) => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success, error } = useToast();

  if (!isOpen) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: UploadQueueItem[] = Array.from(files).map((f) => ({
      id: Math.random().toString(36).substring(2, 9),
      file: f,
      progress: 0,
      status: 'pending',
    }));
    setQueue((prev) => [...prev, ...newItems]);
  };

  const startUpload = async () => {
    setIsUploading(true);
    let successCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === 'completed') continue;

      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading' } : q))
      );

      try {
        await api.uploadFile(item.file, folderId, (percent) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === item.id ? { ...q, progress: percent } : q))
          );
        });

        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'completed', progress: 100 } : q))
        );
        successCount++;
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'error', error: err.message || 'Upload failed' } : q
          )
        );
      }
    }

    setIsUploading(false);
    if (successCount > 0) {
      success(`Successfully uploaded ${successCount} file(s)`);
      onUploadSuccess();
    }
  };

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Upload className="w-5 h-5 text-vault-500" />
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Upload Files</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drop Zone */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-vault-500 bg-vault-500/10'
                : 'border-slate-300 dark:border-slate-700 hover:border-vault-400 bg-slate-50/50 dark:bg-slate-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="w-12 h-12 rounded-full bg-vault-500/10 text-vault-500 flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">
              Click to select files, or drag & drop here
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Files are streamed directly to your host SSD (Up to 10 GB per file)
            </p>
          </div>

          {/* Queue List */}
          {queue.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Files Queue ({queue.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <File className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {item.file.name}
                        </span>
                        <span className="text-slate-400 text-[10px] shrink-0">
                          ({formatBytes(item.file.size)})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'completed' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                        {item.status === 'error' && (
                          <span title={item.error}>
                            <AlertCircle className="w-4 h-4 text-rose-500" />
                          </span>
                        )}
                        {item.status === 'uploading' && (
                          <span className="font-semibold text-vault-500">{item.progress}%</span>
                        )}
                        {item.status === 'pending' && !isUploading && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-slate-400 hover:text-rose-500 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {item.status === 'uploading' && (
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-vault-500 transition-all duration-150"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setQueue([])}
            disabled={isUploading || queue.length === 0}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40"
          >
            Clear List
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={startUpload}
              disabled={isUploading || queue.filter((q) => q.status === 'pending').length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-vault-600 hover:bg-vault-500 disabled:opacity-50 rounded-xl shadow-md shadow-vault-600/20 transition-all active:scale-95"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <span>Start Upload</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
