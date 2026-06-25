import { Component, OnDestroy } from '@angular/core';
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
export class RubyThemeOneComponent extends LavenderBloomThemeComponent implements OnDestroy {
  readonly floralAsset = 'assets/flower.png';
  readonly craftedByLabel = 'crafted by Sena Digital';

  wishForm: RubyWishForm = {
    nama: '',
    kehadiran: '',
    pesan: '',
  };

  isSubmittingWish = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private dashboardService: DashboardService,
    private toastService: ToastService
  ) {
    super();
  }

  override ngOnDestroy(): void {
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
    return this.getSafeImageUrl([
      this.weddingData?.mempelai?.cover_photo,
      this.getBride()?.photo,
      this.getGroom()?.photo,
    ], this.createCouplePlaceholder());
  }

  getBridePhoto(): string {
    return this.getSafeImageUrl([
      this.getBride()?.photo,
    ], this.createPersonPlaceholder(this.getBrideNickname() || 'Isabela'));
  }

  getGroomPhoto(): string {
    return this.getSafeImageUrl([
      this.getGroom()?.photo,
    ], this.createPersonPlaceholder(this.getGroomNickname() || 'Ketut'));
  }

  getSafeGalleryPhotos(): GalleryItem[] {
    return this.getGalleryItems().filter((item) => {
      const photo = item?.photo;
      if (!this.isSafePublicImage(photo)) {
        return false;
      }

      return !this.isLikelyThemeSelectionImage(photo);
    });
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

  getGalleryCollection(): GalleryItem[] {
    return this.getSafeGalleryPhotos().slice(0, 5);
  }

  getOpeningHeading(): string {
    return 'Bismillahirrahmanirrahim';
  }

  getInvitationIntro(): string {
    return this.weddingData?.settings?.salam_atas
      || 'Dengan memohon rahmat dan ridha Allah SWT, kami bermaksud mengundang Bapak/Ibu/Saudara/i untuk hadir pada acara pernikahan kami.';
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
    return this.getReceptionCard().nama_acara || 'The LaFaYe Hotel';
  }

  getLocationAddressText(): string {
    return this.getReceptionCard().alamat || 'Jl. Merdeka No. 1, Jakarta';
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
    return this.formatDate(event.tanggal_acara, 'long');
  }

  getClosingDateLabel(): string {
    return this.getOpeningDateLabel();
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
      if (this.isSafePublicImage(candidate)) {
        return String(candidate);
      }
    }
    return fallback;
  }

  private isSafePublicImage(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }

    const normalized = String(value).toLowerCase().trim();
    if (!normalized) {
      return false;
    }

    const blockedTokens = [
      'assets/landing/template-',
      'assets/themas',
      'dashboard',
      '/dashboard/',
      'website/tampilan',
      'website-categories',
      'admin/themes',
      'admin/categories',
      'theme-preview',
      'preview tema',
      'preview-image',
      'thumbnail',
      '/themes/',
      'theme selection',
      'pilih tema',
      'screenshot',
      'soft-ivory',
      'lavender-bloom',
      'garden-whisper',
      'modern-vows',
      'champagne-rose',
      'velvet-mauve',
    ];

    return !blockedTokens.some((token) => normalized.includes(token));
  }

  private isLikelyThemeSelectionImage(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }

    const normalized = String(value).toLowerCase().trim();
    const suspiciousTokens = [
      'paket-ruby',
      'paket ruby',
      'preview',
      'tampilan',
      'thema',
      'theme-card',
      'template-card',
      'category',
    ];

    return suspiciousTokens.some((token) => normalized.includes(token));
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
}
