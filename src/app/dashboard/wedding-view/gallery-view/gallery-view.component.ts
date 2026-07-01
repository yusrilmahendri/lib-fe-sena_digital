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

  getImageUrl(item: GalleryItem): string {
    const raw = String(item?.photo || '').trim();
    if (!raw) {
      return 'assets/default-gallery.jpg';
    }
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    const origin = (environment.apiBaseUrl || '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');
    if (raw.startsWith('/storage/')) {
      return `${origin}${raw}`;
    }
    const clean = raw.replace(/^\/+/, '');
    if (clean.startsWith('storage/')) {
      return `${origin}/${clean}`;
    }
    return `${origin}/storage/${clean}`;
  }

  getImageAlt(item: GalleryItem, index: number): string {
    return item.nama_foto || `Gallery image ${index + 1}`;
  }

  trackByGalleryId(index: number, item: GalleryItem): number {
    return item.id;
  }
}
