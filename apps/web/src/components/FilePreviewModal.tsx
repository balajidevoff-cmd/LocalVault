'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileText,
  FileQuestion,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { api, formatBytes, formatDate } from '@/lib/api';
import { FileItem } from '@/types';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ isOpen, onClose, file }) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent(null);
      return;
    }

    const mime = file.mime_type.toLowerCase();
    const isText =
      mime.startsWith('text/') ||
      mime.includes('json') ||
      mime.includes('javascript') ||
      mime.includes('python') ||
      mime.includes('xml') ||
      mime.includes('yaml') ||
      file.original_name.endsWith('.md') ||
      file.original_name.endsWith('.txt') ||
      file.original_name.endsWith('.json') ||
      file.original_name.endsWith('.py') ||
      file.original_name.endsWith('.ts') ||
      file.original_name.endsWith('.js');

    if (isText && file.size_bytes < 2 * 1024 * 1024) {
      setLoadingText(true);
      const token = api.getToken();
      const headers = new Headers();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      fetch(api.getFilePreviewUrl(file.id), { headers, credentials: 'include' })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((txt) => setTextContent(txt))
        .catch(() => setTextContent('Failed to load text content.'))
        .finally(() => setLoadingText(false));
    } else {
      setTextContent(null);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const mime = file.mime_type.toLowerCase();
  const isImage = mime.startsWith('image/');
  const isPdf = mime.includes('pdf');
  const isVideo = mime.startsWith('video/');
  const isAudio = mime.startsWith('audio/');
  const previewUrl = api.getFilePreviewUrl(file.id);
  const downloadUrl = api.getFileDownloadUrl(file.id);

  const copyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {file.original_name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {formatBytes(file.size_bytes)} &bull; {file.mime_type} &bull; Uploaded {formatDate(file.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download={file.original_name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-vault-600 hover:bg-vault-500 text-white text-xs font-medium shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/50 dark:bg-[#070b14]/50">
          {/* Images */}
          {isImage && (
            <div className="max-w-full max-h-full flex items-center justify-center">
              <img
                src={previewUrl}
                alt={file.original_name}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-200 dark:border-slate-800"
              />
            </div>
          )}

          {/* PDF viewer */}
          {isPdf && (
            <iframe
              src={previewUrl}
              title={file.original_name}
              className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
            />
          )}

          {/* Video */}
          {isVideo && (
            <video
              controls
              preload="auto"
              playsInline
              className="max-h-[75vh] max-w-full rounded-lg shadow-lg"
              src={previewUrl}
            >
              Your browser does not support HTML5 video streaming.
            </video>
          )}

          {/* Audio */}
          {isAudio && (
            <div className="p-8 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xl text-center max-w-md w-full">
              <div className="w-16 h-16 rounded-full bg-vault-500/10 text-vault-500 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="font-semibold text-sm mb-4 truncate">{file.original_name}</h4>
              <audio controls className="w-full" src={previewUrl}>
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* Text and code content */}
          {textContent !== null && (
            <div className="w-full h-full flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">
                <span>Text Viewer</span>
                <button
                  onClick={copyText}
                  className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
              <pre className="flex-1 p-4 font-mono text-xs overflow-auto whitespace-pre-wrap break-all text-slate-800 dark:text-slate-200">
                {textContent}
              </pre>
            </div>
          )}

          {/* Loading text state */}
          {loadingText && (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-vault-500" />
              <span className="text-xs">Loading preview...</span>
            </div>
          )}

          {/* Fallback for other files */}
          {!isImage && !isPdf && !isVideo && !isAudio && textContent === null && !loadingText && (
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-4">
                <FileQuestion className="w-8 h-8" />
              </div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-1">
                No Preview Available
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Direct in-browser preview is not supported for this format ({file.mime_type}). You can download the file to open it in your desktop application.
              </p>
              <a
                href={downloadUrl}
                download={file.original_name}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-vault-600 hover:bg-vault-500 text-white text-sm font-medium shadow-md shadow-vault-600/20 transition-all active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
