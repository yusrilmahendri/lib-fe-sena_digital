import { environment } from '../../environments/environment';

export type PhotoType = 'gallery' | 'collage';

export type PhotoPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type PhotoDisplayMode = 'cover' | 'contain';

export interface UserPhoto {
  id: number;
  photo_type: PhotoType;
  photo_url: string;
  url_video?: string | null;
  video_url?: string | null;
  link_video?: string | null;
  media_type?: string | null;
  image_url?: string | null;
  preview_url?: string | null;
  photo?: string | null;
  description?: string | null;
  position: PhotoPosition;
  display_mode: PhotoDisplayMode;
  focal_point_x?: number | null;
  focal_point_y?: number | null;
  object_position?: string | null;
  is_featured: boolean;
  sort_order: number;
  original_size?: number | null;
  compressed_size?: number | null;
  quality?: number | null;
  created_at?: string | null;
}

export function normalizeInvitationMediaUrl(value: any): string {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();

  if (!raw || raw === 'null' || raw === 'undefined') {
    return '';
  }

  if (raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  if (/^\/?assets\//i.test(raw)) {
    return raw.replace(/^\/+/, '');
  }

  const origin = getInvitationApiOrigin();

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const pathname = url.pathname || '';
      const shouldUseApiOrigin =
        pathname.startsWith('/api/photos/') ||
        pathname.startsWith('/storage/') ||
        pathname.includes('/storage/photos/photos/');

      if (shouldUseApiOrigin) {
        const normalizedPath = normalizeStoragePath(pathname);
        return `${origin}/${normalizedPath}`;
      }
    } catch {
      return raw;
    }

    return raw.replace('/storage/photos/photos/', '/storage/photos/');
  }

  const normalizedPath = normalizeStoragePath(raw);

  if (normalizedPath) {
    return `${origin}/${normalizedPath}`;
  }

  return '';
}

export function resolveInvitationPhotoUrl(photo: any): string {
  if (!photo) {
    return '';
  }

  return normalizeInvitationMediaUrl(
    photo?.photo_url ||
    photo?.image_url ||
    photo?.preview_url ||
    photo?.url ||
    photo?.file_url ||
    photo?.path_url ||
    photo?.image ||
    photo?.photo ||
    photo?.file_path ||
    photo?.path ||
    photo?.foto ||
    getYoutubeThumbnailUrl(resolveInvitationVideoUrl(photo)) ||
    photo
  );
}

export function resolveInvitationMediaUrlFromItem(photo: any): string {
  if (!photo) {
    return '';
  }

  return normalizeInvitationMediaUrl(
    photo?.photo_url ||
    photo?.video_url ||
    photo?.image_url ||
    photo?.preview_url ||
    photo?.url ||
    photo?.file_url ||
    photo?.path_url ||
    photo?.image ||
    photo?.photo ||
    photo?.file_path ||
    photo?.path ||
    photo?.foto ||
    photo
  );
}

export function resolveInvitationVideoUrl(photo: any): string {
  if (!photo) {
    return '';
  }

  return normalizeInvitationMediaUrl(
    photo?.video_url ||
    photo?.url_video ||
    photo?.link_video ||
    photo?.youtube_link ||
    photo?.link_youtube ||
    photo?.youtube ||
    (isInvitationVideoMedia(photo) ? (
      photo?.url ||
      photo?.file_url ||
      photo?.path_url ||
      photo?.file_path ||
      photo?.path
    ) : '')
  );
}

export function isInvitationVideoMedia(photo: any): boolean {
  if (!photo) {
    return false;
  }

  const mediaType = String(photo?.media_type || photo?.type || '').toLowerCase().trim();
  const url = String(
    photo?.video_url ||
    photo?.url_video ||
    photo?.link_video ||
    photo?.youtube_link ||
    photo?.link_youtube ||
    photo?.youtube ||
    photo?.url ||
    photo?.file_url ||
    photo?.path ||
    photo?.file_path ||
    ''
  ).toLowerCase();

  return mediaType === 'video' || isYoutubeUrl(url) || /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/.test(url);
}

export function getYoutubeThumbnailUrl(value: string | null | undefined): string {
  const videoId = extractYoutubeVideoId(value);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
}

function isYoutubeUrl(value: string | null | undefined): boolean {
  return !!extractYoutubeVideoId(value);
}

function extractYoutubeVideoId(value: string | null | undefined): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    if (hostname === 'youtu.be') {
      return url.pathname.split('/').filter(Boolean)[0] || '';
    }
    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v') || '';
      if (url.pathname.startsWith('/embed/')) return url.pathname.split('/').filter(Boolean)[1] || '';
    }
  } catch {
    return '';
  }

  return '';
}

export function logInvitationImageError(event: Event, context: string, raw?: any, resolved?: string): void {
  const img = event.target as HTMLImageElement | null;
  console.error('[InvitationImageError]', {
    context,
    src: img?.currentSrc || img?.src || resolved || '',
    raw,
    resolved,
  });
  img?.closest('.gallery-card')?.classList.add('is-image-missing');
}

