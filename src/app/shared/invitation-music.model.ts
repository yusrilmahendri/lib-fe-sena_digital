export interface MusicTrack {
  id: number;
  title: string;
  artist?: string | null;
  audio_url?: string | null;
  thumbnail_url?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  sort_order?: number | null;
}

export interface UserMusicSelection {
  selected_music_id?: number | null;
  selected_music?: MusicTrack | null;
  default_music?: MusicTrack | null;
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
