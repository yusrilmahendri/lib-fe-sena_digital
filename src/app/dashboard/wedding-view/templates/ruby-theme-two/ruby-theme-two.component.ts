import { Component } from '@angular/core';
import { DashboardService, DashboardServiceType } from '../../../../dashboard.service';
import { GalleryItem, GuestWish, WeddingEvent } from '../../../../services/wedding-data.service';
import { LavenderBloomThemeComponent } from '../../themes/lavender-bloom/lavender-bloom-theme.component';

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
export class RubyThemeTwoComponent extends LavenderBloomThemeComponent {

  wishForm: WishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
  isSubmittingWish = false;

  private readonly FALLBACK_EVENT = {} as WeddingEvent;

  constructor(private svc: DashboardService) {
    super();
  }

  // ─── Display helpers ─────────────────────────────────────────────────

  getPrimaryDisplayName(): string {
    return this.getGroomNickname() || 'Arya';
  }

  getSecondaryDisplayName(): string {
    return this.getBrideNickname() || 'Sena';
  }

  getGuestName(): string {
    return 'Tamu Undangan';
  }

  getHeroDateLabel(): string {
    const ev = this.getPrimaryEvent();
    return ev ? this.formatDate(ev.tanggal_acara, 'long') : 'Tanggal menyusul';
  }

  // ─── Intro / Quote ────────────────────────────────────────────────────

  getInvitationIntro(): string {
    return (
      this.weddingData?.settings?.salam_atas ||
      'Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud mengundang ' +
      'Bapak/Ibu/Saudara/i untuk hadir di hari pernikahan kami.'
    );
  }

  getQuranQuote(): string {
    return (
      '"Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu ' +
      'dari jenismu sendiri, agar kamu cenderung dan merasa tenteram kepadanya."'
    );
  }

  getQuranSource(): string {
    return '— QS. Ar-Rum: 21';
  }

  // ─── Photos ──────────────────────────────────────────────────────────

  getBridePhoto(): string {
    return this.normalizeMediaUrl(this.getBride()?.photo) || '';
  }

  getGroomPhoto(): string {
    return this.normalizeMediaUrl(this.getGroom()?.photo) || '';
  }

  getSafeGalleryPhotos(): GalleryItem[] {
    return this.getGalleryItems();
  }

  getGalleryPhotos(): GalleryItem[] {
    return this.getSafeGalleryPhotos();
  }

  /** Public wrapper so the template can call the protected base-class helper. */
  public getRubyTwoGalleryPhotoUrl(item: any): string {
    return this.getGalleryPhotoUrl(item);
  }

  // ─── Parents ─────────────────────────────────────────────────────────

  getBrideParentLine(): string {
    return this.getParentsText(this.getBride(), 'wanita');
  }

  getGroomParentLine(): string {
    return this.getParentsText(this.getGroom(), 'pria');
  }

  // ─── Event cards ─────────────────────────────────────────────────────

  getAkadCard(): WeddingEvent {
    return this.getAkadEvent() ?? this.FALLBACK_EVENT;
  }

  getReceptionCard(): WeddingEvent {
    return this.getReceptionEvent() ?? this.FALLBACK_EVENT;
  }

  getEventAddress(event: WeddingEvent): string {
    return event?.alamat || 'Alamat menyusul';
  }

  getDetailEventVenue(event: WeddingEvent): string {
    return event?.nama_acara || 'Lokasi menyusul';
  }

  getAkadMapLink(): string | null {
    return (this.getAkadCard() as any)?.link_maps || this.getMapsLink();
  }

  getReceptionMapLink(): string | null {
    return (this.getReceptionCard() as any)?.link_maps || this.getMapsLink();
  }

  // ─── Bank accounts ────────────────────────────────────────────────────

  getVisibleBankAccounts(): any[] {
    const accounts = (this.weddingData as any)?.bank_accounts;
    return Array.isArray(accounts) ? accounts : [];
  }

  copyAccountNumber(number: string): void {
    if (!number) { return; }
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(number).catch(() => {});
    }
  }

  // ─── Wishes ──────────────────────────────────────────────────────────

  getDisplayedWishes(): GuestWish[] {
    return this.getGuestWishes().slice(0, 10);
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
    if (!userId) { return; }

    this.isSubmittingWish = true;
    const payload = {
      user_id: userId,
      nama: this.wishForm.nama.trim(),
      pesan: this.wishForm.pesan.trim(),
      kehadiran: this.wishForm.kehadiran || 'hadir',
    };

    this.svc.create(DashboardServiceType.ATTENDANCE, payload).subscribe({
      next: () => {
        this.isSubmittingWish = false;
        this.wishForm = { nama: '', pesan: '', kehadiran: 'hadir' };
      },
      error: () => {
        this.isSubmittingWish = false;
      },
    });
  }

  // ─── Love story ───────────────────────────────────────────────────────

  getLoveStoryItems(): Array<{ title: string; date: string; description: string }> {
    const stories = this.getStories();
    if (stories.length) {
      return stories.slice(0, 4).map((s, i) => ({
        title: s.title || this.fallbackStoryTitle(i),
        date: this.getStoryDate(s),
        description: this.getStoryLead(s) || this.fallbackStoryDescription(i),
      }));
    }
    return [
      {
        title: 'Pertemuan Pertama',
        date: '2019',
        description: 'Pertemuan di sebuah acara sederhana menjadi awal kisah yang penuh kehangatan.',
      },
      {
        title: 'Menjalin Hubungan',
        date: '2020',
        description: 'Kami saling mengenal lebih dekat dan tumbuh menjadi tempat pulang satu sama lain.',
      },
      {
        title: 'Lamaran',
        date: '2025',
        description: 'Dengan restu keluarga, kami mantap melangkah menuju ikatan yang lebih sakral.',
      },
      {
        title: 'Hari Bahagia',
        date: '2026',
        description: 'Kini kami mengundang Anda untuk menjadi bagian dari hari istimewa kami.',
      },
    ];
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

  // ─── Private helpers ──────────────────────────────────────────────────

  private fallbackStoryTitle(i: number): string {
    return (
      ['Pertemuan Pertama', 'Menjalin Hubungan', 'Lamaran', 'Hari Bahagia'][i] || 'Cerita Kami'
    );
  }

  private fallbackStoryDescription(i: number): string {
    return (
      [
        'Kami dipertemukan dalam sebuah momen yang sederhana, lalu saling menemukan alasan untuk bertahan.',
        'Perjalanan kami dipenuhi percakapan hangat, tawa, dan dukungan yang membuat cinta tumbuh semakin kuat.',
        'Dengan restu keluarga besar, kami memutuskan untuk melangkah ke tahap yang lebih serius.',
        'Hari ini menjadi awal baru bagi kami untuk membangun kisah rumah tangga bersama.',
      ][i] || 'Cerita cinta kami akan terus bertumbuh.'
    );
  }
}
