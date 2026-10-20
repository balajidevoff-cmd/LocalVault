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

export const STORAGE_KEY_API_URL = 'localvault_api_url';
export const STORAGE_KEY_ACCESS_TOKEN = 'localvault_token';
export const STORAGE_KEY_REFRESH_TOKEN = 'localvault_refresh_token';

/**
 * Normalizes user-provided or environment API URLs.
 * Handles trailing slashes, redundant /health or /api paths, and missing protocols.
 * Filters out example placeholder strings (e.g. your-tunnel.trycloudflare.com).
 */
export function normalizeApiUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let trimmed = raw.trim();

  // Ignore dummy placeholder strings
  if (
    trimmed === '' ||
    trimmed.includes('your-tunnel') ||
    trimmed.includes('example.com') ||
    trimmed.includes('<your-') ||
    trimmed.includes('YOUR_TUNNEL')
  ) {
    return '';
  }

  // Preserve relative local development route
  if (trimmed === '/api/v1' || trimmed === '/api/v1/') {
    return '/api/v1';
  }

  // Prepend protocol if user omitted it
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    const isHttps = typeof window !== 'undefined' ? window.location.protocol === 'https:' : true;
    trimmed = (isHttps ? 'https://' : 'http://') + trimmed;
  }

  // Strip trailing slashes
  trimmed = trimmed.replace(/\/+$/, '');

  // Strip trailing /health if user pasted the full health check URL
  if (trimmed.endsWith('/health')) {
    trimmed = trimmed.slice(0, -'/health'.length).replace(/\/+$/, '');
  }

  // Ensure consistent /api/v1 path
  if (!trimmed.endsWith('/api/v1')) {
    if (trimmed.endsWith('/api')) {
      trimmed = `${trimmed}/v1`;
    } else {
      trimmed = `${trimmed}/api/v1`;
    }
  }

  return trimmed;
}

export function resolveApiBase(): string {
  // 1. In browser, check user override in localStorage
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_API_URL);
      if (stored && stored.trim() !== '') {
        const normalized = normalizeApiUrl(stored);
        if (normalized) return normalized;
      }
    } catch {
      // Storage access blocked or restricted
    }
  }

  // 2. Next.js public environment variable (configured in Vercel or .env)
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim() !== '') {
    const normalized = normalizeApiUrl(envUrl);
    if (normalized) return normalized;
  }

  // 3. Fallback: on localhost / 127.0.0.1 development, use relative /api/v1 (proxied by Next.js rewrites)
  if (typeof window !== 'undefined') {
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1';
    if (isLocal) {
      return '/api/v1';
    }
    // Remote host without configured API URL
    return '';
  }

  return '/api/v1';
}

export const API_BASE = resolveApiBase();

export interface TestConnectionResult {
  success: boolean;
  status?: number;
  data?: HealthResponse;
  error?: string;
  normalizedUrl?: string;
}

