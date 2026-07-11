import { Component, OnInit, Input } from '@angular/core';
import { GalleryItem } from '../../../services/wedding-data.service';
import {
  getOrderedGalleryPhotos,
  getPhotoObjectFit,
  getPhotoObjectPosition,
  logInvitationImageError,
  normalizeInvitationMediaUrl,
  resolveInvitationPhotoUrl,
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

  normalizeMediaUrl(value: any): string {
    return normalizeInvitationMediaUrl(value);
  }

  getGalleryPhotoUrl(item: any): string {
    const resolved = resolveInvitationPhotoUrl(item);

    console.log('[ImageUrlDebug]', {
      context: 'gallery-view',
      raw: item,
      resolved
    });

    return resolved;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    logInvitationImageError(event, 'gallery-view');
    img.style.display = 'none';
  }
}
