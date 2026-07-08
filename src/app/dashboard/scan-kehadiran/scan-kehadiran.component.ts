import { Component, OnDestroy, OnInit } from '@angular/core';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardService, ProfileResponse } from 'src/app/dashboard.service';
import { createGuestSlug, normalizeGuestName } from 'src/app/shared/guest-checkin/guest-checkin.utils';
import * as XLSX from 'xlsx';

interface StoredGuestInvitation {
  id?: string;
  name?: string;
  slug?: string;
  url?: string;
  guest_name?: string;
  invitation_url?: string;
  guest_token?: string;
  token?: string;
  checked_in_at?: string | null;
  checkedInAt?: string | null;
  lastScannedAt?: string | null;
  checkin_count?: number;
  checkinCount?: number;
}

interface ScanResult {
  guestName: string;
  invitationUrl: string;
  status: string;
  scannedAt: string;
  isError: boolean;
}

@Component({
  selector: 'wc-scan-kehadiran',
  templateUrl: './scan-kehadiran.component.html',
  styleUrls: ['./scan-kehadiran.component.scss'],
})
export class ScanKehadiranComponent implements OnInit, OnDestroy {
  public activeDomain = '';
  public manualDomain = '';
  public noticeMessage = '';
  public lastScanResult: ScanResult | null = null;
  public presentGuests: StoredGuestInvitation[] = [];
  public isScanning = false;

