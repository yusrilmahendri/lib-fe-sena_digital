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
  constructor(
    svc: DashboardService,
    sanitizer: DomSanitizer,
    toastService: ToastService
  ) {
    super(sanitizer, svc, toastService);
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);

    if (changes['invitationOpened'] && this.invitationOpened) {
      this.isInvitationOpened = true;
    }
  }

  override openInvitation(): void {
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

  get wishFormData(): any {
    if (!this.wishForm.kehadiran) {
      this.wishForm.kehadiran = 'hadir';
    }

    return this.wishForm;
  }

  override getBrideData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data.mempelai || data.mempelais || data.couple || {};

    return (
      data.bride ||
      mempelai.bride ||
      mempelai.wanita ||
      mempelai.perempuan ||
      mempelai.mempelai_wanita ||
      (Array.isArray(mempelai) ? mempelai.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('wanita') || gender.includes('perempuan') || gender.includes('bride');
      }) : null) ||
      this.getBride() ||
      {}
    );
  }

  override getGroomData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data.mempelai || data.mempelais || data.couple || {};

    return (
      data.groom ||
      mempelai.groom ||
      mempelai.pria ||
      mempelai.laki_laki ||
      mempelai.mempelai_pria ||
      (Array.isArray(mempelai) ? mempelai.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('pria') || gender.includes('laki') || gender.includes('groom');
      }) : null) ||
      this.getGroom() ||
      {}
    );
  }

  override getBrideName(): string {
    const bride = this.getBrideData();
    const data: any = this.weddingData || {};

    return this.gardenFirstFilled([
      data?.mempelai?.nama_wanita,
      bride?.nama_lengkap,
      bride?.full_name,
      bride?.name,
      bride?.nama,
      bride?.nama_mempelai,
      super.getBrideName(),
    ], 'Mempelai Wanita');
  }

  override getGroomName(): string {
    const groom = this.getGroomData();
    const data: any = this.weddingData || {};

    return this.gardenFirstFilled([
      data?.mempelai?.nama_pria,
      groom?.nama_lengkap,
      groom?.full_name,
      groom?.name,
      groom?.nama,
      groom?.nama_mempelai,
      super.getGroomName(),
    ], 'Mempelai Pria');
  }

  override getBrideParents(): string {
    const bride = this.getBrideData();

    return this.gardenFirstFilled([
      bride?.nama_orang_tua,
      bride?.orang_tua,
      bride?.parents,
      bride?.parent,
      bride?.nama_ayah && bride?.nama_ibu ? `Putri dari ${bride.nama_ayah} & ${bride.nama_ibu}` : '',
      super.getBrideParents(),
    ], '');
  }

  override getGroomParents(): string {
    const groom = this.getGroomData();

    return this.gardenFirstFilled([
      groom?.nama_orang_tua,
      groom?.orang_tua,
      groom?.parents,
      groom?.parent,
      groom?.nama_ayah && groom?.nama_ibu ? `Putra dari ${groom.nama_ayah} & ${groom.nama_ibu}` : '',
      super.getGroomParents(),
    ], '');
  }

  override getBridePhotoUrl(): string {
    const bride = this.getBrideData();
    const rawUrl =
      bride?.photo_url ||
      bride?.foto_url ||
      bride?.photo ||
      bride?.foto ||
      bride?.image ||
      bride?.avatar ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || super.getBridePhotoUrl();
  }

  override getGroomPhotoUrl(): string {
    const groom = this.getGroomData();
    const rawUrl =
      groom?.photo_url ||
      groom?.foto_url ||
      groom?.photo ||
      groom?.foto ||
      groom?.image ||
      groom?.avatar ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || super.getGroomPhotoUrl();
  }

  override getBrideInstagram(): string {
    const bride = this.getBrideData();

    return this.gardenFirstFilled([
      bride?.instagram,
      bride?.ig,
      bride?.sosmed,
      bride?.social_media,
      super.getBrideInstagram(),
    ], '').replace('@', '');
  }

  override getGroomInstagram(): string {
    const groom = this.getGroomData();

    return this.gardenFirstFilled([
      groom?.instagram,
      groom?.ig,
      groom?.sosmed,
      groom?.social_media,
      super.getGroomInstagram(),
    ], '').replace('@', '');
  }

  override getInstagramUrl(username: string): string {
    const value = String(username || '').replace('@', '').trim();
    return value ? `https://instagram.com/${value}` : '#';
  }

  private gardenFirstFilled(values: any[], fallback = ''): string {
    const found = values.find((value) => {
      const text = String(value || '').trim();
      return !!text && text !== 'null' && text !== 'undefined';
    });

    return found ? String(found).trim() : fallback;
  }

  getHeroLabel(): string {
    return 'Wedding Invitation';
  }

  getOpeningQuote(): string {
    return this.getInvitationIntro();
  }

  getGardenCoverPhotoUrl(): string {
    return this.getGardenHeroImage(2);
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
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['wanita', 'bride', 'female', 'mempelai wanita', 'pengantin wanita'])),
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['pria', 'groom', 'male', 'mempelai pria', 'pengantin pria'])),
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['couple', 'pasangan', 'berdua', 'prewedding', 'outdoor', 'cover', 'sampul'])),
    ];

    const portraitFallback = [
      this.getBridePortrait(),
      this.getGroomPortrait(),
      this.getGardenGalleryCoverPhoto(),
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

    return this.normalizeGardenPhotoUrl(rawUrl) || portraitFallback[index] || this.getGardenFallbackImage(index);
  }

  getHeroImage(index: number): string {
    return this.getGardenHeroImage(index);
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

  getGardenGalleryCoverPhoto(): string {
    const gallery = this.getGardenGallery();
    const item: any =
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['couple', 'pasangan', 'berdua', 'prewedding', 'outdoor', 'cover', 'sampul'])) ||
      gallery[2] ||
      gallery[0] ||
      null;

    const rawUrl =
      item?.photo_url ||
      item?.photo ||
      item?.url ||
      item?.image ||
      (this.weddingData as any)?.cover_url ||
      (this.weddingData as any)?.cover ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl);
  }

  getGardenMomentGallery(): any[] {
    const gallery: any[] = this.weddingData?.gallery || [];

    return gallery.filter((item: any) => {
      return Boolean(
        item?.photo_url ||
        item?.photo ||
        item?.url ||
        item?.image
      );
    });
  }

  getGardenMomentFeatured(): any {
    const gallery = this.getGardenMomentGallery();

    return (
      gallery.find((item: any) => item?.url_video || item?.video_url || item?.link_video) ||
      gallery[0] ||
      null
    );
  }

  getGardenMomentPhotos(): any[] {
    const gallery = this.getGardenMomentGallery();
    const featured = this.getGardenMomentFeatured();

    return gallery
      .filter((item: any) => item !== featured)
      .slice(0, 3);
  }

  getGardenMomentPhotoUrl(item: any): string {
    const rawUrl =
      item?.photo_url ||
      item?.photo ||
      item?.url ||
      item?.image ||
      item?.foto ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || this.getGardenFallbackImage(1);
  }

  getGardenMomentAlt(item: any, index: number): string {
    return String(
      item?.nama_foto ||
      item?.name ||
      item?.title ||
      `Moment ${index + 1}`
    );
  }

  hasGardenMomentVideo(item: any): boolean {
    return Boolean(
      item?.url_video ||
      item?.video_url ||
      item?.link_video
    );
  }

  openGardenMomentVideo(item: any): void {
    const videoUrl = String(
      item?.url_video ||
      item?.video_url ||
      item?.link_video ||
      ''
    ).trim();

    if (!videoUrl) return;

    window.open(videoUrl, '_blank');
  }

  getGardenGuestWishes(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.guest_wishes)) return data.guest_wishes;
    if (Array.isArray(data.ucapan)) return data.ucapan;
    if (Array.isArray(data.wishes)) return data.wishes;
    if (Array.isArray(data?.data?.guest_wishes)) return data.data.guest_wishes;

    return [];
  }

  isRealGardenWish(item: any): boolean {
    const name = String(item?.nama || item?.name || '').trim().toLowerCase();
    const message = String(item?.pesan || item?.message || item?.ucapan || '').trim();
    const normalized = message.toLowerCase();

    if (!message) return false;
    if (name === 'viewer') return false;
    if (normalized.startsWith('undangan ') && normalized.endsWith(' telah dilihat')) return false;

    return true;
  }

  getVisibleGardenWishes(): any[] {
    return this.getGardenGuestWishes()
      .filter((item: any) => this.isRealGardenWish(item))
      .slice(0, 3);
  }

  getWishAttendance(wish: any): string {
    return String(
      wish?.kehadiran ||
      wish?.attendance ||
      wish?.status_kehadiran ||
      'hadir'
    ).toLowerCase();
  }

  override getWishAttendanceLabel(wish: any): string {
    const status = typeof wish === 'string' ? wish.toLowerCase() : this.getWishAttendance(wish);

    if (status === 'tidak_hadir') return 'Tidak Hadir';
    if (status === 'mungkin') return 'Mungkin';

    return 'Hadir';
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

  getGardenEventDate(event?: any): Date | null {
    const rawDate = String(
      event?.tanggal_acara ||
      event?.tanggal ||
      event?.date ||
      event?.event_date ||
      ''
    ).trim();

    if (!rawDate) return null;

    const datePart = rawDate.split('T')[0];
    const date = new Date(`${datePart}T00:00:00`);

    return isNaN(date.getTime()) ? null : date;
  }

  getGardenEventMonthLabel(event?: any): string {
    const date = this.getGardenEventDate(event);

    if (!date) return '';

    return date.toLocaleDateString('id-ID', { month: 'long' });
  }

  getGardenEventDayNumber(event?: any): string {
    const date = this.getGardenEventDate(event);

    if (!date) return '--';

    return String(date.getDate()).padStart(2, '0');
  }

  getGardenEventYearLabel(event?: any): string {
    const date = this.getGardenEventDate(event);

    if (!date) return '';

    return String(date.getFullYear());
  }

  override getEventVenueName(event?: any): string {
    const selectedEvent = event || this.getGardenMainEvent();

    return String(
      selectedEvent?.nama_tempat ||
      selectedEvent?.tempat ||
      selectedEvent?.venue ||
      selectedEvent?.lokasi ||
      selectedEvent?.location ||
      selectedEvent?.gedung ||
      selectedEvent?.nama_lokasi ||
      selectedEvent?.nama_acara ||
      ''
    ).trim();
  }

  override getDetailEventVenue(event?: any): string {
    const selectedEvent = event || this.getGardenMainEvent();

    return String(
      selectedEvent?.nama_tempat ||
      selectedEvent?.tempat ||
      selectedEvent?.venue ||
      selectedEvent?.lokasi ||
      selectedEvent?.location ||
      selectedEvent?.gedung ||
      selectedEvent?.nama_lokasi ||
      selectedEvent?.nama_acara ||
      ''
    ).trim();
  }

  getDetailEventAddress(event?: any): string {
    return String(
      event?.alamat ||
      event?.address ||
      event?.lokasi_detail ||
      event?.detail_lokasi ||
      event?.alamat_lengkap ||
      ''
    ).trim();
  }

  override getEventMapLink(event?: any): string {
    const selectedEvent = event || this.getGardenMainEvent();

    return String(
      selectedEvent?.link_maps ||
      selectedEvent?.link_map ||
      selectedEvent?.maps ||
      selectedEvent?.map_url ||
      selectedEvent?.google_maps ||
      selectedEvent?.google_map ||
      ''
    ).trim();
  }

  override getAkadMapLink(): string {
    return this.getEventMapLink(this.getAkadEvent());
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
    if (ymd) return `${ymd[3]} . ${ymd[2]} . ${ymd[1]}`;

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day} . ${month} . ${year}`;
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
