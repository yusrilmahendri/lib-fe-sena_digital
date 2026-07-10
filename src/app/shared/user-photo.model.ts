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
      const photoType = (photo as any)?.photo_type;
      return type === 'gallery' ? !photoType || photoType === 'gallery' : photoType === type;
    })
    .slice()
    .sort((a, b) => {
      const featuredDiff = Number(Boolean((b as any)?.is_featured)) - Number(Boolean((a as any)?.is_featured));
      if (featuredDiff !== 0) {
        return featuredDiff;
      }

      return normalizeSortOrder((a as any)?.sort_order) - normalizeSortOrder((b as any)?.sort_order);
    });
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
