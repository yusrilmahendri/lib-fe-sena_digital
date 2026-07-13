import { Component, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
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

@Component({
  selector: 'wc-diamond-theme-one',
  templateUrl: './diamond-theme-one.component.html',
  styleUrls: ['./diamond-theme-one.component.scss'],
})
export class DiamondThemeOneComponent extends RubyThemeOneComponent implements OnInit, OnChanges, OnDestroy {
  override isInvitationOpened = false;
  readonly apiBaseUrl = (environment as any).apiBaseUrl || (environment as any).apiUrl || '';
  countdown = {
    days: '00',
    hours: '00',
    minutes: '00',
    seconds: '00',
  };
  private countdownInterval: any = null;
  private mapEmbedUrlCache = new Map<string, SafeResourceUrl>();

  constructor(
    private diamondSanitizer: DomSanitizer,
    dashboardService: DashboardService,
    toastService: ToastService
  ) {
    super(diamondSanitizer, dashboardService, toastService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.syncInvitationState();
    this.startDiamondCountdown();
    if (!this.wishForm.kehadiran) {
      this.wishForm.kehadiran = 'hadir';
    }
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);
    if (changes['invitationOpened'] || changes['weddingData']) {
      this.syncInvitationState();
    }
    if (changes['weddingData']) {
      this.startDiamondCountdown();
    }
    if (changes['weddingData']) {
      this.debugDiamondEvents();
      this.debugDiamondDate();
      this.debugDiamondMap();
    }
  }

  override ngOnDestroy(): void {
    this.clearDiamondCountdownInterval();
    super.ngOnDestroy();
  }

  override openInvitation(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.isInvitationOpened = true;
    this.openInvitationRequested.emit();
    this.hasOpened = true;
    document.body.classList.remove('modal-open');
    setTimeout(() => {
      const main = document.querySelector('.diamond-main');
      main?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
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
    return this.firstFilled([
      groom?.nama_panggilan,
      groom?.nickname,
      groom?.nama_lengkap,
      this.getGroomName(),
    ], '');
  }

  getBrideShortName(): string {
    const bride = this.getBride() as any;
    return this.firstFilled([
      bride?.nama_panggilan,
      bride?.nickname,
      bride?.nama_lengkap,
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
    const featuredGalleryPhoto = this.getFeaturedGalleryItem();
    const featuredGalleryUrl = featuredGalleryPhoto ? this.getGalleryPhotoUrl(featuredGalleryPhoto) : '';
    const gallery = this.getGalleryItems();
    const namedCover = gallery.find((item: any) => {
      const name = String(item?.nama_foto || item?.name || '').toLowerCase();
      return (name.includes('cover') || name.includes('outdoor')) && this.getGalleryCandidateUrl(item);
    });
    const firstGalleryPhoto = gallery.find((item: any) => this.getGalleryCandidateUrl(item));

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
    const galleryItem: any = item || {};
    return resolveInvitationPhotoUrl(galleryItem);
  }

  getOpeningPhoto(): string {
    return this.getCoverPhotoUrl();
  }

  getPrayerPhotoUrl(): string {
    const gallery = this.getGalleryItems();

    const preferred =
      gallery.find((item: any) => {
        const name = String(item?.nama_foto || item?.name || item?.title || '').toLowerCase();
        return (
          name.includes('couple') ||
          name.includes('pasangan') ||
          name.includes('berdua') ||
          name.includes('outdoor') ||
          name.includes('prewedding') ||
          name.includes('sampul') ||
          name.includes('cover')
        );
      }) ||
      gallery.find((item: any) => item?.url_video) ||
      gallery[1] ||
      gallery[0];

    const preferredItem: any = preferred || {};
    const rawUrl = resolveInvitationPhotoUrl(preferredItem);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  override getGuestName(): string {
    return String(
      (this.weddingData as any)?.guest_name ||
      (this.weddingData as any)?.nama_tamu ||
      (this.weddingData as any)?.filter_undangan?.nama_tamu ||
      (this.weddingData as any)?.filter_undangan?.guest_name ||
      (this.weddingData as any)?.guest?.nama ||
      (this.weddingData as any)?.guest?.name ||
      'Tamu Undangan'
    ).trim();
  }

  override getEvents(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.acaras)) return data.acaras;
    if (Array.isArray(data?.data?.events)) return data.data.events;

    if (data.events && typeof data.events === 'object') {
      return Object.values(data.events);
    }

    return [];
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

  getEventVenueName(): string {
    const event = this.getEventForLocation();
    if (!event) return '';

    return String(
      event?.nama_tempat ||
      event?.tempat ||
      event?.venue ||
      event?.lokasi ||
      event?.location ||
      event?.gedung ||
      event?.nama_lokasi ||
      event?.nama_acara ||
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
    if (!event) return '';

    const directLink = String(
      event?.google_maps_url ||
      event?.link_maps ||
      event?.link_map ||
      event?.maps ||
      event?.map_url ||
      event?.google_maps ||
      event?.google_map ||
      ''
    ).trim();

    if (directLink) {
      return directLink;
    }

    const latitude = String(event?.latitude || '').trim();
    const longitude = String(event?.longitude || '').trim();

    return latitude && longitude
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
      : '';
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
    console.log('[DiamondThemeOne] map link:', this.getEventMapLink());
    console.log(
      '[DiamondThemeOne] map embed:',
      this.buildGoogleMapsEmbedUrl(this.getEventMapLink(), this.getEventAddress(), this.getEventVenueName())
    );
  }

  getEventPhotoUrl(): string {
    const gallery: any[] = this.getGalleryItems();

    const item: any =
      gallery.find((photo: any) => {
        const name = String(photo?.nama_foto || photo?.name || photo?.title || '').toLowerCase();
        return (
          name.includes('venue') ||
          name.includes('lokasi') ||
          name.includes('tempat') ||
          name.includes('outdoor') ||
          name.includes('prewedding') ||
          name.includes('couple') ||
          name.includes('pasangan')
        );
      }) ||
      gallery[2] ||
      gallery[1] ||
      gallery[0] ||
      null;

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
    console.log('[DiamondThemeOne] cover date raw:', this.getDiamondCoverRawDate());
    console.log('[DiamondThemeOne] cover date label:', this.getDiamondCoverDateLabel());
    console.log('[DiamondThemeOne] events for cover date:', this.weddingData?.events);
    console.log('[DiamondThemeOne] date events:', this.getWeddingEvents());
    console.log('[DiamondThemeOne] raw date:', this.getWeddingMainDateValue());
    console.log('[DiamondThemeOne] hero date label:', this.getHeroDateLabel());
  }

  private debugDiamondEvents(): void {
    console.log('[DiamondThemeOne] events:', this.getEvents());
    console.log('[DiamondThemeOne] akad:', this.getAkadEvent());
    console.log('[DiamondThemeOne] resepsi:', this.getResepsiEvent());
    console.log('[DiamondThemeOne] day:', this.getMainEventDayName());
    console.log('[DiamondThemeOne] long date:', this.getMainEventLongDate());
    console.log('[DiamondThemeOne] akad time:', this.getAkadTimeLabel());
    console.log('[DiamondThemeOne] resepsi time:', this.getResepsiTimeLabel());
    console.log('[DiamondThemeOne] venue:', this.getEventVenueName());
    console.log('[DiamondThemeOne] address:', this.getEventAddress());
    console.log('[DiamondThemeOne] maps:', this.getEventMapLink());
  }

  getCountdownPhotoUrl(): string {
    const gallery: any[] = this.getGalleryItems();

    const item: any =
      gallery.find((photo: any) => {
        const name = String(photo?.nama_foto || photo?.name || photo?.title || '').toLowerCase();
        return (
          name.includes('countdown') ||
          name.includes('couple') ||
          name.includes('pasangan') ||
          name.includes('berdua') ||
          name.includes('outdoor') ||
          name.includes('prewedding')
        );
      }) ||
      gallery[2] ||
      gallery[1] ||
      gallery[0] ||
      null;

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
    const gallery: any[] = this.getGalleryItems();

    const item: any =
      gallery.find((photo: any) => {
        const name = String(photo?.nama_foto || photo?.name || photo?.title || '').toLowerCase();
        return (
          name.includes('wish') ||
          name.includes('ucapan') ||
          name.includes('doa') ||
          name.includes('couple') ||
          name.includes('pasangan') ||
          name.includes('outdoor')
        );
      }) ||
      gallery[3] ||
      gallery[2] ||
      gallery[1] ||
      gallery[0] ||
      null;

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

    return String(quote?.quote || quote?.pesan || quote?.text || this.getDiamondQuoteText() || '').trim();
  }

  getMainQuoteSource(): string {
    const data: any = this.weddingData || {};
    const quote = Array.isArray(data?.quotes)
      ? data?.quotes?.[0]
      : data?.quotes;

    return String(quote?.name || quote?.source || quote?.sumber || this.getDiamondQuoteSource() || '').trim();
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
    const bride = this.getBrideData();

    const father =
      bride?.nama_ayah ||
      bride?.ayah ||
      bride?.father ||
      bride?.bapak ||
      '';

    const mother =
      bride?.nama_ibu ||
      bride?.ibu ||
      bride?.mother ||
      '';

    const custom =
      bride?.orang_tua ||
      bride?.nama_orang_tua ||
      bride?.parents ||
      bride?.putri_dari ||
      bride?.anak_dari ||
      '';

    if (custom) return String(custom).trim();

    if (father && mother) return `Putri pertama dari Bapak ${father} dan Ibu ${mother}`;
    if (father) return `Putri pertama dari Bapak ${father}`;
    if (mother) return `Putri pertama dari Ibu ${mother}`;

    return this.getBrideParentLine() || '';
  }

  override getGroomParents(): string {
    const groom = this.getGroomData();

    const father =
      groom?.nama_ayah ||
      groom?.ayah ||
      groom?.father ||
      groom?.bapak ||
      '';

    const mother =
      groom?.nama_ibu ||
      groom?.ibu ||
      groom?.mother ||
      '';

    const custom =
      groom?.orang_tua ||
      groom?.nama_orang_tua ||
      groom?.parents ||
      groom?.putra_dari ||
      groom?.anak_dari ||
      '';

    if (custom) return String(custom).trim();

    if (father && mother) return `Putra pertama dari Bapak ${father} dan Ibu ${mother}`;
    if (father) return `Putra pertama dari Bapak ${father}`;
    if (mother) return `Putra pertama dari Ibu ${mother}`;

    return this.getGroomParentLine() || '';
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
    const data = event as any;
    const link = String(data?.google_maps_url || event?.link_maps || data?.maps_url || data?.map_url || '').trim();
    if (link) {
      return link;
    }

    const latitude = String(data?.latitude || '').trim();
    const longitude = String(data?.longitude || '').trim();
    return latitude && longitude
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
      : null;
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

  getLoveStoryItems(): Array<{ title: string; date: string; description: string }> {
    return this.getStories().map((story: WeddingStory) => ({
      title: story.title || 'Cerita Kami',
      date: story.tanggal_cerita ? String(story.tanggal_cerita).slice(0, 4) : '',
      description: story.lead_cerita || '',
    })).filter((item) => !!item.title || !!item.description);
  }

  getStoryTrackBy(index: number, item: { title: string }): string {
    return `${index}-${item.title}`;
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
    const data = event as any;
    const directLink = String(data?.google_maps_url || event?.link_maps || data?.maps || data?.map_url || '').trim();
    if (directLink) {
      return directLink;
    }

    const latitude = String(data?.latitude || '').trim();
    const longitude = String(data?.longitude || '').trim();
    return latitude && longitude
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
      : '';
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
    const gallery: any[] = this.getGalleryItems();

    const item: any =
      gallery.find((photo: any) => {
        const name = String(photo?.nama_foto || photo?.name || photo?.title || '').toLowerCase();
        return (
          name.includes('gift') ||
          name.includes('hadiah') ||
          name.includes('couple') ||
          name.includes('pasangan') ||
          name.includes('outdoor') ||
          name.includes('prewedding')
        );
      }) ||
      gallery[2] ||
      gallery[1] ||
      gallery[0] ||
      null;

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  copyGiftNumber(account: any): void {
    const number = String(
      account?.nomor_rekening ||
      account?.account_number ||
      account?.no_rekening ||
      ''
    ).trim();

    if (!number) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(number);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = number;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  getMomentCollageItems(): any[] {
    const collagePhotos: any[] = this.getCollageItems();
    const galleryPhotos: any[] = this.getGalleryItems();
    const source = collagePhotos.length ? collagePhotos : galleryPhotos;

    return source.filter((item: any) => {
      const url = this.getMomentMediaUrl(item);
      return Boolean(url);
    });
  }

  getMomentFeaturedItem(): any {
    const collagePhotos = this.getMomentCollageItems();
    return collagePhotos[0] || null;
  }

  getMomentPhotosPartOne(): any[] {
    const collagePhotos = this.getMomentCollageItems();

    if (!collagePhotos.length) return [];

    const remaining = this.getMomentFeaturedItem() ? collagePhotos.slice(1) : collagePhotos;

    return remaining.slice(0, 4);
  }

  getMomentPhotosPartTwo(): any[] {
    const collagePhotos = this.getMomentCollageItems();

    if (!collagePhotos.length) return [];

    const remaining = this.getMomentFeaturedItem() ? collagePhotos.slice(1) : collagePhotos;

    return remaining.slice(4, 10);
  }

  getMomentPhotoUrl(item: any): string {
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
    return isInvitationVideoMedia(item) || Boolean(resolveInvitationVideoUrl(item));
  }

  openMomentVideo(item: any): void {
    const videoUrl = String(
      resolveInvitationVideoUrl(item) ||
      ''
    ).trim();

    if (!videoUrl) return;

    window.open(videoUrl, '_blank');
  }

  getMomentsBackgroundUrl(index: number): string {
    const gallery = this.getMomentCollageItems();
    const photoItems = gallery.filter((item: any) => !this.isMomentVideo(item));
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

    return String(
      live?.url ||
      live?.link ||
      live?.link_live ||
      live?.url_live ||
      live?.youtube_url ||
      live?.link_youtube ||
      data?.link_live_streaming ||
      data?.live_streaming_url ||
      ''
    ).trim();
  }

  hasLiveStreaming(): boolean {
    return Boolean(this.getLiveStreamingUrl());
  }

  getLiveStreamingPhotoUrl(): string {
    const gallery: any[] = this.getGalleryItems();

    const item: any =
      gallery.find((photo: any) => {
        const name = String(photo?.nama_foto || photo?.name || photo?.title || '').toLowerCase();
        return (
          name.includes('live') ||
          name.includes('stream') ||
          name.includes('couple') ||
          name.includes('pasangan') ||
          name.includes('outdoor') ||
          name.includes('prewedding')
        );
      }) ||
      gallery[1] ||
      gallery[0] ||
      null;

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  getFooterPhotoUrl(): string {
    const gallery: any[] = this.getGalleryItems();

    const item: any =
      gallery.find((photo: any) => {
        const name = String(photo?.nama_foto || photo?.name || photo?.title || '').toLowerCase();
        return (
          name.includes('footer') ||
          name.includes('closing') ||
          name.includes('couple') ||
          name.includes('pasangan') ||
          name.includes('outdoor') ||
          name.includes('prewedding')
        );
      }) ||
      gallery[0] ||
      null;

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizePhotoUrl(rawUrl) || this.getCoverPhotoUrl();
  }

  override getVisibleBankAccounts(): BankAccount[] {
    const bankAccounts = this.weddingData?.bank_accounts ?? [];
    return Array.isArray(bankAccounts) ? bankAccounts : [];
  }

  private syncInvitationState(): void {
    this.isInvitationOpened = this.invitationOpened;
    if (this.invitationOpened) {
      this.hasOpened = true;
    }
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
}