export const PHOTO_POSITION_OBJECT_POSITION: Record<PhotoPosition, string> = {
  center: 'center center',
  top: 'center top',
  bottom: 'center bottom',
  left: 'left center',
  right: 'right center',
  'top-left': 'left top',
  'top-right': 'right top',
  'bottom-left': 'left bottom',
  'bottom-right': 'right bottom',
};

export function getUserPhotoObjectPosition(photo: Pick<UserPhoto, 'position' | 'focal_point_x' | 'focal_point_y' | 'object_position'>): string {
  if (photo.object_position) {
    return photo.object_position;
  }

  if (photo.focal_point_x !== null && photo.focal_point_x !== undefined && photo.focal_point_y !== null && photo.focal_point_y !== undefined) {
    return `${photo.focal_point_x}% ${photo.focal_point_y}%`;
  }

  return PHOTO_POSITION_OBJECT_POSITION[photo.position] || PHOTO_POSITION_OBJECT_POSITION.center;
}

type PhotoLike = Record<string, any>;

export function getPhotoObjectFit(photo: PhotoLike | null | undefined): PhotoDisplayMode {
  return photo?.['display_mode'] === 'contain' ? 'contain' : 'cover';
}

export function getPhotoObjectPosition(photo: PhotoLike | null | undefined): string {
  if (!photo) {
    return PHOTO_POSITION_OBJECT_POSITION.center;
  }

  return getUserPhotoObjectPosition({
    position: isPhotoPosition(photo['position']) ? photo['position'] : 'center',
    focal_point_x: normalizePhotoNumber(photo['focal_point_x']),
    focal_point_y: normalizePhotoNumber(photo['focal_point_y']),
    object_position: photo['object_position'] || null,
  });
}

export function getOrderedGalleryPhotos<T extends PhotoLike>(photos: T[] | null | undefined): T[] {
  return getOrderedPhotosByType(photos, 'gallery');
}

export function getOrderedCollagePhotos<T extends PhotoLike>(photos: T[] | null | undefined): T[] {
  return getOrderedPhotosByType(photos, 'collage');
}

export function getFeaturedGalleryPhoto<T extends PhotoLike>(photos: T[] | null | undefined): T | null {
  return getOrderedGalleryPhotos(photos)[0] || null;
}

export function getFeaturedCollagePhoto<T extends PhotoLike>(photos: T[] | null | undefined): T | null {
  return getOrderedCollagePhotos(photos)[0] || null;
}

function getOrderedPhotosByType<T extends PhotoLike>(photos: T[] | null | undefined, type: PhotoType): T[] {
  if (!Array.isArray(photos)) {
    return [];
  }

  return photos
    .filter((photo) => {
      const photoType = String((photo as any)?.photo_type ?? '').trim().toLowerCase();
      return type === 'gallery' ? !photoType || photoType === 'gallery' : photoType === type;
    })
    .slice()
    .sort((a, b) => {
      const featuredDiff = Number(normalizeFeaturedFlag((b as any)?.is_featured)) - Number(normalizeFeaturedFlag((a as any)?.is_featured));
      if (featuredDiff !== 0) {
        return featuredDiff;
      }

      return normalizeSortOrder((a as any)?.sort_order) - normalizeSortOrder((b as any)?.sort_order);
    });
}

function normalizeFeaturedFlag(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }

  return false;
}

function normalizePhotoNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isNaN(numeric) ? null : numeric;
}

function normalizeSortOrder(value: number | string | null | undefined): number {
  const numeric = normalizePhotoNumber(value);
  return numeric === null ? Number.MAX_SAFE_INTEGER : numeric;
}

function isPhotoPosition(value: any): value is PhotoPosition {
  return Object.prototype.hasOwnProperty.call(PHOTO_POSITION_OBJECT_POSITION, value);
}

function getInvitationApiOrigin(): string {
  const env = environment as any;
  const apiUrl =
    env.apiBaseUrl ||
    env.apiUrl ||
    env.baseUrl ||
    'https://cloud-api.sena-digital.com';

  return String(apiUrl)
    .replace(/\/api\/v1\/?$/, '')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '');
}

function normalizeStoragePath(value: string): string {
  let path = String(value || '').trim();

  if (!path) {
    return '';
  }

  path = path
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '')
    .replace(/^api\/photos\//, 'storage/photos/')
    .replace(/^photos\/photos\//, 'photos/')
    .replace(/^storage\/photos\/photos\//, 'storage/photos/')
    .replace(/\/storage\/photos\/photos\//, '/storage/photos/')
    .replace(/\/{2,}/g, '/');

  if (path.startsWith('assets/')) {
    return path;
  }

  if (path.startsWith('storage/')) {
    return path;
  }

  if (path.startsWith('photos/')) {
    return `storage/${path}`;
  }

  if (path.startsWith('uploads/') || path.startsWith('gallery/') || path.startsWith('mempelai/')) {
    return `storage/${path}`;
  }

  if (/^[^/]+\.(jpe?g|png|webp|gif|avif|mp3|wav|ogg|m4a)$/i.test(path)) {
    return `storage/${path}`;
  }

  return path;
}
