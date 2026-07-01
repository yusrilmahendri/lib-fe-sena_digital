import { Component, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService, DashboardServiceType } from '../../../../dashboard.service';
import { BankAccount, GalleryItem, GuestWish, WeddingEvent } from '../../../../services/wedding-data.service';
import { LavenderBloomThemeComponent } from '../../themes/lavender-bloom/lavender-bloom-theme.component';
import { environment } from '../../../../../environments/environment';

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
export class SapphireThemeOneComponent extends LavenderBloomThemeComponent implements OnInit, OnDestroy {
  wishForm: WishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
  isSubmittingWish = false;
  isOpening = false;

  private readonly FALLBACK_EVENT = {} as WeddingEvent;
  private readonly mapUrlCache = new Map<string, SafeResourceUrl>();
  private openingTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private svc: DashboardService,
    private sanitizer: DomSanitizer
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
  }

  override ngOnDestroy(): void {
    if (this.openingTimer) {
      clearTimeout(this.openingTimer);
    }
    if (this.scrollTimer) {
      clearTimeout(this.scrollTimer);
    }
    super.ngOnDestroy();
  }

  override openInvitation(): void {
    if (this.isOpening || this.invitationOpened) {
      return;
    }

    this.isOpening = true;

    this.openingTimer = setTimeout(() => {
      super.openInvitation();
      this.isOpening = false;

      this.scrollTimer = setTimeout(() => {
        document.querySelector('.sapphire-post-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }, 1000);
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

  getGuestName(): string {
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
    return this.getInvitationIntro();
  }

  getInvitationIntro(): string {
    return (
      this.weddingData?.settings?.salam_atas ||
      'Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud mengundang ' +
      'Bapak/Ibu/Saudara/i untuk hadir di hari pernikahan kami.'
    );
  }

  getQuranQuote(): string {
    const quote = this.getPrimaryQuote();
    return quote?.text ||
      'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu cenderung dan merasa tenteram kepadanya.';
  }

  getQuranSource(): string {
    const quote = this.getPrimaryQuote();
    return quote ? quote.source : 'QS. Ar-Rum: 21';
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
      galleryItem?.photo,
      galleryUrl,
      (this.weddingData as any)?.photo_pria_url,
      (this.weddingData as any)?.mempelai?.photo_pria_url,
      (this.weddingData as any)?.mempelai?.pria?.photo_url,
      this.getGroom()?.photo,
      (this.weddingData as any)?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.wanita?.photo_url,
      this.getBride()?.photo,
    ], this.getOpeningFallbackCover());
  }

  getBridePhoto(): string {
    return this.getSafeImageUrl([
      (this.weddingData as any)?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.photo_wanita_url,
      (this.weddingData as any)?.mempelai?.wanita?.photo_url,
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
    return event?.alamat || 'Alamat menyusul';
  }

  getDetailEventVenue(event: WeddingEvent): string {
    const data = event as any;
    return (
      data?.nama_lokasi ||
      data?.nama_tempat ||
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
      data?.link_maps,
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
    if (!userId) {
      return;
    }

    this.isSubmittingWish = true;
    const payload = {
      user_id: userId,
      nama: this.wishForm.nama.trim(),
      pesan: this.wishForm.pesan.trim(),
      kehadiran: this.wishForm.kehadiran || 'hadir',
    };

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
    return this.normalizeMediaUrl(
      item?.photo_url ||
      item?.image_url ||
      item?.preview_url ||
      item?.cover_photo_url ||
      item?.url ||
      item?.file_url ||
      item?.path_url ||
      item?.photo ||
      item?.image ||
      item?.file_path ||
      item?.path ||
      item?.foto ||
      item
    );
  }

  override onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    img.closest('.gallery-card')?.classList.add('is-image-missing');
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

  override normalizeMediaUrl(value: any): string {
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
