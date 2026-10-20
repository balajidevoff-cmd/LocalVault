export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  is_active: boolean;
  storage_quota_bytes?: number | null;
  created_at: string;
  last_login_at?: string | null;
}

export interface FileItem {
  id: string;
  owner_id: string;
  folder_id?: string | null;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  is_starred: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface FolderItem {
  id: string;
  owner_id: string;
  parent_folder_id?: string | null;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface StorageUsageResponse {
  user_used_bytes: number;
  user_quota_bytes: number;
  user_usage_percentage: number;
  file_count: number;
  folder_count: number;
  disk_total_bytes: number;
  disk_free_bytes: number;
  disk_used_bytes: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  database: string;
  disk_healthy: boolean;
  first_run_setup_required: boolean;
}
