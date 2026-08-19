import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import {
  GalleryItem,
  GuestWish,
  MempelaiPerson,
  ReligionContentData,
  WeddingData,
  WeddingEvent,
  WeddingQuote,
  WeddingStory,
} from '../../../../services/wedding-data.service';
import {
  resolveSalamAtas,
  resolveSalamBawah,
  resolveSalamPembuka,
} from '../../../../shared/salam-defaults';
import {
  getReligionContentFromData,
  getResolvedReligionValue,
} from '../../../../shared/religion-content.util';
import {
  getFeaturedGalleryPhoto,
  getOrderedCollagePhotos,
  getPhotoObjectFit,
  getPhotoObjectPosition,
  isInvitationVideoMedia,
  logInvitationImageError,
  normalizeInvitationMediaUrl,
  resolveInvitationPhotoUrl,
} from '../../../../shared/user-photo.model';
import {
  isWeddingSectionEnabled,
  resolveEventMapUrl,
  resolveGalleryPhotos,
  resolveGuestName,
  resolveStories,
  resolveWeddingEvents,
  resolveYoutubeVideos,
} from '../../../../shared/wedding-theme-data.util';

type FilterKey =
  | 'halaman_sampul'
  | 'halaman_mempelai'
  | 'halaman_acara'
  | 'halaman_ucapan'
  | 'halaman_galery'
  | 'halaman_cerita'
  | 'halaman_lokasi'
  | 'halaman_send_gift'
  | 'halaman_qoute';

@Component({
  selector: 'wc-lavender-bloom-theme',
  templateUrl: './lavender-bloom-theme.component.html',
  styleUrls: ['./lavender-bloom-theme.component.scss'],
})
export class LavenderBloomThemeComponent implements OnInit, OnChanges, OnDestroy {
  @Input() weddingData: WeddingData | null = null;
  @Input() invitationOpened = false;
  @Input() invitationDomain: string | null = null;
  @Output() openInvitationRequested = new EventEmitter<void>();
  @Output() wishSubmitted = new EventEmitter<GuestWish>();

  private countdownTimerId: number | null = null;
  private openingTimerId: number | null = null;
  now = Date.now();
  isOpening = false;
  isInvitationOpened = false;
  isCoverVisible = true;
  selectedLavenderGalleryPhotoIndex = -1;

  private galleryTouchStartX = 0;
  private galleryTouchStartY = 0;
  private galleryScrollY = 0;
  private readonly gallerySwipeThreshold = 48;

  ngOnInit(): void {
    this.countdownTimerId = window.setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.unlockGalleryLightboxScroll();

    if (this.countdownTimerId !== null) {
      window.clearInterval(this.countdownTimerId);
    }
    if (this.openingTimerId !== null) {
      window.clearTimeout(this.openingTimerId);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['invitationOpened']) {
      return;
    }

    if (this.invitationOpened && !this.isOpening && !this.isInvitationOpened) {
      console.debug('[LavenderBloomOpening] synced opened state from parent input');
      this.isInvitationOpened = true;
      this.isCoverVisible = false;
      return;
    }

    if (!this.invitationOpened && !this.isOpening && this.isInvitationOpened) {
      console.debug('[LavenderBloomOpening] reset opened state from parent input');
      this.isInvitationOpened = false;
      this.isCoverVisible = true;
    }
  }

