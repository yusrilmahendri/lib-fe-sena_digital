export interface AdminMusicCatalogItem {
  id: number;
  title: string;
  artist?: string | null;
  subtitle?: string | null;
  audio_url?: string | null;
  file_url?: string | null;
  duration?: number | string | null;
  duration_label?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  is_default?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AdminMusicCatalogListResult {
  items: AdminMusicCatalogItem[];
}

export interface AdminMusicCatalogPayload {
  title?: string;
  artist?: string;
  subtitle?: string;
  description?: string;
}

export interface AdminMusicCatalogSortPayload {
  id: number;
  sort_order: number;
}
