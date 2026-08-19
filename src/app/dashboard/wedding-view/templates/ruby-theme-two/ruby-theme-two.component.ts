import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService, DashboardServiceType } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
import { BankAccount, GalleryItem, GuestWish, WeddingData, WeddingEvent, WeddingStory } from '../../../../services/wedding-data.service';
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
export class RubyThemeTwoComponent extends LavenderBloomThemeComponent implements OnInit, OnChanges, OnDestroy {
  @Input() override weddingData: WeddingData | null = null;
  @Input() override invitationOpened = false;

  wishForm: WishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
  isSubmittingWish = false;
  selectedGalleryVideoUrl: SafeResourceUrl | null = null;
  selectedGalleryVideoTitle = '';
  override isOpening = false;
  hasOpened = false;
  forceOpened = false;

  private readonly mapUrlCache = new Map<string, SafeResourceUrl>();

  constructor(
    private svc: DashboardService,
    private toastService: ToastService,
    private sanitizer?: DomSanitizer,
    private cdr?: ChangeDetectorRef
  ) {
    super();
  }

  override ngOnInit(): void {
    console.log('[Lavender Bloom] ngOnInit');
    super.ngOnInit();
    if (this.invitationOpened) {
      this.hasOpened = true;
      this.isInvitationOpened = true;
      this.isCoverVisible = false;
      this.forceOpened = true;
    }
    console.log('[RubyThemeTwoStories]', this.weddingData?.stories, this.getLoveStories());
  }

  override ngOnChanges(changes: SimpleChanges): void {
    console.log('[Lavender Bloom] ngOnChanges');
    super.ngOnChanges(changes);
  }

  override openInvitation(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    console.log('[Lavender REAL BUTTON CLICKED]');
    console.log('[Lavender] REAL CHILD openInvitation start');
    console.log('[Lavender Bloom] before', {
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
    this.releaseScrollLocks();

    this.openInvitationRequested.emit();
    this.releaseScrollLocks();
    this.cdr?.markForCheck();

    console.log('[Lavender] REAL CHILD openInvitation after', {
      hasOpened: this.hasOpened,
      isInvitationOpened: this.isInvitationOpened,
      isOpening: this.isOpening,
      isCoverVisible: this.isCoverVisible,
      forceOpened: this.forceOpened,
    });
  }

  override ngOnDestroy(): void {
    this.cleanupPreviewLocks();
    super.ngOnDestroy();
  }

  private releaseScrollLocks(): void {
    this.cleanupPreviewLocks();

    if (typeof window === 'undefined') {
      return;
    }

    window.requestAnimationFrame(() => this.cleanupPreviewLocks());
    window.setTimeout(() => this.cleanupPreviewLocks(), 0);
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

  // ─── Display helpers ─────────────────────────────────────────────────

  getPrimaryDisplayName(): string {
    return this.getGroomNickname() || 'Ketut';
  }

  getSecondaryDisplayName(): string {
    return this.getBrideNickname() || 'Isabela';
  }

  override getGuestName(): string {
    return super.getGuestName();
  }

  getHeroDateLabel(): string {
    return this.formatOpeningDate(this.getPrimaryEvent()?.tanggal_acara);
  }

  trackByCountdownPart(_index: number, part: { label: string; value: string }): string {
    return part.label;
  }

  // ─── Intro / Quote ────────────────────────────────────────────────────


  getQuranQuote(): string {
    const quote = this.getPrimaryQuote();
    return this.getReligionQuoteText(
      quote?.text
      || 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu cenderung dan merasa tenteram kepadanya.'
    );
  }

  getQuranSource(): string {
    const quote = this.getPrimaryQuote();
    return this.getReligionQuoteSource(quote ? quote.source : 'QS. Ar-Rum: 21');
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
      if (this.hasGalleryVideo(item)) {
        return false;
      }

      const photoUrl = this.getGalleryPhotoUrl(item);
      return !!photoUrl && !this.isUnsafeThemeImage(photoUrl);
    });
  }

  getGalleryPhotos(): GalleryItem[] {
    return this.getSafeGalleryPhotos();
  }

  override hasGallery(): boolean {
    return this.getSafeGalleryPhotos().length > 0 || this.getGalleryVideoItems().length > 0;
  }

  override getFeaturedGalleryItem(): GalleryItem | null {
    return this.getSafeGalleryPhotos()[0] || null;
  }

  override getGalleryGridItems(): GalleryItem[] {
    return this.getSafeGalleryPhotos();
  }

  override getGalleryPhotoUrl(item: any): string {
    return resolveInvitationPhotoUrl(item);
  }

  hasGalleryVideo(item: any): boolean {
    return !!this.getYoutubeEmbedUrl(this.getRawGalleryVideoUrl(item));
  }

  getGalleryVideoItems(): GalleryItem[] {
    return this.getGalleryItems().filter((item) => this.hasGalleryVideo(item));
  }

  getGalleryVideoCoverUrl(item: any): string {
    const photoUrl = resolveInvitationPhotoUrl(item);
    if (photoUrl && !this.isUnsafeThemeImage(photoUrl)) {
      return photoUrl;
    }

    return this.getGalleryVideoThumbnailUrl(item);
  }

  openGalleryVideo(item: any): void {
    const embedUrl = this.getYoutubeEmbedUrl(this.getRawGalleryVideoUrl(item));
    if (!embedUrl || !this.sanitizer) {
      return;
    }

    this.selectedGalleryVideoTitle = item?.description || item?.nama_foto || 'Video undangan';
    this.selectedGalleryVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.withYoutubeAutoplay(embedUrl));
  }

