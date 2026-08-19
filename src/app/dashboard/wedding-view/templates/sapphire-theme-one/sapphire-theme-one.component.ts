import { ChangeDetectorRef, Component, HostListener, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService, DashboardServiceType } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
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
  wishPage = 1;
  readonly wishPerPage = 3;
  isSubmittingWish = false;
  hasOpened = false;
  forceOpened = false;
  selectedGalleryVideoUrl: SafeResourceUrl | null = null;
  selectedGalleryVideoTitle = '';
  selectedGalleryPhotoIndex = -1;
  isWishPageChanging = false;

  private readonly mapUrlCache = new Map<string, SafeResourceUrl>();
  private wishPageAnimationTimer: ReturnType<typeof setTimeout> | null = null;
  private lightboxTouchStartX = 0;
  private lightboxTouchStartY = 0;
  private lightboxScrollY = 0;
  private readonly lightboxSwipeThreshold = 48;

  constructor(
    private svc: DashboardService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService
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
    this.ensureValidWishPage();
  }

  override ngOnDestroy(): void {
    if (this.wishPageAnimationTimer) {
      clearTimeout(this.wishPageAnimationTimer);
      this.wishPageAnimationTimer = null;
    }

    this.unlockLightboxScroll();
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
    this.releaseScrollLocks();

    this.openInvitationRequested.emit();
    this.releaseScrollLocks();
    this.cdr.markForCheck();

    console.log('[Garden] REAL CHILD openInvitation after', {
      hasOpened: this.hasOpened,
      isInvitationOpened: this.isInvitationOpened,
      isOpening: this.isOpening,
      isCoverVisible: this.isCoverVisible,
      forceOpened: this.forceOpened,
    });

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

    const lockedScrollY = this.getLockedBodyScrollY();
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
    document.body.style.overflowY = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.touchAction = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.overflowY = '';
    document.documentElement.style.position = '';
    document.documentElement.style.top = '';
    document.documentElement.style.width = '';
    document.documentElement.style.touchAction = '';

    if (lockedScrollY > 0 && typeof window !== 'undefined') {
      window.scrollTo(0, lockedScrollY);
    }
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
    return super.getGuestName();
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
    return !!this.getYoutubeEmbedUrl(this.getRawGalleryVideoUrl(item));
  }

  getEventWeekday(event: WeddingEvent): string {
    const date = this.parseEventDate(event);
    if (!date) {
      return '';
    }
    return date.toLocaleDateString('id-ID', { weekday: 'long' });
  }

  getEventDayNumber(event: WeddingEvent): string {
    const date = this.parseEventDate(event);
    return date ? String(date.getDate()) : '';
  }

  getEventMonthYear(event: WeddingEvent): string {
    const date = this.parseEventDate(event);
    if (!date) {
      return '';
    }
    const month = date.toLocaleDateString('id-ID', { month: 'long' });
    return `${month} ${date.getFullYear()}`;
  }

  override formatTimeRange(event?: WeddingEvent | null): string {
    if (!event?.start_acara) {
      return '';
    }

    return super.formatTimeRange(event);
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

  copyAccountNumber(bank: any): void {
    this.copyText(this.getBankClipboardText(bank), 'Data rekening berhasil disalin', 'Data rekening gagal disalin');
  }

  getDisplayedWishes(): GuestWish[] {
    return this.getGuestWishes()
      .filter((item) => this.isRealGuestWish(item));
  }

  get paginatedWishes(): GuestWish[] {
    const wishes = this.getDisplayedWishes();
    const validPage = this.getValidWishPage();
    const start = (validPage - 1) * this.wishPerPage;

    return wishes.slice(start, start + this.wishPerPage);
  }

  get wishTotalPages(): number {
    return Math.ceil(this.getDisplayedWishes().length / this.wishPerPage);
  }

  get wishPaginationItems(): Array<number | 'ellipsis'> {
    const totalPages = this.wishTotalPages;
    const currentPage = this.getValidWishPage();

    if (totalPages <= 4) {
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
    const totalPages = this.wishTotalPages;

    if (page < 1 || page > totalPages || page === this.wishPage) {
      return;
    }

    this.wishPage = page;
    this.playWishPageTransition();
    this.cdr.markForCheck();
  }

  goToPreviousWishPage(): void {
    this.goToWishPage(this.wishPage - 1);
  }

  goToNextWishPage(): void {
    this.goToWishPage(this.wishPage + 1);
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
    const domain = this.getInvitationDomain();
    const payload = {
      user_id: userId || 0,
      domain,
      nama: this.wishForm.nama.trim(),
      pesan: this.wishForm.pesan.trim(),
      kehadiran: this.wishForm.kehadiran || 'hadir',
    };

    if (isThemePreviewWeddingData(this.weddingData)) {
      this.weddingData = appendPreviewGuestWish(this.weddingData as any, payload);
      this.wishPage = 1;
      this.wishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
      return;
    }

    if (!userId) {
      return;
    }
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
            guest_wishes: [
              nextWish,
              ...currentWishes.filter((wish) => this.getWishIdentity(wish) !== this.getWishIdentity(nextWish)),
            ],
          };
        }

        this.wishPage = 1;
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

  getGalleryPhotos(): GalleryItem[] {
    return this.getGalleryItems().filter((item) => {
      if ((item as any)?.status === false) {
        return false;
      }

      if (this.hasGalleryVideo(item)) {
        return false;
      }

      const photoUrl = this.getGalleryPhotoUrl(item);
      return !!photoUrl;
    });
  }

  override hasGallery(): boolean {
    return this.getGalleryPhotos().length > 0 || !!this.getFeaturedGalleryVideoItem();
  }

  override getFeaturedGalleryItem(): GalleryItem | null {
    return this.getFeaturedGalleryVideoItem();
  }

  override getGalleryGridItems(): GalleryItem[] {
    return this.getGalleryPhotos();
  }

  getGalleryLightboxPhotos(): GalleryItem[] {
    return this.getGalleryPhotos();
  }

  override getGalleryPhotoUrl(item: any): string {
    return resolveInvitationPhotoUrl(item);
  }

  getFeaturedGalleryVideoItem(): GalleryItem | null {
    return this.getGalleryItems().find((item: any) => item?.status !== false && this.hasGalleryVideo(item)) || null;
  }

  getGalleryVideoCoverUrl(item: any): string {
    const photoUrl = resolveInvitationPhotoUrl(item);
    if (photoUrl) {
      return photoUrl;
    }

    return this.getGalleryVideoThumbnailUrl(item);
  }

  openGalleryVideo(item: any): void {
    const embedUrl = this.getYoutubeEmbedUrl(this.getRawGalleryVideoUrl(item));
    if (!embedUrl) {
      return;
    }

    this.selectedGalleryVideoTitle = item?.description || item?.nama_foto || 'Video undangan';
    this.selectedGalleryVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.withYoutubeAutoplay(embedUrl));
  }

  closeGalleryVideo(): void {
    this.selectedGalleryVideoUrl = null;
    this.selectedGalleryVideoTitle = '';
  }

  get isGalleryLightboxOpen(): boolean {
    return this.selectedGalleryPhotoIndex >= 0 && this.getGalleryLightboxPhotos().length > 0;
  }

  get selectedGalleryPhoto(): GalleryItem | null {
    const photos = this.getGalleryLightboxPhotos();
    return photos[this.selectedGalleryPhotoIndex] || null;
  }

  openGalleryPhoto(index: number): void {
    const photos = this.getGalleryLightboxPhotos();

    if (index < 0 || index >= photos.length) {
      return;
    }

    this.selectedGalleryPhotoIndex = index;
    this.lockLightboxScroll();
  }

  closeGalleryPhoto(): void {
    this.selectedGalleryPhotoIndex = -1;
    this.unlockLightboxScroll();
  }

  showPreviousGalleryPhoto(): void {
    const total = this.getGalleryLightboxPhotos().length;

    if (!total) {
      return;
    }

    this.selectedGalleryPhotoIndex = (this.selectedGalleryPhotoIndex - 1 + total) % total;
  }

  showNextGalleryPhoto(): void {
    const total = this.getGalleryLightboxPhotos().length;

    if (!total) {
      return;
    }

    this.selectedGalleryPhotoIndex = (this.selectedGalleryPhotoIndex + 1) % total;
  }

  onGalleryLightboxTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    this.lightboxTouchStartX = touch.clientX;
    this.lightboxTouchStartY = touch.clientY;
  }

  onGalleryLightboxTouchEnd(event: TouchEvent): void {
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
      this.showNextGalleryPhoto();
      return;
    }

    this.showPreviousGalleryPhoto();
  }

  @HostListener('document:keydown', ['$event'])
  onGalleryLightboxKeydown(event: KeyboardEvent): void {
    if (!this.isGalleryLightboxOpen) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeGalleryPhoto();
      return;
    }

    if (event.key === 'ArrowLeft') {
      this.showPreviousGalleryPhoto();
      return;
    }

    if (event.key === 'ArrowRight') {
      this.showNextGalleryPhoto();
    }
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
    const separator = value.includes('?') ? '&' : '?';
    return `${value}${separator}autoplay=1&mute=1&rel=0&playsinline=1`;
  }

  private getYoutubeVideoId(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        return this.normalizeYoutubeVideoId(url.pathname.replace(/^\//, ''));
      }

      if (host.endsWith('youtube.com')) {
        if (url.pathname === '/watch') {
          return this.normalizeYoutubeVideoId(url.searchParams.get('v'));
        }

        const match = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/);
        return this.normalizeYoutubeVideoId(match?.[1] || '');
      }
    } catch {
      const match = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
      return this.normalizeYoutubeVideoId(match?.[1] || '');
    }

    return '';
  }

  private normalizeYoutubeVideoId(value: string | null | undefined): string {
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
    return [
      this.getEventAddress(event),
      this.getDetailEventVenue(event),
    ].map((value) => String(value || '').trim())
      .filter((value) => !!value && !/menyusul|diumumkan/i.test(value))
      .join(', ');
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
    const bankName = String(bank?.nama_bank || bank?.bank_name || bank?.bank?.name || bank?.bank?.nama_bank || '').trim();
    const accountHolder = String(bank?.nama_pemilik || bank?.atas_nama || bank?.account_holder || bank?.pemilik || bank?.owner || '').trim();
    const accountNumber = String(bank?.nomor_rekening || bank?.account_number || bank?.rekening || '').trim();

    return [bankName, accountHolder, accountNumber].filter(Boolean).join('\n');
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

  private ensureValidWishPage(): void {
    const validPage = this.getValidWishPage();

    if (this.wishPage !== validPage) {
      this.wishPage = validPage;
    }
  }

  private getValidWishPage(): number {
    const totalPages = this.wishTotalPages;

    if (totalPages <= 1) {
      return 1;
    }

    return Math.min(Math.max(this.wishPage, 1), totalPages);
  }

  private playWishPageTransition(): void {
    if (this.wishPageAnimationTimer) {
      clearTimeout(this.wishPageAnimationTimer);
    }

    this.isWishPageChanging = true;
    this.wishPageAnimationTimer = setTimeout(() => {
      this.isWishPageChanging = false;
      this.wishPageAnimationTimer = null;
      this.cdr.markForCheck();
    }, 420);
  }

  private lockLightboxScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.lightboxScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.lightboxScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    document.body.style.overflowY = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overflowY = 'hidden';
  }

  private unlockLightboxScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const scrollY = this.lightboxScrollY || this.getLockedBodyScrollY();
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.overflowY = '';
    document.body.style.touchAction = '';
    document.documentElement.style.overflow = '';
    document.documentElement.style.overflowY = '';
    document.documentElement.style.touchAction = '';

    if (scrollY > 0) {
      window.scrollTo(0, scrollY);
    }
  }

  private getLockedBodyScrollY(): number {
    if (typeof document === 'undefined') {
      return 0;
    }

    if (document.body.style.position !== 'fixed') {
      return 0;
    }

    const top = Number.parseFloat(document.body.style.top || '0');
    return Number.isFinite(top) && top < 0 ? Math.abs(top) : 0;
  }

  private getWishIdentity(wish: GuestWish): string {
    const id = (wish as any)?.id;

    if (id) {
      return `id:${id}`;
    }

    return [
      (wish as any)?.nama || '',
      (wish as any)?.pesan || '',
      (wish as any)?.created_at || '',
    ].join('|').toLowerCase();
  }
}
