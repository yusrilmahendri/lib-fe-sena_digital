import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnChanges, OnDestroy, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
import { WeddingEvent } from '../../../../services/wedding-data.service';
import { DiamondThemeOneComponent } from '../diamond-theme-one/diamond-theme-one.component';
import {
  normalizeInvitationMediaUrl,
  resolveInvitationMediaUrlFromItem,
  resolveInvitationPhotoUrl,
  resolveInvitationVideoUrl,
} from '../../../../shared/user-photo.model';

interface DiamondGardenGalleryItem {
  photoUrl: string;
  alt: string;
}

@Component({
  selector: 'wc-diamond-theme-two',
  templateUrl: './diamond-theme-two.component.html',
  styleUrls: ['./diamond-theme-two.component.scss'],
})
export class DiamondThemeTwoComponent extends DiamondThemeOneComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('diamondGardenGalleryTrack') diamondGardenGalleryTrack?: ElementRef<HTMLElement>;

  diamondGardenMapSrc = '';
  diamondGardenMapSafeSrc: SafeResourceUrl | null = null;
  diamondGardenMapLink = '';
  diamondGardenMapDebug: any = null;
  private diamondGardenMapInitialized = false;
  private diamondGardenGalleryFrameId: number | null = null;
  private diamondGardenGalleryStartFrameId: number | null = null;
  private diamondGardenGalleryResumeTimeout: ReturnType<typeof setTimeout> | null = null;
  private diamondGardenGalleryPausedByUser = false;
  private diamondGardenGalleryDirection: 1 | -1 = 1;
  private diamondGardenGalleryPosition = 0;
  private diamondGardenGalleryIgnoreScrollUntil = 0;
  private readonly diamondGardenGallerySpeed = 0.9;
  private readonly diamondGardenGalleryResumeDelay = 1400;
  private readonly diamondGardenGalleryMinimumVisualItems = 6;
  private readonly diamondGardenVisibilityHandler = () => this.handleDiamondGardenVisibilityChange();
  private readonly diamondGardenResizeHandler = () => this.refreshDiamondGardenGalleryLayout();

  constructor(
    svc: DashboardService,
    private readonly diamondGardenSanitizer: DomSanitizer,
    toastService: ToastService,
    diamondGardenChangeDetector: ChangeDetectorRef
  ) {
    super(diamondGardenSanitizer, svc, toastService, diamondGardenChangeDetector);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    setTimeout(() => this.setupDiamondGardenMapOnce(), 500);
    setTimeout(() => this.setupDiamondGardenMapOnce(), 1200);
    document.addEventListener('visibilitychange', this.diamondGardenVisibilityHandler);
    window.addEventListener('resize', this.diamondGardenResizeHandler);
  }

  override ngAfterViewInit(): void {
    this.scheduleDiamondGardenGalleryAutoFlowStart();
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);

    if (changes['invitationOpened'] && this.invitationOpened) {
      this.isInvitationOpened = true;
    }

    if (changes['weddingData']) {
      this.diamondGardenMapInitialized = false;
      this.diamondGardenMapSafeSrc = null;
      this.diamondGardenMapSrc = '';
      this.diamondGardenMapLink = '';
      setTimeout(() => this.setupDiamondGardenMapOnce(), 300);
      setTimeout(() => this.setupDiamondGardenMapOnce(), 1200);
      this.scheduleDiamondGardenGalleryAutoFlowStart();
    }
  }

  override ngOnDestroy(): void {
    if (this.diamondGardenGalleryStartFrameId !== null) {
      cancelAnimationFrame(this.diamondGardenGalleryStartFrameId);
      this.diamondGardenGalleryStartFrameId = null;
    }
    this.stopDiamondGardenGalleryAutoSlide();
    this.clearDiamondGardenGalleryResumeTimeout();
    document.removeEventListener('visibilitychange', this.diamondGardenVisibilityHandler);
    window.removeEventListener('resize', this.diamondGardenResizeHandler);
    super.ngOnDestroy();
  }

  override openInvitation(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    this.isInvitationOpened = true;
    this.hasOpened = true;
    this.openInvitationRequested.emit();
    document.body.classList.remove('modal-open');
    this.scheduleDiamondGardenGalleryAutoFlowStart();
  }

  pauseDiamondGardenGalleryAutoSlide(): void {
    this.diamondGardenGalleryPausedByUser = true;
    this.stopDiamondGardenGalleryAutoSlide();
  }

  onDiamondGardenGalleryInteractionStart(): void {
    this.clearDiamondGardenGalleryResumeTimeout();
    this.pauseDiamondGardenGalleryAutoSlide();
  }

  onDiamondGardenGalleryInteractionEnd(): void {
    this.syncDiamondGardenGalleryPositionFromTrack();
    this.scheduleDiamondGardenGalleryAutoSlideResume();
  }

  onDiamondGardenGalleryWheel(event: WheelEvent): void {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
      return;
    }

    this.pauseDiamondGardenGalleryAutoSlide();
    this.syncDiamondGardenGalleryPositionFromTrack();
    this.scheduleDiamondGardenGalleryAutoSlideResume();
  }

  onDiamondGardenGalleryScroll(): void {
    if (performance.now() < this.diamondGardenGalleryIgnoreScrollUntil) {
      return;
    }

    this.pauseDiamondGardenGalleryAutoSlide();
    this.syncDiamondGardenGalleryPositionFromTrack();
    this.scheduleDiamondGardenGalleryAutoSlideResume();
  }

  private scheduleDiamondGardenGalleryAutoFlowStart(): void {
    if (this.diamondGardenGalleryStartFrameId !== null) {
      cancelAnimationFrame(this.diamondGardenGalleryStartFrameId);
    }

    this.diamondGardenGalleryStartFrameId = requestAnimationFrame(() => {
      this.diamondGardenGalleryStartFrameId = requestAnimationFrame(() => {
        this.diamondGardenGalleryStartFrameId = null;
        this.refreshDiamondGardenGalleryLayout();
        this.startDiamondGardenGalleryAutoSlide();
      });
    });
  }

  private startDiamondGardenGalleryAutoSlide(): void {
    if (this.diamondGardenGalleryPausedByUser || document.hidden || !this.galleryPhotos.length) {
      return;
    }

    this.stopDiamondGardenGalleryAutoSlide();
    this.refreshDiamondGardenGalleryLayout();

    const track = this.diamondGardenGalleryTrack?.nativeElement;
    if (!track) {
      return;
    }

    this.diamondGardenGalleryPosition = track.scrollLeft;
    this.diamondGardenGalleryFrameId = requestAnimationFrame(() => this.flowDiamondGardenGallery());
  }

  private stopDiamondGardenGalleryAutoSlide(): void {
    if (this.diamondGardenGalleryFrameId === null) {
      return;
    }

    cancelAnimationFrame(this.diamondGardenGalleryFrameId);
    this.diamondGardenGalleryFrameId = null;
  }

  private scheduleDiamondGardenGalleryAutoSlideResume(): void {
    this.clearDiamondGardenGalleryResumeTimeout();
    this.diamondGardenGalleryResumeTimeout = setTimeout(() => {
      this.diamondGardenGalleryPausedByUser = false;
      this.startDiamondGardenGalleryAutoSlide();
    }, this.diamondGardenGalleryResumeDelay);
  }

  private clearDiamondGardenGalleryResumeTimeout(): void {
    if (!this.diamondGardenGalleryResumeTimeout) {
      return;
    }

    clearTimeout(this.diamondGardenGalleryResumeTimeout);
    this.diamondGardenGalleryResumeTimeout = null;
  }

  private handleDiamondGardenVisibilityChange(): void {
    if (document.hidden) {
      this.stopDiamondGardenGalleryAutoSlide();
      return;
    }

    if (!this.diamondGardenGalleryPausedByUser) {
      this.startDiamondGardenGalleryAutoSlide();
    }
  }

  private getDiamondGardenGalleryMaxScroll(): number {
    const track = this.diamondGardenGalleryTrack?.nativeElement;
    return track ? Math.max(0, track.scrollWidth - track.clientWidth) : 0;
  }

  private flowDiamondGardenGallery(): void {
    const track = this.diamondGardenGalleryTrack?.nativeElement;
    if (document.hidden || !track || this.diamondGardenGalleryPausedByUser) {
      this.diamondGardenGalleryFrameId = null;
      return;
    }

    const maxScroll = this.getDiamondGardenGalleryMaxScroll();
    if (maxScroll <= 1) {
      this.diamondGardenGalleryFrameId = requestAnimationFrame(() => this.flowDiamondGardenGallery());
      return;
    }

    if (this.diamondGardenGalleryPosition >= maxScroll - 1) {
      this.diamondGardenGalleryDirection = -1;
      this.diamondGardenGalleryPosition = maxScroll - 1;
    } else if (this.diamondGardenGalleryPosition <= 1) {
      this.diamondGardenGalleryDirection = 1;
      this.diamondGardenGalleryPosition = 1;
    }

    this.diamondGardenGalleryPosition += this.diamondGardenGalleryDirection * this.diamondGardenGallerySpeed;
    this.diamondGardenGalleryPosition = Math.max(0, Math.min(maxScroll, this.diamondGardenGalleryPosition));
    this.diamondGardenGalleryIgnoreScrollUntil = performance.now() + 80;
    track.scrollLeft = this.diamondGardenGalleryPosition;
    this.diamondGardenGalleryFrameId = requestAnimationFrame(() => this.flowDiamondGardenGallery());
  }

  private syncDiamondGardenGalleryPositionFromTrack(): void {
    const track = this.diamondGardenGalleryTrack?.nativeElement;
    if (!track) {
      return;
    }

    this.diamondGardenGalleryPosition = track.scrollLeft;
  }

  private refreshDiamondGardenGalleryLayout(): void {
    const track = this.diamondGardenGalleryTrack?.nativeElement;
    if (!track) {
      return;
    }

    const visibleCards = this.getDiamondGardenVisibleGalleryCards(track);
    const gap = this.getDiamondGardenGalleryGap(track);
    const { paddingLeft, paddingRight } = this.getDiamondGardenGalleryPadding(track);
    const available = track.clientWidth - paddingLeft - paddingRight - (gap * (visibleCards - 1));
    const cardWidth = Math.floor(available / visibleCards);

    if (cardWidth <= 0) {
      return;
    }

    track.style.setProperty('--diamond-garden-gallery-card-width', `${cardWidth}px`);
  }

  private getDiamondGardenVisibleGalleryCards(track: HTMLElement): number {
    return track.clientWidth <= 340 ? 2 : 3;
  }

  private getDiamondGardenGalleryPadding(track: HTMLElement): { paddingLeft: number; paddingRight: number } {
    const style = window.getComputedStyle(track);
    return {
      paddingLeft: parseFloat(style.paddingLeft || '0') || 0,
      paddingRight: parseFloat(style.paddingRight || '0') || 0,
    };
  }

  private getDiamondGardenGalleryGap(track: HTMLElement): number {
    const style = window.getComputedStyle(track);
    return parseFloat(style.columnGap || style.gap || '0') || 0;
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
    const rawUrl = resolveInvitationPhotoUrl(bride) || bride?.foto_url || bride?.foto || bride?.avatar || '';

    return this.normalizeGardenPhotoUrl(rawUrl) || super.getBridePhotoUrl();
  }

  override getGroomPhotoUrl(): string {
    const groom = this.getGroomData();
    const rawUrl = resolveInvitationPhotoUrl(groom) || groom?.foto_url || groom?.foto || groom?.avatar || '';

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
    return this.getInvitationOpeningText();
  }

  getGardenCoverPhotoUrl(): string {
    return this.getGardenHeroImage(2);
  }

  getGardenGallery(): any[] {
    return this.getGalleryItems().filter((item: any) => this.isDiamondPhotoItem(item));
  }

  getGardenHeroImage(index: number): string {
    const item = this.getGardenHeroItem(index);
    const rawUrl = resolveInvitationPhotoUrl(item);

    const portraitFallback = [
      this.getBridePortrait(),
      this.getGroomPortrait(),
      this.getGardenGalleryCoverPhoto(),
    ];

    return this.normalizeGardenPhotoUrl(rawUrl) || portraitFallback[index] || this.getGardenFallbackImage(index);
  }

  getGardenHeroItem(index: number): any {
    const gallery = this.getGardenGallery();
    const featured = this.getFeaturedGalleryItem();

    const preferred: any[] = [
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['wanita', 'bride', 'female', 'mempelai wanita', 'pengantin wanita'])),
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['pria', 'groom', 'male', 'mempelai pria', 'pengantin pria'])),
      featured || gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['couple', 'pasangan', 'berdua', 'prewedding', 'outdoor', 'cover', 'sampul'])),
    ];

    return (
      preferred[index] ||
      gallery[index] ||
      gallery[0] ||
      null
    );
  }

  getGardenHeroObjectFit(index: number): string {
    return this.getPhotoObjectFit(this.getGardenHeroItem(index));
  }

  getGardenHeroObjectPosition(index: number): string {
    return this.getPhotoObjectPosition(this.getGardenHeroItem(index));
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
    const featured = this.getFeaturedGalleryItem();
    const item: any =
      featured ||
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['couple', 'pasangan', 'berdua', 'prewedding', 'outdoor', 'cover', 'sampul'])) ||
      gallery[2] ||
      gallery[0] ||
      null;

    const rawUrl =
      resolveInvitationPhotoUrl(item) ||
      (this.weddingData as any)?.cover_url ||
      (this.weddingData as any)?.cover ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl);
  }

  getGardenMomentGallery(): any[] {
    const collagePhotos: any[] = this.getCollageItems();
    const galleryPhotos: any[] = this.getGalleryItems();
    const source = collagePhotos.length ? collagePhotos : galleryPhotos;

    return source.filter((item: any) => {
      return Boolean(this.getGardenMomentMediaUrl(item));
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

  getGardenMomentPhotos(): string[] {
    return this.galleryPhotos
      .map((item: any) => this.getGardenGalleryPhotoUrl(item))
      .filter((url: string) => !!url);
  }

  getGardenMomentPhotoItems(): any[] {
    return this.galleryPhotos;
  }

  override get galleryPhotos(): any[] {
    return this.getGardenGallery()
      .filter((item: any) => !this.isDiamondVideoItem(item))
      .filter((item: any) => Boolean(this.getGardenGalleryPhotoUrl(item)));
  }

  getGardenFeaturedPhotoItem(): any {
    return this.getGardenFeaturedVideoItem();
  }

  getGardenFeaturedVideoItem(): any {
    return this.getGardenMomentGallery().find((item: any) => this.isDiamondVideoItem(item))
      || this.getGalleryItems().find((item: any) => this.isDiamondVideoItem(item))
      || this.getGalleryVideoItems()[0]
      || null;
  }

  override getDiamondLightboxPhotos(): any[] {
    return this.galleryPhotos;
  }

  getDiamondGardenFlowGalleryPhotos(): Array<{ photo: any; originalIndex: number; visualIndex: number }> {
    const photos = this.galleryPhotos;
    if (!photos.length) {
      return [];
    }

    const visualCount = Math.max(photos.length, this.diamondGardenGalleryMinimumVisualItems);
    return Array.from({ length: visualCount }, (_, visualIndex) => {
      const originalIndex = visualIndex % photos.length;
      return {
        photo: photos[originalIndex],
        originalIndex,
        visualIndex,
      };
    });
  }

  trackByDiamondGardenFlowPhoto(index: number, item: { photo: any; originalIndex: number; visualIndex: number }): string {
    const photo = item.photo;
    return `${item.visualIndex}-${item.originalIndex}-${photo?.id || photo?.photo_url || photo?.photo || photo}`;
  }

  override getDiamondLightboxPhotoUrl(item: any): string {
    return this.getGardenGalleryPhotoUrl(item) || this.getMomentPhotoUrl(item) || '';
  }

  getGardenFeaturedPhoto(): string {
    const photos = this.getGardenMomentPhotos();

    return photos[0] || this.getCoverPhotoUrl() || 'assets/thema-2/bg-wd.jpeg';
  }

  getGardenGalleryPhotoUrl(item: any): string {
    if (this.isDiamondVideoItem(item)) {
      return '';
    }

    const raw = resolveInvitationPhotoUrl(item);

    if (!raw) return '';

    return this.normalizeGardenPhotoUrl(raw);
  }

  trackByGardenPhoto(index: number, item: any): string {
    return `${index}-${item?.id || item?.photo_url || item?.photo || item}`;
  }

  getGardenMomentPhotoUrl(item: any): string {
    if (this.isDiamondVideoItem(item)) {
      return '';
    }

    const rawUrl = resolveInvitationPhotoUrl(item);

    return this.normalizeGardenPhotoUrl(rawUrl) || this.getGardenFallbackImage(1);
  }

  getGardenMomentMediaUrl(item: any): string {
    const rawUrl = this.isGardenMomentVideo(item)
      ? resolveInvitationVideoUrl(item)
      : resolveInvitationMediaUrlFromItem(item);

    return this.normalizeGardenPhotoUrl(rawUrl);
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
    return this.isGardenMomentVideo(item);
  }

  isGardenMomentVideo(item: any): boolean {
    return this.isDiamondVideoItem(item);
  }

  openGardenMomentVideo(item: any): void {
    this.openGalleryVideo(item);
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
    return this.getGardenGuestWishes().filter((item: any) => this.isRealGardenWish(item));
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
    return normalizeInvitationMediaUrl(rawUrl);
  }

  onGardenImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    target.style.visibility = 'hidden';
  }

  onGardenVideoError(event: Event, item?: any): void {
    const target = event.target as HTMLVideoElement | null;
    if (!target || !item) return;
    target.style.display = 'none';
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
    return this.getEventMapUrl(selectedEvent) || '';
  }

  override getAkadMapLink(): string {
    return this.getEventMapLink(this.getAkadEvent());
  }

  getGardenAkadEvent(): any {
    const data: any = this.weddingData || {};
    const events = data.events || data.acaras || data.event || [];

    if (!Array.isArray(events)) return null;

    return (
      events.find((event: any) =>
        String(event?.jenis_acara || event?.type || event?.nama_acara || '')
          .toLowerCase()
          .includes('akad')
      ) ||
      events[0] ||
      null
    );
  }

  getGardenReceptionEvent(): any {
    const data: any = this.weddingData || {};
    const events = data.events || data.acaras || data.event || [];

    if (!Array.isArray(events)) return null;

    return (
      events.find((event: any) => {
        const type = String(
          event?.jenis_acara || event?.type || event?.nama_acara || ''
        ).toLowerCase();

        return (
          type.includes('resepsi') ||
          type.includes('reception') ||
          type.includes('walimah')
        );
      }) ||
      events[1] ||
      null
    );
  }

  override getReceptionEvent(): any {
    return this.getResepsiEvent();
  }

  private setupDiamondGardenMapOnce(): void {
    if (this.diamondGardenMapInitialized) {
      return;
    }

    const event: any = this.getDiamondGardenAkadEventForMap();

    const linkMaps = String(
      event?.link_maps ||
      event?.link_map ||
      event?.maps_link ||
      event?.google_maps ||
      event?.google_map ||
      event?.map_url ||
      event?.maps ||
      ''
    ).trim();

    const venue = String(
      event?.nama_acara ||
      event?.venue ||
      event?.nama_tempat ||
      event?.tempat ||
      event?.lokasi ||
      ''
    ).trim();

    const address = String(
      event?.alamat ||
      event?.address ||
      event?.alamat_acara ||
      ''
    ).trim();

    const query = [venue, address].filter(Boolean).join(', ').trim();
    const previewQuery = query || linkMaps;

    if (!previewQuery) {
      console.warn('[Diamond Garden Maps] preview query kosong', { event, linkMaps, venue, address });
      return;
    }

    const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(previewQuery)}&output=embed`;

    this.diamondGardenMapSrc = embedSrc;
    this.diamondGardenMapSafeSrc = this.diamondGardenSanitizer.bypassSecurityTrustResourceUrl(embedSrc);
    this.diamondGardenMapLink = linkMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(previewQuery)}`;

    this.diamondGardenMapDebug = {
      event,
      linkMaps,
      venue,
      address,
      query,
      previewQuery,
      embedSrc,
      openLink: this.diamondGardenMapLink
    };

    this.diamondGardenMapInitialized = true;

    console.log('[Diamond Garden Maps Ready]', this.diamondGardenMapDebug);
  }

  private getDiamondGardenAkadEventForMap(): any {
    const data: any = this.weddingData || {};

    const events = []
      .concat(Array.isArray(data.events) ? data.events : [])
      .concat(Array.isArray(data.acaras) ? data.acaras : [])
      .concat(Array.isArray(data.data?.events) ? data.data.events : [])
      .concat(Array.isArray(data.invitation_package?.events) ? data.invitation_package.events : []);

    const akad = events.find((item: any) => {
      const type = String(
        item?.jenis_acara ||
        item?.nama_acara ||
        item?.type ||
        item?.title ||
        ''
      ).toLowerCase();

      return type.includes('akad');
    });

    return akad || events[0] || {};
  }

  openDiamondGardenMap(): void {
    if (!this.diamondGardenMapLink) {
      return;
    }

    window.open(this.diamondGardenMapLink, '_blank', 'noopener,noreferrer');
  }

  getGardenGiftAccounts(): any[] {
    const data: any = this.weddingData || {};
    const nestedData: any = data.data || {};
    const packageData: any = data.invitation_package || {};
    const userInfo: any = data.user_info || {};
    const user: any = data.user || {};

    const candidates = [
      data.bank_accounts,
      nestedData.bank_accounts,
      data.bankAccounts,
      data.rekenings,
      data.rekening,
      data.rekenings_user,
      data.gift_accounts,
      data.wedding_gifts,
      data.gifts,
      packageData.bank_accounts,
      packageData.rekenings,
      packageData.rekening,
      userInfo.bank_accounts,
      userInfo.rekenings,
      user.bank_accounts,
      user.rekenings,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.filter(Boolean);
      }

      if (candidate && typeof candidate === 'object') {
        return [candidate];
      }
    }

    const parentAccounts = this.getBankAccounts();
    if (parentAccounts.length) {
      return parentAccounts;
    }

    const visibleAccounts = this.getVisibleBankAccounts();
    return visibleAccounts.length ? visibleAccounts : [];
  }

  getGardenGiftBankName(account: any): string {
    return String(
      account?.nama_bank ||
      account?.bank_name ||
      account?.bank?.nama_bank ||
      account?.bank?.name ||
      account?.name_bank ||
      ''
    ).trim();
  }

  getGardenGiftNumber(account: any): string {
    return String(
      account?.nomor_rekening ||
      account?.no_rekening ||
      account?.account_number ||
      account?.number ||
      ''
    ).trim();
  }

  getGardenGiftOwner(account: any): string {
    return String(
      account?.nama_pemilik ||
      account?.account_name ||
      account?.pemilik ||
      account?.atas_nama ||
      account?.owner ||
      ''
    ).trim();
  }

  copyGardenGiftNumber(account: any): void {
    this.copyGiftNumber(account);
  }

  getGardenMapLink(event?: any): string {
    return this.getEventMapUrl(event) || '';
  }

  getGardenEventAddress(event?: any): string {
    return String(
      event?.alamat ||
      event?.address ||
      event?.location_name ||
      event?.lokasi ||
      event?.location ||
      event?.venue ||
      ''
    ).trim();
  }

  getGardenMapEmbedUrl(event?: any): string {
    const rawLink = String(
      event?.google_maps_url ||
      event?.link_maps ||
      event?.link_map ||
      event?.maps ||
      event?.google_maps ||
      event?.map_url ||
      ''
    ).trim();

    const venue = String(
      event?.nama_acara ||
      event?.venue ||
      event?.nama_tempat ||
      event?.tempat ||
      event?.lokasi ||
      ''
    ).trim();

    const address = this.getGardenEventAddress(event);
    const query = [venue, address].filter(Boolean).join(', ').trim();
    const previewQuery = query || rawLink;

    if (!previewQuery) {
      return '';
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(previewQuery)}&output=embed`;
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

  getGardenStories(): Array<{ date: string; title: string; lead: string; body: string }> {
    if (this.loveStoryItems?.length) {
      return this.loveStoryItems.map((item) => ({
        date: item.date || item.year || '',
        title: item.title || '',
        lead: item.lead || '',
        body: item.description || '',
      })).filter((item) => !!(item.date || item.title || item.lead || item.body));
    }

    return this.getStories().map((item: any) => {
      const lead = String(item?.lead_cerita || item?.subtitle || item?.short_description || '').trim();
      const body = String(item?.cerita || item?.content || item?.body || item?.description || item?.deskripsi || item?.isi || '').trim();

      return {
        date: String(item?.tanggal_cerita || item?.date || item?.tanggal || item?.year || item?.tahun || '').trim(),
        title: String(item?.title || item?.judul || item?.nama_cerita || '').trim(),
        lead: lead && lead !== body ? lead : '',
        body: body || lead,
      };
    }).filter((item: any) => !!(item.date || item.title || item.lead || item.body));
  }

  trackByGardenStory(index: number, item: any): string {
    return `${item?.date || index}-${item?.title || index}`;
  }

  getGardenHeroDateLabel(): string {
    return this.getGardenDateLabel();
  }

  getGardenFooterPhotoUrl(): string {
    const data: any = this.weddingData || {};
    const invitationPackage: any = data.invitation_package || {};

    const galleries =
      data.gallery ||
      data.galleries ||
      data.photos ||
      [];

    if (Array.isArray(galleries) && galleries.length) {
      const selected =
        galleries.find((item: any) => resolveInvitationPhotoUrl(item)) ||
        galleries[0];

      const raw = resolveInvitationPhotoUrl(selected);

      if (raw) {
        return this.normalizeGardenPhotoUrl(raw);
      }
    }

    const cover =
      data.cover_url ||
      data.cover ||
      data.photo_cover ||
      invitationPackage.cover ||
      '';

    if (cover) {
      return this.normalizeGardenPhotoUrl(cover);
    }

    const groomPhoto = this.getGroomPhotoUrl();
    if (groomPhoto) return groomPhoto;

    const bridePhoto = this.getBridePhotoUrl();
    if (bridePhoto) return bridePhoto;

    return 'assets/thema-2/bg-wd.jpeg';
  }
}
