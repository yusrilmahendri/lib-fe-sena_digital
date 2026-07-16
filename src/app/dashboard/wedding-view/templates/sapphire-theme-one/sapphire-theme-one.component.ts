import { ChangeDetectorRef, Component, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService, DashboardServiceType } from '../../../../dashboard.service';
import { BankAccount, GalleryItem, GuestWish, WeddingEvent } from '../../../../services/wedding-data.service';
import { LavenderBloomThemeComponent } from '../../themes/lavender-bloom/lavender-bloom-theme.component';
import {
  logInvitationImageError,
  normalizeInvitationMediaUrl,
  resolveInvitationPhotoUrl,
} from '../../../../shared/user-photo.model';
import {
  appendPreviewGuestWish,
  isThemePreviewWeddingData,
} from '../../../../shared/data/theme-preview-dummy.data';

interface WishForm {
  nama: string;
  pesan: string;
  kehadiran: string;
}

@Component({
  selector: 'wc-sapphire-theme-one',
  templateUrl: './sapphire-theme-one.component.html',
  styleUrls: ['./sapphire-theme-one.component.scss'],
})
export class SapphireThemeOneComponent extends LavenderBloomThemeComponent implements OnInit, OnChanges, OnDestroy {
  wishForm: WishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
  isSubmittingWish = false;
  hasOpened = false;
  forceOpened = false;

  private readonly FALLBACK_EVENT = {} as WeddingEvent;
  private readonly mapUrlCache = new Map<string, SafeResourceUrl>();

