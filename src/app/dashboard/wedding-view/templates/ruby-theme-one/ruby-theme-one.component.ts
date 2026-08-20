import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnChanges, OnDestroy, OnInit, Optional, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  BankAccount,
  GalleryItem,
  GuestWish,
  MempelaiPerson,
  WeddingData,
  WeddingEvent,
} from '../../../../services/wedding-data.service';
import { LavenderBloomThemeComponent } from '../../themes/lavender-bloom/lavender-bloom-theme.component';
import { DashboardService, DashboardServiceType } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
import { Subscription } from 'rxjs';
import {
  logInvitationImageError,
  getYoutubeThumbnailUrl as resolveYoutubeThumbnailUrl,
  normalizeInvitationMediaUrl,
  resolveInvitationPhotoUrl,
  resolveInvitationVideoUrl,
} from '../../../../shared/user-photo.model';
import {
  appendPreviewGuestWish,
  isThemePreviewWeddingData,
} from '../../../../shared/data/theme-preview-dummy.data';
import { normalizeYoutubeEmbedUrl } from '../../../../shared/wedding-theme-data.util';

interface AttendanceRequest {
  user_id: number;
  domain: string;
  nama: string;
  kehadiran: 'hadir' | 'tidak_hadir' | 'mungkin';
  pesan: string;
}

interface RubyWishForm {
  nama: string;
  kehadiran: 'hadir' | 'mungkin' | 'tidak_hadir' | '';
  pesan: string;
}

interface RubyLoveStoryItem {
  id: string | number;
  year: string;
  title: string;
  description: string;
}

type RubyCaptionDirection = 'down' | 'up';

@Component({
  selector: 'wc-ruby-theme-one',
  templateUrl: './ruby-theme-one.component.html',
  styleUrls: ['./ruby-theme-one.component.scss'],
})
export class RubyThemeOneComponent extends LavenderBloomThemeComponent implements OnInit, OnChanges, OnDestroy, AfterViewInit {
  readonly floralAssetLeft = 'assets/thema-1/flower-1.png';
  readonly floralAssetRight = 'assets/thema-1/flower-2.png';
  readonly craftedByLabel = 'crafted by Sena Digital';
  receptionEvent: any;
  safeMapEmbedUrl?: SafeResourceUrl;
  googleMapsUrl = '';
  receptionVenueName = '';
  receptionAddress = '';
  selectedGalleryVideoUrl: SafeResourceUrl | null = null;
  selectedGalleryVideoDirectUrl = '';
  selectedGalleryVideoTitle = '';
  selectedGalleryVideoType: 'youtube' | 'video' | '' = '';
  selectedGalleryPhotoUrl = '';
  selectedGalleryPhotoTitle = '';
  loveStoryItems: RubyLoveStoryItem[] = [];
  activeGalleryIndex = 0;
  countdownDays = '00';
  countdownHours = '00';
  countdownMinutes = '00';
  countdownSeconds = '00';

  wishForm: RubyWishForm = {
    nama: '',
    kehadiran: '',
    pesan: '',
  };

  isSubmittingWish = false;
  override isOpening = false;
  hasOpened = false;

  private readonly subscriptions = new Subscription();
  private openingTimer: any;
  private countdownTimer?: any;
  private captionObserver?: IntersectionObserver;
  private captionMutationObserver?: MutationObserver;
  private captionObservedElements = new Set<HTMLElement>();
  private captionScrollRoot: HTMLElement | null = null;
  private captionScrollCleanup?: () => void;
  private captionRefreshTimer?: any;
  private captionScrollRaf = 0;
  private captionDirection: RubyCaptionDirection = 'down';
  private captionLastScrollTop = 0;
  private readonly rubyMapEmbedUrlCache = new Map<string, SafeResourceUrl>();
  private galleryDragStartX = 0;
  private galleryDragStartScrollLeft = 0;
  private galleryIsDragging = false;
  private galleryDidDrag = false;

