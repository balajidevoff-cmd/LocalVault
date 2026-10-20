import {
  FileListResponse,
  FileItem,
  FolderItem,
  HealthResponse,
  PublicShareMetadata,
  SearchResults,
  ShareResponse,
  StorageStatusResponse,
  StorageUsageResponse,
  User,
} from '@/types';

function resolveApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl || envUrl.trim() === '') {
    return '/api/v1';
  }
  const trimmed = envUrl.trim().replace(/\/+$/, '');
  if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.endsWith('/api/v1')) {
    return `${trimmed}/api/v1`;
  }
  return trimmed;
}

export const API_BASE = resolveApiBase();

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('localvault_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('localvault_token', token);
      } else {
        localStorage.removeItem('localvault_token');
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('localvault_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const headers = new Headers(options.headers || {});

    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      let errorMsg = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        if (data && data.detail) {
          errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        }
      } catch {
        // Fallback to text
        try {
          const txt = await res.text();
          if (txt) errorMsg = txt;
        } catch {}
      }
      throw new Error(errorMsg);
    }

    // Handle 204 No Content
    if (res.status === 204) {
      return null as unknown as T;
    }

    return res.json();
  }

  // Health
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Auth
  async register(data: { username: string; email: string; password: string }): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { username_or_email: string; password: string }): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const res = await this.request<{ access_token: string; refresh_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async changePassword(data: { current_password: string; new_password: string }): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Files
  async listFiles(params?: {
    folder_id?: string | null;
    all_files?: boolean;
    starred?: boolean;
    deleted?: boolean;
    query?: string;
    sort_by?: string;
    sort_order?: string;
    page?: number;
    page_size?: number;
  }): Promise<FileListResponse> {
    const sp = new URLSearchParams();
    if (params) {
      if (params.folder_id) sp.set('folder_id', params.folder_id);
      if (params.all_files !== undefined) sp.set('all_files', String(params.all_files));
      if (params.starred !== undefined) sp.set('starred', String(params.starred));
      if (params.deleted !== undefined) sp.set('deleted', String(params.deleted));
      if (params.query) sp.set('query', params.query);
      if (params.sort_by) sp.set('sort_by', params.sort_by);
      if (params.sort_order) sp.set('sort_order', params.sort_order);
      if (params.page) sp.set('page', String(params.page));
      if (params.page_size) sp.set('page_size', String(params.page_size));
    }
    const queryStr = sp.toString() ? `?${sp.toString()}` : '';
    return this.request<FileListResponse>(`/files${queryStr}`);
  }

  async getFile(id: string): Promise<FileItem> {
    return this.request<FileItem>(`/files/${id}`);
  }

  async updateFile(id: string, data: { original_name?: string; folder_id?: string | null; is_starred?: boolean; is_deleted?: boolean }): Promise<FileItem> {
    return this.request<FileItem>(`/files/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFile(id: string): Promise<void> {
    return this.request<void>(`/files/${id}`, {
      method: 'DELETE',
    });
  }

  getFileDownloadUrl(id: string): string {
    return `${API_BASE}/files/${id}/download`;
  }

  getFilePreviewUrl(id: string): string {
    return `${API_BASE}/files/${id}/preview`;
  }

  async uploadFile(file: File, folder_id?: string | null, onProgress?: (percent: number) => void): Promise<FileItem> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE}/files/upload`;
      xhr.open('POST', url, true);
      xhr.withCredentials = true;

      const token = this.getToken();
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          let errorMsg = `Upload failed with status ${xhr.status}`;
          try {
            const err = JSON.parse(xhr.responseText);
            if (err.detail) errorMsg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
          } catch {}
          reject(new Error(errorMsg));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload'));
      xhr.onabort = () => reject(new Error('File upload was cancelled'));

      const formData = new FormData();
      formData.append('file', file);
      if (folder_id) {
        formData.append('folder_id', folder_id);
      }

      xhr.send(formData);
    });
  }

  // Folders
  async createFolder(name: string, parent_folder_id?: string | null): Promise<FolderItem> {
    return this.request<FolderItem>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_folder_id: parent_folder_id || null }),
    });
  }

  async listFolders(parent_folder_id?: string | null): Promise<FolderItem[]> {
    const sp = parent_folder_id ? `?parent_folder_id=${parent_folder_id}` : '';
    return this.request<FolderItem[]>(`/folders${sp}`);
  }

  async getFolder(id: string): Promise<FolderItem> {
    return this.request<FolderItem>(`/folders/${id}`);
  }

  async updateFolder(id: string, data: { name?: string; parent_folder_id?: string | null }): Promise<FolderItem> {
    return this.request<FolderItem>(`/folders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteFolder(id: string): Promise<void> {
    return this.request<void>(`/folders/${id}`, {
      method: 'DELETE',
    });
  }

  // Storage
  async getStorageUsage(): Promise<StorageUsageResponse> {
    return this.request<StorageUsageResponse>('/storage/usage');
  }

  async getStorageStatus(): Promise<StorageStatusResponse> {
    return this.request<StorageStatusResponse>('/storage/status');
  }

  // Search
  async search(query: string): Promise<SearchResults> {
    return this.request<SearchResults>(`/search?q=${encodeURIComponent(query)}`);
  }

  // Sharing
  async createShare(data: { file_id: string; permission: 'view' | 'download'; password?: string; expires_in_hours?: number }): Promise<ShareResponse> {
    return this.request<ShareResponse>('/shares', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listShares(): Promise<ShareResponse[]> {
    return this.request<ShareResponse[]>('/shares');
  }

  async revokeShare(id: string): Promise<void> {
    return this.request<void>(`/shares/${id}`, {
      method: 'DELETE',
    });
  }

  async getPublicShareMetadata(token: string): Promise<PublicShareMetadata> {
    return this.request<PublicShareMetadata>(`/public/shares/${token}`);
  }

  getPublicDownloadUrl(token: string, password?: string): string {
    const pwdParam = password ? `?password=${encodeURIComponent(password)}` : '';
    return `${API_BASE}/public/shares/${token}/download${pwdParam}`;
  }
}

export const api = new ApiClient();

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
