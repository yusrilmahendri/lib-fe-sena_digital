import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService, DashboardServiceType } from '../../../../dashboard.service';
import { BankAccount, GalleryItem, GuestWish, WeddingData, WeddingEvent } from '../../../../services/wedding-data.service';
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
  selector: 'wc-ruby-theme-two',
  templateUrl: './ruby-theme-two.component.html',
  styleUrls: ['./ruby-theme-two.component.scss'],
})
export class RubyThemeTwoComponent extends LavenderBloomThemeComponent implements OnInit, OnDestroy {
  @Input() override weddingData: WeddingData | null = null;
  @Input() override invitationOpened = false;

  wishForm: WishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
  isSubmittingWish = false;
  isOpening = false;
  hasOpened = false;

  private readonly FALLBACK_EVENT = {} as WeddingEvent;
  private readonly mapUrlCache = new Map<string, SafeResourceUrl>();
  private openingTimer: any;

  constructor(
    private svc: DashboardService,
    private sanitizer?: DomSanitizer
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    if (this.invitationOpened) {
      this.hasOpened = true;
    }
    console.log('[RubyThemeTwoStories]', this.weddingData?.stories, this.getLoveStories());
  }

  openRubyTwoInvitation(): void {
    if (this.isOpening || this.hasOpened) {
      return;
    }

    this.isOpening = true;
    super.openInvitation();
    this.hasOpened = true;

    this.openingTimer = setTimeout(() => {
      this.isOpening = false;
    }, 650);
  }

  override ngOnDestroy(): void {
    if (this.openingTimer) {
      clearTimeout(this.openingTimer);
    }
    super.ngOnDestroy();
  }

  // ─── Display helpers ─────────────────────────────────────────────────

  getPrimaryDisplayName(): string {
    return this.getGroomNickname() || 'Ketut';
  }

