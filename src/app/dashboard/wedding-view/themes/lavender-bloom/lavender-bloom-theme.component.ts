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
import { environment } from '../../../../../environments/environment';

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
    return this.normalizeMediaUrl(
      (this.weddingData as any)?.cover_photo_url ||
      (this.weddingData as any)?.mempelai?.cover_photo_url ||
      this.weddingData?.mempelai?.cover_photo ||
      (this.weddingData as any)?.cover_photo ||
      (this.weddingData as any)?.photo_pria_url ||
      (this.weddingData as any)?.mempelai?.photo_pria_url ||
      (this.weddingData as any)?.mempelai?.pria?.photo_url ||
      this.getGroom()?.photo ||
      (this.weddingData as any)?.photo_wanita_url ||
      (this.weddingData as any)?.mempelai?.photo_wanita_url ||
      (this.weddingData as any)?.mempelai?.wanita?.photo_url ||
      this.getBride()?.photo
    ) || 'assets/landing/template-1.png';
  }

  getOpeningDate(): string {
    const primaryEvent = this.getPrimaryEvent();
    return primaryEvent ? this.formatDate(primaryEvent.tanggal_acara, 'short') : 'Tanggal menyusul';
  }

  getOpeningMessage(): string {
    return this.weddingData?.settings?.salam_pembuka || 'Bismillahirrahmanirrahim';
  }

  getIntroductionText(): string {
    return this.weddingData?.settings?.salam_atas || 'Dengan penuh rasa syukur, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari bahagia kami.';
  }

  getClosingText(): string {
    return this.weddingData?.settings?.salam_bawah || 'Merupakan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.';
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
    return Array.isArray(this.weddingData?.gallery) ? this.weddingData?.gallery || [] : [];
  }

  getFeaturedGalleryItem(): GalleryItem | null {
    return this.getGalleryItems()[0] || null;
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
    return this.getLocationEvent()?.alamat || 'Lokasi acara akan diumumkan segera.';
  }

  getMapsLink(): string | null {
    return this.getLocationEvent()?.link_maps || null;
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
    return item.nama_foto || `Galeri ${index + 1}`;
  }

  getPersonPhotoUrl(person: MempelaiPerson | null): string {
    const gender = this.getPersonGender(person);
    return this.normalizeMediaUrl(
      gender === 'pria'
        ? ((this.weddingData as any)?.photo_pria_url ||
          (this.weddingData as any)?.mempelai?.photo_pria_url ||
          (this.weddingData as any)?.mempelai?.pria?.photo_url ||
          (this.weddingData as any)?.photo_pria ||
          (this.weddingData as any)?.mempelai?.photo_pria ||
          person?.photo)
        : ((this.weddingData as any)?.photo_wanita_url ||
          (this.weddingData as any)?.mempelai?.photo_wanita_url ||
          (this.weddingData as any)?.mempelai?.wanita?.photo_url ||
          (this.weddingData as any)?.photo_wanita ||
          (this.weddingData as any)?.mempelai?.photo_wanita ||
          person?.photo)
    );
  }

  getGalleryPhotoUrl(item: any): string {
    const resolved = this.normalizeMediaUrl(
      item?.photo_url ||
      item?.image_url ||
      item?.preview_url ||
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

    console.log('[ImageUrlDebug]', {
      raw: item,
      resolved
    });

    return resolved;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    img.closest('.gallery-card')?.classList.add('is-image-missing');
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

  private getLavenderApiOrigin(): string {
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

  normalizeMediaUrl(value: any): string {
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

    const origin = this.getLavenderApiOrigin();

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
