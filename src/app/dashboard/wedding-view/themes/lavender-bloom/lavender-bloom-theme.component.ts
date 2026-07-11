import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import {
  GalleryItem,
  GuestWish,
  MempelaiPerson,
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
  getFeaturedGalleryPhoto,
  getOrderedCollagePhotos,
  getOrderedGalleryPhotos,
  getPhotoObjectFit,
  getPhotoObjectPosition,
  logInvitationImageError,
  normalizeInvitationMediaUrl,
  resolveInvitationPhotoUrl,
} from '../../../../shared/user-photo.model';

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
export class LavenderBloomThemeComponent implements OnInit, OnDestroy {
  @Input() weddingData: WeddingData | null = null;
  @Input() invitationOpened = false;
  @Output() openInvitationRequested = new EventEmitter<void>();

  private countdownTimerId: number | null = null;
  now = Date.now();

  ngOnInit(): void {
    this.countdownTimerId = window.setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.countdownTimerId !== null) {
      window.clearInterval(this.countdownTimerId);
    }
  }

  openInvitation(): void {
    this.openInvitationRequested.emit();
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
    const data = this.weddingData as any;
    const candidates = [
      data?.guest_name,
      data?.nama_tamu,
      data?.guest?.nama,
      data?.guest?.name,
      data?.guest_book?.[0]?.nama,
      data?.guest_book?.[0]?.name,
    ];

    return candidates
      .map((value) => String(value || '').trim())
      .find((value) => !!value) || 'Tamu Undangan';
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

  getInvitationOpeningText(): string {
    const source = this.getTestimoniSetting();
    const text = String(source['salam_pembuka'] ?? '').trim();

    return resolveSalamPembuka(text);
  }

  getWhatsappOpeningText(): string {
    const source = this.getTestimoniSetting();
    const text = String(source['salam_atas'] ?? '').trim();

    return resolveSalamAtas(text);
  }

  getWhatsappClosingText(): string {
    const source = this.getTestimoniSetting();
    const text = String(source['salam_bawah'] ?? '').trim();

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
    return 'Merupakan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.';
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
    return Array.isArray(this.weddingData?.events) ? this.weddingData?.events || [] : [];
  }

  getStories(): WeddingStory[] {
    return Array.isArray(this.weddingData?.stories) ? this.weddingData?.stories || [] : [];
  }

  getQuotes(): WeddingQuote[] {
    return Array.isArray(this.weddingData?.quotes) ? this.weddingData?.quotes || [] : [];
  }

  getGalleryItems(): GalleryItem[] {
    const gallery = Array.isArray(this.weddingData?.gallery) ? this.weddingData?.gallery || [] : [];
    return getOrderedGalleryPhotos(gallery);
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
    return this.getGalleryItems().length > 0;
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
    const event = this.getLocationEvent() as any;
    const directLink = String(event?.google_maps_url || event?.link_maps || event?.maps_url || event?.map_url || '').trim();
    if (directLink) {
      return directLink;
    }

    const latitude = String(event?.latitude || '').trim();
    const longitude = String(event?.longitude || '').trim();
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
    }

    const address = String(event?.address || event?.alamat || event?.location_name || '').trim();
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
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
    return this.formatDate(story.tanggal_cerita, 'long');
  }

  getStoryLead(story: WeddingStory): string {
    return story.lead_cerita || story.title || '';
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

  private isFilterVisible(key: FilterKey): boolean {
    const value = this.weddingData?.filter_undangan?.[key];
    return value === undefined || value === null || Number(value) === 1;
  }

  private formatClock(value: string): string {
    return value.slice(0, 5).replace(':', '.');
  }

  private padNumber(value: number): string {
    return String(Math.max(value, 0)).padStart(2, '0');
  }
}