  getSecondaryDisplayName(): string {
    return this.getBrideNickname() || 'Isabela';
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

  getHeroDateLabel(): string {
    return this.formatOpeningDate(this.getPrimaryEvent()?.tanggal_acara);
  }

  // ─── Intro / Quote ────────────────────────────────────────────────────


  getQuranQuote(): string {
    const quote = this.getPrimaryQuote();
    return quote?.text
      || 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu cenderung dan merasa tenteram kepadanya.';
  }

  getQuranSource(): string {
    const quote = this.getPrimaryQuote();
    return quote ? quote.source : 'QS. Ar-Rum: 21';
  }

  getBrideInstagram(): string | null {
    return this.extractInstagram(this.getBride());
  }

  getGroomInstagram(): string | null {
    return this.extractInstagram(this.getGroom());
  }

  // ─── Photos ──────────────────────────────────────────────────────────

  override getCoverPhoto(): string {
    const featuredGalleryPhoto = this.getFeaturedGalleryItem();
    const featuredGalleryUrl = featuredGalleryPhoto ? this.getGalleryPhotoUrl(featuredGalleryPhoto) : '';
    return this.getSafeImageUrl([
      featuredGalleryUrl,
      (this.weddingData as any)?.cover_photo_url,
      (this.weddingData as any)?.mempelai?.cover_photo_url,
      this.weddingData?.mempelai?.cover_photo,
      (this.weddingData as any)?.cover_photo,
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
    ], 'assets/landing/template-1.png');
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

  getSafeGalleryPhotos(): GalleryItem[] {
    return this.getGalleryItems().filter((item) => {
      const photoUrl = this.getGalleryPhotoUrl(item);
      return !!photoUrl && !this.isUnsafeThemeImage(photoUrl);
    });
  }

  getGalleryPhotos(): GalleryItem[] {
    return this.getSafeGalleryPhotos();
  }

  override hasGallery(): boolean {
    return this.getSafeGalleryPhotos().length > 0;
  }

  override getFeaturedGalleryItem(): GalleryItem | null {
    return this.getSafeGalleryPhotos()[0] || null;
  }

  override getGalleryGridItems(): GalleryItem[] {
    return this.getSafeGalleryPhotos().slice(1, 5);
  }

  override getGalleryPhotoUrl(item: any): string {
    const resolved = resolveInvitationPhotoUrl(item);

    console.log('[ImageUrlDebug]', {
      context: 'ruby-theme-two',
      raw: item,
      resolved
    });

    return resolved;
  }

  override onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    logInvitationImageError(event, 'ruby-theme-two');
    img.style.display = 'none';
  }

  // ─── Parents ─────────────────────────────────────────────────────────

  getBrideParentLine(): string {
    return this.getParentsText(this.getBride(), 'wanita');
  }

  getGroomParentLine(): string {
    return this.getParentsText(this.getGroom(), 'pria');
  }

  // ─── Event cards ─────────────────────────────────────────────────────

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

  getAkadMapLink(): string | null {
    return this.getEventMapLink(this.getAkadCard());
  }

  getReceptionMapLink(): string | null {
    return this.getEventMapLink(this.getReceptionCard());
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
    if (!this.sanitizer) {
      return null;
    }

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

  getEventMapEmbedUrl(event: WeddingEvent): SafeResourceUrl | null {
    return this.getSafeMapUrl(event);
  }

  // ─── Bank accounts ────────────────────────────────────────────────────

  getVisibleBankAccounts(): BankAccount[] {
    return Array.isArray(this.weddingData?.bank_accounts)
      ? this.weddingData?.bank_accounts.slice(0, 2) || []
      : [];
  }

  copyAccountNumber(number: string): void {
    this.copyText(number);
  }

  getGiftAddress(bank?: any): string {
    if (bank) {
      return String(bank.alamat_kado || bank.gift_address || bank.alamat || '').trim();
    }

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

  getWeddingGiftIntro(): string {
    return 'Doa restu Anda adalah hadiah terindah. Namun jika ingin memberi tanda kasih, dapat melalui:';
  }

  // ─── Wishes ──────────────────────────────────────────────────────────

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
    if (!this.wishForm.nama?.trim() || !this.wishForm.pesan?.trim()) { return; }
    const userId = (this.weddingData as any)?.user_info?.id;
    const payload = {
      user_id: userId || 0,
      nama: this.wishForm.nama.trim(),
      pesan: this.wishForm.pesan.trim(),
      kehadiran: this.wishForm.kehadiran || 'hadir',
    };

    if (isThemePreviewWeddingData(this.weddingData)) {
      this.weddingData = appendPreviewGuestWish(this.weddingData as WeddingData, payload);
      this.wishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
      return;
    }

    if (!userId) { return; }

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

  // ─── Love story ───────────────────────────────────────────────────────

  getLoveStories(): Array<{ year: string; title: string; description: string }> {
    const data = this.weddingData as any;
    const rawStories =
      this.weddingData?.stories ||
      data?.data?.stories ||
      data?.cerita_cinta ||
      data?.love_stories ||
      [];

    if (Array.isArray(rawStories) && rawStories.length) {
      return rawStories.map((story: any) => {
        const date = story.tanggal_cerita || story.date || story.tanggal || '';
        const year = date ? String(date).slice(0, 4) : String(story.year || story.tahun || '');

        return {
          year,
          title: story.title || story.judul || story.name || 'Cerita Kami',
          description:
            story.lead_cerita ||
            story.description ||
            story.deskripsi ||
            story.content ||
            story.cerita ||
            story.story ||
            '',
        };
      });
    }

    return [
      {
        year: '2019',
        title: 'Pertama Bertemu',
        description: 'Dipertemukan di sebuah acara, percakapan singkat berubah menjadi awal dari segalanya.',
      },
      {
        year: '2022',
        title: 'Menjalin Hubungan',
        description: 'Setiap hari menjadi lebih berwarna. Kami belajar tumbuh dan saling melengkapi.',
      },
      {
        year: '2025',
        title: 'Lamaran',
        description: 'Di bawah langit senja, sebuah janji diucapkan untuk melangkah ke jenjang yang lebih serius.',
      },
      {
        year: '2026',
        title: 'Hari Bahagia',
        description: 'Dengan restu keluarga, kami siap memulai babak baru sebagai pasangan suami istri.',
      },
    ];
  }

  getLoveStoryItems(): Array<{ title: string; date: string; description: string }> {
    return this.getLoveStories().map((story) => ({
      title: story.title,
      date: story.year,
      description: story.description,
    }));
  }

  getStoryTrackBy(index: number, item: { title: string }): string {
    return `${index}-${item.title}`;
  }

  getCountdownHeading(): string {
    return 'MENUJU HARI BAHAGIA';
  }

  getMapPreviewLabel(): string {
    return this.getMapsLink() ? 'Peta lokasi acara' : 'Peta lokasi akan segera diperbarui';
  }

  getClosingDateLabel(): string {
    return this.getHeroDateLabel();
  }

  getPackageLabelText(): string {
    return 'Paket Ruby';
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private fallbackStoryTitle(i: number): string {
    return (
      ['Pertemuan Pertama', 'Menjalin Hubungan', 'Lamaran', 'Hari Bahagia'][i] || 'Cerita Kami'
    );
  }

  private fallbackStoryDescription(i: number): string {
    return (
      [
        'Kami dipertemukan dalam sebuah momen yang sederhana, lalu saling menemukan alasan untuk bertahan.',
        'Perjalanan kami dipenuhi percakapan hangat, tawa, dan dukungan yang membuat cinta tumbuh semakin kuat.',
        'Dengan restu keluarga besar, kami memutuskan untuk melangkah ke tahap yang lebih serius.',
        'Hari ini menjadi awal baru bagi kami untuk membangun kisah rumah tangga bersama.',
      ][i] || 'Cerita cinta kami akan terus bertumbuh.'
    );
  }

  private getLoveStoryYear(story: any): string {
    const rawDate = story?.tanggal_cerita || story?.date || story?.tanggal || story?.year || story?.tahun || '';
    const value = String(rawDate || '').trim();
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return String(date.getFullYear());
    }

    return value;
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

  private extractInstagram(person: any): string | null {
    const rawValue = person?.instagram || person?.ig || person?.username || '';
    const normalized = String(rawValue || '').trim();
    if (!normalized) {
      return null;
    }

    return normalized.startsWith('@') ? normalized : `@${normalized}`;
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
      return '12 · 12 · 2026';
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
      if (!this.isUnsafeThemeImage(candidate)) {
        return this.normalizeMediaUrl(candidate);
      }
    }
    return fallback;
  }

  override normalizeMediaUrl(value: any): string {
    return normalizeInvitationMediaUrl(value);
  }

  private isUnsafeThemeImage(value: string | null | undefined): boolean {
    const image = String(value || '').trim();
    if (!image) {
      return true;
    }

    if (/storage|gallery|uploads|photo_pria|photo_wanita|cover_photo/i.test(image)) {
      return false;
    }

    return /^assets\/(?:landing\/template-|thema-|bg-|feature|Rectangle|Ellipse|logo|LOGO|landing_page|themas)/i.test(image);
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
