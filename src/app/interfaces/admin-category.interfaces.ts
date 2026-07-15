/**
 * Admin Category Management Interfaces
 *
 * Type-safe interfaces for video and website category management
 * Based on API contracts for /api/admin/video-categories and /api/admin/website-categories
 */

// === Core Category Interfaces ===

export interface BaseCategory {
  id: number;
  nama_kategori: string;
  slug: string;
  image: string;
  preview_image?: string | null;
  preview?: string | null;
  thumbnail_image?: string | null;
  image_url?: string | null;
  preview_url?: string | null;
  is_active: boolean;
  urutan?: number | string | null;
  status?: boolean | number | string;
  created_at: string;
  updated_at: string;
}

export interface VideoCategory extends BaseCategory {
  theme_id?: number; // Synchronized theme ID
}

export interface WebsiteCategory extends BaseCategory {
  theme_id?: number; // Synchronized theme ID
}

// === API Request Interfaces ===

export interface CategoryCreateRequest {
  nama_kategori: string;
  slug?: string;
  image?: File;
  preview_image?: File;
  is_active?: boolean | number | string; // Support boolean, 1/0, "true"/"false", "1"/"0"
  urutan?: number | string | null;
  status?: boolean | number | string;
}

export interface CategoryUpdateRequest {
  nama_kategori?: string;
  slug?: string;
  image?: File;
  preview_image?: File;
  is_active?: boolean | number | string; // Support boolean, 1/0, "true"/"false", "1"/"0"
  urutan?: number | string | null;
  status?: boolean | number | string;
}

export interface CategoryToggleRequest {
  is_active: boolean | number | string; // Support boolean, 1/0, "true"/"false", "1"/"0"
}

// === API Response Interfaces ===

export interface CategoryPaginationMeta {
  current_page: number;
  from: number;
  to: number;
  per_page: number;
  total: number;
}

export interface CategoryListResponse<T = BaseCategory> {
  status: boolean;
  data: T[];
  meta: CategoryPaginationMeta;
}

export interface CategoryCreateResponse<T = BaseCategory> {
  status: boolean;
  message: string;
  data: T;
}

export interface CategoryUpdateResponse<T = BaseCategory> {
  status: boolean;
  message: string;
  data: T;
}

export interface CategoryDeleteResponse {
  status: boolean;
  message: string;
}

export interface CategoryShowResponse<T = BaseCategory> {
  status: boolean;
  data: T;
}

export interface CategoryToggleResponse<T = BaseCategory> {
  status: boolean;
  message: string;
  data: T;
}

export interface CategoryStatisticsResponse {
  status: boolean;
  data: {
    total_categories: number;
    active_categories: number;
    inactive_categories: number;
    categories_with_images: number;
    synchronized_themes: number;
  };
}

// === Error Response Interfaces ===

export interface CategoryErrorResponse {
  status: false;
  message: string;
  errors?: {
    [key: string]: string[];
  };
}

// === API Parameters Interfaces ===

export interface CategoryListParams {
  search?: string;
  status?: 'active' | 'inactive';
  per_page?: number;
  page?: number;
}

// === File Upload Interfaces ===

export interface CategoryImageUpload {
  file: File;
  preview?: string;
}

// === Form Data Interfaces ===

export interface CategoryFormData {
  nama_kategori: string;
  slug: string;
  image?: File;
  is_active: boolean;
  imagePreview?: string;
}

// === Type Guards ===

export function isVideoCategoryResponse(response: any): response is CategoryListResponse<VideoCategory> {
  return response && response.status && Array.isArray(response.data);
}

export function isWebsiteCategoryResponse(response: any): response is CategoryListResponse<WebsiteCategory> {
  return response && response.status && Array.isArray(response.data);
}

export function isCategoryErrorResponse(response: any): response is CategoryErrorResponse {
  return response && response.status === false;
}

// === Utility Types ===

export type CategoryType = 'video' | 'website';

export interface CategoryOperationResult<T = BaseCategory> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  validationErrors?: { [key: string]: string[] };
}

// === Modal State Interfaces ===

export interface CategoryModalState {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view' | 'delete';
  data?: BaseCategory;
  loading: boolean;
  error?: string;
}

// === Component State Interfaces ===

export interface CategoryComponentState {
  categories: BaseCategory[];
  loading: boolean;
  error?: string;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  searchTerm: string;
  statusFilter: 'all' | 'active' | 'inactive';
  selectedItems: number[];
}

// === Service Configuration ===

export interface CategoryServiceConfig {
  baseUrl: string;
  endpoints: {
    list: string;
    create: string;
    show: string;
    update: string;
    delete: string;
    toggle: string;
    statistics: string;
  };
  imageUpload: {
    maxSize: number; // in bytes
    allowedTypes: string[];
    uploadPath: string;
  };
}