  private readonly scannerElementId = 'scan-kehadiran-reader';
  private scanner?: Html5Qrcode;
  private isScanPaused = false;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadProfileDomain();
  }

  ngOnDestroy(): void {
    this.stopScan();
  }

  public get resolvedDomain(): string {
    return this.normalizeWeddingDomain(this.activeDomain || this.manualDomain);
  }

  public onManualDomainChange(): void {
    this.activeDomain = this.normalizeWeddingDomain(this.manualDomain);
    this.loadPresentGuests();
  }

  public async startScan(): Promise<void> {
    const domain = this.resolvedDomain;

    if (!domain) {
      this.showNotice('Domain undangan wajib diisi sebelum mulai scan.');
      return;
    }

    if (this.isScanning) {
      return;
    }

    try {
      this.scanner = this.scanner || new Html5Qrcode(this.scannerElementId);
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => this.handleScanResult(decodedText),
        () => undefined
      );
      this.isScanning = true;
      this.showNotice('Scanner aktif.');
    } catch {
      this.showNotice('Gagal mengaktifkan kamera. Pastikan izin kamera sudah diberikan.');
    }
  }

  public async stopScan(): Promise<void> {
    if (!this.scanner || !this.isScanning) {
      return;
    }

    try {
      await this.scanner.stop();
      await this.scanner.clear();
    } catch {
      // Scanner cleanup is best-effort when the camera stream has already stopped.
    } finally {
      this.isScanning = false;
      this.isScanPaused = false;
    }
  }

  public async rescan(): Promise<void> {
    this.lastScanResult = null;
    this.isScanPaused = false;

    if (!this.isScanning) {
      await this.startScan();
      return;
    }

    try {
      this.scanner?.resume();
    } catch {
      // html5-qrcode throws when resume is called while already running.
    }
  }

  public handleScanResult(decodedText: string): void {
    if (this.isScanPaused) {
      return;
    }

    const scannedAt = new Date().toISOString();
    const parsed = this.parseInvitationUrl(decodedText);
    const domain = parsed.domain;

    if (!domain) {
      this.setScanResult({
        guestName: '-',
        invitationUrl: decodedText,
        status: 'QR tidak valid karena domain undangan tidak ditemukan.',
        scannedAt,
        isError: true,
      });
      this.pauseScannerBriefly();
      return;
    }

    if (!parsed.to) {
      this.setScanResult({
        guestName: '-',
        invitationUrl: decodedText,
        status: 'QR ini tidak memiliki nama tamu undangan.',
        scannedAt,
        isError: true,
      });
      this.pauseScannerBriefly();
      return;
    }

    this.activeDomain = domain;
    this.manualDomain = domain;

    const scannedName = this.normalizeGuestName(parsed.to);
    const scannedSlug = this.createGuestSlug(scannedName);
    const guests = this.loadGuests(domain);
    const guestIndex = guests.findIndex((guest) => this.isMatchingGuest(guest, scannedName, scannedSlug));

    if (guestIndex < 0) {
      this.setScanResult({
        guestName: '-',
        invitationUrl: decodedText,
        status: 'Data tamu tidak ditemukan di browser ini. Pastikan nama tamu sudah dibuat atau di-import di perangkat scanner.',
        scannedAt,
        isError: true,
      });
      this.pauseScannerBriefly();
      return;
    }

    const guest = guests[guestIndex];
    const alreadyCheckedIn = !!this.getCheckedInAt(guest);
    const updatedGuest: StoredGuestInvitation = {
      ...guest,
      checked_in_at: alreadyCheckedIn ? guest.checked_in_at || guest.checkedInAt || null : scannedAt,
      checkedInAt: alreadyCheckedIn ? guest.checkedInAt || guest.checked_in_at || null : scannedAt,
      lastScannedAt: scannedAt,
      checkin_count: alreadyCheckedIn ? this.getCheckinCount(guest) + 1 : 1,
      checkinCount: alreadyCheckedIn ? this.getCheckinCount(guest) + 1 : 1,
    };

    guests[guestIndex] = updatedGuest;
    this.saveGuests(domain, guests);
    this.presentGuests = this.filterPresentGuests(guests);

    this.setScanResult({
      guestName: this.getGuestName(updatedGuest),
      invitationUrl: this.getGuestInvitationUrl(updatedGuest),
      status: alreadyCheckedIn ? 'Sudah Pernah Scan' : 'Berhasil',
      scannedAt,
      isError: false,
    });
    this.pauseScannerBriefly();
  }

  public exportPresentGuestsToExcel(): void {
    const rows = this.presentGuests.map((guest) => ({
      nama_tamu: this.getGuestName(guest),
      link_undangan: this.getGuestInvitationUrl(guest),
      status_hadir: 'hadir',
      waktu_hadir: this.getCheckedInAt(guest) || '',
      jumlah_scan: this.getCheckinCount(guest),
      scan_terakhir: guest.lastScannedAt || '',
    }));

    if (!rows.length) {
      rows.push({
        nama_tamu: 'Belum ada tamu hadir',
        link_undangan: '',
        status_hadir: '',
        waktu_hadir: '',
        jumlah_scan: 0,
        scan_terakhir: '',
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 64 },
      { wch: 16 },
      { wch: 24 },
      { wch: 12 },
      { wch: 24 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tamu Hadir');
    XLSX.writeFile(workbook, `tamu-hadir-${this.resolvedDomain || 'undangan'}.xlsx`);
    this.showNotice('Data tamu hadir berhasil diekspor.');
  }

  public resetAllAttendance(): void {
    const domain = this.resolvedDomain;

    if (!domain) {
      this.showNotice('Domain undangan belum tersedia.');
      return;
    }

    const confirmed = window.confirm('Reset semua data kehadiran pada domain aktif?');

    if (!confirmed) {
      return;
    }

    const guests = this.loadGuests(domain).map((guest) => this.resetGuestAttendanceFields(guest));
    this.saveGuests(domain, guests);
    this.presentGuests = [];
    this.lastScanResult = null;
    this.showNotice('Semua data kehadiran berhasil direset.');
  }

  public resetGuestAttendance(guestToReset: StoredGuestInvitation): void {
    const domain = this.resolvedDomain;
    const guestKey = this.getGuestIdentityKey(guestToReset);

    if (!domain || !guestKey) {
      this.showNotice('Data tamu tidak valid.');
      return;
    }

    const guests = this.loadGuests(domain).map((guest) =>
      this.getGuestIdentityKey(guest) === guestKey ? this.resetGuestAttendanceFields(guest) : guest
    );
    this.saveGuests(domain, guests);
    this.presentGuests = this.filterPresentGuests(guests);
    this.showNotice('Status hadir tamu berhasil direset.');
  }

  public trackByGuest(index: number, guest: StoredGuestInvitation): string {
    return `${this.getGuestIdentityKey(guest) || this.getGuestName(guest)}-${index}`;
  }

  public getGuestName(guest: StoredGuestInvitation): string {
    return String(guest.guest_name || guest.name || 'Tamu Undangan').trim();
  }

  public getGuestInvitationUrl(guest: StoredGuestInvitation): string {
    return String(guest.invitation_url || guest.url || '').trim();
  }

  public getCheckedInAt(guest: StoredGuestInvitation): string | null {
    return guest.checkedInAt || guest.checked_in_at || null;
  }

  public getCheckinCount(guest: StoredGuestInvitation): number {
    return Number(guest.checkinCount ?? guest.checkin_count ?? 0);
  }

  private loadProfileDomain(): void {
    this.dashboardService.getProfile().subscribe({
      next: (response: ProfileResponse) => {
        this.activeDomain = this.normalizeWeddingDomain(response?.data?.domain_info?.domain);
        this.manualDomain = this.activeDomain;
        this.loadPresentGuests();
      },
      error: () => {
        this.showNotice('Gagal mengambil domain aktif. Silakan isi domain manual.');
      },
    });
  }

  private parseInvitationUrl(decodedText: string): { domain: string; token: string; to: string } {
    try {
      const url = new URL(decodedText);
      const segments = url.pathname.split('/').filter(Boolean);
      const weddingIndex = segments.indexOf('wedding');
      const domain = weddingIndex >= 0 ? segments[weddingIndex + 1] || '' : '';

      return {
        domain: this.normalizeWeddingDomain(domain),
        token: String(url.searchParams.get('token') || '').trim(),
        to: String(url.searchParams.get('to') || '').trim(),
      };
    } catch {
      return { domain: '', token: '', to: '' };
    }
  }

  private pauseScannerBriefly(): void {
    this.isScanPaused = true;

    try {
      this.scanner?.pause(true);
    } catch {
      // Scanner can already be paused between camera frames.
    }

    window.setTimeout(() => {
      this.isScanPaused = false;
      if (this.isScanning) {
        try {
          this.scanner?.resume();
        } catch {
          // Resuming is best-effort; the Scan Ulang button can recover manually.
        }
      }
    }, 1500);
  }

  private setScanResult(result: ScanResult): void {
    this.lastScanResult = result;
  }

  private loadPresentGuests(): void {
    const domain = this.resolvedDomain;
    this.presentGuests = domain ? this.filterPresentGuests(this.loadGuests(domain)) : [];
  }

  private filterPresentGuests(guests: StoredGuestInvitation[]): StoredGuestInvitation[] {
    return guests
      .filter((guest) => !!this.getCheckedInAt(guest))
      .sort((a, b) => {
        const timeA = new Date(a.lastScannedAt || this.getCheckedInAt(a) || '').getTime() || 0;
        const timeB = new Date(b.lastScannedAt || this.getCheckedInAt(b) || '').getTime() || 0;
        return timeB - timeA;
      });
  }

  private loadGuests(domain: string): StoredGuestInvitation[] {
    try {
      const raw = localStorage.getItem(this.getStorageKey(domain));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((guest) => this.normalizeStoredGuest(guest)) : [];
    } catch {
      return [];
    }
  }

  private saveGuests(domain: string, guests: StoredGuestInvitation[]): void {
    localStorage.setItem(this.getStorageKey(domain), JSON.stringify(guests.map((guest) => this.serializeGuest(guest))));
  }

  private getStorageKey(domain: string): string {
    return `guest_invitations_${this.normalizeWeddingDomain(domain) || 'unknown'}`;
  }

  private getGuestIdentityKey(guest: StoredGuestInvitation): string {
    return String(guest.id || guest.slug || this.createGuestSlug(this.getGuestName(guest))).trim();
  }

  private isMatchingGuest(guest: StoredGuestInvitation, scannedName: string, scannedSlug: string): boolean {
    const guestName = this.getGuestName(guest);

    return (
      this.normalizeGuestName(guestName) === scannedName ||
      String(guest.slug || '').trim() === scannedSlug ||
      this.createGuestSlug(guestName) === scannedSlug
    );
  }

  private normalizeGuestName(value: string): string {
    return normalizeGuestName(value);
  }

  private createGuestSlug(name: string): string {
    return createGuestSlug(name);
  }

  private normalizeStoredGuest(raw: StoredGuestInvitation): StoredGuestInvitation {
    const name = this.getGuestName(raw);
    const checkedInAt = raw.checkedInAt || raw.checked_in_at || null;
    const checkinCount = Number(raw.checkinCount ?? raw.checkin_count ?? 0);

    return {
      ...raw,
      id: raw.id || raw.token || raw.guest_token || raw.slug || this.createGuestSlug(name),
      name,
      slug: raw.slug || this.createGuestSlug(name),
      url: raw.url || raw.invitation_url || '',
      checkedInAt,
      checked_in_at: checkedInAt,
      checkinCount,
      checkin_count: checkinCount,
      lastScannedAt: raw.lastScannedAt || null,
    };
  }

  private serializeGuest(guest: StoredGuestInvitation): Record<string, any> {
    const serialized: Record<string, any> = {
      id: guest.id || this.getGuestIdentityKey(guest),
      name: this.getGuestName(guest),
      slug: guest.slug || this.createGuestSlug(this.getGuestName(guest)),
      url: this.getGuestInvitationUrl(guest),
      checkedInAt: this.getCheckedInAt(guest),
      checkinCount: this.getCheckinCount(guest),
      lastScannedAt: guest.lastScannedAt || null,
      createdAt: (guest as any).createdAt || new Date().toISOString(),
    };

    const token = String(guest.token || guest.guest_token || '').trim();
    if (token) {
      serialized['token'] = token;
    }

    return serialized;
  }

  private resetGuestAttendanceFields(guest: StoredGuestInvitation): StoredGuestInvitation {
    return {
      ...guest,
      checked_in_at: null,
      checkedInAt: null,
      lastScannedAt: null,
      checkin_count: 0,
      checkinCount: 0,
    };
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

  private showNotice(message: string): void {
    this.noticeMessage = message;
    window.setTimeout(() => {
      if (this.noticeMessage === message) {
        this.noticeMessage = '';
      }
    }, 3000);
  }
}
