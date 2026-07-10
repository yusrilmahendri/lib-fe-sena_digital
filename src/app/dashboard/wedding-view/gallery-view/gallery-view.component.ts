import { Component, OnInit, Input } from '@angular/core';
import { GalleryItem } from '../../../services/wedding-data.service';
import { environment } from '../../../../environments/environment';
import {
  getOrderedGalleryPhotos,
  getPhotoObjectFit,
  getPhotoObjectPosition,
} from '../../../shared/user-photo.model';

@Component({
  selector: 'wc-gallery-view',
  templateUrl: './gallery-view.component.html',
  styleUrls: ['./gallery-view.component.scss']
})
export class GalleryViewComponent implements OnInit {
  @Input() galleryItems: GalleryItem[] | undefined = [];

  constructor() { }

  ngOnInit(): void {
    console.log('GalleryViewComponent initialized with gallery:', this.galleryItems);
  }

  getGalleryImages(): GalleryItem[] {
    return getOrderedGalleryPhotos(this.galleryItems || []);
  }

  hasImages(): boolean {
    return this.getGalleryImages().length > 0;
  }

  getImageUrl(item: GalleryItem): string {
    return this.getGalleryPhotoUrl(item);
  }

  getImageAlt(item: GalleryItem, index: number): string {
    return item.description || item.nama_foto || `Gallery image ${index + 1}`;
  }

  getImageObjectFit(item: GalleryItem): string {
    return getPhotoObjectFit(item);
  }

  getImageObjectPosition(item: GalleryItem): string {
    return getPhotoObjectPosition(item);
  }

  trackByGalleryId(index: number, item: GalleryItem): number {
    return item.id;
  }

  private getApiOrigin(): string {
    const env = environment as any;
    const apiUrl =
      env.apiUrl ||
      env.baseUrl ||
      'https://cloud-api.sena-digital.com';

    return String(apiUrl)
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');
  }

  normalizeMediaUrl(value: any): string {
    if (!value) {
      return '';
    }

    const raw = String(value).trim();

    if (!raw || raw === 'null' || raw === 'undefined') {
      return '';
    }

    if (raw.startsWith('data:')) {
      return raw;
    }

    const origin = this.getApiOrigin();

    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        if (url.pathname.startsWith('/api/photos/')) {
          const filename = url.pathname.replace('/api/photos/', '').replace(/^\/+/, '');
          return `${origin}/storage/${filename}`;
        }

        if (url.hostname === 'sena-digital.com' && url.pathname.startsWith('/storage/')) {
          return `${origin}${url.pathname}`;
        }
      } catch {
        return raw;
      }

      return raw;
    }

    if (raw.startsWith('/storage/')) {
      return `${origin}${raw}`;
    }

    if (raw.startsWith('storage/')) {
      return `${origin}/${raw}`;
    }

    if (raw.startsWith('/api/photos/')) {
      const filename = raw.replace('/api/photos/', '').replace(/^\/+/, '');
      return `${origin}/storage/${filename}`;
    }

    if (raw.startsWith('api/photos/')) {
      const filename = raw.replace('api/photos/', '').replace(/^\/+/, '');
      return `${origin}/storage/${filename}`;
    }

    if (raw.startsWith('/')) {
      return `${origin}${raw}`;
    }

    return `${origin}/storage/${raw}`;
  }

  getGalleryPhotoUrl(item: any): string {
    const resolved = this.normalizeMediaUrl(
      item?.photo_url ||
      item?.image_url ||
      item?.preview_url ||
      item?.url ||
      item?.file_url ||
      item?.path_url ||
      item?.image ||
      item?.photo ||
      item?.file_path ||
      item?.path ||
      item?.foto ||
      item
    );

    console.log('[ImageUrlDebug]', {
      raw: item,
      resolved
    });

    return resolved;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    img.closest('.gallery-card')?.classList.add('is-image-missing');
  }
}
