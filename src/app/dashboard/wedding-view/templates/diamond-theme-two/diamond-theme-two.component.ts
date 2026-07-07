import { Component, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DashboardService } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
import { WeddingEvent } from '../../../../services/wedding-data.service';
import { DiamondThemeOneComponent } from '../diamond-theme-one/diamond-theme-one.component';

interface DiamondGardenGalleryItem {
  photoUrl: string;
  alt: string;
}

@Component({
  selector: 'wc-diamond-theme-two',
  templateUrl: './diamond-theme-two.component.html',
  styleUrls: ['./diamond-theme-two.component.scss'],
})
export class DiamondThemeTwoComponent extends DiamondThemeOneComponent {
  isInvitationOpen = false;

  constructor(
    svc: DashboardService,
    sanitizer: DomSanitizer,
    toastService: ToastService
  ) {
    super(sanitizer, svc, toastService);
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);

    if (changes['invitationOpened']) {
      this.isInvitationOpen = this.invitationOpened;
    }
  }

  override openInvitation(): void {
    this.isInvitationOpen = true;
    this.isInvitationOpened = true;
    this.hasOpened = true;
    this.openInvitationRequested.emit();
    document.body.classList.remove('modal-open');

    setTimeout(() => {
      const target = document.querySelector('.diamond-garden-main');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  override getPrimaryDisplayName(): string {
    return this.getBrideNickname() || this.getBrideName() || 'Mempelai Wanita';
  }

  override getSecondaryDisplayName(): string {
    return this.getGroomNickname() || this.getGroomName() || 'Mempelai Pria';
  }

  override getBrideFullName(): string {
    return this.getBrideName() || 'Mempelai Wanita';
  }

  override getGroomFullName(): string {
    return this.getGroomName() || 'Mempelai Pria';
  }

  get guestName(): string {
    return this.getGuestName();
  }

  getHeroLabel(): string {
    return 'Wedding Invitation';
  }

  getOpeningQuote(): string {
    return this.getInvitationIntro();
  }

  getGardenCoverPhotoUrl(): string {
    return this.getGardenHeroImage(1);
  }

  getGardenGallery(): any[] {
    const gallery: any[] = this.weddingData?.gallery || [];

    return gallery.filter((item: any) => {
      return Boolean(item?.photo_url || item?.photo || item?.url || item?.image);
    });
  }

  getGardenHeroImage(index: number): string {
    const gallery = this.getGardenGallery();

    const preferred: any[] = [
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['detail', 'bouquet', 'bunga', 'flower'])),
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['couple', 'pasangan', 'prewedding', 'outdoor'])),
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['venue', 'dekorasi', 'akad', 'resepsi', 'tempat'])),
    ];

    const item: any =
      preferred[index] ||
      gallery[index] ||
      gallery[0] ||
      null;

    const rawUrl =
      item?.photo_url ||
      item?.photo ||
      item?.url ||
      item?.image ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || this.getGardenFallbackImage(index);
  }

  matchGardenPhotoName(photo: any, keywords: string[]): boolean {
    const name = String(
      photo?.nama_foto ||
      photo?.name ||
      photo?.title ||
      photo?.caption ||
      ''
    ).toLowerCase();

    return keywords.some((keyword) => name.includes(keyword));
  }

  getGardenFallbackImage(index: number): string {
    const fallback = [
      'assets/thema-5/hero-top.jpg',
      'assets/thema-5/hero-middle.jpg',
      'assets/thema-5/hero-bottom.jpg',
    ];

    return fallback[index] || fallback[0];
  }

  normalizeGardenPhotoUrl(rawUrl: any): string {
    if (!rawUrl) return '';

    let url = String(rawUrl).trim();
    if (!url) return '';

    url = url.replace('/storage/photos/photos/', '/storage/photos/');
    url = url.replace('/storage/photos//', '/storage/photos/');

    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;

    url = url.replace(/^\/+/, '');
    url = url.replace(/^storage\/photos\/photos\//, 'storage/photos/');
    url = url.replace(/^photos\/photos\//, 'photos/');

    const baseUrl = String(this.apiBaseUrl || (this as any).BASE_URL_API || '')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');

    if (url.startsWith('storage/')) return `${baseUrl}/${url}`;
    if (url.startsWith('photos/')) return `${baseUrl}/storage/${url}`;

    return `${baseUrl}/storage/photos/${url}`;
  }

  onGardenImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    target.style.visibility = 'hidden';
  }

  getGardenEvents(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.acaras)) return data.acaras;
    if (Array.isArray(data?.data?.events)) return data.data.events;

    if (data.events && typeof data.events === 'object') {
      return Object.values(data.events);
    }

    return [];
  }

  getGardenMainEvent(): any {
    const events = this.getGardenEvents();

    return (
      events.find((event: any) => {
        const type = String(
          event?.jenis_acara ||
          event?.nama_acara ||
          event?.type ||
          event?.name ||
          ''
        ).toLowerCase();

        return type.includes('akad');
      }) ||
      events[0] ||
      null
    );
  }

  getGardenDateLabel(): string {
    const event = this.getGardenMainEvent();
    const rawDate =
      event?.tanggal_acara ||
      event?.tanggal ||
      event?.date ||
      event?.event_date ||
      (this.weddingData as any)?.tanggal_acara ||
      (this.weddingData as any)?.tanggal ||
      '';

    return this.formatGardenDate(rawDate);
  }

  formatGardenDate(rawDate: any): string {
    if (!rawDate) return '';

    const value = String(rawDate).trim();
    if (!value) return '';

    const datePart = value.split('T')[0];

    const ymd = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return `${ymd[3]} · ${ymd[2]} · ${ymd[1]}`;

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day} · ${month} · ${year}`;
    }

    return value;
  }

  getMomentGalleryItems(): DiamondGardenGalleryItem[] {
    const items = this.getSafeGalleryPhotos()
      .slice(0, 4)
      .map((item, index) => ({
        photoUrl: this.getGalleryPhotoUrl(item),
        alt: this.getGalleryAlt(item, index),
      }))
      .filter((item) => !!item.photoUrl);

    if (items.length) {
      return items;
    }

    return [
      { photoUrl: this.getGardenCoverPhotoUrl(), alt: `${this.getPrimaryDisplayName()} & ${this.getSecondaryDisplayName()}` },
      { photoUrl: this.getBridePortrait(), alt: this.getBrideFullName() },
      { photoUrl: this.getGroomPortrait(), alt: this.getGroomFullName() },
      { photoUrl: this.getGardenCoverPhotoUrl(), alt: 'Momen bahagia mempelai' },
    ];
  }

  getEventDay(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date ? String(date.getDate()).padStart(2, '0') : '--';
  }

  getEventMonthName(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date
      ? date.toLocaleDateString('id-ID', { month: 'long' })
      : 'Bulan';
  }

  getEventYear(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date ? String(date.getFullYear()) : '----';
  }

  getWishBadgeClass(kehadiran: string): string {
    switch (kehadiran) {
      case 'hadir':
        return 'diamond-garden-wish__badge--hadir';
      case 'mungkin':
        return 'diamond-garden-wish__badge--mungkin';
      default:
        return 'diamond-garden-wish__badge--tidak';
    }
  }

  override getGiftAddress(bank?: any): string {
    return bank?.nama_pemilik ? `a/n ${bank.nama_pemilik}` : 'Atas nama mempelai';
  }

  getMapPreviewCaption(event: WeddingEvent): string {
    return this.getEventAddress(event);
  }
}
