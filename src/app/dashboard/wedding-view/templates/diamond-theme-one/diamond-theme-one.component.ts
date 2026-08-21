import { ChangeDetectorRef, Component, HostListener, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
import { BankAccount, GalleryItem, WeddingEvent, WeddingStory } from '../../../../services/wedding-data.service';
import { RubyThemeOneComponent } from '../ruby-theme-one/ruby-theme-one.component';
import { environment } from '../../../../../environments/environment';
import {
  isInvitationVideoMedia,
  normalizeInvitationMediaUrl,
  resolveInvitationMediaUrlFromItem,
  resolveInvitationPhotoUrl,
  resolveInvitationVideoUrl,
} from '../../../../shared/user-photo.model';
import { normalizeYoutubeEmbedUrl } from '../../../../shared/wedding-theme-data.util';

@Component({
  selector: 'wc-diamond-theme-one',
  templateUrl: './diamond-theme-one.component.html',
  styleUrls: ['./diamond-theme-one.component.scss'],
})
export class DiamondThemeOneComponent extends RubyThemeOneComponent implements OnInit, OnChanges, OnDestroy {
  override isInvitationOpened = false;
  diamondOpened = false;
  readonly apiBaseUrl = (environment as any).apiBaseUrl || (environment as any).apiUrl || '';
  countdown = {
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
  };
  selectedGalleryPhotoIndex = -1;
  currentWishPage = 1;
  wishPageSize = 3;
  diamondInlineYoutubeSrc: SafeResourceUrl | null = null;
  readonly diamondGlobalParticles: Array<{
    left: string;
    size: number;
    opacity: number;
    duration: number;
    delay: number;
    drift: number;
    glow: boolean;
    kind: 'dot' | 'star';
  }> = [
    { left: '4%', size: 2, opacity: 0.18, duration: 14.4, delay: -12.1, drift: -6, glow: false, kind: 'dot' },
    { left: '9%', size: 4, opacity: 0.32, duration: 11.2, delay: -8.4, drift: 8, glow: true, kind: 'dot' },
    { left: '13%', size: 3, opacity: 0.22, duration: 15.6, delay: -3.2, drift: -4, glow: false, kind: 'dot' },
    { left: '18%', size: 5, opacity: 0.28, duration: 9.8, delay: -14.6, drift: 11, glow: true, kind: 'star' },
    { left: '23%', size: 2, opacity: 0.16, duration: 13.1, delay: -1.1, drift: -8, glow: false, kind: 'dot' },
    { left: '28%', size: 3, opacity: 0.4, duration: 8.6, delay: -9.7, drift: 5, glow: false, kind: 'dot' },
    { left: '34%', size: 6, opacity: 0.24, duration: 16, delay: -6.3, drift: 10, glow: true, kind: 'dot' },
    { left: '39%', size: 2, opacity: 0.2, duration: 12.4, delay: -13.8, drift: -5, glow: false, kind: 'dot' },
    { left: '44%', size: 4, opacity: 0.36, duration: 10.2, delay: -4.5, drift: 7, glow: true, kind: 'star' },
    { left: '49%', size: 3, opacity: 0.18, duration: 14.8, delay: -0.8, drift: -7, glow: false, kind: 'dot' },
    { left: '54%', size: 2, opacity: 0.3, duration: 9.1, delay: -11.2, drift: 12, glow: false, kind: 'dot' },
    { left: '58%', size: 5, opacity: 0.26, duration: 13.7, delay: -7.6, drift: -3, glow: true, kind: 'dot' },
    { left: '63%', size: 3, opacity: 0.42, duration: 11.6, delay: -2.4, drift: 6, glow: false, kind: 'star' },
    { left: '68%', size: 2, opacity: 0.15, duration: 15.2, delay: -10.9, drift: -8, glow: false, kind: 'dot' },
    { left: '73%', size: 4, opacity: 0.34, duration: 8.4, delay: -5.1, drift: 9, glow: true, kind: 'dot' },
    { left: '78%', size: 3, opacity: 0.21, duration: 12.8, delay: -14.1, drift: 4, glow: false, kind: 'dot' },
    { left: '82%', size: 6, opacity: 0.27, duration: 10.7, delay: -1.8, drift: -6, glow: true, kind: 'star' },
    { left: '86%', size: 2, opacity: 0.19, duration: 14.1, delay: -8.8, drift: 8, glow: false, kind: 'dot' },
    { left: '90%', size: 3, opacity: 0.38, duration: 9.4, delay: -3.7, drift: 11, glow: false, kind: 'dot' },
    { left: '94%', size: 4, opacity: 0.23, duration: 15.8, delay: -12.6, drift: -4, glow: true, kind: 'dot' },
    { left: '7%', size: 2, opacity: 0.17, duration: 11.9, delay: -6.8, drift: 3, glow: false, kind: 'dot' },
    { left: '41%', size: 5, opacity: 0.29, duration: 13.3, delay: -9.2, drift: -7, glow: true, kind: 'star' },
    { left: '71%', size: 3, opacity: 0.33, duration: 8.9, delay: -0.4, drift: 10, glow: false, kind: 'dot' },
    { left: '96%', size: 2, opacity: 0.2, duration: 12.1, delay: -15.4, drift: 5, glow: false, kind: 'dot' },
  ];
  private diamondInlineYoutubeId = '';
  private countdownInterval: any = null;
  private mapEmbedUrlCache = new Map<string, SafeResourceUrl>();
  private lightboxTouchStartX = 0;
  private lightboxTouchStartY = 0;
  private readonly lightboxSwipeThreshold = 48;

  constructor(
    private diamondSanitizer: DomSanitizer,
    dashboardService: DashboardService,
    private readonly diamondToast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {
    super(diamondSanitizer, dashboardService, diamondToast);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.startDiamondCountdown();
    this.syncWishPage();
    this.refreshDiamondInlineYoutube();
    if (!this.wishForm.kehadiran) {
      this.wishForm.kehadiran = 'hadir';
    }
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);
    if (changes['weddingData']) {
      this.startDiamondCountdown();
      this.syncWishPage();
      this.refreshDiamondInlineYoutube();
      this.debugDiamondEvents();
      this.debugDiamondDate();
      this.debugDiamondMap();
    }
  }

  override ngOnDestroy(): void {
    this.clearDiamondCountdownInterval();
    super.ngOnDestroy();
  }

  /**
   * Champagne Rose opening is fully child-owned: `diamondOpened` is the only
   * source of truth for the cover/main split in the template. The parent's
   * `invitationOpened` input, `hasOpened`, `isInvitationOpened`, `isCoverVisible`
   * and `currentView` are intentionally never read here — tracking, audio and
   * any other parent side-effect run only *after* this fires and can never
   * hold the cover on screen or close it back.
   */
  openDiamondThemeOne(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.diamondOpened) {
      return;
    }

    // BUKA VISUAL DULU
    this.diamondOpened = true;
    this.cdr.detectChanges();

    // Parent hanya side effect setelah child sudah open.
    setTimeout(() => {
      this.openInvitationRequested.emit();
    }, 0);
  }

  override getPrimaryDisplayName(): string {
    return this.getGroomShortName();
  }

  override getSecondaryDisplayName(): string {
    return this.getBrideShortName();
  }

  override getBrideName(): string {
    const bride = this.getBride() as any;
    const data = this.weddingData as any;
    return this.firstFilled([
      data?.mempelai?.nama_wanita,
      bride?.nama_lengkap,
      bride?.name,
      bride?.nama,
      data?.mempelai_wanita?.nama_lengkap,
      data?.mempelai?.wanita?.nama_lengkap,
      data?.mempelai?.wanita?.nama,
      data?.mempelai?.female_name,
    ], '');
  }

  override getGroomName(): string {
    const groom = this.getGroom() as any;
    const data = this.weddingData as any;
    return this.firstFilled([
      data?.mempelai?.nama_pria,
      groom?.nama_lengkap,
      groom?.name,
      groom?.nama,
      data?.mempelai_pria?.nama_lengkap,
      data?.mempelai?.pria?.nama_lengkap,
      data?.mempelai?.pria?.nama,
      data?.mempelai?.male_name,
    ], '');
  }

  getGroomFullName(): string {
    return this.getGroomName() || this.getGroomShortName();
  }

  getBrideFullName(): string {
    return this.getBrideName() || this.getBrideShortName();
  }

  getGroomShortName(): string {
    const groom = this.getGroom() as any;
    const data = this.weddingData as any;
    return this.firstFilled([
      groom?.nama_panggilan,
      groom?.nickname,
      data?.mempelai?.nama_panggilan_pria,
      data?.mempelai?.pria?.nama_panggilan,
      data?.mempelai_pria?.nama_panggilan,
      this.getGroomName(),
    ], '');
  }

  getBrideShortName(): string {
    const bride = this.getBride() as any;
    const data = this.weddingData as any;
    return this.firstFilled([
      bride?.nama_panggilan,
      bride?.nickname,
      data?.mempelai?.nama_panggilan_wanita,
      data?.mempelai?.wanita?.nama_panggilan,
      data?.mempelai_wanita?.nama_panggilan,
      this.getBrideName(),
    ], '');
  }

  getCoupleNames(): string {
    const groom = this.getGroomShortName() || this.getGroomName();
    const bride = this.getBrideShortName() || this.getBrideName();
    if (groom && bride) {
      return `${groom} & ${bride}`;
    }
    return groom || bride || 'Bride & Groom';
  }

  getWeddingDateText(): string {
    return this.getOpeningDateLabel();
  }

  getWeddingDayPart(): string {
    const date = this.getCeremonyDateSource();
    return date ? String(date.getDate()).padStart(2, '0') : '--';
  }

  getWeddingMonthPart(): string {
    const date = this.getCeremonyDateSource();
    return date ? String(date.getMonth() + 1).padStart(2, '0') : '--';
  }

  getWeddingYearPart(): string {
    const date = this.getCeremonyDateSource();
    return date ? String(date.getFullYear()) : '----';
  }

  override getOpeningDateLabel(): string {
    return this.getHeroDateLabel();
  }

  override getCoverPhoto(): string {
    return this.getCoverPhotoUrl();
  }

  getCoverPhotoUrl(): string {
    const photos = this.getDiamondPhotoItems();
    const featuredGalleryPhoto = photos[0] || this.getFeaturedGalleryItem();
    const featuredGalleryUrl = featuredGalleryPhoto && this.isDiamondPhotoItem(featuredGalleryPhoto)
      ? this.getGalleryPhotoUrl(featuredGalleryPhoto)
      : '';
    const namedCover = photos.find((item: any) => {
      const name = String(item?.nama_foto || item?.name || '').toLowerCase();
      return (name.includes('cover') || name.includes('outdoor')) && this.getGalleryCandidateUrl(item);
    });
    const firstGalleryPhoto = photos.find((item: any) => this.getGalleryCandidateUrl(item));

    const candidates = [
      featuredGalleryUrl,
      this.getGalleryCandidateUrl(namedCover),
      this.getGalleryCandidateUrl(firstGalleryPhoto),
      (this.weddingData as any)?.cover_photo_url,
      (this.weddingData as any)?.mempelai?.cover_photo_url,
      this.weddingData?.mempelai?.cover_photo,
      (this.weddingData as any)?.cover_photo,
      this.getBridePhoto(),
      this.getGroomPhoto(),
    ];

    for (const candidate of candidates) {
      const photoUrl = this.normalizePhotoUrl(candidate);
      if (photoUrl) {
        return photoUrl;
      }
    }

    return 'assets/thema-4/diamond-cover.jpg';
  }

  private getGalleryCandidateUrl(item: any): string {
    if (!this.isDiamondPhotoItem(item)) {
      return '';
    }

    return resolveInvitationPhotoUrl(item);
  }

  getOpeningPhoto(): string {
    return this.getCoverPhotoUrl();
  }

  getPrayerPhotoUrl(): string {
    const item = this.pickDiamondPhotoItem([
      'couple',
      'pasangan',
      'berdua',
      'outdoor',
      'prewedding',
      'sampul',
      'cover',
    ], 1);

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  override getGuestName(): string {
    return super.getGuestName();
  }

  override getEvents(): any[] {
    return super.getEvents();
  }

  private normalizeEventType(event: any): string {
    return String(
      event?.jenis_acara ||
      event?.nama_acara ||
      event?.type ||
      event?.name ||
      ''
    ).toLowerCase();
  }

  getMainEvent(): any {
    const events = this.getEvents();

    if (!events.length) return null;

    return (
      events.find((event: any) => this.normalizeEventType(event).includes('akad')) ||
      events.find((event: any) => Boolean(this.getEventDateValue(event))) ||
      events[0]
    );
  }

  override getAkadEvent(): any {
    const events = this.getEvents();

    return (
      events.find((event: any) => this.normalizeEventType(event).includes('akad')) ||
      events[0] ||
      null
    );
  }

  getResepsiEvent(): any {
    const events = this.getEvents();
    const akad = this.getAkadEvent();

    return (
      events.find((event: any) => {
        const type = this.normalizeEventType(event);
        return type.includes('resepsi') || type.includes('reception') || type.includes('walimah');
      }) ||
      events.find((event: any) => event !== akad) ||
      events[1] ||
      null
    );
  }

  getEventForLocation(): any {
    return this.getResepsiEvent() || this.getAkadEvent();
  }

  getEventDateValue(event?: any): string {
    const selectedEvent = event || this.getAkadEvent() || this.getResepsiEvent();

    return String(
      selectedEvent?.tanggal_acara ||
      selectedEvent?.tanggal ||
      selectedEvent?.date ||
      selectedEvent?.event_date ||
      selectedEvent?.start_date ||
      ''
    ).trim();
  }

  getMainEventDayName(): string {
    const rawDate = this.getEventDateValue(this.getAkadEvent());

    if (!rawDate) return '';

    const dateOnly = rawDate.split('T')[0];
    const date = new Date(`${dateOnly}T00:00:00`);

    if (isNaN(date.getTime())) return '';

    return date.toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase();
  }

  getMainEventLongDate(): string {
    const rawDate = this.getEventDateValue(this.getAkadEvent());

    if (!rawDate) return '';

    const value = rawDate.split('T')[0];

    const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const date = new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00:00`);
      const month = date.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
      return `${ymd[3]} ${month} ${ymd[1]}`;
    }

    const parsed = new Date(value);

    if (isNaN(parsed.getTime())) return value;

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = parsed.toLocaleDateString('id-ID', { month: 'long' }).toUpperCase();
    const year = parsed.getFullYear();

    return `${day} ${month} ${year}`;
  }

  formatEventTime(start?: string, end?: string): string {
    const clean = (value?: string): string => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      return raw.slice(0, 5).replace(':', '.');
    };

    const startTime = clean(start);
    const endTime = clean(end);

    if (startTime && endTime) return `${startTime} - ${endTime} WIB`;
    if (startTime) return `${startTime} WIB`;

    return '';
  }

  getAkadTimeLabel(): string {
    const event = this.getAkadEvent();
    if (!event) return '';

    return this.formatEventTime(
      event?.start_acara || event?.jam_mulai || event?.start_time || event?.mulai,
      event?.end_acara || event?.jam_selesai || event?.end_time || event?.selesai
    );
  }

  getResepsiTimeLabel(): string {
    const event = this.getResepsiEvent();
    if (!event) return '';

    return this.formatEventTime(
      event?.start_acara || event?.jam_mulai || event?.start_time || event?.mulai,
      event?.end_acara || event?.jam_selesai || event?.end_time || event?.selesai
    );
  }

  getDiamondEventTimeLabel(event?: any): string {
    if (!event) {
      return '';
    }

    return this.formatEventTime(
      event?.start_acara || event?.jam_mulai || event?.start_time || event?.mulai,
      event?.end_acara || event?.jam_selesai || event?.end_time || event?.selesai
    );
  }

  getEventVenueName(event?: any): string {
    const selectedEvent = event || this.getEventForLocation();
    if (!selectedEvent) return '';

    return String(
      selectedEvent?.nama_tempat ||
      selectedEvent?.tempat ||
      selectedEvent?.venue ||
      selectedEvent?.lokasi ||
      selectedEvent?.location ||
      selectedEvent?.gedung ||
      selectedEvent?.nama_lokasi ||
      ''
    ).trim();
  }

  override getEventAddress(event?: WeddingEvent | any): string {
    const selectedEvent = event || this.getEventForLocation();
    if (!selectedEvent) return '';

    return String(
      selectedEvent?.alamat ||
      selectedEvent?.address ||
      selectedEvent?.lokasi_detail ||
      selectedEvent?.detail_lokasi ||
      selectedEvent?.alamat_lengkap ||
      ''
    ).trim();
  }

  getEventMapLink(): string {
    const event = this.getEventForLocation();
    return this.getEventMapUrl(event) || '';
  }

  getDiamondMapEvents(): any[] {
    return this.getOrderedEvents().filter((event) => this.hasDiamondEventMap(event));
  }

  hasDiamondEventMap(event?: any): boolean {
    return !!this.getDirectEventMapLink(event);
  }

  getDiamondEventVenue(event?: any): string {
    if (!event) {
      return '';
    }

    return String(
      event?.nama_tempat ||
      event?.nama_lokasi ||
      event?.tempat ||
      event?.venue ||
      event?.venue_name ||
      event?.lokasi ||
      event?.location ||
      event?.gedung ||
      ''
    ).trim();
  }

  getEventMapEmbedUrl(event?: any): SafeResourceUrl | null {
    if (!event || !this.hasDiamondEventMap(event)) {
      return null;
    }

    const mapLink = this.getDirectEventMapLink(event) || this.getEventMapUrl(event) || '';
    const address = this.getEventAddress(event);
    const venue = this.getDiamondEventVenue(event);
    const rawEmbedUrl = this.buildGoogleMapsEmbedUrl(mapLink, address, venue);

    if (!rawEmbedUrl) {
      return null;
    }

    if (this.mapEmbedUrlCache.has(rawEmbedUrl)) {
      return this.mapEmbedUrlCache.get(rawEmbedUrl) || null;
    }

    const safeUrl = this.diamondSanitizer.bypassSecurityTrustResourceUrl(rawEmbedUrl);
    this.mapEmbedUrlCache.set(rawEmbedUrl, safeUrl);
    return safeUrl;
  }

  trackByDiamondEvent(index: number, event: any): string {
    return String(event?.id || event?.nama_acara || event?.jenis_acara || index);
  }

  getMapPreviewUrl(): string {
    const event = this.getEventForLocation();
    if (!event) return '';

    const rawUrl =
      event?.map_image_url ||
      event?.maps_image ||
      event?.photo_maps ||
      event?.map_preview ||
      event?.image_maps ||
      event?.gambar_maps ||
      '';

    return this.normalizePhotoUrl(rawUrl);
  }

  getMapEmbedUrl(): SafeResourceUrl | null {
    const mapLink = this.getEventMapLink();
    const address = this.getEventAddress();
    const venue = this.getEventVenueName();

    const rawEmbedUrl = this.buildGoogleMapsEmbedUrl(mapLink, address, venue);

    if (!rawEmbedUrl) return null;

    if (this.mapEmbedUrlCache.has(rawEmbedUrl)) {
      return this.mapEmbedUrlCache.get(rawEmbedUrl) || null;
    }

    const safeUrl = this.diamondSanitizer.bypassSecurityTrustResourceUrl(rawEmbedUrl);
    this.mapEmbedUrlCache.set(rawEmbedUrl, safeUrl);

    return safeUrl;
  }

  private buildGoogleMapsEmbedUrl(mapLink?: string, address?: string, venue?: string): string {
    const link = String(mapLink || '').trim();
    const addressText = String(address || '').trim();
    const venueText = String(venue || '').trim();

    if (link) {
      try {
        const url = new URL(link);

        const q = url.searchParams.get('q') || url.searchParams.get('query');

        if (q) {
          return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
        }

        const placeMatch = url.pathname.match(/\/place\/([^/]+)/);
        if (placeMatch?.[1]) {
          const place = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
          return `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
        }

        const coordinateMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (coordinateMatch) {
          return `https://www.google.com/maps?q=${coordinateMatch[1]},${coordinateMatch[2]}&output=embed`;
        }
      } catch (error) {
        // Abaikan error parsing URL, lanjut fallback address.
      }
    }

    const query = [venueText, addressText].filter(Boolean).join(', ');

    if (query) {
      return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    }

    if (link) {
      return `https://www.google.com/maps?q=${encodeURIComponent(link)}&output=embed`;
    }

    return '';
  }

  private debugDiamondMap(): void {

  }

  getEventPhotoUrl(): string {
    const item = this.pickDiamondPhotoItem([
      'venue',
      'lokasi',
      'tempat',
      'outdoor',
      'prewedding',
      'couple',
      'pasangan',
    ], 2);

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  getDiamondCoverDateLabel(): string {
    const rawDate = this.getDiamondCoverRawDate();

    return this.formatDiamondCoverDate(rawDate);
  }

  getDiamondCoverRawDate(): string {
    const data: any = this.weddingData || {};

    const events: any[] = Array.isArray(data.events)
      ? data.events
      : Array.isArray(data?.data?.events)
        ? data.data.events
        : data.events && typeof data.events === 'object'
          ? Object.values(data.events)
          : [];

    const akad =
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
      null;

    return String(
      akad?.tanggal_acara ||
      akad?.tanggal ||
      akad?.date ||
      akad?.event_date ||
      akad?.start_date ||
      data?.tanggal_acara ||
      data?.tanggal ||
      data?.wedding_date ||
      data?.countdown?.tanggal_acara ||
      data?.countdown?.tanggal ||
      data?.filter_undangan?.tanggal_acara ||
      data?.filter_undangan?.tanggal ||
      ''
    ).trim();
  }

  formatDiamondCoverDate(rawDate: any): string {
    if (!rawDate) return '';

    const value = String(rawDate).trim();
    if (!value) return '';

    const datePart = value.split('T')[0];

    const ymd = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      return `${ymd[3]} · ${ymd[2]} · ${ymd[1]}`;
    }

    const dmy = datePart.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (dmy) {
      return `${dmy[1]} · ${dmy[2]} · ${dmy[3]}`;
    }

    const parsed = new Date(value);

    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();

      return `${day} · ${month} · ${year}`;
    }

    return value;
  }

  private debugDiamondDate(): void {

  }

  private debugDiamondEvents(): void {

  }

  getCountdownPhotoUrl(): string {
    const item = this.pickDiamondPhotoItem([
      'countdown',
      'couple',
      'pasangan',
      'berdua',
      'outdoor',
      'prewedding',
    ], 2);

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  private startDiamondCountdown(): void {
    this.clearDiamondCountdownInterval();
    this.updateDiamondCountdown();

    this.countdownInterval = setInterval(() => {
      this.updateDiamondCountdown();
    }, 1000);
  }

  private clearDiamondCountdownInterval(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private getDiamondCountdownTargetDate(): Date | null {
    const event = this.getAkadEvent() || this.getResepsiEvent() || this.getMainEvent();

    const rawDate =
      event?.tanggal_acara ||
      event?.tanggal ||
      event?.date ||
      event?.event_date ||
      '';

    const rawTime =
      event?.start_acara ||
      event?.jam_mulai ||
      event?.start_time ||
      '00:00';

    if (!rawDate) return null;

    const datePart = String(rawDate).split('T')[0];
    const timePart = String(rawTime).slice(0, 5);

    const target = new Date(`${datePart}T${timePart}:00`);

    return isNaN(target.getTime()) ? null : target;
  }

  private updateDiamondCountdown(): void {
    const target = this.getDiamondCountdownTargetDate();

    if (!target) {
      this.countdown = { days: '00', hours: '00', minutes: '00', seconds: '00' };
      return;
    }

    const diff = target.getTime() - Date.now();

    if (diff <= 0) {
      this.countdown = { days: '00', hours: '00', minutes: '00', seconds: '00' };
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    this.countdown = {
      days: String(days).padStart(2, '0'),
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
    };
  }

  setWishAttendance(status: 'hadir' | 'mungkin' | 'tidak_hadir'): void {
    this.wishForm.kehadiran = status;
  }

  override get visibleGuestWishes(): any[] {
    const wishes = (this as any).guestWishes || this.weddingData?.guest_wishes || this.getGuestWishes() || [];

    return wishes.filter((item: any) => this.isRealGuestWish(item));
  }

  get totalWishPages(): number {
    const total = this.visibleGuestWishes.length;
    if (!total) {
      return 0;
    }

    return Math.ceil(total / this.wishPageSize);
  }

  get paginatedWishes(): any[] {
    const wishes = this.visibleGuestWishes;
    const totalPages = this.totalWishPages;
    const page = totalPages > 0
      ? Math.min(Math.max(this.currentWishPage, 1), totalPages)
      : 1;
    const start = (page - 1) * this.wishPageSize;

    return wishes.slice(start, start + this.wishPageSize);
  }

  get wishPaginationItems(): Array<number | 'ellipsis'> {
    const totalPages = this.totalWishPages;
    const currentPage = totalPages > 0
      ? Math.min(Math.max(this.currentWishPage, 1), totalPages)
      : 1;

    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 'ellipsis', totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'ellipsis', currentPage, 'ellipsis', totalPages];
  }

  goToWishPage(page: number): void {
    const totalPages = this.totalWishPages;
    if (page < 1 || page > totalPages || page === this.currentWishPage) {
      return;
    }

    this.currentWishPage = page;
  }

  goToPreviousWishPage(): void {
    this.goToWishPage(this.currentWishPage - 1);
  }

  goToNextWishPage(): void {
    this.goToWishPage(this.currentWishPage + 1);
  }

  private syncWishPage(): void {
    const totalPages = this.totalWishPages;
    if (this.currentWishPage < 1 || (totalPages > 0 && this.currentWishPage > totalPages) || (totalPages === 0 && this.currentWishPage !== 1)) {
      this.currentWishPage = 1;
    }
  }

  getWishAttendanceLabel(status: string): string {
    const value = String(status || '').toLowerCase();

    if (value === 'hadir') return 'Hadir';
    if (value === 'mungkin') return 'Mungkin';
    if (value === 'tidak_hadir') return 'Tidak Hadir';

    return 'Hadir';
  }

  getWishAttendanceClass(status: string): string {
    const value = String(status || '').toLowerCase();

    if (value === 'tidak_hadir') return 'status status--danger';
    if (value === 'mungkin') return 'status status--warning';

    return 'status status--success';
  }

  getWishesPhotoUrl(): string {
    const item = this.pickDiamondPhotoItem([
      'wish',
      'ucapan',
      'doa',
      'couple',
      'pasangan',
      'outdoor',
    ], 3);

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  getGroomPortrait(): string {
    return this.getGroomPhoto() || '';
  }

  getBridePortrait(): string {
    return this.getBridePhoto() || '';
  }

  getMainQuote(): string {
    const data: any = this.weddingData || {};
    const quote = Array.isArray(data?.quotes)
      ? data?.quotes?.[0]
      : data?.quotes;

    return this.getReligionQuoteText(
      String(quote?.quote || quote?.pesan || quote?.text || this.getDiamondQuoteText() || '').trim()
    );
  }

  getMainQuoteSource(): string {
    const data: any = this.weddingData || {};
    const quote = Array.isArray(data?.quotes)
      ? data?.quotes?.[0]
      : data?.quotes;

    return this.getReligionQuoteSource(
      String(quote?.name || quote?.source || quote?.sumber || this.getDiamondQuoteSource() || '').trim()
    );
  }

  getBrideData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data?.mempelai || {};
    const list = Array.isArray(mempelai) ? mempelai : [];

    return (
      list.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('wanita') || gender.includes('perempuan') || gender.includes('bride');
      }) ||
      mempelai?.wanita ||
      mempelai?.bride ||
      mempelai?.female ||
      data?.mempelai_wanita ||
      this.getBride() ||
      mempelai
    );
  }

  getGroomData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data?.mempelai || {};
    const list = Array.isArray(mempelai) ? mempelai : [];

    return (
      list.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('pria') || gender.includes('laki') || gender.includes('groom');
      }) ||
      mempelai?.pria ||
      mempelai?.groom ||
      mempelai?.male ||
      data?.mempelai_pria ||
      this.getGroom() ||
      mempelai
    );
  }

  getBridePhotoUrl(): string {
    const bride = this.getBrideData();
    const rawUrl =
      resolveInvitationPhotoUrl(bride) ||
      bride?.foto_url ||
      bride?.foto_mempelai_url ||
      bride?.foto_mempelai ||
      bride?.foto ||
      bride?.avatar ||
      bride?.photo_profile ||
      this.getBridePhoto() ||
      '';

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  getGroomPhotoUrl(): string {
    const groom = this.getGroomData();
    const rawUrl =
      resolveInvitationPhotoUrl(groom) ||
      groom?.foto_url ||
      groom?.foto_mempelai_url ||
      groom?.foto_mempelai ||
      groom?.foto ||
      groom?.avatar ||
      groom?.photo_profile ||
      this.getGroomPhoto() ||
      '';

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  override getBrideParents(): string {
    return this.formatDiamondParentLine('wanita', this.getBrideData());
  }

  override getGroomParents(): string {
    return this.formatDiamondParentLine('pria', this.getGroomData());
  }

  override getBrideInstagram(): string {
    const bride = this.getBrideData();
    return String(bride?.instagram || bride?.ig || bride?.sosmed || super.getBrideInstagram() || '').replace('@', '').trim();
  }

  override getGroomInstagram(): string {
    const groom = this.getGroomData();
    return String(groom?.instagram || groom?.ig || groom?.sosmed || super.getGroomInstagram() || '').replace('@', '').trim();
  }

  getInstagramUrl(username: string): string {
    const clean = String(username || '').replace('@', '').trim();
    return clean ? `https://instagram.com/${clean}` : '#';
  }

  onCoverImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;
    target.onerror = null;
    target.src = this.getCoverPhotoUrl();
  }

  onPersonImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    const fallback = this.getCoverPhotoUrl();

    if (fallback && target.getAttribute('src') !== fallback) {
      target.src = fallback;
    }
  }

  getDiamondQuoteText(): string {
    return this.getQuoteText();
  }

  getDiamondQuoteSource(): string {
    return this.getQuoteName();
  }

  getInvitingFamilies(): string[] {
    return [
      this.getGroomParentLine(),
      this.getBrideParentLine(),
    ].filter((line) => !!line && line.trim().length > 0);
  }

  getOrderedEvents(): WeddingEvent[] {
    const events = this.getEvents();
    if (!events.length) {
      return [];
    }

    const weight = (event: WeddingEvent): number => {
      const label = `${(event as any).jenis_acara || ''} ${event.nama_acara || ''}`.toLowerCase();
      if (/akad|nikah|pemberkatan/.test(label)) {
        return 0;
      }
      if (/resepsi|reception|ngunduh/.test(label)) {
        return 1;
      }
      return 2;
    };

    return [...events].sort((left, right) => weight(left) - weight(right));
  }

  getEventTypeLabel(event: WeddingEvent): string {
    const label = `${(event as any).jenis_acara || ''} ${event.nama_acara || ''}`.toLowerCase();
    if (/akad|nikah|pemberkatan/.test(label)) {
      return 'Akad Nikah';
    }
    if (/resepsi|reception|ngunduh/.test(label)) {
      return 'Resepsi';
    }
    return event.nama_acara || 'Acara';
  }

  getEventMapsLink(event: WeddingEvent): string | null {
    return this.getEventMapUrl(event);
  }

  getCalendarLink(event: WeddingEvent): string | null {
    if (!event?.tanggal_acara) {
      return null;
    }

    const start = this.toCalendarStamp(event.tanggal_acara, event.start_acara);
    const end = this.toCalendarStamp(event.tanggal_acara, event.end_acara || event.start_acara);
    if (!start) {
      return null;
    }

    const title = encodeURIComponent(event.nama_acara || 'Acara Pernikahan');
    const location = encodeURIComponent(event.alamat || '');
    const dates = end ? `${start}/${end}` : start;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}`;
  }

  getLoveStoryItems(): Array<{ title: string; date: string; lead: string; description: string }> {
    if (this.loveStoryItems?.length) {
      return this.loveStoryItems.map((item) => ({
        title: item.title || '',
        date: item.date || item.year || '',
        lead: item.lead || '',
        description: item.description || '',
      })).filter((item) => !!(item.date || item.title || item.lead || item.description));
    }

    return this.getStories().map((story: WeddingStory) => {
      const lead = String((story as any).lead_cerita || (story as any).subtitle || '').trim();
      const body = String(
        (story as any).cerita ||
        (story as any).content ||
        (story as any).body ||
        (story as any).description ||
        (story as any).deskripsi ||
        ''
      ).trim();

      return {
        title: String(story.title || (story as any).judul || '').trim(),
        date: story.tanggal_cerita ? String(story.tanggal_cerita) : '',
        lead: lead && lead !== body ? lead : '',
        description: body || lead,
      };
    }).filter((item) => !!(item.date || item.title || item.lead || item.description));
  }

  getStoryTrackBy(index: number, item: { title: string }): string {
    return `${index}-${item.title}`;
  }

  trackByDiamondParticle(index: number): number {
    return index;
  }

  trackByEvent(index: number, event: WeddingEvent): number {
    return event.id || index;
  }

  getBankPhotoUrl(bank: BankAccount): string {
    return this.normalizeMediaUrl(bank?.photo_rek);
  }

  override getPackageLabelText(): string {
    return 'Paket Diamond';
  }

  getWeddingEvents(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.acaras)) return data.acaras;
    if (Array.isArray(data.event)) return data.event;
    if (Array.isArray(data.detail_acara)) return data.detail_acara;
    if (Array.isArray(data.detail_acaras)) return data.detail_acaras;
    if (Array.isArray(data?.data?.events)) return data.data.events;

    if (data.events && typeof data.events === 'object') {
      return Object.values(data.events);
    }

    return [];
  }

  getWeddingMainDateValue(): string {
    const events = this.getWeddingEvents();

    const akad =
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
      null;

    const data: any = this.weddingData || {};

    return String(
      akad?.tanggal_acara ||
      akad?.tanggal ||
      akad?.date ||
      akad?.event_date ||
      akad?.start_date ||
      events?.[0]?.tanggal_acara ||
      events?.[0]?.tanggal ||
      events?.[0]?.date ||
      data?.countdown?.tanggal_acara ||
      data?.countdown?.tanggal ||
      data?.filter_undangan?.tanggal_acara ||
      data?.filter_undangan?.tanggal ||
      ''
    ).trim();
  }

  getHeroDateLabel(): string {
    return this.formatDiamondDateLabel(this.getWeddingMainDateValue());
  }

  getFallbackWeddingDateLabel(): string {
    const data: any = this.weddingData || {};

    const rawDate =
      data?.tanggal_acara ||
      data?.tanggal ||
      data?.wedding_date ||
      data?.date ||
      data?.invitation_package?.tanggal ||
      data?.invitation_package?.tanggal_acara ||
      '';

    return this.formatDiamondDateLabel(rawDate);
  }

  formatDiamondDateLabel(rawDate: any): string {
    if (!rawDate) return '';

    const value = String(rawDate).trim();
    if (!value) return '';

    const datePart = value.split('T')[0];

    const ymd = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      return `${ymd[3]} · ${ymd[2]} · ${ymd[1]}`;
    }

    const dmy = datePart.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (dmy) {
      return `${dmy[1]} · ${dmy[2]} · ${dmy[3]}`;
    }

    const parsed = new Date(value);

    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();

      return `${day} · ${month} · ${year}`;
    }

    return value;
  }

  formatDateParts(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day} · ${month} · ${year}`;
  }

  getFallbackDateLabel(): string {
    return '';
  }

  normalizePhotoUrl(url: string | null | undefined): string {
    return normalizeInvitationMediaUrl(url);
  }

  getDetailEventVenue(event?: WeddingEvent | any): string {
    return String(
      event?.nama_acara ||
      event?.nama_lokasi ||
      event?.venue ||
      event?.tempat ||
      event?.lokasi ||
      ''
    ).trim();
  }

  getAkadMapLink(): string {
    const event = this.getAkadCard();
    return this.getEventMapUrl(event) || '';
  }

  getGiftAddress(bank?: any): string {
    if (bank) {
      return String(
        bank.alamat_kado ||
        bank.gift_address ||
        bank.alamat ||
        bank.address ||
        ''
      ).trim();
    }

    const data = this.weddingData as any;
    const candidates = [
      data?.alamat_kado,
      data?.gift_address,
      data?.settings?.alamat_kado,
    ];

    return candidates
      .map((value) => String(value || '').trim())
      .find((value) => !!value) || '';
  }

  getBankAccounts(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.bank_accounts)) return data.bank_accounts;
    if (Array.isArray(data.rekenings)) return data.rekenings;
    if (Array.isArray(data.rekening)) return data.rekening;
    if (Array.isArray(data.gifts)) return data.gifts;

    return [];
  }

  getGiftPhotoUrl(): string {
    const item = this.pickDiamondPhotoItem([
      'gift',
      'hadiah',
      'couple',
      'pasangan',
      'outdoor',
      'prewedding',
    ], 2);

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  copyGiftNumber(account: any): void {
    const bankName = String(
      account?.nama_bank ||
      account?.bank_name ||
      account?.bank?.name ||
      account?.bank?.nama_bank ||
      ''
    ).trim();
    const owner = String(
      account?.nama_pemilik ||
      account?.account_name ||
      account?.atas_nama ||
      account?.account_holder ||
      account?.pemilik ||
      account?.owner ||
      ''
    ).trim();
    const number = String(
      account?.nomor_rekening ||
      account?.account_number ||
      account?.no_rekening ||
      account?.rekening ||
      ''
    ).trim();
    const text = [bankName, owner, number].filter(Boolean).join('\n');

    if (!text) {
      return;
    }

    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
    if (clipboard?.writeText) {
      clipboard.writeText(text)
        .then(() => this.diamondToast.showToast('Data rekening berhasil disalin', 'success'))
        .catch(() => this.copyGiftNumberFallback(text));
      return;
    }

    this.copyGiftNumberFallback(text);
  }

  private copyGiftNumberFallback(text: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!copied) {
        throw new Error('copy failed');
      }
      this.diamondToast.showToast('Data rekening berhasil disalin', 'success');
    } catch {
      this.diamondToast.showToast('Data rekening gagal disalin', 'error');
    }
  }

  hasDiamondVideoUrl(item: any): boolean {
    if (!item) {
      return false;
    }

    const raw = String(
      item?.url_video ||
      item?.video_url ||
      item?.link_video ||
      item?.youtube_url ||
      item?.youtube_link ||
      item?.link_youtube ||
      item?.youtube ||
      ''
    ).trim();

    if (raw && raw !== 'null' && raw !== 'undefined') {
      return true;
    }

    return isInvitationVideoMedia(item) || Boolean(resolveInvitationVideoUrl(item));
  }

  isDiamondVideoItem(item: any): boolean {
    return this.hasDiamondVideoUrl(item);
  }

  isDiamondPhotoItem(item: any): boolean {
    if (!item || this.isDiamondVideoItem(item)) {
      return false;
    }

    return Boolean(resolveInvitationPhotoUrl(item) || this.getGalleryPhotoUrl(item));
  }

  getDiamondPhotoItems(): any[] {
    return this.getGalleryItems().filter((item: any) => this.isDiamondPhotoItem(item));
  }

  private pickDiamondPhotoItem(tokens: string[], fallbackIndex = 0): any {
    const photos = this.getDiamondPhotoItems();
    return photos.find((photo: any) => {
      const name = String(photo?.nama_foto || photo?.name || photo?.title || '').toLowerCase();
      return tokens.some((token) => name.includes(token));
    }) || photos[fallbackIndex] || photos[0] || null;
  }

  getDiamondInlineVideoId(): string {
    const item = this.getDiamondFeaturedVideoItem();
    if (!item) {
      return '';
    }

    const embedUrl = this.getGalleryVideoUrl(item);
    const embedMatch = String(embedUrl || '').match(/embed\/([a-zA-Z0-9_-]{6,})/i);
    if (embedMatch?.[1]) {
      return embedMatch[1];
    }

    const rawVideoUrl = String(
      item?.youtube_url ||
      item?.youtube_link ||
      item?.link_youtube ||
      item?.video_url ||
      item?.url_video ||
      item?.link_video ||
      item?.youtube ||
      ''
    ).trim();
    const rawEmbed = normalizeYoutubeEmbedUrl(rawVideoUrl);
    const rawMatch = String(rawEmbed || '').match(/embed\/([a-zA-Z0-9_-]{6,})/i);
    return rawMatch?.[1] || '';
  }

  private refreshDiamondInlineYoutube(): void {
    const videoId = this.getDiamondInlineVideoId();
    if (videoId === this.diamondInlineYoutubeId) {
      return;
    }

    this.diamondInlineYoutubeId = videoId;
    this.diamondInlineYoutubeSrc = videoId
      ? this.diamondSanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0&loop=1&playlist=${encodeURIComponent(videoId)}`
        )
      : null;
  }

  override getGalleryVideoUrl(item: any): string {
    if (!item) {
      return '';
    }

    const rawVideoUrl = String(
      item?.youtube_url ||
      item?.youtube_link ||
      item?.link_youtube ||
      item?.video_url ||
      item?.url_video ||
      item?.link_video ||
      item?.youtube ||
      resolveInvitationVideoUrl(item) ||
      ''
    ).trim();

    const youtubeEmbedUrl = normalizeYoutubeEmbedUrl(rawVideoUrl);
    if (youtubeEmbedUrl) {
      return youtubeEmbedUrl;
    }

    const resolvedVideoUrl = resolveInvitationVideoUrl(item) || rawVideoUrl;
    if (/^https?:\/\//i.test(resolvedVideoUrl) && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(resolvedVideoUrl)) {
      return resolvedVideoUrl;
    }

    return youtubeEmbedUrl;
  }

  getDiamondFeaturedVideoItem(): any {
    return this.getMomentCollageItems().find((item: any) => this.isDiamondVideoItem(item))
      || this.getGalleryItems().find((item: any) => this.isDiamondVideoItem(item))
      || this.getGalleryVideoItems()[0]
      || null;
  }

  getMomentPhotoItems(): any[] {
    return this.getMomentCollageItems().filter((item: any) => {
      if (this.isDiamondVideoItem(item)) {
        return false;
      }

      return Boolean(resolveInvitationPhotoUrl(item) || this.getGalleryPhotoUrl(item));
    });
  }

  getDiamondLightboxPhotos(): any[] {
    return this.getMomentPhotoItems();
  }

  getDiamondLightboxPhotoUrl(item: any): string {
    return this.getMomentPhotoUrl(item) || this.getGalleryPhotoUrl(item) || '';
  }

  get isDiamondLightboxOpen(): boolean {
    return this.selectedGalleryPhotoIndex >= 0 && this.getDiamondLightboxPhotos().length > 0;
  }

  get selectedDiamondLightboxPhoto(): any {
    return this.getDiamondLightboxPhotos()[this.selectedGalleryPhotoIndex] || null;
  }

  openDiamondGalleryPhoto(index: number): void {
    const photos = this.getDiamondLightboxPhotos();
    if (index < 0 || index >= photos.length) {
      return;
    }

    this.selectedGalleryPhotoIndex = index;
  }

  showPreviousDiamondGalleryPhoto(event?: Event): void {
    event?.stopPropagation();
    const total = this.getDiamondLightboxPhotos().length;
    if (total <= 1) {
      return;
    }

    this.selectedGalleryPhotoIndex = (this.selectedGalleryPhotoIndex - 1 + total) % total;
  }

  showNextDiamondGalleryPhoto(event?: Event): void {
    event?.stopPropagation();
    const total = this.getDiamondLightboxPhotos().length;
    if (total <= 1) {
      return;
    }

    this.selectedGalleryPhotoIndex = (this.selectedGalleryPhotoIndex + 1) % total;
  }

  override closeGalleryPhoto(): void {
    super.closeGalleryPhoto();
    this.selectedGalleryPhotoIndex = -1;
  }

  onDiamondLightboxTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0] || event.touches[0];
    if (!touch) {
      return;
    }

    this.lightboxTouchStartX = touch.clientX;
    this.lightboxTouchStartY = touch.clientY;
  }

  onDiamondLightboxTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - this.lightboxTouchStartX;
    const deltaY = touch.clientY - this.lightboxTouchStartY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (horizontalDistance < this.lightboxSwipeThreshold || horizontalDistance < verticalDistance * 1.2) {
      return;
    }

    if (deltaX < 0) {
      this.showNextDiamondGalleryPhoto();
      return;
    }

    this.showPreviousDiamondGalleryPhoto();
  }

  @HostListener('document:keydown', ['$event'])
  onDiamondLightboxKeydown(event: KeyboardEvent): void {
    if (!this.isDiamondLightboxOpen) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeGalleryPhoto();
      return;
    }

    if (event.key === 'ArrowLeft') {
      this.showPreviousDiamondGalleryPhoto();
      return;
    }

    if (event.key === 'ArrowRight') {
      this.showNextDiamondGalleryPhoto();
    }
  }

  getMomentCollageItems(): any[] {
    const collagePhotos: any[] = this.getCollageItems();
    const galleryPhotos: any[] = this.getGalleryItems();
    const source = collagePhotos.length ? collagePhotos : galleryPhotos;

    return source.filter((item: any) => {
      const url = this.getMomentMediaUrl(item) || this.getGalleryVideoUrl(item) || this.getGalleryPhotoUrl(item);
      return Boolean(url);
    });
  }

  getMomentFeaturedItem(): any {
    return this.getDiamondFeaturedVideoItem();
  }

  getMomentPhotosPartOne(): any[] {
    return this.getMomentPhotoItems().slice(0, 4);
  }

  getMomentPhotosPartTwo(): any[] {
    return this.getMomentPhotoItems().slice(4, 10);
  }

  trackByMomentPhoto(index: number, item: any): string | number {
    return item?.id
      || item?.foto_id
      || item?.url_foto
      || item?.url
      || item?.photoUrl
      || index;
  }

  getMomentPhotoUrl(item: any): string {
    if (this.isDiamondVideoItem(item)) {
      return '';
    }

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  getMomentMediaUrl(item: any): string {
    const rawUrl = this.isMomentVideo(item)
      ? resolveInvitationVideoUrl(item)
      : resolveInvitationMediaUrlFromItem(item);

    return this.normalizePhotoUrl(rawUrl);
  }

  getMomentAlt(item: any, index: number): string {
    return String(
      item?.description ||
      item?.nama_foto ||
      item?.name ||
      item?.title ||
      `Moment ${index + 1}`
    );
  }

  hasMomentVideo(item: any): boolean {
    return this.isMomentVideo(item);
  }

  isMomentVideo(item: any): boolean {
    return this.hasDiamondVideoUrl(item);
  }

  openMomentVideo(item: any): void {
    this.openGalleryVideo(item);
  }

  override openGalleryVideo(item: any): void {
    if (this.getGalleryVideoUrl(item)) {
      super.openGalleryVideo(item);
      return;
    }

    const direct = String(
      resolveInvitationVideoUrl(item) ||
      item?.url_video ||
      item?.video_url ||
      item?.link_video ||
      ''
    ).trim();

    if (!direct || !/^https?:\/\//i.test(direct)) {
      return;
    }

    this.selectedGalleryVideoTitle = item?.description || item?.nama_foto || 'Video undangan';
    this.selectedGalleryVideoDirectUrl = direct;
    this.selectedGalleryVideoUrl = null;
    this.selectedGalleryVideoType = 'video';
  }

  getMomentsBackgroundUrl(index: number): string {
    const photoItems = this.getMomentPhotoItems();
    const item = photoItems[index] || photoItems[0];

    return item ? this.getMomentPhotoUrl(item) : this.getCoverPhotoUrl();
  }

  onMomentImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    const fallback = this.getCoverPhotoUrl();

    if (fallback && target.src !== fallback) {
      target.src = fallback;
    }
  }

  onMomentVideoError(event: Event, item?: any): void {
    const target = event.target as HTMLVideoElement | null;
    if (!target || !item) return;
    target.style.display = 'none';
  }

  getLiveStreamingData(): any {
    const data: any = this.weddingData || {};

    return (
      data.live_streaming ||
      data.livestreaming ||
      data.liveStreaming ||
      data.streaming ||
      data.filter_undangan?.live_streaming ||
      data.filter_undangan?.livestreaming ||
      null
    );
  }

  getLiveStreamingUrl(): string {
    const live = this.getLiveStreamingData();
    const data: any = this.weddingData || {};
    const youtube = this.getYoutubeVideos()[0]?.url || this.getYoutubeVideos()[0]?.embedUrl || '';

    return String(
      live?.url ||
      live?.link ||
      live?.link_live ||
      live?.url_live ||
      live?.youtube_url ||
      live?.link_youtube ||
      youtube ||
      data?.link_live_streaming ||
      data?.live_streaming_url ||
      ''
    ).trim();
  }

  hasLiveStreaming(): boolean {
    return Boolean(this.getLiveStreamingUrl());
  }

  getLiveStreamingPhotoUrl(): string {
    const item = this.pickDiamondPhotoItem([
      'live',
      'stream',
      'couple',
      'pasangan',
      'outdoor',
      'prewedding',
    ], 1);

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  getFooterPhotoUrl(): string {
    const item = this.pickDiamondPhotoItem([
      'footer',
      'closing',
      'couple',
      'pasangan',
      'outdoor',
    ], 1);

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  override getVisibleBankAccounts(): BankAccount[] {
    const bankAccounts = this.weddingData?.bank_accounts ?? [];
    return Array.isArray(bankAccounts) ? bankAccounts : [];
  }

  private getCeremonyDateSource(): Date | null {
    const akad = this.getAkadEvent();
    if (akad?.tanggal_acara) {
      return this.toValidDate(akad.tanggal_acara);
    }

    const firstEvent = this.getEvents()[0];
    if (firstEvent?.tanggal_acara) {
      return this.toValidDate(firstEvent.tanggal_acara);
    }

    const countdownDate = (this.weddingData as any)?.countdown?.tanggal_countdown
      || (this.weddingData as any)?.countdown?.date;
    if (countdownDate) {
      return this.toValidDate(countdownDate);
    }

    return null;
  }

  protected toValidDate(dateValue?: string | null): Date | null {
    if (!dateValue) {
      return null;
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private firstFilled(values: any[], fallback: string): string {
    return values
      .map((value) => String(value || '').trim())
      .find((value) => !!value) || fallback;
  }

  private toCalendarStamp(date?: string | null, time?: string | null): string | null {
    if (!date) {
      return null;
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const datePart = parsed.toISOString().slice(0, 10).replace(/-/g, '');
    const safeTime = (time || '00:00').slice(0, 5).replace(':', '');
    return `${datePart}T${safeTime}00`;
  }

  private getDirectEventMapLink(event?: any): string {
    if (!event) {
      return '';
    }

    const directLink = [
      event?.maps_url,
      event?.map_url,
      event?.google_maps_url,
      event?.google_map_url,
      event?.location_url,
      event?.link_maps,
      event?.link_map,
      event?.maps,
      event?.url_maps,
      event?.google_maps,
      event?.google_map,
      event?.maps_link,
    ].map((value) => String(value || '').trim()).find((value) => /^https?:\/\//i.test(value));

    if (directLink) {
      return directLink;
    }

    const latitude = String(event?.latitude || event?.lat || '').trim();
    const longitude = String(event?.longitude || event?.lng || event?.long || '').trim();
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
    }

    return '';
  }

  private formatDiamondParentLine(gender: 'pria' | 'wanita', person: any): string {
    const father = this.firstFilled([
      person?.nama_ayah,
      person?.ayah,
      person?.father,
      person?.bapak,
      person?.nama_bapak,
    ], '');

    const mother = this.firstFilled([
      person?.nama_ibu,
      person?.ibu,
      person?.mother,
      person?.nama_mama,
    ], '');

    const custom = this.stripParentOrder(this.firstFilled([
      person?.orang_tua,
      person?.nama_orang_tua,
      person?.parents,
      person?.putri_dari,
      person?.putra_dari,
      person?.anak_dari,
    ], ''));

    if (custom && !this.isIncompleteParentLine(custom)) {
      return custom;
    }

    const label = gender === 'pria' ? 'Putra' : 'Putri';
    if (father && mother) {
      return `${label} dari Bapak ${father} dan Ibu ${mother}`;
    }
    if (father) {
      return `${label} dari Bapak ${father}`;
    }
    if (mother) {
      return `${label} dari Ibu ${mother}`;
    }

    return '';
  }

  private stripParentOrder(value: string): string {
    return String(value || '')
      .replace(/\s+(ke-?\d+|pertama|kedua|ketiga|keempat|kelima|keenam|ketujuh|kedelapan|kesembilan|kesepuluh)\s+/gi, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private isIncompleteParentLine(value: string): boolean {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return !normalized ||
      /bapak\s+dan\s+ibu/i.test(normalized) ||
      /dari\s*$/i.test(normalized) ||
      /bapak\s*$/i.test(normalized) ||
      /ibu\s*$/i.test(normalized);
  }
}
