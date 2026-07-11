import { normalizeInvitationMediaUrl } from './user-photo.model';

export interface MusicTrack {
  id: number;
  title: string;
  artist?: string | null;
  description?: string | null;
  duration?: string | number | null;
  duration_label?: string | null;
  source_type?: MusicSourceType | string | null;
  audio_url?: string | null;
  stream_url?: string | null;
  url?: string | null;
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
  stream_url?: string | null;
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
  const url = firstNonEmptyString([
    data?.settings?.resolved_music_url,
    data?.resolved_music_url,
    data?.settings?.custom_music?.url,
    data?.settings?.custom_music?.stream_url,
    data?.settings?.custom_music?.audio_url,
    data?.custom_music?.url,
    data?.custom_music?.stream_url,
    data?.custom_music?.audio_url,
    data?.settings?.custom_music_url,
    data?.custom_music_url,
    data?.settings?.selected_music?.stream_url,
    data?.settings?.selected_music?.audio_url,
    data?.settings?.selected_music?.url,
    data?.selected_music?.stream_url,
    data?.selected_music?.audio_url,
    data?.selected_music?.url,
    data?.settings?.default_music?.stream_url,
    data?.settings?.default_music?.audio_url,
    data?.settings?.default_music?.url,
    data?.default_music?.stream_url,
    data?.default_music?.audio_url,
    data?.default_music?.url,
    data?.settings?.music_stream_url,
    data?.music_stream_url,
    data?.settings?.musik,
  ]);

  return url ? normalizeInvitationMediaUrl(url) || url : null;
}

export function resolveInvitationMusicSourceType(data: any): string {
  return firstNonEmptyString([
    data?.settings?.music_source_type,
    data?.music_source_type,
    data?.settings?.active_music?.source_type,
    data?.active_music?.source_type,
  ]) || 'unknown';
}

function firstNonEmptyString(values: unknown[]): string | null {
  const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
  return typeof value === 'string' ? value : null;
}