  constructor(
    private svc: DashboardService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {
    super();
  }

  override ngOnInit(): void {
    console.log('[Garden Whisper] ngOnInit');
    super.ngOnInit();
  }

  override ngOnChanges(changes: SimpleChanges): void {
    console.log('[Garden Whisper] ngOnChanges');
    super.ngOnChanges(changes);
  }

  override ngOnDestroy(): void {
    this.cleanupPreviewLocks();
    super.ngOnDestroy();
  }

  override openInvitation(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    console.log('[Garden REAL BUTTON CLICKED]');
    console.log('[Garden] REAL CHILD openInvitation start');
    console.log('[Garden Whisper] before', {
      hasOpened: this.hasOpened,
      isInvitationOpened: this.isInvitationOpened,
      isOpening: this.isOpening,
      isCoverVisible: this.isCoverVisible,
      forceOpened: this.forceOpened,
    });
    if (this.forceOpened) {
      return;
    }

    this.hasOpened = true;
    this.isInvitationOpened = true;
    this.isCoverVisible = false;
    this.isOpening = false;
    this.forceOpened = true;
    this.cleanupPreviewLocks();

    this.openInvitationRequested.emit();
    this.cdr.markForCheck();

    console.log('[Garden] REAL CHILD openInvitation after', {
      hasOpened: this.hasOpened,
      isInvitationOpened: this.isInvitationOpened,
      isOpening: this.isOpening,
      isCoverVisible: this.isCoverVisible,
      forceOpened: this.forceOpened,
    });

  }
  private cleanupPreviewLocks(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const classes = [
      'no-scroll',
      'modal-open',
      'preview-open',
      'invitation-open',
      'cover-active',
      'opening-active',
      'theme-opening-active'
    ];

    classes.forEach((className) => {
      document.body.classList.remove(className);
      document.documentElement.classList.remove(className);
    });

    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  getCoupleNames(): string {
    return `${this.getGroomDisplayName()} & ${this.getBrideDisplayName()}`;
  }

  getGroomDisplayName(): string {
    const groom = this.getGroom();
    return groom?.nama_panggilan || groom?.nama_lengkap || this.getGroomName();
  }

  getBrideDisplayName(): string {
    const bride = this.getBride();
    return bride?.nama_panggilan || bride?.nama_lengkap || this.getBrideName();
  }

  getWeddingDate(): string {
    return `${this.getWeddingDayPart()} · ${this.getWeddingMonthPart()} · ${this.getWeddingYearPart()}`;
  }

  trackByCountdownPart(_index: number, part: { label: string; value: string }): string {
    return part.label;
  }

  getWeddingDayPart(): string {
    const date = this.getOpeningDateSource();
    return date ? String(date.getDate()).padStart(2, '0') : '12';
  }

  getWeddingMonthPart(): string {
    const date = this.getOpeningDateSource();
    return date ? String(date.getMonth() + 1).padStart(2, '0') : '12';
  }

  getWeddingYearPart(): string {
    const date = this.getOpeningDateSource();
    return date ? String(date.getFullYear()) : '2026';
  }

  private getOpeningDateSource(): Date | null {
    const raw = this.getPrimaryEvent()?.tanggal_acara;
    if (!raw) {
      return null;
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isThemePreviewMode(): boolean {
    return Number((this.weddingData as any)?.user_info?.id) === 0;
  }

  private getOpeningFallbackCover(): string {
    return this.isThemePreviewMode()
      ? 'assets/landing/template-5.png'
      : 'assets/landing/template-5.png';
  }

  override getGuestName(): string {
    const data = this.weddingData as any;
    const candidates = [
      data?.guest_name,
      data?.nama_tamu,
      data?.guest?.nama,
      data?.guest?.name,
      data?.guest_book?.[0]?.nama,
      data?.guest_book?.[0]?.name,
    ];

    const guestName = candidates
      .map((value) => String(value || '').trim())
      .find((value) => !!value);

    return guestName || 'Tamu Undangan';
  }

  getIntroText(): string {
    return this.getInvitationOpeningText();
  }

  getQuranQuote(): string {
    const quote = this.getPrimaryQuote();
    return this.getReligionQuoteText(
      quote?.text ||
      'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu cenderung dan merasa tenteram kepadanya.'
    );
  }

  getQuranSource(): string {
    const quote = this.getPrimaryQuote();
    return this.getReligionQuoteSource(quote ? quote.source : 'QS. Ar-Rum: 21');
  }

  override getCoverPhoto(): string {
    const galleryItem = this.getGalleryPhotos()[0] as any;
    const galleryUrl = galleryItem ? this.getGalleryPhotoUrl(galleryItem) : '';

    return this.getSafeImageUrl([
      (this.weddingData as any)?.cover_photo_url,
      (this.weddingData as any)?.mempelai?.cover_photo_url,
      this.weddingData?.mempelai?.cover_photo,
      (this.weddingData as any)?.cover_photo,
      galleryItem?.photo_url,
      galleryItem?.image_url,
      galleryItem?.preview_url,
      galleryItem?.photo,
      galleryUrl,
      (this.weddingData as any)?.photo_pria_url,
      (this.weddingData as any)?.mempelai?.photo_pria_url,
      (this.weddingData as any)?.mempelai?.pria?.photo_url,
      (this.weddingData as any)?.mempelai?.pria?.image_url,
      (this.weddingData as any)?.mempelai?.pria?.preview_url,
      this.getGroom()?.photo,
      (this.weddingData as any)?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.wanita?.photo_url,
      (this.weddingData as any)?.mempelai?.wanita?.image_url,
      (this.weddingData as any)?.mempelai?.wanita?.preview_url,
      this.getBride()?.photo,
    ], this.getOpeningFallbackCover());
  }

  getBridePhoto(): string {
    return this.getSafeImageUrl([
      (this.weddingData as any)?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.wanita?.photo_url,
      (this.weddingData as any)?.mempelai?.wanita?.image_url,
      (this.weddingData as any)?.mempelai?.wanita?.preview_url,
      (this.weddingData as any)?.photo_wanita,
      (this.weddingData as any)?.mempelai?.photo_wanita,
      this.getBride()?.photo,
    ], '');
  }

  getGroomPhoto(): string {
    return this.getSafeImageUrl([
      (this.weddingData as any)?.photo_pria_url,
      (this.weddingData as any)?.mempelai?.photo_pria_url,
      (this.weddingData as any)?.mempelai?.pria?.photo_url,
      (this.weddingData as any)?.mempelai?.pria?.image_url,
      (this.weddingData as any)?.mempelai?.pria?.preview_url,
      (this.weddingData as any)?.photo_pria,
      (this.weddingData as any)?.mempelai?.photo_pria,
      this.getGroom()?.photo,
    ], '');
  }

  getBrideParentLine(): string {
    return this.getParentsText(this.getBride(), 'wanita');
  }

  getGroomParentLine(): string {
    return this.getParentsText(this.getGroom(), 'pria');
  }

  getBrideInstagram(): string | null {
    return this.extractInstagram(this.getBride());
  }

  getGroomInstagram(): string | null {
    return this.extractInstagram(this.getGroom());
  }

  getCountdownBackground(): string {
    const gallery = this.getGalleryPhotos();
    const second = gallery[1] ? this.getGalleryPhotoUrl(gallery[1]) : '';
    return second || this.getCoverPhoto();
  }

  getWishesBackground(): string {
    const gallery = this.getGalleryPhotos();
    const third = gallery[2] ? this.getGalleryPhotoUrl(gallery[2]) : '';
    return third || this.getCoverPhoto();
  }

  hasGalleryVideo(item: any): boolean {
    return !!(item?.url_video || item?.video_url || item?.video);
  }

  getEventWeekday(event: WeddingEvent): string {
    const date = this.parseEventDate(event);
    if (!date) {
      return 'Minggu';
    }
    return date.toLocaleDateString('id-ID', { weekday: 'long' });
  }

  getEventDayNumber(event: WeddingEvent): string {
    const date = this.parseEventDate(event);
    return date ? String(date.getDate()) : '12';
  }

  getEventMonthYear(event: WeddingEvent): string {
    const date = this.parseEventDate(event);
    if (!date) {
      return 'Desember 2026';
    }
    const month = date.toLocaleDateString('id-ID', { month: 'long' });
    return `${month} ${date.getFullYear()}`;
  }

  getWeddingGiftIntro(): string {
    return 'Doa restu Anda adalah hadiah terindah. Namun jika ingin memberi tanda kasih, dapat melalui:';
  }

  getGiftAddress(): string {
    const data = this.weddingData as any;
    const candidates = [
      data?.alamat_kado,
      data?.gift_address,
      data?.send_gift_address,
      data?.settings?.alamat_kado,
      data?.settings?.gift_address,
      data?.mempelai?.alamat_kado,
    ];

    return candidates
      .map((value) => String(value || '').trim())
      .find((value) => !!value) || '';
  }

  copyGiftAddress(): void {
    this.copyText(this.getGiftAddress());
  }

  getInvitedNames(): string[] {
    const data = this.weddingData as any;
    const guestBook = data?.guest_book;

    if (Array.isArray(guestBook) && guestBook.length) {
      return guestBook
        .map((item: any) => String(item?.nama || item?.name || '').trim())
        .filter((name: string) => !!name)
        .slice(0, 5);
    }

    const turut = data?.turut_mengundung || data?.invited_names || data?.settings?.turut_mengundung;
    if (Array.isArray(turut) && turut.length) {
      return turut.map((name: any) => String(name).trim()).filter(Boolean).slice(0, 5);
    }

    if (typeof turut === 'string' && turut.trim()) {
      return turut.split(/[,;\n]/).map((name) => name.trim()).filter(Boolean).slice(0, 5);
    }

    return ['Keluarga Besar', 'Saudara & Kerabat', 'Teman Terkasih'];
  }

  getAkadCard(): WeddingEvent {
    return this.getAkadEvent() ?? this.FALLBACK_EVENT;
  }

  getReceptionCard(): WeddingEvent {
    return this.getReceptionEvent() ?? this.FALLBACK_EVENT;
  }

  getEventAddress(event: WeddingEvent): string {
    const data = event as any;
    return data?.address || event?.alamat || data?.location_name || 'Alamat menyusul';
  }

  getDetailEventVenue(event: WeddingEvent): string {
    const data = event as any;
    return (
      data?.nama_lokasi ||
      data?.nama_tempat ||
      data?.location_name ||
      data?.venue ||
      data?.tempat ||
      data?.lokasi ||
      event?.nama_acara ||
      'Lokasi menyusul'
    );
  }

  getEventMapLink(event: WeddingEvent): string | null {
    const data = event as any;
    const directLink = [
      data?.google_maps_url,
      data?.link_maps,
      data?.map_url,
      data?.google_maps,
      data?.maps_url,
      data?.location_url,
    ].map((value) => String(value || '').trim()).find((value) => !!value);

    if (directLink) {
      return directLink;
    }

    const query = this.getMapQuery(event);
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  }

  getMapEmbedUrl(event: any): string {
    const data = event as any;
    const directEmbed = [
      data?.maps_embed,
      data?.map_embed,
      data?.embed_maps,
      data?.iframe_maps,
    ].map((value) => String(value || '').trim()).find((value) => !!value);

    if (directEmbed) {
      return directEmbed;
    }

    const query = this.getMapQuery(event);
    if (!query) {
      return '';
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
  }

  getSafeMapUrl(event: any): SafeResourceUrl | null {
    const rawUrl = this.getMapEmbedUrl(event);
    if (!rawUrl) {
      return null;
    }

    const cacheKey = String(rawUrl);
    if (!this.mapUrlCache.has(cacheKey)) {
      this.mapUrlCache.set(
        cacheKey,
        this.sanitizer.bypassSecurityTrustResourceUrl(cacheKey)
      );
    }

    return this.mapUrlCache.get(cacheKey) || null;
  }

  getVisibleBankAccounts(): BankAccount[] {
    return Array.isArray(this.weddingData?.bank_accounts)
      ? this.weddingData?.bank_accounts.slice(0, 2) || []
      : [];
  }

  copyAccountNumber(number: string): void {
    this.copyText(number);
  }

  getDisplayedWishes(): GuestWish[] {
    return this.getGuestWishes()
      .filter((item) => this.isRealGuestWish(item))
      .slice(0, 8);
  }

  getAttendanceLabel(kehadiran: string): string {
    const labelMap: Record<string, string> = {
      hadir: 'Hadir',
      tidak_hadir: 'Tidak Hadir',
      mungkin: 'Mungkin',
    };
    return labelMap[kehadiran] || kehadiran;
  }

  submitWish(): void {
    if (!this.wishForm.nama?.trim() || !this.wishForm.pesan?.trim()) {
      return;
    }

    const userId = (this.weddingData as any)?.user_info?.id;
    const payload = {
      user_id: userId || 0,
      nama: this.wishForm.nama.trim(),
      pesan: this.wishForm.pesan.trim(),
      kehadiran: this.wishForm.kehadiran || 'hadir',
    };

    if (isThemePreviewWeddingData(this.weddingData)) {
      this.weddingData = appendPreviewGuestWish(this.weddingData as any, payload);
      this.wishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
      return;
    }

    if (!userId) {
      return;
    }

    this.isSubmittingWish = true;

    this.svc.create(DashboardServiceType.ATTENDANCE, payload).subscribe({
      next: () => {
        const currentWishes = Array.isArray(this.weddingData?.guest_wishes)
          ? [...(this.weddingData?.guest_wishes || [])]
          : [];
        const nextWish: GuestWish = {
          id: Date.now(),
          nama: payload.nama,
          kehadiran: payload.kehadiran,
          pesan: payload.pesan,
          created_at: new Date().toISOString(),
        };

        if (this.weddingData) {
          this.weddingData = {
            ...this.weddingData,
            guest_wishes: [nextWish, ...currentWishes],
          };
        }

        this.isSubmittingWish = false;
        this.wishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
      },
      error: () => {
        this.isSubmittingWish = false;
      },
    });
  }

  getGalleryPhotos(): GalleryItem[] {
    return this.getGalleryItems();
  }

  override getFeaturedGalleryItem(): GalleryItem | null {
    return this.getGalleryPhotos()[0] || null;
  }

  override getGalleryGridItems(): GalleryItem[] {
    return this.getGalleryPhotos().slice(1, 5);
  }

  override getGalleryPhotoUrl(item: any): string {
    return resolveInvitationPhotoUrl(item);
  }

  override onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    logInvitationImageError(event, 'sapphire-theme-one');
    img.style.display = 'none';
  }

  getPackageLabelText(): string {
    return 'Paket Sapphire';
  }

  getClosingDateLabel(): string {
    return this.getWeddingDate();
  }

  private getPrimaryQuote(): { text: string; source: string } | null {
    const quote = this.getQuotes().find((item: any) => item?.quote || item?.qoute);
    if (!quote) {
      return null;
    }

    const data = quote as any;
    return {
      text: String(data.quote || data.qoute || '').replace(/^["“”]+|["“”]+$/g, '').trim(),
      source: String(data.name || data.source || data.reference || data.referensi || '').trim(),
    };
  }

  private getMapQuery(event: WeddingEvent): string {
    const data = event as any;
    const latitude = String(data?.latitude || '').trim();
    const longitude = String(data?.longitude || '').trim();

    if (latitude && longitude) {
      return `${latitude},${longitude}`;
    }

    return [
      this.getEventAddress(event),
      this.getDetailEventVenue(event),
    ].map((value) => String(value || '').trim())
      .filter((value) => !!value && !/menyusul|diumumkan/i.test(value))
      .join(', ');
  }

  private copyText(value: string): void {
    const text = String(value || '').trim();
    if (!text || !navigator?.clipboard) {
      return;
    }

    navigator.clipboard.writeText(text).catch(() => {});
  }

  private formatOpeningDate(dateValue?: string | null): string {
    if (!dateValue) {
      return '';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());

    return `${day} · ${month} · ${year}`;
  }

  private getSafeImageUrl(candidates: Array<string | null | undefined>, fallback: string): string {
    for (const candidate of candidates) {
      const normalized = this.normalizeMediaUrl(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return fallback;
  }

  override normalizeMediaUrl(value: any): string {
    return normalizeInvitationMediaUrl(value);
  }

  private parseEventDate(event: WeddingEvent): Date | null {
    const raw = event?.tanggal_acara;
    if (!raw) {
      return this.getOpeningDateSource();
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private extractInstagram(person: any): string | null {
    const rawValue = person?.instagram || person?.ig || person?.username || '';
    const normalized = String(rawValue || '').trim();
    if (!normalized) {
      return null;
    }

    return normalized.startsWith('@') ? normalized : `@${normalized}`;
  }

  private isRealGuestWish(item: GuestWish): boolean {
    const name = String((item as any)?.nama || (item as any)?.name || '').trim().toLowerCase();
    const message = String((item as any)?.pesan || (item as any)?.message || '').trim();
    const normalizedMessage = message.toLowerCase();

    if (!message || name === 'viewer') {
      return false;
    }

    return !(
      normalizedMessage.startsWith('undangan ') &&
      normalizedMessage.endsWith(' telah dilihat')
    );
  }
}
