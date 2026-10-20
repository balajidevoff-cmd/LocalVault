import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import {
  FileItem,
  FolderItem,
  HealthResponse,
  StorageUsageResponse,
  User,
} from '../types';

const STORAGE_KEY_SERVER_URL = 'localvault_server_url';
const STORAGE_KEY_ACCESS_TOKEN = 'localvault_access_token';
const STORAGE_KEY_REFRESH_TOKEN = 'localvault_refresh_token';

// Default development fallback: LAN IP instructions, never localhost on physical Android!
export const DEFAULT_SERVER_URL = 'http://192.168.1.100:8000/api/v1';

class AndroidApiClient {
  private serverUrl: string = DEFAULT_SERVER_URL;
  private accessToken: string | null = null;

  async init(): Promise<void> {
    try {
      const savedUrl = await SecureStore.getItemAsync(STORAGE_KEY_SERVER_URL);
      if (savedUrl) {
        this.serverUrl = savedUrl;
      }
      const token = await SecureStore.getItemAsync(STORAGE_KEY_ACCESS_TOKEN);
      if (token) {
        this.accessToken = token;
      }
    } catch (e) {
      console.warn('SecureStore init error:', e);
    }
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  async setServerUrl(url: string): Promise<void> {
    let clean = url.trim();
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    if (!clean.endsWith('/api/v1') && !clean.includes('/api/v1')) {
      clean = `${clean}/api/v1`;
    }
    this.serverUrl = clean;
    await SecureStore.setItemAsync(STORAGE_KEY_SERVER_URL, clean);
  }

  async setTokens(access: string | null, refresh: string | null): Promise<void> {
    this.accessToken = access;
    if (access) {
      await SecureStore.setItemAsync(STORAGE_KEY_ACCESS_TOKEN, access);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY_ACCESS_TOKEN);
    }

    if (refresh) {
      await SecureStore.setItemAsync(STORAGE_KEY_REFRESH_TOKEN, refresh);
    } else {
      await SecureStore.deleteItemAsync(STORAGE_KEY_REFRESH_TOKEN);
    }
  }

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(STORAGE_KEY_REFRESH_TOKEN);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.serverUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const body = await res.json();
        if (body.detail) msg = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      } catch {
        try {
          const txt = await res.text();
          if (txt) msg = txt;
        } catch {}
      }
      throw new Error(msg);
    }

    if (res.status === 204) {
      return null as unknown as T;
    }

    return res.json();
  }

  // Health / Server connection test
  async testConnection(targetUrl?: string): Promise<HealthResponse> {
    const testBase = targetUrl || this.serverUrl;
    const url = `${testBase}/health`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    return res.json();
  }

  // Auth
  async login(data: { username_or_email: string; password: string }): Promise<{ access_token: string; refresh_token: string; user: User }> {
    const res = await this.request<{ access_token: string; refresh_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await this.setTokens(res.access_token, res.refresh_token);
    return res;
  }

  async register(data: { username: string; email: string; password: string }): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    try {
      const rawRefresh = await this.getRefreshToken();
      if (rawRefresh) {
        await this.request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: rawRefresh }),
        });
      }
    } catch {}
    await this.setTokens(null, null);
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  // Files
  async listFiles(params?: { folder_id?: string | null; all_files?: boolean; starred?: boolean }): Promise<FileItem[]> {
    const sp = new URLSearchParams();
    if (params?.folder_id) sp.set('folder_id', params.folder_id);
    if (params?.all_files) sp.set('all_files', 'true');
    if (params?.starred) sp.set('starred', 'true');
    const query = sp.toString() ? `?${sp.toString()}` : '';
    const res = await this.request<{ items: FileItem[] }>(`/files${query}`);
    return res.items || [];
  }

  async updateFile(id: string, data: { is_starred?: boolean; is_deleted?: boolean; original_name?: string }): Promise<FileItem> {
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

  // Folders
  async listFolders(parent_folder_id?: string | null): Promise<FolderItem[]> {
    const sp = parent_folder_id ? `?parent_folder_id=${parent_folder_id}` : '';
    return this.request<FolderItem[]>(`/folders${sp}`);
  }

  async createFolder(name: string, parent_folder_id?: string | null): Promise<FolderItem> {
    return this.request<FolderItem>('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_folder_id }),
    });
  }

  // Storage
  async getStorageUsage(): Promise<StorageUsageResponse> {
    return this.request<StorageUsageResponse>('/storage/usage');
  }

  // Upload file from local device URI via FileSystem uploadAsync
  async uploadFromDevice(uri: string, filename: string, folderId?: string | null): Promise<FileItem> {
    const uploadUrl = `${this.serverUrl}/files/upload`;
    const options: FileSystem.FileSystemUploadOptions = {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      headers: {
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      parameters: {
        ...(folderId ? { folder_id: folderId } : {}),
      },
    };

    const result = await FileSystem.uploadAsync(uploadUrl, uri, options);
    if (result.status >= 200 && result.status < 300) {
      return JSON.parse(result.body);
    } else {
      let msg = `Upload failed with status ${result.status}`;
      try {
        const body = JSON.parse(result.body);
        if (body.detail) msg = body.detail;
      } catch {}
      throw new Error(msg);
    }
  }

  // Download file to device storage
  async downloadToDevice(fileId: string, filename: string): Promise<string> {
    const downloadUrl = `${this.serverUrl}/files/${fileId}/download`;
    const targetPath = `${FileSystem.documentDirectory}${filename}`;
    const result = await FileSystem.downloadAsync(downloadUrl, targetPath, {
      headers: {
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
    });
    return result.uri;
  }
}

export const androidApi = new AndroidApiClient();

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