  protected getInvitationDomain(): string {
    const data: any = this.weddingData || {};
    const domain = String(
      this.invitationDomain ||
      data?.settings?.domain ||
      data?.domain ||
      data?.domain_slug ||
      data?.invitation?.domain ||
      data?.wedding?.slug ||
      data?.profile?.domain ||
      ''
    ).trim();

    return domain.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0];
  }

  openInvitation(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    console.debug('[LavenderBloomOpening] button clicked', {
      parentInvitationOpened: this.invitationOpened,
      isOpening: this.isOpening,
      isInvitationOpened: this.isInvitationOpened,
    });

    if (this.isOpening || this.isInvitationOpened) {
      return;
    }

    this.isOpening = true;
    this.isCoverVisible = true;

    console.debug('[LavenderBloomOpening] emitting open request to parent for audio/user gesture');
    this.openInvitationRequested.emit();

    this.openingTimerId = window.setTimeout(() => {
      this.isOpening = false;
      this.isInvitationOpened = true;
      this.isCoverVisible = false;
      console.debug('[LavenderBloomOpening] animation finished');
    }, this.getOpeningDurationMs());
  }

  protected getOpeningDurationMs(): number {
    return 920;
  }

  getBride(): MempelaiPerson | null {
    return this.weddingData?.mempelai?.wanita || null;
  }

  getGroom(): MempelaiPerson | null {
    return this.weddingData?.mempelai?.pria || null;
  }

  getFirstPerson(): MempelaiPerson | null {
    return this.weddingData?.mempelai?.urutan_mempelai === 'pria'
      ? this.getGroom()
      : this.getBride();
  }

  getSecondPerson(): MempelaiPerson | null {
    return this.weddingData?.mempelai?.urutan_mempelai === 'pria'
      ? this.getBride()
      : this.getGroom();
  }

  getBrideName(): string {
    return this.getDisplayName(this.getBride(), 'Mempelai Wanita');
  }

  getGroomName(): string {
    return this.getDisplayName(this.getGroom(), 'Mempelai Pria');
  }

  getBrideNickname(): string {
    return this.getNickname(this.getBride(), 'Mempelai Wanita');
  }

  getGroomNickname(): string {
    return this.getNickname(this.getGroom(), 'Mempelai Pria');
  }

  getCoupleDisplayName(): string {
    return `${this.getGroomNickname()} & ${this.getBrideNickname()}`;
  }

  getGuestName(): string {
    return resolveGuestName(this.weddingData);
  }

  getResolvedGuestName(): string {
    return resolveGuestName(this.weddingData);
  }

  getCoverPhoto(): string {
    const featuredGalleryPhoto = this.getFeaturedGalleryItem();
    const featuredGalleryUrl = featuredGalleryPhoto ? this.getGalleryPhotoUrl(featuredGalleryPhoto) : '';

    return this.normalizeMediaUrl(
      featuredGalleryUrl ||
      (this.weddingData as any)?.cover_photo_url ||
      (this.weddingData as any)?.mempelai?.cover_photo_url ||
      this.weddingData?.mempelai?.cover_photo ||
      (this.weddingData as any)?.cover_photo ||
      (this.weddingData as any)?.photo_pria_url ||
      (this.weddingData as any)?.mempelai?.photo_pria_url ||
      (this.weddingData as any)?.mempelai?.pria?.photo_url ||
      (this.weddingData as any)?.mempelai?.pria?.image_url ||
      (this.weddingData as any)?.mempelai?.pria?.preview_url ||
      this.getGroom()?.photo ||
      (this.weddingData as any)?.photo_wanita_url ||
      (this.weddingData as any)?.mempelai?.photo_wanita_url ||
      (this.weddingData as any)?.mempelai?.wanita?.photo_url ||
      (this.weddingData as any)?.mempelai?.wanita?.image_url ||
      (this.weddingData as any)?.mempelai?.wanita?.preview_url ||
      this.getBride()?.photo
    ) || 'assets/landing/template-1.png';
  }

  getOpeningDate(): string {
    const primaryEvent = this.getPrimaryEvent();
    return primaryEvent ? this.formatDate(primaryEvent.tanggal_acara, 'short') : 'Tanggal menyusul';
  }

  protected getTestimoniSetting(): Record<string, any> {
    const data: any = this.weddingData || {};

    return (
      data?.testimoni ||
      data?.setting ||
      data?.settings ||
      data?.invitation_package ||
      data?.data?.setting ||
      {}
    );
  }

  getReligionText(key: string, fallback: string = ''): string {
    return getResolvedReligionValue(this.getReligionContent(), key) || fallback || '';
  }

  getInvitationText(key: string, fallback: string = ''): string {
    const source = this.getTestimoniSetting();
    const keys = this.getReligionKeyAliases(key);

    return (
      this.getReligionText(key, '') ||
      this.readFirstText(source, keys) ||
      fallback ||
      ''
    );
  }

  getInvitationOpeningText(): string {
    const text = this.getInvitationText('salam_pembuka', '');

    return resolveSalamPembuka(text);
  }

  getWhatsappOpeningText(): string {
    const text = this.getInvitationText('salam_atas', '');

    return resolveSalamAtas(text);
  }

  getWhatsappClosingText(): string {
    const text = this.getInvitationText('salam_bawah', '');

    return resolveSalamBawah(text);
  }

  getInvitationIntro(): string {
    return this.getInvitationOpeningText();
  }

  getOpeningMessage(): string {
    return this.getInvitationOpeningText();
  }

  getIntroductionText(): string {
    return this.getInvitationOpeningText();
  }

  getClosingText(): string {
    return this.getReligionText(
      'penutup',
      'Merupakan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.'
    );
  }

  getOpeningHeading(): string {
    return this.getReligionText('salam', 'Bismillahirrahmanirrahim');
  }

  getReligionQuoteText(fallback: string = ''): string {
    return this.getReligionText('quote', fallback);
  }

  getReligionQuoteSource(fallback: string = ''): string {
    return this.getReligionText('quote_source', fallback);
  }

  private getReligionContent(): ReligionContentData {
    const data: any = this.weddingData || {};
    return getReligionContentFromData(data) as ReligionContentData;
  }

  private getReligionKeyAliases(key: string): string[] {
    const aliases: Record<string, string[]> = {
      salam_pembuka: ['salam_pembuka', 'invitation_intro', 'opening_prayer', 'message', 'opening_greeting'],
      opening_prayer: ['opening_prayer', 'invitation_intro', 'prayer_text', 'blessing_text', 'message', 'salam_pembuka'],
      salam_atas: ['salam_atas', 'opening_greeting', 'salam', 'salam_pembuka'],
      salam: ['salam', 'opening_greeting', 'salam_atas'],
      salam_bawah: ['salam_bawah', 'closing_greeting', 'salam_penutup', 'penutup', 'blessing_text'],
      penutup: ['penutup', 'closing_greeting', 'salam_bawah', 'blessing_text'],
      quote: ['quote', 'quote_text'],
      quote_text: ['quote_text', 'quote'],
      quote_source: ['quote_source', 'quote_author', 'quote_reference', 'source'],
      message: ['message', 'invitation_intro', 'opening_prayer'],
      whatsapp_text: ['whatsapp_text', 'whatsapp_message', 'pesan_whatsapp'],
    };

    return aliases[key] || [key];
  }

  private readFirstText(source: Record<string, any>, keys: string[]): string {
    for (const key of keys) {
      const value = String(source?.[key] ?? '').trim();
      if (value) {
        return value;
      }
    }

    return '';
  }

  getParentsText(person: MempelaiPerson | null, gender: 'pria' | 'wanita'): string {
    if (person?.ayah && person?.ibu) {
      const label = gender === 'pria' ? 'Putra' : 'Putri';
      return `${label} dari Bapak ${person.ayah} & Ibu ${person.ibu}`;
    }

    return gender === 'pria'
      ? 'Putra dari keluarga tercinta'
      : 'Putri dari keluarga tercinta';
  }

  getPersonGender(person: MempelaiPerson | null): 'pria' | 'wanita' {
    return person === this.getGroom() ? 'pria' : 'wanita';
  }

  getAkadEvent(): WeddingEvent | null {
    const events = this.getEvents();
    return events.find((event) => /akad|nikah|pemberkatan/i.test(event.nama_acara || '')) || events[0] || null;
  }

  getReceptionEvent(): WeddingEvent | null {
    const events = this.getEvents();
    const reception = events.find((event) => /resepsi|reception|ngunduh/i.test(event.nama_acara || ''));

    if (reception) {
      return reception;
    }

    return events.length > 1 ? events[1] : null;
  }

  getPrimaryEvent(): WeddingEvent | null {
    return this.getReceptionEvent() || this.getAkadEvent() || this.getEvents()[0] || null;
  }

  getLocationEvent(): WeddingEvent | null {
    return this.getReceptionEvent() || this.getAkadEvent();
  }

  getEvents(): WeddingEvent[] {
    return resolveWeddingEvents(this.weddingData);
  }

  getStories(): WeddingStory[] {
    return resolveStories(this.weddingData) as unknown as WeddingStory[];
  }

  getQuotes(): WeddingQuote[] {
    return Array.isArray(this.weddingData?.quotes) ? this.weddingData?.quotes || [] : [];
  }

  getGalleryItems(): GalleryItem[] {
    return resolveGalleryPhotos(this.weddingData);
  }

  getCollageItems(): GalleryItem[] {
    const gallery = Array.isArray(this.weddingData?.gallery) ? this.weddingData?.gallery || [] : [];
    return getOrderedCollagePhotos(gallery);
  }

  getFeaturedGalleryItem(): GalleryItem | null {
    return getFeaturedGalleryPhoto(this.getGalleryItems());
  }

  getGalleryGridItems(): GalleryItem[] {
    return this.getGalleryItems().slice(1, 5);
  }

  getLavenderGalleryLightboxPhotos(): GalleryItem[] {
    return this.getGalleryItems().filter((item) => !isInvitationVideoMedia(item));
  }

  get isLavenderGalleryLightboxOpen(): boolean {
    return this.selectedLavenderGalleryPhotoIndex >= 0 && this.getLavenderGalleryLightboxPhotos().length > 0;
  }

  get selectedLavenderGalleryPhoto(): GalleryItem | null {
    return this.getLavenderGalleryLightboxPhotos()[this.selectedLavenderGalleryPhotoIndex] || null;
  }

  openLavenderGalleryLightbox(item: GalleryItem): void {
    if (isInvitationVideoMedia(item)) {
      return;
    }

    const index = this.getLavenderGalleryLightboxPhotos().findIndex((photo) => photo === item || photo.id === item.id);

    if (index < 0) {
      return;
    }

    this.selectedLavenderGalleryPhotoIndex = index;
    this.lockGalleryLightboxScroll();
  }

  closeLavenderGalleryLightbox(): void {
    this.selectedLavenderGalleryPhotoIndex = -1;
    this.unlockGalleryLightboxScroll();
  }

  showPreviousLavenderGalleryPhoto(): void {
    const total = this.getLavenderGalleryLightboxPhotos().length;

    if (!total) {
      return;
    }

    this.selectedLavenderGalleryPhotoIndex = (this.selectedLavenderGalleryPhotoIndex - 1 + total) % total;
  }

  showNextLavenderGalleryPhoto(): void {
    const total = this.getLavenderGalleryLightboxPhotos().length;

    if (!total) {
      return;
    }

    this.selectedLavenderGalleryPhotoIndex = (this.selectedLavenderGalleryPhotoIndex + 1) % total;
  }

  onLavenderGalleryLightboxTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    this.galleryTouchStartX = touch.clientX;
    this.galleryTouchStartY = touch.clientY;
  }

  onLavenderGalleryLightboxTouchEnd(event: TouchEvent): void {
    const touch = event.changedTouches[0];

    if (!touch) {
      return;
    }

    const deltaX = touch.clientX - this.galleryTouchStartX;
    const deltaY = touch.clientY - this.galleryTouchStartY;
    const horizontalDistance = Math.abs(deltaX);
    const verticalDistance = Math.abs(deltaY);

    if (horizontalDistance < this.gallerySwipeThreshold || horizontalDistance < verticalDistance * 1.2) {
      return;
    }

    if (deltaX < 0) {
      this.showNextLavenderGalleryPhoto();
      return;
    }

    this.showPreviousLavenderGalleryPhoto();
  }

  getGuestWishes(): GuestWish[] {
    return Array.isArray(this.weddingData?.guest_wishes) ? this.weddingData?.guest_wishes || [] : [];
  }

  hasStories(): boolean {
    return this.getStories().length > 0;
  }

  hasQuotes(): boolean {
    return this.getQuotes().length > 0;
  }

  hasGallery(): boolean {
    return this.getGalleryItems().length > 0 || this.getYoutubeVideos().length > 0;
  }

  hasCollage(): boolean {
    return this.getCollageItems().length > 0;
  }

  hasGuestWishes(): boolean {
    return this.getGuestWishes().length > 0;
  }

  isCoupleVisible(): boolean {
    return this.isFilterVisible('halaman_mempelai');
  }

  isEventVisible(): boolean {
    return this.isFilterVisible('halaman_acara');
  }

  isLocationVisible(): boolean {
    return this.isFilterVisible('halaman_lokasi');
  }

  isStoryVisible(): boolean {
    return this.isFilterVisible('halaman_cerita');
  }

  isGalleryVisible(): boolean {
    return this.isFilterVisible('halaman_galery');
  }

  isWishVisible(): boolean {
    return this.isFilterVisible('halaman_ucapan');
  }

  isGiftVisible(): boolean {
    return this.isFilterVisible('halaman_send_gift');
  }

  isQuoteVisible(): boolean {
    return this.isFilterVisible('halaman_qoute');
  }

  getLocationTitle(): string {
    return this.getLocationEvent()?.nama_acara || 'Lokasi Acara';
  }

  getLocationAddress(): string {
    const event = this.getLocationEvent() as any;
    return event?.address || event?.alamat || event?.location_name || 'Lokasi acara akan diumumkan segera.';
  }

  getMapsLink(): string | null {
    return resolveEventMapUrl(this.getLocationEvent());
  }

  getCountdownParts(): Array<{ label: string; value: string }> {
    const eventDate = this.getPrimaryEvent()?.tanggal_acara;
    if (!eventDate) {
      return [
        { label: 'Hari', value: '00' },
        { label: 'Jam', value: '00' },
        { label: 'Menit', value: '00' },
        { label: 'Detik', value: '00' },
      ];
    }

    const target = new Date(eventDate).getTime();
    const remaining = Math.max(target - this.now, 0);
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((remaining / (1000 * 60)) % 60);
    const seconds = Math.floor((remaining / 1000) % 60);

    return [
      { label: 'Hari', value: this.padNumber(days) },
      { label: 'Jam', value: this.padNumber(hours) },
      { label: 'Menit', value: this.padNumber(minutes) },
      { label: 'Detik', value: this.padNumber(seconds) },
    ];
  }

  formatDate(dateValue?: string | null, mode: 'short' | 'long' = 'long'): string {
    if (!dateValue) {
      return mode === 'short' ? 'Tanggal menyusul' : 'Tanggal acara akan diumumkan segera';
    }

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return dateValue;
    }

    return date.toLocaleDateString('id-ID', {
      weekday: mode === 'long' ? 'long' : undefined,
      day: '2-digit',
      month: mode === 'long' ? 'long' : '2-digit',
      year: 'numeric',
    });
  }

  formatTimeRange(event?: WeddingEvent | null): string {
    if (!event?.start_acara) {
      return 'Waktu acara akan diumumkan segera';
    }

    const start = this.formatClock(event.start_acara);
    const end = event.end_acara ? ` - ${this.formatClock(event.end_acara)}` : '';
    return `Pukul ${start}${end} WIB`;
  }

  getStoryDate(story: WeddingStory): string {
    return this.formatDate((story as any).tanggal_cerita || (story as any).date, 'long');
  }

  getStoryLead(story: WeddingStory): string {
    return (story as any).lead_cerita || (story as any).description || story.title || '';
  }

  getGalleryAlt(item: GalleryItem, index: number): string {
    return item.description || item.nama_foto || `Galeri ${index + 1}`;
  }

  getPhotoObjectFit(item: any): string {
    return getPhotoObjectFit(item);
  }

  getPhotoObjectPosition(item: any): string {
    return getPhotoObjectPosition(item);
  }

  getCoverPhotoObjectFit(): string {
    return this.getFeaturedGalleryItem() ? this.getPhotoObjectFit(this.getFeaturedGalleryItem()) : 'cover';
  }

  getCoverPhotoObjectPosition(): string {
    return this.getFeaturedGalleryItem() ? this.getPhotoObjectPosition(this.getFeaturedGalleryItem()) : 'center center';
  }

  getPersonPhotoUrl(person: MempelaiPerson | null): string {
    const gender = this.getPersonGender(person);
    return this.normalizeMediaUrl(
      gender === 'pria'
        ? ((this.weddingData as any)?.photo_pria_url ||
          (this.weddingData as any)?.mempelai?.photo_pria_url ||
          (this.weddingData as any)?.mempelai?.pria?.photo_url ||
          (this.weddingData as any)?.mempelai?.pria?.image_url ||
          (this.weddingData as any)?.mempelai?.pria?.preview_url ||
          (this.weddingData as any)?.photo_pria ||
          (this.weddingData as any)?.mempelai?.photo_pria ||
          person?.photo)
        : ((this.weddingData as any)?.photo_wanita_url ||
          (this.weddingData as any)?.mempelai?.photo_wanita_url ||
          (this.weddingData as any)?.mempelai?.wanita?.photo_url ||
          (this.weddingData as any)?.mempelai?.wanita?.image_url ||
          (this.weddingData as any)?.mempelai?.wanita?.preview_url ||
          (this.weddingData as any)?.photo_wanita ||
          (this.weddingData as any)?.mempelai?.photo_wanita ||
          person?.photo)
    );
  }

  getGalleryPhotoUrl(item: any): string {
    const resolved = resolveInvitationPhotoUrl(item);

    console.log('[ImageUrlDebug]', {
      context: 'lavender-bloom',
      raw: item,
      resolved
    });

    return resolved;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    logInvitationImageError(event, 'lavender-bloom');
    img.style.display = 'none';
  }

  getGuestWishDate(dateValue: string): string {
    return this.formatDate(dateValue, 'long');
  }

  trackByStory(index: number, story: WeddingStory): number {
    return story.id || index;
  }

  trackByGallery(index: number, item: GalleryItem): number {
    return item.id || index;
  }

  @HostListener('document:keydown', ['$event'])
  onLavenderGalleryLightboxKeydown(event: KeyboardEvent): void {
    if (!this.isLavenderGalleryLightboxOpen) {
      return;
    }

    if (event.key === 'Escape') {
      this.closeLavenderGalleryLightbox();
      return;
    }

    if (event.key === 'ArrowLeft') {
      this.showPreviousLavenderGalleryPhoto();
      return;
    }

    if (event.key === 'ArrowRight') {
      this.showNextLavenderGalleryPhoto();
    }
  }

  trackByWish(index: number, item: GuestWish): number {
    return item.id || index;
  }

  trackByQuote(index: number, item: WeddingQuote): number {
    return item.id || index;
  }

  getDisplayName(person: MempelaiPerson | null, fallback: string): string {
    return person?.nama_lengkap || person?.nama_panggilan || fallback;
  }

  private getNickname(person: MempelaiPerson | null, fallback: string): string {
    return person?.nama_panggilan || person?.nama_lengkap || fallback;
  }

  normalizeMediaUrl(value: any): string {
    return normalizeInvitationMediaUrl(value);
  }

  private lockGalleryLightboxScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.galleryScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${this.galleryScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  private unlockGalleryLightboxScroll(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const scrollY = this.galleryScrollY;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';

    if (scrollY > 0) {
      window.scrollTo(0, scrollY);
    }
  }

  getYoutubeVideos() {
    return resolveYoutubeVideos(this.weddingData);
  }

  getEventMapUrl(event: WeddingEvent | null | undefined): string | null {
    return resolveEventMapUrl(event);
  }

  protected isFilterVisible(key: FilterKey): boolean {
    const sectionMap: Record<FilterKey, any> = {
      halaman_sampul: 'cover',
      halaman_mempelai: 'couple',
      halaman_acara: 'events',
      halaman_ucapan: 'wishes',
      halaman_galery: 'gallery',
      halaman_cerita: 'stories',
      halaman_lokasi: 'location',
      halaman_send_gift: 'gift',
      halaman_qoute: 'quote',
    };

    return isWeddingSectionEnabled(this.weddingData, sectionMap[key] || key);
  }

  private formatClock(value: string): string {
    return value.slice(0, 5).replace(':', '.');
  }

  private padNumber(value: number): string {
    return String(Math.max(value, 0)).padStart(2, '0');
  }
}