  constructor(
    private sanitizer: DomSanitizer,
    private dashboardService: DashboardService,
    private toastService: ToastService,
    @Optional() private elementRef?: ElementRef<HTMLElement>,
    @Optional() private ngZone?: NgZone
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.setupRubyReceptionFromEvents();
    this.initCountdown();
    this.setupLoveStory();
    if (this.invitationOpened) {
      this.hasOpened = true;
    }
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);
    if (changes['weddingData']) {
      this.setupRubyReceptionFromEvents();
      this.initCountdown();
      this.setupLoveStory();
      this.activeGalleryIndex = 0;
      this.scheduleRubyCaptionMotionRefresh();
    }
  }

  ngAfterViewInit(): void {
    if (!this.elementRef || !this.ngZone) {
      return;
    }

    const hostElement = this.elementRef.nativeElement;
    this.ngZone.runOutsideAngular(() => {
      this.scheduleRubyCaptionMotionRefresh();
      this.captionMutationObserver = new MutationObserver(() => this.scheduleRubyCaptionMotionRefresh());
      this.captionMutationObserver.observe(hostElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  override openInvitation(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.isOpening || this.hasOpened) {
      return;
    }

    this.isOpening = true;
    this.hasOpened = true;
    this.isInvitationOpened = true;
    this.openInvitationRequested.emit();

    console.log('[Soft Ivory] after', {
      hasOpened: this.hasOpened,
      isOpening: this.isOpening,
      isInvitationOpened: this.isInvitationOpened,
    });

    this.openingTimer = setTimeout(() => {
      this.isOpening = false;
      this.scheduleRubyCaptionMotionRefresh();
    }, 850);
  }

  override ngOnDestroy(): void {
    if (this.openingTimer) {
      clearTimeout(this.openingTimer);
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
    if (this.captionRefreshTimer) {
      clearTimeout(this.captionRefreshTimer);
    }
    if (this.captionScrollRaf) {
      cancelAnimationFrame(this.captionScrollRaf);
    }
    this.captionObserver?.disconnect();
    this.captionMutationObserver?.disconnect();
    this.captionScrollCleanup?.();
    this.subscriptions.unsubscribe();
    super.ngOnDestroy();
  }

  @HostListener('document:keydown.escape')
  onEscapeGalleryVideo(): void {
    this.closeGalleryVideo();
    this.closeGalleryPhoto();
  }

  override getGuestName(): string {
    return super.getGuestName();
  }

  getDisplayCoupleNames(): { first: string; second: string } {
    return {
      first: this.getPrimaryDisplayName(),
      second: this.getSecondaryDisplayName(),
    };
  }

  getPrimaryDisplayName(): string {
    return this.getGroomNickname() || 'Ketut';
  }

  getSecondaryDisplayName(): string {
    return this.getBrideNickname() || 'Isabela';
  }

  getBrideParents(): string {
    return this.getParentsText(this.getBride(), 'wanita');
  }

  getGroomParents(): string {
    return this.getParentsText(this.getGroom(), 'pria');
  }

  getBrideInstagram(): string | null {
    return this.extractInstagram(this.getBride());
  }

  getGroomInstagram(): string | null {
    return this.extractInstagram(this.getGroom());
  }

  override getCoverPhoto(): string {
    const featuredGalleryPhoto = this.getFeaturedGalleryItem();
    const featuredGalleryUrl = featuredGalleryPhoto ? this.getGalleryPhotoUrl(featuredGalleryPhoto) : '';
    const coverPhoto = this.getSafeImageUrl([
      featuredGalleryUrl,
      (this.weddingData as any)?.cover_photo_url,
      (this.weddingData as any)?.mempelai?.cover_photo_url,
      this.weddingData?.mempelai?.cover_photo,
      (this.weddingData as any)?.cover_photo,
    ], '');
    console.log('[RubyCoverPhoto]', coverPhoto);
    return coverPhoto;
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
    const photos = this.getGalleryItems().filter((item) => {
      if (this.isValidGalleryVideoItem(item)) {
        return false;
      }

      const photoUrl = this.getGalleryPhotoUrl(item);
      return !!photoUrl && !this.isUnsafeThemeImage(photoUrl);
    });

    return photos;
  }

  override hasGallery(): boolean {
    return this.galleryPhotoItems.length > 0 || this.getGalleryVideoItems().length > 0;
  }

  get galleryPhotos(): GalleryItem[] {
    return this.galleryPhotoItems;
  }


  get galleryPhotoItems(): GalleryItem[] {
    const photos = this.getGalleryItems();
    return photos.filter((item) => {
      if (this.isValidGalleryVideoItem(item)) {
        return false;
      }

      const photoUrl = this.getGalleryPhotoUrl(item);
      return !!photoUrl && !this.isUnsafeThemeImage(photoUrl);
    });
  }

  private setupLoveStory(): void {
  const data: any = this.weddingData || {};

  const rawStories =
    data?.love_story ??
    data?.love_stories ??
    data?.stories ??
    data?.story ??
    data?.journey ??
    data?.cerita_cinta ??
    [];

  const stories = Array.isArray(rawStories)
    ? rawStories
    : Array.isArray(rawStories?.data)
      ? rawStories.data
      : rawStories
        ? [rawStories]
        : [];

  this.loveStoryItems = stories
      .map((item: any, index: number): RubyLoveStoryItem => {
        return {
          id: item?.id ?? item?.uuid ?? index,

          year: String(
            item?.year ??
            item?.tahun ??
            item?.date ??
            item?.tanggal ??
            ''
          ).trim(),

          title: String(
            item?.title ??
            item?.judul ??
            item?.judul_cerita ??
            item?.nama_cerita ??
            item?.name ??
            ''
          ).trim(),

          description: String(
            item?.description ??
            item?.deskripsi ??
            item?.content ??
            item?.cerita ??
            item?.story ??
            ''
          ).trim(),
        };
      })
      .filter((item: RubyLoveStoryItem) =>
        !!item.year ||
        !!item.title ||
        !!item.description
      );
  }

  trackByLoveStory(
    index: number,
    item: RubyLoveStoryItem
  ): string | number {
    return item.id ?? index;
  }

  get mainGalleryPhoto(): GalleryItem | null {
    return this.galleryPhotoItems[0] || null;
  }

  get galleryThumbs(): GalleryItem[] {
    const main = this.mainGalleryPhoto;
    return this.galleryPhotoItems.filter((item) => !main || item.id !== main.id);
  }

  getGalleryCarouselItems(): GalleryItem[] {
    return this.galleryPhotoItems;
  }

  getGalleryActiveNumber(): string {
    const total = this.getGalleryCarouselItems().length;
    const current = total ? Math.min(this.activeGalleryIndex + 1, total) : 0;
    return String(current).padStart(2, '0');
  }

  getGalleryTotalNumber(): string {
    return String(this.getGalleryCarouselItems().length).padStart(2, '0');
  }

  override getFeaturedGalleryItem(): GalleryItem | null {
    return this.getSafeGalleryPhotos()[0] || null;
  }

  override getGalleryGridItems(): GalleryItem[] {
    return this.getSafeGalleryPhotos().slice(1, 5);
  }

  getGalleryCollection(): GalleryItem[] {
    return this.getSafeGalleryPhotos().slice(0, 5);
  }

  hasVideo(item: any): boolean {
    return this.isValidGalleryVideoItem(item);
  }

  getGalleryDisplayImageUrl(item: any): string {
    if (this.hasVideo(item)) {
      return this.getGalleryVideoCoverUrl(item);
    }

    const photoUrl = this.getGalleryPhotoUrl(item);
    if (photoUrl && !this.isUnsafeThemeImage(photoUrl)) {
      return photoUrl;
    }

    return '';
  }

  getGalleryVideoItems(): GalleryItem[] {
    return this.getGalleryItems().filter((item) => this.isValidGalleryVideoItem(item));
  }

  getGalleryVideoCoverUrl(item: any): string {
    const photoUrl = this.getGalleryPhotoUrl(item);
    if (photoUrl && !this.isUnsafeThemeImage(photoUrl)) {
      return photoUrl;
    }

    return this.getGalleryCustomThumbnailUrl(item) || this.getGalleryYoutubeThumbnailUrl(item);
  }

  isValidGalleryVideoItem(item: any): boolean {
    return !!this.getGalleryVideoUrl(item);
  }

  override getGalleryPhotoUrl(item: any): string {
    const resolved = resolveInvitationPhotoUrl(item);
    return resolved;
  }

  openGalleryVideo(item: any): void {
    const videoUrl = this.getGalleryVideoUrl(item);

    if (!videoUrl) {
      return;
    }

    this.selectedGalleryVideoTitle = item?.description || item?.nama_foto || 'Video undangan';

    if (this.isDirectVideoUrl(videoUrl)) {
      this.selectedGalleryVideoDirectUrl = videoUrl;
      this.selectedGalleryVideoUrl = null;
      this.selectedGalleryVideoType = 'video';
      return;
    }

    this.selectedGalleryVideoDirectUrl = '';
    this.selectedGalleryVideoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.withYoutubeAutoplay(videoUrl));
    this.selectedGalleryVideoType = 'youtube';
  }

  openGalleryItem(item: any): void {
    if (this.galleryDidDrag) {
      this.galleryDidDrag = false;
      return;
    }

    if (this.hasVideo(item)) {
      this.openGalleryVideo(item);
      return;
    }

    const photoUrl = this.getGalleryPhotoUrl(item);
    if (!photoUrl) {
      return;
    }

    this.selectedGalleryPhotoUrl = photoUrl;
    this.selectedGalleryPhotoTitle = item?.description || item?.nama_foto || 'Foto galeri';
  }

  closeGalleryVideo(): void {
    this.selectedGalleryVideoUrl = null;
    this.selectedGalleryVideoDirectUrl = '';
    this.selectedGalleryVideoTitle = '';
    this.selectedGalleryVideoType = '';
  }

  closeGalleryPhoto(): void {
    this.selectedGalleryPhotoUrl = '';
    this.selectedGalleryPhotoTitle = '';
  }

  scrollGalleryCarousel(direction: -1 | 1): void {
    const track = this.elementRef?.nativeElement.querySelector<HTMLElement>('.ruby-gallery-track');
    if (!track) {
      return;
    }

    const firstSlide = track.querySelector<HTMLElement>('.ruby-gallery-slide');
    const step = firstSlide ? firstSlide.offsetWidth + 14 : track.clientWidth * 0.86;
    track.scrollBy({ left: direction * step, behavior: this.prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  onGalleryCarouselScroll(event: Event): void {
    const track = event.currentTarget as HTMLElement;
    const slides = Array.from(track.querySelectorAll<HTMLElement>('.ruby-gallery-slide'));
    if (!slides.length) {
      this.activeGalleryIndex = 0;
      return;
    }

    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(slideCenter - trackCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    this.activeGalleryIndex = closestIndex;
  }

  onGalleryPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') {
      return;
    }

    const track = event.currentTarget as HTMLElement;
    this.galleryIsDragging = true;
    this.galleryDidDrag = false;
    this.galleryDragStartX = event.clientX;
    this.galleryDragStartScrollLeft = track.scrollLeft;
    track.setPointerCapture?.(event.pointerId);
  }

  onGalleryPointerMove(event: PointerEvent): void {
    if (!this.galleryIsDragging || event.pointerType !== 'mouse') {
      return;
    }

    const track = event.currentTarget as HTMLElement;
    const delta = event.clientX - this.galleryDragStartX;
    if (Math.abs(delta) > 6) {
      this.galleryDidDrag = true;
    }
    track.scrollLeft = this.galleryDragStartScrollLeft - delta;
  }

  onGalleryPointerUp(): void {
    this.galleryIsDragging = false;
  }

  getGalleryVideoUrl(item: any): string {
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
      ''
    ).trim();

    const youtubeEmbedUrl = this.getYoutubeEmbedUrl(rawVideoUrl);
    if (youtubeEmbedUrl) {
      return youtubeEmbedUrl;
    }

    const resolvedVideoUrl = resolveInvitationVideoUrl(item);
    const resolvedYoutubeEmbedUrl = this.getYoutubeEmbedUrl(resolvedVideoUrl);
    return resolvedYoutubeEmbedUrl || '';
  }

  private getGalleryYoutubeThumbnailUrl(item: any): string {
    const rawVideoUrl = this.getRawGalleryVideoUrl(item);
    const sharedThumbnail = resolveYoutubeThumbnailUrl(rawVideoUrl);
    if (sharedThumbnail) {
      return sharedThumbnail;
    }

    const videoId = this.getYoutubeVideoId(rawVideoUrl);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  private getGalleryCustomThumbnailUrl(item: any): string {
    const candidates = [
      item?.thumbnail_url,
      item?.thumbnail,
      item?.thumb_url,
      item?.thumb,
      item?.preview_url,
      item?.cover_url,
      item?.cover,
    ];

    for (const candidate of candidates) {
      const thumbnail = this.normalizeMediaUrl(candidate);
      if (thumbnail) {
        return thumbnail;
      }
    }

    return '';
  }

  private getGalleryItemKey(item: any): string {
    return String(
      item?.id ||
      item?.uuid ||
      item?.photo_url ||
      item?.image_url ||
      item?.url ||
      item?.url_video ||
      item?.video_url ||
      item?.youtube_url ||
      ''
    );
  }

  private getRawGalleryVideoUrl(item: any): string {
    return String(
      item?.youtube_url ||
      item?.youtube_link ||
      item?.link_youtube ||
      item?.video_url ||
      item?.url_video ||
      item?.link_video ||
      item?.youtube ||
      ''
    ).trim();
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
      const looseMatch = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/);
      return this.normalizeYoutubeVideoId(looseMatch?.[1] || '');
    }

    return '';
  }

  private normalizeYoutubeVideoId(value: string | undefined | null): string {
    const id = String(value || '').trim().split(/[?&#/]/)[0];
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : '';
  }

  private getYoutubeEmbedUrl(value: string): string {
    const raw = String(value || '').trim();

    if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(raw)) {
      return '';
    }

    return normalizeYoutubeEmbedUrl(raw);
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

  private isDirectVideoUrl(value: string): boolean {
    return /^https?:\/\//i.test(value) && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(value);
  }

  onGalleryImageError(event: Event): void {
    this.onImageError(event);
  }

  override onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    logInvitationImageError(event, 'ruby-theme-one');
    img.style.display = 'none';
  }

  override getOpeningHeading(): string {
    return super.getOpeningHeading();
  }


  getQuoteText(): string {
    return this.getReligionQuoteText()
      || ((this.weddingData?.quotes || []).find((item) => item?.qoute)?.qoute || '').trim();
  }

  getQuoteSource(): string {
    const quote = (this.weddingData?.quotes || []).find((item) => item?.qoute) as any;
    return this.getReligionQuoteSource() || (
      quote?.source
      || quote?.reference
      || quote?.referensi
      || quote?.ayat
      || quote?.surat
      || ''
    ).trim();
  }

  getShortQuote(value: string | undefined | null): string {
    if (!value) {
      return '';
    }

    const text = value.replace(/^["“”]+|["“”]+$/g, '').trim();
    return text.length > 150 ? text.slice(0, 147).trim() + '...' : text;
  }

  getQuoteName(): string {
    const quote = (this.weddingData?.quotes || []).find((item) => item?.qoute) as any;
    return this.getReligionQuoteSource() || (quote?.name || '').trim();
  }

  getQuranQuote(): string {
    const quote = (this.weddingData?.quotes || []).find((item) => item?.qoute);
    return this.getReligionQuoteText(
      quote?.qoute
      || 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu cenderung dan merasa tenteram kepadanya, dan dijadikan-Nya di antaramu rasa kasih dan sayang.'
    );
  }

  getQuranSource(): string {
    return this.getReligionQuoteSource('QS. Ar-Rum: 21');
  }

  getBrideParentLine(): string {
    return this.getBrideParents() || 'Putri dari Bapak & Ibu tercinta';
  }

  getGroomParentLine(): string {
    return this.getGroomParents() || 'Putra dari Bapak & Ibu tercinta';
  }

  getAkadCard(): WeddingEvent {
    return this.getAkadEvent() || this.createFallbackEvent('Akad Nikah', 'Masjid Agung Al-Hikmah');
  }

  getReceptionCard(): WeddingEvent {
    return this.getReceptionEvent() || this.createFallbackEvent('Resepsi', 'The LaFaYe Hotel');
  }

  getEventVenue(event: WeddingEvent): string {
    const data = event as any;
    return data?.nama_lokasi ||
      data?.venue ||
      data?.venue_name ||
      data?.location_name ||
      data?.tempat ||
      data?.nama_tempat ||
      event.nama_acara ||
      'Lokasi acara';
  }

  getEventAddress(event: WeddingEvent): string {
    const data = event as any;
    return data?.address || event.alamat || data?.location_name || 'Alamat acara akan diumumkan segera.';
  }

  getRubyEventCards(): WeddingEvent[] {
    return this.getEvents().filter((event) => !!event);
  }

  getRubyLocationEvents(): WeddingEvent[] {
    return this.getRubyEventCards().filter((event) => {
      const address = this.getEventAddress(event);
      const venue = this.getEventVenue(event);
      const mapUrl = this.getRubyGoogleMapsUrl(event);
      return !!(mapUrl || address || venue);
    });
  }

  getEventDisplayTitle(event: WeddingEvent): string {
    const data = event as any;
    const raw = String(data?.jenis_acara || data?.type || '').trim();
    if (raw) {
      return this.toTitleCase(raw.replace(/[_-]+/g, ' '));
    }

    const name = String(event?.nama_acara || '').trim();
    if (/akad|nikah|pemberkatan/i.test(name)) {
      return 'Akad Nikah';
    }
    if (/resepsi|reception|ngunduh/i.test(name)) {
      return 'Resepsi';
    }
    return name || 'Acara';
  }

  getRubyGoogleMapsUrl(event: WeddingEvent): string {
    return this.getEventMapUrl(event) || '';
  }

  getRubySafeMapEmbedUrl(event: WeddingEvent): SafeResourceUrl | null {
    const mapQuery = this.getEventAddress(event) || this.getEventVenue(event);
    if (!mapQuery) {
      return null;
    }

    const cacheKey = `${event?.id || this.getEventDisplayTitle(event)}:${mapQuery}`;
    if (!this.rubyMapEmbedUrlCache.has(cacheKey)) {
      const embed = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed`;
      this.rubyMapEmbedUrlCache.set(cacheKey, this.sanitizer.bypassSecurityTrustResourceUrl(embed));
    }

    return this.rubyMapEmbedUrlCache.get(cacheKey) || null;
  }

  trackByRubyEvent(index: number, event: WeddingEvent): number | string {
    return event?.id || `${event?.nama_acara || 'event'}-${index}`;
  }

  private toTitleCase(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  getLocationVenue(): string {
    return this.receptionVenueName;
  }

  getLocationAddressText(): string {
    return this.receptionAddress;
  }

  getMapPreviewLabel(): string {
    return this.getMapsLink() ? 'Peta lokasi resepsi' : 'Lokasi akan segera diperbarui';
  }

  getCountdownHeading(): string {
    return 'MENUJU HARI SPESIAL KAMI';
  }

  getWeddingGiftIntro(): string {
    return 'Doa restu Anda adalah hadiah terindah bagi kami. Namun jika ingin berbagi tanda kasih, dapat melalui rekening berikut.';
  }

  getVisibleBankAccounts(): BankAccount[] {
    return Array.isArray(this.weddingData?.bank_accounts)
      ? this.weddingData?.bank_accounts.slice(0, 2) || []
      : [];
  }

  getDisplayedWishes(): GuestWish[] {
    return this.visibleGuestWishes.slice(0, 8);
  }

  get visibleGuestWishes(): GuestWish[] {
    const wishes = this.getGuestWishes();
    return wishes.filter((item: GuestWish) => this.isRealGuestWish(item));
  }

  isRealGuestWish(item: any): boolean {
    const name = String(item?.nama || item?.name || '').trim().toLowerCase();
    const message = String(item?.pesan || item?.message || '').trim();
    const normalizedMessage = message.toLowerCase();

    if (!message) {
      return false;
    }

    if (name === 'viewer') {
      return false;
    }

    if (
      normalizedMessage.startsWith('undangan ') &&
      normalizedMessage.endsWith(' telah dilihat')
    ) {
      return false;
    }

    return true;
  }

  submitWish(): void {
    if (!this.isWishFormValid()) {
      this.toastService.showToast('Mohon lengkapi nama, kehadiran, dan ucapan.', 'warning');
      return;
    }

    this.isSubmittingWish = true;
    const domain = this.getInvitationDomain();

    const payload: AttendanceRequest = {
      user_id: this.weddingData?.user_info?.id || 0,
      domain,
      nama: this.wishForm.nama.trim(),
      kehadiran: this.wishForm.kehadiran as 'hadir' | 'mungkin' | 'tidak_hadir',
      pesan: this.wishForm.pesan.trim(),
    };

    if (isThemePreviewWeddingData(this.weddingData)) {
      this.weddingData = appendPreviewGuestWish(this.weddingData!, payload);
      this.toastService.showToast('Ucapan preview ditambahkan', 'success');
      this.wishForm = { nama: '', kehadiran: '', pesan: '' };
      this.isSubmittingWish = false;
      return;
    }

    if (!domain) {
      this.toastService.showToast('Domain undangan tidak tersedia untuk mengirim ucapan.', 'error');
      this.isSubmittingWish = false;
      return;
    }

    if (!this.weddingData?.user_info?.id) {
      this.toastService.showToast('Data undangan belum lengkap untuk mengirim ucapan.', 'error');
      this.isSubmittingWish = false;
      return;
    }

    const attendanceSubscription = this.dashboardService.create(
      DashboardServiceType.ATTENDANCE,
      payload
    ).subscribe({
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
          } as WeddingData;
        }

        this.wishSubmitted.emit(nextWish);
        this.toastService.showToast('Ucapan berhasil dikirim', 'success');
        this.wishForm = { nama: '', kehadiran: '', pesan: '' };
        this.isSubmittingWish = false;
      },
      error: (error) => {
        const message = error?.error?.message || 'Gagal mengirim ucapan. Silakan coba lagi.';
        this.toastService.showToast(message, 'error');
        this.isSubmittingWish = false;
      }
    });

    this.subscriptions.add(attendanceSubscription);
  }

  copyAccountNumber(bank: any): void {
    const accountText = this.getBankClipboardText(bank);
    if (!accountText) {
      this.toastService.showToast('Nomor rekening tidak tersedia.', 'warning');
      return;
    }

    const copyAction = navigator?.clipboard?.writeText(accountText);
    if (copyAction) {
      copyAction
        .then(() => this.toastService.showToast('Data rekening berhasil disalin', 'success'))
        .catch(() => this.fallbackCopy(accountText));
      return;
    }

    this.fallbackCopy(accountText);
  }

  getAttendanceLabel(value: string): string {
    if (value === 'hadir') return 'Hadir';
    if (value === 'mungkin') return 'Mungkin';
    if (value === 'tidak_hadir') return 'Tidak Hadir';
    return 'Ucapan';
  }

  getOpeningDateLabel(): string {
    const event = this.getPrimaryEvent() || this.createFallbackEvent('Resepsi', 'The LaFaYe Hotel');
    return this.formatOpeningDate(event.tanggal_acara);
  }

  private scheduleRubyCaptionMotionRefresh(): void {
    if (this.captionRefreshTimer) {
      clearTimeout(this.captionRefreshTimer);
    }

    this.captionRefreshTimer = setTimeout(() => this.setupRubyCaptionMotion(), 40);
  }

  private setupRubyCaptionMotion(): void {
    if (!this.elementRef) {
      return;
    }

    const captions = Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>('.ruby-caption[data-caption-motion]')
    );

    if (!captions.length) {
      return;
    }

    if (this.prefersReducedMotion()) {
      this.captionObserver?.disconnect();
      this.captionObservedElements.clear();
      captions.forEach((caption) => {
        caption.classList.remove('ruby-caption--ready', 'ruby-caption--down', 'ruby-caption--up');
        caption.classList.add('ruby-caption--visible');
      });
      return;
    }

    const nextRoot = this.resolveRubyCaptionScrollRoot(captions[0]);
    if (!this.captionObserver || nextRoot !== this.captionScrollRoot) {
      this.captionObserver?.disconnect();
      this.captionObservedElements.clear();
      this.captionScrollRoot = nextRoot;
      this.captionObserver = new IntersectionObserver(
        (entries) => this.onRubyCaptionIntersections(entries),
        {
          root: this.captionScrollRoot,
          rootMargin: '-10% 0px -18% 0px',
          threshold: [0, 0.22, 0.3],
        }
      );
      this.setupRubyCaptionScrollDirection();
    }

    captions.forEach((caption) => {
      caption.classList.add('ruby-caption--ready');
      if (!this.captionObservedElements.has(caption)) {
        this.captionObserver?.observe(caption);
        this.captionObservedElements.add(caption);
      }
    });
  }

  private onRubyCaptionIntersections(entries: IntersectionObserverEntry[]): void {
    entries.forEach((entry) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.12) {
        return;
      }

      const caption = entry.target as HTMLElement;

      if (!caption.classList.contains('ruby-caption--visible')) {
        this.playRubyCaptionAnimation(caption);
      }

      // Setelah tampil, jangan diamati lagi.
      this.captionObserver?.unobserve(caption);
    });
  }

  private playRubyCaptionAnimation(caption: HTMLElement): void {
    caption.classList.remove(
      'ruby-caption--down',
      'ruby-caption--up'
    );

    caption.classList.add(
      `ruby-caption--${this.captionDirection}`,
      'ruby-caption--visible'
    );
  }



  private setupRubyCaptionScrollDirection(): void {
    this.captionScrollCleanup?.();
    const target: HTMLElement | Window = this.captionScrollRoot || window;
    this.captionLastScrollTop = this.getRubyCaptionScrollTop();

    const onScroll = () => {
      if (this.captionScrollRaf) {
        return;
      }

      this.captionScrollRaf = requestAnimationFrame(() => {
        const currentScrollTop = this.getRubyCaptionScrollTop();
        if (Math.abs(currentScrollTop - this.captionLastScrollTop) > 2) {
          this.captionDirection = currentScrollTop > this.captionLastScrollTop ? 'down' : 'up';
          this.captionLastScrollTop = currentScrollTop;
        }
        this.captionScrollRaf = 0;
      });
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    this.captionScrollCleanup = () => target.removeEventListener('scroll', onScroll);
  }

  private getRubyCaptionScrollTop(): number {
    if (this.captionScrollRoot) {
      return this.captionScrollRoot.scrollTop;
    }

    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  private resolveRubyCaptionScrollRoot(element: HTMLElement): HTMLElement | null {
    let parent = element.parentElement;

    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const canScroll = /(auto|scroll|overlay)/.test(overflowY) && parent.scrollHeight > parent.clientHeight + 1;
      if (canScroll) {
        return parent;
      }
      parent = parent.parentElement;
    }

    return null;
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  getClosingDateLabel(): string {
    return this.getOpeningDateLabel();
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

  getPackageLabelText(): string {
    return 'Paket Ruby';
  }

  private isWishFormValid(): boolean {
    return !!(
      this.wishForm.nama.trim() &&
      this.wishForm.kehadiran &&
      this.wishForm.pesan.trim()
    );
  }

  private fallbackCopy(value: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
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
      this.toastService.showToast('Data rekening berhasil disalin', 'success');
    } catch {
      this.toastService.showToast('Data rekening gagal disalin', 'error');
    }
  }

  private getBankClipboardText(bank: any): string {
    const bankName = String(bank?.nama_bank || bank?.bank_name || bank?.bank?.name || bank?.bank?.nama_bank || bank?.bank?.kode_bank || bank?.kode_bank || '').trim();
    const accountHolder = String(bank?.nama_pemilik || bank?.atas_nama || bank?.account_holder || bank?.pemilik || bank?.owner || '').trim();
    const accountNumber = String(bank?.nomor_rekening || bank?.account_number || bank?.rekening || '').trim();

    return [bankName, accountHolder, accountNumber].filter(Boolean).join('\n');
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

  private isUnsafeThemeImage(url: any): boolean {
    const value = String(url || '').toLowerCase().trim();
    if (/storage|gallery|uploads|photo_pria|photo_wanita|cover_photo/i.test(value)) {
      return false;
    }

    return !value ||
      value.includes('dashboard') ||
      value.includes('website/tampilan') ||
      value.includes('theme') ||
      value.includes('/themes/') ||
      value.includes('preview') ||
      value.includes('thumbnail') ||
      value.includes('soft-ivory') ||
      value.includes('lavender-bloom') ||
      value.includes('garden-whisper') ||
      value.includes('modern-vows') ||
      value.includes('diamond-garden') ||
      value.includes('diamond') ||
      value.includes('champagne-rose') ||
      value.includes('velvet-mauve');
  }

  private createCouplePlaceholder(): string {
    const bride = this.escapeSvgText(this.getSecondaryDisplayName() || 'Isabela');
    const groom = this.escapeSvgText(this.getPrimaryDisplayName() || 'Ketut');
    return this.createSvgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fdf2f0"/>
            <stop offset="55%" stop-color="#f6d7da"/>
            <stop offset="100%" stop-color="#eed3cd"/>
          </linearGradient>
        </defs>
        <rect width="800" height="1200" fill="url(#bg)"/>
        <circle cx="240" cy="360" r="148" fill="#fff7f5" opacity=".9"/>
        <circle cx="560" cy="360" r="148" fill="#fff7f5" opacity=".82"/>
        <path d="M140 1080c90-200 430-200 520 0" fill="#ffffff" opacity=".72"/>
        <text x="400" y="840" text-anchor="middle" font-size="58" font-family="Georgia,serif" fill="#9f352d">${groom}</text>
        <text x="400" y="920" text-anchor="middle" font-size="42" font-family="Georgia,serif" fill="#9f352d">&amp;</text>
        <text x="400" y="1000" text-anchor="middle" font-size="58" font-family="Georgia,serif" fill="#9f352d">${bride}</text>
      </svg>`
    );
  }

  private createPersonPlaceholder(name: string): string {
    const initial = this.escapeSvgText((name || 'A').trim().charAt(0).toUpperCase());
    return this.createSvgDataUrl(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 640">
        <defs>
          <linearGradient id="person" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff8f6"/>
            <stop offset="100%" stop-color="#f5d8db"/>
          </linearGradient>
        </defs>
        <rect width="500" height="640" rx="36" fill="url(#person)"/>
        <circle cx="250" cy="210" r="90" fill="#ffffff" opacity=".9"/>
        <path d="M110 520c30-108 125-165 140-165 14 0 109 57 140 165" fill="#ffffff" opacity=".76"/>
        <text x="250" y="600" text-anchor="middle" font-size="96" font-family="Georgia,serif" fill="#9f352d">${initial}</text>
      </svg>`
    );
  }

  private createSvgDataUrl(svg: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private escapeSvgText(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private extractInstagram(person: MempelaiPerson | null): string | null {
    const rawValue = (person as any)?.instagram || (person as any)?.ig || (person as any)?.username || '';
    const normalized = String(rawValue || '').trim();
    if (!normalized) {
      return null;
    }

    return normalized.startsWith('@') ? normalized : `@${normalized}`;
  }

  private createFallbackEvent(name: string, venue: string): WeddingEvent {
    return {
      id: 0,
      nama_acara: venue,
      tanggal_acara: '2026-12-12',
      start_acara: '09:00',
      end_acara: '11:00',
      alamat: `Aula ${venue}, Jakarta`,
      link_maps: '',
      countdown: null,
    };
  }

  private setupRubyReceptionFromEvents(): void {
    const events = this.getEvents();

    this.receptionEvent = events.find((event: any) => {
      const type = String(event?.jenis_acara || event?.nama_acara || '').toLowerCase();
      return type.includes('resepsi');
    }) || events[0];

    this.receptionVenueName = '';
    this.receptionAddress = '';
    this.googleMapsUrl = '';
    this.safeMapEmbedUrl = undefined;
    this.countdownDays = '00';
    this.countdownHours = '00';
    this.countdownMinutes = '00';
    this.countdownSeconds = '00';

    if (!this.receptionEvent) {
      return;
    }

    this.receptionVenueName = String(this.receptionEvent.nama_acara || '').trim();
    this.receptionAddress = String((this.receptionEvent as any).address || this.receptionEvent.alamat || '').trim();
    this.googleMapsUrl = this.getEventMapUrl(this.receptionEvent) || '';

    const mapQuery = this.receptionAddress || this.receptionVenueName;
    if (mapQuery) {
      const embed = `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=16&output=embed`;
      this.safeMapEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embed);
    }

    if (!this.googleMapsUrl && mapQuery) {
      this.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
    }

  }

  private initCountdown(): void {
    const target = this.getCountdownTargetDate();

    if (!target) {
      this.setCountdownZero();
      return;
    }

    this.updateCountdown(target);

    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }

    this.countdownTimer = setInterval(() => {
      this.updateCountdown(target);
    }, 1000);
  }

  private getCountdownTargetDate(): Date | null {
    const events = (this as any)?.data?.events || this.weddingData?.events || [];
    const countdownName = (
      (this as any)?.data?.countdown?.name_countdown ||
      (this.weddingData as any)?.countdown?.name_countdown ||
      ''
    ).toString().toLowerCase().trim();

    if (!events.length) {
      return null;
    }

    const selectedEvent = events.find((event: any) => {
      const namaAcara = (event?.nama_acara || '').toString().toLowerCase().trim();
      const jenisAcara = (event?.jenis_acara || '').toString().toLowerCase().trim();
      return namaAcara === countdownName || jenisAcara === countdownName;
    }) || events[0];

    const tanggal = selectedEvent?.tanggal_acara;
    const jam = selectedEvent?.start_acara || '00:00';

    if (!tanggal) {
      return null;
    }

    const dateOnly = tanggal.toString().split('T')[0];
    const timeOnly = jam.toString().slice(0, 5);
    const target = new Date(`${dateOnly}T${timeOnly}:00`);

    if (isNaN(target.getTime())) {
      return null;
    }

    return target;
  }

  private updateCountdown(target: Date): void {
    const now = new Date().getTime();
    const distance = target.getTime() - now;

    if (distance <= 0) {
      this.setCountdownZero();
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = undefined;
      }
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((distance / (1000 * 60)) % 60);
    const seconds = Math.floor((distance / 1000) % 60);

    this.countdownDays = this.padCountdown(days);
    this.countdownHours = this.padCountdown(hours);
    this.countdownMinutes = this.padCountdown(minutes);
    this.countdownSeconds = this.padCountdown(seconds);
  }

  private padCountdown(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }

  private setCountdownZero(): void {
    this.countdownDays = '00';
    this.countdownHours = '00';
    this.countdownMinutes = '00';
    this.countdownSeconds = '00';
  }
}
