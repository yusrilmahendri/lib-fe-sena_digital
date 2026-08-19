import { Component, HostListener, OnDestroy, OnInit, Input } from '@angular/core';
import { GalleryItem } from '../../../services/wedding-data.service';
import {
  getOrderedGalleryPhotos,
  getPhotoObjectFit,
  getPhotoObjectPosition,
  isInvitationVideoMedia,
  logInvitationImageError,
  normalizeInvitationMediaUrl,
  resolveInvitationPhotoUrl,
} from '../../../shared/user-photo.model';

@Component({
  selector: 'wc-gallery-view',
  templateUrl: './gallery-view.component.html',
  styleUrls: ['./gallery-view.component.scss']
})
export class GalleryViewComponent implements OnInit, OnDestroy {
  @Input() galleryItems: GalleryItem[] | undefined = [];
  selectedImageIndex = -1;

  private touchStartX = 0;
  private touchStartY = 0;
  private scrollY = 0;
  private readonly swipeThreshold = 48;

  constructor() { }

  ngOnInit(): void {
    console.log('GalleryViewComponent initialized with gallery:', this.galleryItems);
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  getGalleryImages(): GalleryItem[] {
    return getOrderedGalleryPhotos(this.galleryItems || []);
  }

  getLightboxImages(): GalleryItem[] {
    return this.getGalleryImages().filter((item) => !isInvitationVideoMedia(item));
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

  get isLightboxOpen(): boolean {
    return this.selectedImageIndex >= 0 && this.getLightboxImages().length > 0;
  }

  get selectedImage(): GalleryItem | null {
    return this.getLightboxImages()[this.selectedImageIndex] || null;
  }

  openLightbox(item: GalleryItem): void {
    if (isInvitationVideoMedia(item)) {
      return;
    }

    const index = this.getLightboxImages().findIndex((image) => image === item || image.id === item.id);

    if (index < 0) {
      return;
    }

    this.selectedImageIndex = index;
    this.lockScroll();
  }

  closeLightbox(): void {
    this.selectedImageIndex = -1;
    this.unlockScroll();
  }

  showPreviousImage(): void {
    const total = this.getLightboxImages().length;

    if (!total) {
      return;
    }

    this.selectedImageIndex = (this.selectedImageIndex - 1 + total) % total;
  }

  showNextImage(): void {
    const total = this.getLightboxImages().length;

    if (!total) {
      return;
    }

    this.selectedImageIndex = (this.selectedImageIndex + 1) % total;
  }

  onLightboxTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  onLightboxTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (horizontalDistance < this.swipeThreshold || horizontalDistance < verticalDistance * 1.2) {
      return;
    }

    if (deltaX < 0) {
      this.showNextImage();
      return;
    }

    this.showPreviousImage();
  }

  @HostListener('document:keydown', ['$event'])
  onLightboxKeydown(event: KeyboardEvent): void {
    if (!this.isLightboxOpen) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeLightbox();
      return;
    }

    if (event.key === 'ArrowLeft') {
      this.showPreviousImage();
      return;
    }

    if (event.key === 'ArrowRight') {
      this.showNextImage();
    }
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

  private lockScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const scrollY = this.scrollY;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';

    if (scrollY > 0) {
      window.scrollTo(0, scrollY);
    }
  }
}