class ApiClient {
  private token: string | null = null;
  private isRefreshing: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.token = localStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
      } catch {
        this.token = null;
      }
    }
  }

  getBaseUrl(): string {
    return resolveApiBase();
  }

  setServerUrl(url: string | null) {
    if (typeof window !== 'undefined') {
      if (url && url.trim() !== '') {
        const clean = normalizeApiUrl(url);
        if (clean) {
          localStorage.setItem(STORAGE_KEY_API_URL, clean);
        } else {
          localStorage.removeItem(STORAGE_KEY_API_URL);
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_API_URL);
      }
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
      }
    }
  }

  setTokens(accessToken: string | null, refreshToken: string | null) {
    this.token = accessToken;
    if (typeof window !== 'undefined') {
      if (accessToken) {
        localStorage.setItem(STORAGE_KEY_ACCESS_TOKEN, accessToken);
      } else {
        localStorage.removeItem(STORAGE_KEY_ACCESS_TOKEN);
      }
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
      } else {
        localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      try {
        this.token = localStorage.getItem(STORAGE_KEY_ACCESS_TOKEN);
      } catch {
        this.token = null;
      }
    }
    return this.token;
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Performs an active health check test against a candidate backend URL.
   * Does NOT alter localStorage unless verified by the caller.
   */
  async testServerUrl(candidateUrl: string): Promise<TestConnectionResult> {
    const trimmed = candidateUrl.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter a backend server URL.' };
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
      return {
        success: false,
        error: `Mixed Content Error: This frontend is loaded securely over HTTPS (${window.location.origin}). Web browsers strictly block HTTP requests from HTTPS sites. Your tunnel or server URL must use HTTPS (e.g., https://...).`,
      };
    }

    const clean = normalizeApiUrl(trimmed);
    if (!clean) {
      return {
        success: false,
        error: 'Please enter a valid, active server URL (e.g. https://<subdomain>.trycloudflare.com).',
      };
    }

    const targetUrl = `${clean}/health`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 200) {
        try {
          const data = (await res.json()) as HealthResponse;
          if (data && typeof data === 'object' && data.status) {
            return {
              success: true,
              status: 200,
              data,
              normalizedUrl: clean,
            };
          }
        } catch {
          return {
            success: false,
            status: 200,
            error: `HTTP 200 received from ${targetUrl}, but response was not valid JSON. Ensure port 8000 is running the FastAPI LocalVault backend.`,
          };
        }
      }

      // Non-200 status response
      let detail = '';
      try {
        const errJson = await res.json();
        if (errJson && errJson.detail) {
          detail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
        }
      } catch {
        try {
          detail = await res.text();
        } catch {}
      }

      return {
        success: false,
        status: res.status,
        error: `Server returned HTTP ${res.status} (${res.statusText || 'Error'})${detail ? `: ${detail}` : ''}`,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          error: `Connection timed out after 9 seconds trying to reach ${targetUrl}. Verify that your laptop is awake, FastAPI is running on port 8000, and your tunnel is active.`,
        };
      }

      const msg = err?.message || String(err);
      return {
        success: false,
        error: `Network Error connecting to ${targetUrl}: ${msg}. Verify your tunnel URL, DNS resolution, and ensure backend CORS allows ${typeof window !== 'undefined' ? window.location.origin : 'your frontend origin'}.`,
      };
    }
  }

  async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken || this.isRefreshing) {
      return false;
    }
    this.isRefreshing = true;
    try {
      const baseUrl = this.getBaseUrl();
      if (!baseUrl) {
        this.isRefreshing = false;
        return false;
      }
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        this.setTokens(data.access_token, data.refresh_token || refreshToken);
        return true;
      }
    } catch {
      // Refresh request failed
    } finally {
      this.isRefreshing = false;
    }
    this.setTokens(null, null);
    return false;
  }

  private async request<T>(endpoint: string, options: RequestInit & { _isRetry?: boolean } = {}): Promise<T> {
    const baseUrl = this.getBaseUrl();

    // Verify remote production URL configuration
    if (typeof window !== 'undefined') {
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '::1';

      if (!baseUrl || (!isLocalhost && baseUrl === '/api/v1')) {
        throw new Error(
          'LocalVault backend URL is not configured. When running on Vercel, please set NEXT_PUBLIC_API_URL in your Vercel Project Settings (e.g. https://your-tunnel.example.com/api/v1) or enter your Server URL in the connection settings.'
        );
      }

      // Check for browser Mixed Content violations (HTTPS page requesting HTTP API)
      if (window.location.protocol === 'https:' && baseUrl.startsWith('http://')) {
        throw new Error(
          `Mixed Content Error: This site is loaded securely over HTTPS (${window.location.origin}), but your API URL is unencrypted HTTP (${baseUrl}). Web browsers block HTTP requests from HTTPS sites. Please connect using an HTTPS tunnel (e.g., Cloudflare Tunnel or Tailscale Funnel) or configure an SSL certificate.`
        );
      }
    }

    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const headers = new Headers(options.headers || {});

    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    let controller: AbortController | null = null;
    let timeoutId: any = null;
    let signal = options.signal;

    if (!signal && !endpoint.includes('/upload')) {
      controller = new AbortController();
      signal = controller.signal;
      timeoutId = setTimeout(() => controller?.abort(), 20000);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        ...options,
        signal,
        headers,
        credentials: 'include',
      });
    } catch (netErr: any) {
      if (timeoutId) clearTimeout(timeoutId);
      if (netErr?.name === 'AbortError') {
        throw new Error(
          `Request to LocalVault server timed out. Check that your laptop is awake, FastAPI is running on port 8000, and your tunnel is active.`
        );
      }
      if (
        netErr instanceof TypeError &&
        (netErr.message.includes('fetch') || netErr.message.includes('NetworkError') || netErr.message.includes('Failed to fetch'))
      ) {
        throw new Error(
          `Cannot reach LocalVault server at ${baseUrl}. Please ensure your laptop is running, the FastAPI backend is started, and your HTTPS tunnel is active.`
        );
      }
      throw netErr;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    // Automatic token refresh on 401 Unauthorized
    if (
      res.status === 401 &&
      !options._isRetry &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/refresh') &&
      !endpoint.includes('/auth/register')
    ) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        return this.request<T>(endpoint, { ...options, _isRetry: true });
      }
    }

    if (!res.ok) {
      let errorMsg = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        if (data && data.detail) {
          errorMsg = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
        }
      } catch {
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      return await this.request<HealthResponse>('/health', { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
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
      this.setTokens(res.access_token, res.refresh_token || null);
    }
    return res;
  }

  async logout(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken || '' }),
      });
    } finally {
      this.setTokens(null, null);
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

  // Users (Admin)
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async updateUser(id: string, data: { is_active?: boolean; role?: 'user' | 'admin'; email?: string; storage_quota_bytes?: number }): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PATCH',
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
    return `${this.getBaseUrl()}/files/${id}/download`;
  }

  getFilePreviewUrl(id: string): string {
    return `${this.getBaseUrl()}/files/${id}/preview`;
  }

  async uploadFile(file: File, folder_id?: string | null, onProgress?: (percent: number) => void): Promise<FileItem> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${this.getBaseUrl()}/files/upload`;
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
          } catch {
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
    return `${this.getBaseUrl()}/public/shares/${token}/download${pwdParam}`;
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
