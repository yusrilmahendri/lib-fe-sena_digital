import { Component, OnInit } from '@angular/core';
import { DashboardService, ProfileResponse } from 'src/app/dashboard.service';

interface GeneratedGuestInvitation {
  name: string;
  url: string;
  createdAt: string;
}

@Component({
  selector: 'wc-bagi-undangan',
  templateUrl: './bagi-undangan.component.html',
  styleUrls: ['./bagi-undangan.component.scss']
})
export class BagiUndanganComponent implements OnInit {
  public guestName = '';
  public generatedGuestUrl = '';
  public publicWeddingDomain = '';
  public noticeMessage = '';
  public generatedGuests: GeneratedGuestInvitation[] = [];

  private readonly storagePrefix = 'generated_guest_invitations';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadProfileDomain();
  }

  private loadProfileDomain(): void {
    this.dashboardService.getProfile().subscribe({
      next: (response: ProfileResponse) => {
        this.publicWeddingDomain = this.normalizeWeddingDomain(response?.data?.domain_info?.domain);
        this.loadStoredGuests();

        if (!this.publicWeddingDomain) {
          this.showNotice('Domain undangan belum tersedia.');
        }
      },
      error: () => {
        this.showNotice('Gagal mengambil domain undangan.');
      }
    });
  }

  private normalizeWeddingDomain(value: any): string {
    if (!value) return '';

    return String(value)
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\.sena-digital\.com\/wedding\//, '')
      .replace(/^sena-digital\.com\/wedding\//, '')
      .replace(/^www\.sena-digital\.com\//, '')
      .replace(/^sena-digital\.com\//, '')
      .replace(/^\/wedding\//, '')
      .replace(/^\//, '')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/$/, '');
  }

  public generateGuestInvitation(): void {
    const name = String(this.guestName || '').trim();

    if (!name) {
      this.showNotice('Nama tamu wajib diisi.');
      return;
    }

    if (!this.publicWeddingDomain) {
      this.showNotice('Domain undangan belum tersedia.');
      return;
    }

    const baseUrl = `https://www.sena-digital.com/wedding/${encodeURIComponent(this.publicWeddingDomain)}`;
    this.generatedGuestUrl = `${baseUrl}?to=${encodeURIComponent(name)}`;
    this.saveGeneratedGuest(name, this.generatedGuestUrl);
    this.showNotice('Link undangan personal berhasil dibuat.');
  }

  public copyGuestInvitation(url = this.generatedGuestUrl): void {
    if (!url) return;

    navigator.clipboard?.writeText(url)
      .then(() => this.showNotice('Link undangan berhasil disalin.'))
      .catch(() => this.showNotice('Gagal menyalin link undangan.'));
  }

  public shareGuestInvitationWhatsapp(url = this.generatedGuestUrl): void {
    if (!url) return;

    const message =
      `Assalamu'alaikum, dengan hormat kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada acara pernikahan kami.\n\nSilakan buka undangan berikut:\n${url}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  public trackByGuest(index: number, guest: GeneratedGuestInvitation): string {
    return `${guest.createdAt}-${guest.name}-${index}`;
  }

  private saveGeneratedGuest(name: string, url: string): void {
    const nextGuest: GeneratedGuestInvitation = {
      name,
      url,
      createdAt: new Date().toISOString()
    };

    this.generatedGuests = [
      nextGuest,
      ...this.generatedGuests.filter((guest) => guest.url !== url)
    ].slice(0, 50);

    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.generatedGuests));
    } catch {
      // Local history is optional; link generation should still work.
    }
  }

  private loadStoredGuests(): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      this.generatedGuests = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.generatedGuests = [];
    }
  }

  private getStorageKey(): string {
    return `${this.storagePrefix}_${this.publicWeddingDomain || 'unknown'}`;
  }

  private showNotice(message: string): void {
    this.noticeMessage = message;
    window.setTimeout(() => {
      if (this.noticeMessage === message) {
        this.noticeMessage = '';
      }
    }, 3000);
  }
}