  closeGalleryVideo(): void {
    this.selectedGalleryVideoUrl = null;
    this.selectedGalleryVideoTitle = '';
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

  getDisplayEvents(): WeddingEvent[] {
    return this.getEvents().filter((event) => this.isDisplayEvent(event));
  }

  trackByEvent(index: number, event: WeddingEvent): string | number {
    const data = event as any;
    return data?.id || data?.uuid || data?.slug || data?.nama_acara || index;
  }

  getEventTitle(event: WeddingEvent): string {
    const data = event as any;
    return data?.nama_acara || data?.title || data?.name || 'Acara';
  }

  getEventAddress(event: WeddingEvent): string {
    const data = event as any;
    return data?.address || event?.alamat || '';
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
      ''
    );
  }

  getEventMapLink(event: WeddingEvent): string | null {
    return this.getDirectEventMapUrl(event, true);
  }

  getMapEmbedUrl(event: any): string {
    const data = event as any;
    const directEmbed = [
      data?.maps_embed,
      data?.map_embed,
      data?.embed_maps,
      data?.iframe_maps,
    ].map((value) => String(value || '').trim()).find((value) => this.isValidMapEmbedUrl(value));

    if (directEmbed) {
      return directEmbed;
    }

    const coordinateQuery = this.getEventCoordinateQuery(event);
    if (coordinateQuery) {
      return `https://www.google.com/maps?q=${encodeURIComponent(coordinateQuery)}&output=embed`;
    }

    const query = this.getMapQuery(event);
    return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : '';
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

  copyAccountNumber(bank: any): void {
    this.copyText(this.getBankClipboardText(bank), 'Data rekening berhasil disalin', 'Data rekening gagal disalin');
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
    const domain = this.getInvitationDomain();
    const payload = {
      user_id: userId || 0,
      domain,
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
    if (!domain) {
      this.toastService.showToast('Domain undangan tidak tersedia untuk mengirim ucapan.', 'error');
      return;
    }

    this.isSubmittingWish = true;

    this.svc.create(DashboardServiceType.ATTENDANCE, payload).subscribe({
      next: (response: { data?: Partial<GuestWish> }) => {
        const currentWishes = Array.isArray(this.weddingData?.guest_wishes)
          ? [...(this.weddingData?.guest_wishes || [])]
          : [];
        const nextWish: GuestWish = {
          id: Number(response?.data?.id) || Date.now(),
          nama: response?.data?.nama || payload.nama,
          kehadiran: response?.data?.kehadiran || payload.kehadiran,
          pesan: response?.data?.pesan || payload.pesan,
          created_at: response?.data?.created_at || new Date().toISOString(),
        };

        if (this.weddingData) {
          this.weddingData = {
            ...this.weddingData,
            guest_wishes: [nextWish, ...currentWishes],
          };
        }

        this.wishSubmitted.emit(nextWish);
        this.isSubmittingWish = false;
        this.wishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
      },
      error: (error) => {
        const message = error?.error?.message || 'Gagal mengirim ucapan. Silakan coba lagi.';
        this.toastService.showToast(message, 'error');
        this.isSubmittingWish = false;
      },
    });
  }

  // ─── Love story ───────────────────────────────────────────────────────

  override getStories(): WeddingStory[] {
    const data = this.weddingData as any;
    const candidates = [
      data?.stories,
      data?.love_story,
      data?.story,
      data?.journey,
      data?.wedding_story,
      data?.wedding_stories,
      data?.love_stories,
      data?.cerita,
      data?.list_cerita,
      data?.cerita_cinta,
      data?.collage,
      data?.invitation_package?.stories,
      data?.invitation_package?.love_story,
      data?.invitation_package?.story,
      data?.invitation_package?.journey,
      data?.invitation_package?.wedding_story,
      data?.invitation_package?.wedding_stories,
      data?.invitation_package?.cerita,
      data?.data?.stories,
      data?.data?.love_story,
      data?.data?.story,
      data?.data?.journey,
      data?.data?.wedding_story,
      data?.data?.wedding_stories,
      data?.data?.cerita,
      data?.data?.list_cerita,
    ];
    const rows = candidates.find((item) => Array.isArray(item)) || [];

    return rows
      .map((story: any, index: number) => {
        const date = String(story?.tanggal_cerita || story?.date || story?.tanggal || story?.year || story?.tahun || '').trim();
        const title = String(story?.title || story?.judul || story?.name || story?.nama_cerita || '').trim();
        const lead = String(
          story?.lead_cerita ||
          story?.description ||
          story?.deskripsi ||
          story?.content ||
          story?.cerita ||
          story?.isi ||
          story?.story ||
          ''
        ).trim();

        return {
          ...story,
          id: Number(story?.id ?? index + 1),
          title,
          lead_cerita: lead,
          tanggal_cerita: date,
          created_at: String(story?.created_at || ''),
        } as WeddingStory;
      })
      .filter((story: WeddingStory) => !!(story.title || story.lead_cerita || story.tanggal_cerita))
      .sort((a: any, b: any) => {
        const orderA = Number(a?.sort_order ?? a?.sortOrder ?? Number.MAX_SAFE_INTEGER);
        const orderB = Number(b?.sort_order ?? b?.sortOrder ?? Number.MAX_SAFE_INTEGER);
        if (orderA !== orderB) {
          return orderA - orderB;
        }

        const timeA = new Date(a?.tanggal_cerita || 0).getTime() || Number.MAX_SAFE_INTEGER;
        const timeB = new Date(b?.tanggal_cerita || 0).getTime() || Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      });
  }

  getLoveStories(): Array<{ year: string; title: string; description: string }> {
    const rawStories = this.getStories();

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

    return [];
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

  private getGalleryVideoThumbnailUrl(item: any): string {
    const customThumbnail = this.getSafeImageUrl([
      item?.thumbnail_url,
      item?.thumbnail,
      item?.thumb_url,
      item?.thumb,
      item?.preview_url,
      item?.cover_url,
      item?.cover,
    ], '');
    if (customThumbnail) {
      return customThumbnail;
    }

    const youtubeId = this.getYoutubeVideoId(this.getRawGalleryVideoUrl(item));
    return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '';
  }

  private getRawGalleryVideoUrl(item: any): string {
    return String(item?.url_video || item?.video_url || item?.youtube_url || item?.video || '').trim();
  }

  private getYoutubeEmbedUrl(value: string): string {
    const videoId = this.getYoutubeVideoId(value);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
  }

  private withYoutubeAutoplay(value: string): string {
    if (!value) {
      return '';
    }

    try {
      const url = new URL(value);
      url.searchParams.set('autoplay', '1');
      url.searchParams.set('mute', '1');
      url.searchParams.set('rel', '0');
      url.searchParams.set('playsinline', '1');
      return url.toString();
    } catch {
      return value;
    }
  }

  private getYoutubeVideoId(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();

      if (host === 'youtu.be') {
        return this.normalizeYoutubeVideoId(url.pathname.split('/').filter(Boolean)[0]);
      }

      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (url.pathname.startsWith('/watch')) {
          return this.normalizeYoutubeVideoId(url.searchParams.get('v') || '');
        }

        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0])) {
          return this.normalizeYoutubeVideoId(parts[1]);
        }
      }
    } catch {
      const match = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
      return this.normalizeYoutubeVideoId(match?.[1] || '');
    }

    return '';
  }

  private normalizeYoutubeVideoId(value: string | undefined | null): string {
    const id = String(value || '').trim().split(/[?&#/]/)[0];
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : '';
  }

  private isDisplayEvent(event: WeddingEvent | null | undefined): boolean {
    if (!event || typeof event !== 'object') {
      return false;
    }

    const data = event as any;
    return [
      data?.tanggal_acara,
      data?.start_acara,
      data?.tanggal,
      data?.date,
      data?.location_name,
      data?.address,
      data?.alamat,
      data?.link_maps,
      data?.google_maps_url,
    ].some((value) => String(value || '').trim());
  }

  private getDirectEventMapUrl(event: WeddingEvent | null | undefined, buttonOnly = false): string | null {
    const data = event as any;
    const buttonLinks = [
      data?.link_maps,
      data?.google_maps_url,
    ];
    const extraLinks = [
      data?.maps_url,
      data?.map_url,
      data?.google_map_url,
      data?.location_url,
      data?.url_maps,
      data?.maps_link,
    ];
    const candidates = buttonOnly ? buttonLinks : [...buttonLinks, ...extraLinks];
    const directLink = candidates.map((value) => String(value || '').trim()).find((value) => this.isValidEventMapUrl(value));

    return directLink || null;
  }

  private isValidEventMapUrl(value: string | null | undefined): boolean {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return false;
    }

    try {
      const parsed = new URL(normalized);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isValidMapEmbedUrl(value: string | null | undefined): boolean {
    const normalized = String(value || '').trim();
    if (!this.isValidEventMapUrl(normalized)) {
      return false;
    }

    return /\/maps\/embed\b|[?&]output=embed\b/i.test(normalized);
  }

  private getEventCoordinateQuery(event: WeddingEvent): string {
    const data = event as any;
    const latitude = String(data?.latitude || data?.lat || '').trim();
    const longitude = String(data?.longitude || data?.lng || data?.long || '').trim();

    return latitude && longitude ? `${latitude},${longitude}` : '';
  }

  private getMapQuery(event: WeddingEvent): string {
    const data = event as any;
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

  private copyText(value: string, successMessage = 'Data berhasil disalin', errorMessage = 'Data gagal disalin'): void {
    const text = String(value || '').trim();
    if (!text) {
      return;
    }

    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : null;
    if (clipboard?.writeText) {
      clipboard.writeText(text)
        .then(() => this.toastService.showToast(successMessage, 'success'))
        .catch(() => this.fallbackCopyText(text, successMessage, errorMessage));
      return;
    }

    this.fallbackCopyText(text, successMessage, errorMessage);
  }

  private fallbackCopyText(text: string, successMessage: string, errorMessage: string): void {
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
      this.toastService.showToast(successMessage, 'success');
    } catch {
      this.toastService.showToast(errorMessage, 'error');
    }
  }

  private getBankClipboardText(bank: any): string {
    const bankName = String(bank?.nama_bank || bank?.bank_name || bank?.bank?.name || bank?.bank?.nama_bank || bank?.bank?.kode_bank || bank?.kode_bank || '').trim();
    const accountHolder = String(bank?.nama_pemilik || bank?.atas_nama || bank?.account_holder || bank?.pemilik || bank?.owner || '').trim();
    const accountNumber = String(bank?.nomor_rekening || bank?.account_number || bank?.rekening || '').trim();

    return [bankName, accountHolder, accountNumber].filter(Boolean).join('\n');
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
