import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  GalleryItem,
  GuestWish,
  MempelaiPerson,
  SelectedThemeSummary,
  WeddingData,
  WeddingEvent,
  WeddingStory,
} from '../../../../services/wedding-data.service';

@Component({
  selector: 'wc-ruby-theme-one',
  templateUrl: './ruby-theme-one.component.html',
  styleUrls: ['./ruby-theme-one.component.scss'],
})
export class RubyThemeOneComponent {
  @Input() weddingData: WeddingData | null = null;
  @Input() invitationOpened = false;
  @Output() openInvitationRequested = new EventEmitter<void>();

  openInvitation(): void {
    this.openInvitationRequested.emit();
  }

  getSelectedTheme(): SelectedThemeSummary | null {
    return this.weddingData?.selected_theme || null;
  }

  getBride(): MempelaiPerson | null {
    return this.weddingData?.mempelai?.wanita || null;
  }

  getGroom(): MempelaiPerson | null {
    return this.weddingData?.mempelai?.pria || null;
  }

  getBrideName(): string {
    return this.getBride()?.nama_lengkap || this.getBride()?.nama_panggilan || 'Isabela';
  }

  getGroomName(): string {
    return this.getGroom()?.nama_lengkap || this.getGroom()?.nama_panggilan || 'Ketut';
  }

  getBrideNickname(): string {
    return this.getBride()?.nama_panggilan || 'Isabela';
  }

  getGroomNickname(): string {
    return this.getGroom()?.nama_panggilan || 'Ketut';
  }

  getCoupleDisplayName(): string {
    return `${this.getGroomNickname()} & ${this.getBrideNickname()}`;
  }

  getOpeningDate(): string {
    const primaryEvent = this.getPrimaryEvent();
    return primaryEvent ? this.formatDate(primaryEvent.tanggal_acara, 'short') : '12 • 12 • 2026';
  }

  getCoverPhoto(): string {
    return this.weddingData?.mempelai?.cover_photo
      || this.getBride()?.photo
      || this.getGroom()?.photo
      || 'assets/landing/template-1.png';
  }

  getOpeningMessage(): string {
    return this.weddingData?.settings?.salam_pembuka
      || 'Bismillahirrahmanirrahim';
  }

  getIntroductionText(): string {
    return this.weddingData?.settings?.salam_atas
      || 'Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk hadir pada hari bahagia kami.';
  }

  getClosingText(): string {
    return this.weddingData?.settings?.salam_bawah
      || 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir serta memberikan doa restu.';
  }

  getBrideParents(): string {
    const bride = this.getBride();
    if (bride?.ayah && bride?.ibu) {
      return `Putri dari Bapak ${bride.ayah} & Ibu ${bride.ibu}`;
    }

    return 'Putri dari keluarga tercinta';
  }

  getGroomParents(): string {
    const groom = this.getGroom();
    if (groom?.ayah && groom?.ibu) {
      return `Putra dari Bapak ${groom.ayah} & Ibu ${groom.ibu}`;
    }

    return 'Putra dari keluarga tercinta';
  }

  getAkadEvent(): WeddingEvent | null {
    const events = this.getEvents();
    return events.find((event) => /akad|nikah|pemberkatan/i.test(event.nama_acara || '')) || events[0] || null;
  }

  getReceptionEvent(): WeddingEvent | null {
    const events = this.getEvents();
    return events.find((event) => /resepsi|reception|ngunduh/i.test(event.nama_acara || '')) || events[1] || events[0] || null;
  }

  getPrimaryEvent(): WeddingEvent | null {
    return this.getAkadEvent() || this.getReceptionEvent() || this.getEvents()[0] || null;
  }

  getEvents(): WeddingEvent[] {
    return Array.isArray(this.weddingData?.events) ? this.weddingData?.events || [] : [];
  }

  getStories(): WeddingStory[] {
    return Array.isArray(this.weddingData?.stories) ? this.weddingData?.stories || [] : [];
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

  hasGallery(): boolean {
    return this.getGalleryItems().length > 0;
  }

  hasGuestWishes(): boolean {
    return this.getGuestWishes().length > 0;
  }

  getLocationTitle(): string {
    return this.getReceptionEvent()?.nama_acara || 'Lokasi Resepsi';
  }

  getLocationAddress(): string {
    return this.getReceptionEvent()?.alamat || this.getAkadEvent()?.alamat || 'Lokasi acara akan diumumkan segera.';
  }

  getMapsLink(): string | null {
    return this.getReceptionEvent()?.link_maps || this.getAkadEvent()?.link_maps || null;
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
    const now = Date.now();
    const remaining = Math.max(target - now, 0);

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
      return mode === 'short' ? '12 • 12 • 2026' : 'Sabtu, 12 Desember 2026';
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
    if (!event) {
      return 'Pukul 00.00 WIB - selesai';
    }

    const start = event.start_acara || '00:00';
    const end = event.end_acara ? ` - ${event.end_acara}` : '';
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

  private padNumber(value: number): string {
    return String(Math.max(value, 0)).padStart(2, '0');
  }
}
