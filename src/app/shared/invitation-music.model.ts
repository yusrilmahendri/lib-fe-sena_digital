export interface MusicTrack {
  id: number;
  title: string;
  artist?: string | null;
  description?: string | null;
  duration?: string | number | null;
  duration_label?: string | null;
  source_type?: MusicSourceType | string | null;
  audio_url?: string | null;
  thumbnail_url?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  sort_order?: number | null;
}

export type MusicSourceType = 'default' | 'catalog' | 'custom' | 'global_catalog';

export interface CustomMusicInfo {
  id?: number | null;
  file_name?: string | null;
  original_name?: string | null;
  name?: string | null;
  size?: number | string | null;
  file_size?: number | string | null;
  size_label?: string | null;
  url?: string | null;
  audio_url?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_active?: boolean;
}

export interface ActiveMusicSummary {
  source_type?: MusicSourceType | string | null;
  title?: string | null;
  artist?: string | null;
  audio_url?: string | null;
  file_name?: string | null;
}

export interface UserMusicSelection {
  selected_music_id?: number | null;
  selected_music?: MusicTrack | null;
  default_music?: MusicTrack | null;
  custom_music?: CustomMusicInfo | null;
  active_music?: ActiveMusicSummary | MusicTrack | CustomMusicInfo | null;
  music_source_type?: MusicSourceType | string | null;
  custom_music_url?: string | null;
  resolved_music_url?: string | null;
  can_upload_custom_music?: boolean;
}

export function resolveInvitationMusicUrl(data: any): string | null {
  return firstNonEmptyString([
    data?.settings?.resolved_music_url,
    data?.resolved_music_url,
    data?.settings?.custom_music_url,
    data?.settings?.selected_music?.audio_url,
    data?.settings?.default_music?.audio_url,
    data?.settings?.musik,
  ]);
}

function firstNonEmptyString(values: unknown[]): string | null {
  const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
  return typeof value === 'string' ? value : null;
}
