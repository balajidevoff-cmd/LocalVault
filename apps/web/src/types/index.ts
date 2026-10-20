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
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BreadcrumbItem {
  id?: string | null;
  name: string;
}

export interface FolderItem {
  id: string;
  owner_id: string;
  parent_folder_id?: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  breadcrumbs?: BreadcrumbItem[];
}

export interface FileListResponse {
  items: FileItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FileCategoryDistribution {
  category: string;
  count: number;
  size_bytes: number;
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
  categories: FileCategoryDistribution[];
}

export interface StorageStatusResponse {
  storage_root: string;
  status: string;
  disk_total_bytes: number;
  disk_free_bytes: number;
  disk_used_bytes: number;
  writable: boolean;
  db_connected: boolean;
}

export interface ShareResponse {
  id: string;
  file_id: string;
  owner_id: string;
  permission: 'view' | 'download';
  has_password: boolean;
  expires_at?: string | null;
  revoked_at?: string | null;
  access_count: number;
  created_at: string;
  share_url?: string | null;
  raw_token?: string | null;
  shared_with_user_id?: string | null;
  shared_with_username?: string | null;
  file_name?: string | null;
}

export interface SharedWithMeItem {
  share_id: string;
  file_id: string;
  file_name: string;
  size_bytes: number;
  mime_type: string;
  owner_id: string;
  owner_username: string;
  permission: 'view' | 'download';
  created_at: string;
  expires_at?: string | null;
}

export interface AdminFileItem {
  id: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  owner_id: string;
  owner_username: string;
  owner_email: string;
  is_deleted: boolean;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminFileListResponse {
  items: AdminFileItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminUserItem {
  id: string;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  used_storage_bytes: number;
  quota_bytes: number;
  file_count: number;
  created_at: string;
}

export interface AdminAuditLogItem {
  id: string;
  admin_id?: string | null;
  admin_username: string;
  target_user_id?: string | null;
  target_username?: string | null;
  file_id?: string | null;
  filename: string;
  action: string;
  result: string;
  details?: string | null;
  timestamp: string;
}

export interface AdminDeleteResponse {
  file_id: string;
  filename: string;
  owner_username: string;
  action: string;
  message: string;
}

export interface AdminStatsResponse {
  total_users: number;
  total_files: number;
  total_storage_bytes: number;
  disk_free_bytes: number;
  disk_total_bytes: number;
}

export interface PublicShareMetadata {
  token: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  permission: 'view' | 'download';
  requires_password: boolean;
  expires_at?: string | null;
  created_at: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  database: string;
  disk_healthy: boolean;
  first_run_setup_required: boolean;
}

export interface SearchResults {
  query: string;
  files: FileItem[];
  folders: FolderItem[];
}
