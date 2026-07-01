import { Component, OnInit, Input } from '@angular/core';
import { GalleryItem } from '../../../services/wedding-data.service';
import { environment } from '../../../../environments/environment';

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
    if (this.galleryItems?.length) {
      const sample = this.galleryItems[0];
      console.log('[GalleryImageDebug]', { item: sample, resolvedUrl: this.getImageUrl(sample) });
    }
  }

  getGalleryImages(): GalleryItem[] {
    return this.galleryItems || [];
  }

  hasImages(): boolean {
    return !!(this.galleryItems && this.galleryItems.length > 0);
  }

  getImageUrl(item: any): string {
    const origin = ((environment as any).apiUrl || (environment as any).baseUrl || environment.apiBaseUrl || '')
      .replace(/\/api\/?$/, '').replace(/\/$/, '');

    // Try all known field names in priority order
    const value = item?.url || item?.photo_url || item?.file_url || item?.image_url ||
      item?.preview_url || item?.path_url || item?.photo ||
      item?.file_path || item?.path || item?.image || item?.foto;

    if (!value) {
      return 'assets/default-gallery.jpg';
    }
    const raw = String(value).trim();
    if (!raw || raw === 'null' || raw === 'undefined') {
      return 'assets/default-gallery.jpg';
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    if (raw.startsWith('/storage/')) {
      return `${origin}${raw}`;
    }
    if (raw.startsWith('storage/')) {
      return `${origin}/${raw}`;
    }
    if (raw.startsWith('/')) {
      return `${origin}${raw}`;
    }
    return `${origin}/storage/${raw}`;
  }

  getImageAlt(item: GalleryItem, index: number): string {
    return item.nama_foto || `Gallery image ${index + 1}`;
  }

  trackByGalleryId(index: number, item: GalleryItem): number {
    return item.id;
  }
}
