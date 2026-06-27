import { Component, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
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
import { environment } from '../../../../../environments/environment';

interface AttendanceRequest {
  user_id: number;
  nama: string;
  kehadiran: 'hadir' | 'tidak_hadir' | 'mungkin';
  pesan: string;
}

interface RubyWishForm {
  nama: string;
  kehadiran: 'hadir' | 'mungkin' | 'tidak_hadir' | '';
  pesan: string;
}

@Component({
  selector: 'wc-ruby-theme-one',
  templateUrl: './ruby-theme-one.component.html',
  styleUrls: ['./ruby-theme-one.component.scss'],
})
export class RubyThemeOneComponent extends LavenderBloomThemeComponent implements OnInit, OnChanges, OnDestroy {
  readonly floralAssetLeft = 'assets/thema-1/flower-1.png';
  readonly floralAssetRight = 'assets/thema-1/flower-2.png';
  readonly craftedByLabel = 'crafted by Sena Digital';
  receptionEvent: any;
  safeMapEmbedUrl?: SafeResourceUrl;
  googleMapsUrl = '';
  receptionVenueName = '';
  receptionAddress = '';
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
  isOpening = false;
  hasOpened = false;

  private readonly subscriptions = new Subscription();
  private openingTimer: any;
  private openingTimer2: any;
  private countdownTimer?: any;

  constructor(
    private sanitizer: DomSanitizer,
    private dashboardService: DashboardService,
    private toastService: ToastService
  ) {
    super();
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.setupRubyReceptionFromEvents();
    this.initCountdown();
    if (this.invitationOpened) {
      this.hasOpened = true;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['weddingData']) {
      this.setupRubyReceptionFromEvents();
      this.initCountdown();
    }
  }

  override openInvitation(): void {
    if (this.isOpening || this.hasOpened) {
      return;
    }

    this.isOpening = true;

    this.openingTimer = setTimeout(() => {
      super.openInvitation();
      this.hasOpened = true;
      this.isOpening = false;

      this.openingTimer2 = setTimeout(() => {
        const openingSection = document.querySelector('.ruby-opening-section');
        if (openingSection) {
          openingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }, 850);
  }

  override ngOnDestroy(): void {
    if (this.openingTimer) {
      clearTimeout(this.openingTimer);
    }
    if (this.openingTimer2) {
      clearTimeout(this.openingTimer2);
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
    this.subscriptions.unsubscribe();
    super.ngOnDestroy();
  }

  getGuestName(): string {
    return 'Tamu Undangan';
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
    const coverPhoto = this.getSafeImageUrl([
      this.weddingData?.mempelai?.cover_photo,
    ], '');
    console.log('[RubyCoverPhoto]', coverPhoto);
    return coverPhoto;
  }

  getBridePhoto(): string {
    return this.getSafeImageUrl([
      this.getBride()?.photo,
    ], '');
  }

  getGroomPhoto(): string {
    return this.getSafeImageUrl([
      this.getGroom()?.photo,
    ], '');
  }

  getSafeGalleryPhotos(): GalleryItem[] {
    const photos = this.getGalleryItems().filter((item) => {
      const photo = item?.photo;
      return !!photo && !this.isUnsafeThemeImage(photo);
    });
    console.log('[RubyGalleryPhotos]', photos);
    return photos;
  }

  override hasGallery(): boolean {
    return this.getSafeGalleryPhotos().length > 0;
  }

  get galleryPhotos(): GalleryItem[] {
    return this.getSafeGalleryPhotos();
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

  getPhotoUrl(photo: string | null | undefined): string {
    return this.resolveMediaUrl(photo);
  }

  getOpeningHeading(): string {
    return 'Bismillahirrahmanirrahim';
  }

  getInvitationIntro(): string {
    return this.weddingData?.settings?.salam_atas
      || 'Dengan memohon rahmat dan ridha Allah SWT, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk hadir pada acara pernikahan kami.';
  }

  getQuoteText(): string {
    return ((this.weddingData?.quotes || []).find((item) => item?.qoute)?.qoute || '').trim();
  }

  getQuoteSource(): string {
    const quote = (this.weddingData?.quotes || []).find((item) => item?.qoute) as any;
    return (
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
    return (quote?.name || '').trim();
  }

  getQuranQuote(): string {
    const quote = (this.weddingData?.quotes || []).find((item) => item?.qoute);
    return quote?.qoute
      || 'Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu cenderung dan merasa tenteram kepadanya, dan dijadikan-Nya di antaramu rasa kasih dan sayang.';
  }

  getQuranSource(): string {
    return 'QS. Ar-Rum: 21';
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
    return event.nama_acara || 'Lokasi acara';
  }

  getEventAddress(event: WeddingEvent): string {
    return event.alamat || 'Alamat acara akan diumumkan segera.';
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
    return this.getGuestWishes().slice(0, 8);
  }

  submitWish(): void {
    if (!this.isWishFormValid()) {
      this.toastService.showToast('Mohon lengkapi nama, kehadiran, dan ucapan.', 'warning');
      return;
    }

    if (!this.weddingData?.user_info?.id) {
      this.toastService.showToast('Data undangan belum lengkap untuk mengirim ucapan.', 'error');
      return;
    }

    this.isSubmittingWish = true;

    const payload: AttendanceRequest = {
      user_id: this.weddingData.user_info.id,
      nama: this.wishForm.nama.trim(),
      kehadiran: this.wishForm.kehadiran as 'hadir' | 'mungkin' | 'tidak_hadir',
      pesan: this.wishForm.pesan.trim(),
    };

    const attendanceSubscription = this.dashboardService.create(
      DashboardServiceType.ATTENDANCE,
      payload
    ).subscribe({
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
          } as WeddingData;
        }

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

  copyAccountNumber(value: string): void {
    const accountNumber = String(value || '').trim();
    if (!accountNumber) {
      this.toastService.showToast('Nomor rekening tidak tersedia.', 'warning');
      return;
    }

    const copyAction = navigator?.clipboard?.writeText(accountNumber);
    if (copyAction) {
      copyAction
        .then(() => this.toastService.showToast('Nomor rekening disalin', 'success'))
        .catch(() => this.fallbackCopy(accountNumber));
      return;
    }

    this.fallbackCopy(accountNumber);
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
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.toastService.showToast('Nomor rekening disalin', 'success');
    } catch {
      this.toastService.showToast('Gagal menyalin nomor rekening.', 'error');
    }
  }

  private getSafeImageUrl(candidates: Array<string | null | undefined>, fallback: string): string {
    for (const candidate of candidates) {
      if (!this.isUnsafeThemeImage(candidate)) {
        return this.resolveMediaUrl(candidate);
      }
    }
    return fallback;
  }

  private resolveMediaUrl(value: string | null | undefined): string {
    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return '';
    }

    if (/^(https?:)?\/\//i.test(rawValue) || rawValue.startsWith('data:')) {
      return rawValue;
    }

    const cleanValue = rawValue.replace(/^\/+/, '');
    const apiBaseUrl = String(environment.apiBaseUrl || '').replace(/\/api\/?$/, '');

    if (!apiBaseUrl) {
      return `/${cleanValue}`;
    }

    return `${apiBaseUrl}/${cleanValue}`;
  }

  private isUnsafeThemeImage(url: any): boolean {
    const value = String(url || '').toLowerCase().trim();
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
    const events = (this as any)?.data?.events || this.weddingData?.events || (this as any)?.events || [];

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
    this.receptionAddress = String(this.receptionEvent.alamat || '').trim();
    this.googleMapsUrl = String(this.receptionEvent.link_maps || '').trim();

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
