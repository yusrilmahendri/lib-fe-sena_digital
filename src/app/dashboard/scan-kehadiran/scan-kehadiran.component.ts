import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardService, ProfileResponse } from 'src/app/dashboard.service';
import { createGuestSlug } from 'src/app/shared/guest-checkin/guest-checkin.utils';
import * as XLSX from 'xlsx';

interface GuestInvitation {
  id?: string;
  name?: string;
  slug?: string;
  url?: string;
  checkedInAt?: string | null;
  lastScannedAt?: string | null;
  checkinCount?: number;
  guest?: {
    name?: string;
    nama?: string;
  };
  [key: string]: any;
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
  public allGuests: GuestInvitation[] = [];
  public attendanceList: GuestInvitation[] = [];
  public isScanning = false;

  private readonly scannerElementId = 'scan-kehadiran-reader';
  private scanner?: Html5Qrcode;
  private isScanPaused = false;

  constructor(
    private dashboardService: DashboardService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

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
    this.reloadGuestsFromStorage();
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
        (decodedText) => this.ngZone.run(() => this.handleScanResult(decodedText)),
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

    const activeDomain = this.resolvedDomain;

    if (!activeDomain) {
      this.setScanResult({
        guestName: '-',
        invitationUrl: decodedText,
        status: 'Domain undangan aktif belum tersedia.',
        scannedAt,
        isError: true,
      });
      this.pauseScannerBriefly();
      return;
    }

    if (domain !== activeDomain) {
      this.setScanResult({
        guestName: '-',
        invitationUrl: decodedText,
        status: 'QR berasal dari domain undangan yang berbeda.',
        scannedAt,
        isError: true,
      });
      this.pauseScannerBriefly();
      return;
    }

    this.reloadGuestsFromStorage(activeDomain);

    const guestSlug = String(parsed.to || '').trim();
    const guestIndex = this.allGuests.findIndex((guest) => String(guest.slug || '').trim() === guestSlug);

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

    const guest = { ...this.allGuests[guestIndex] };
    const alreadyCheckedIn = !!this.getCheckedInAt(guest);

    guest.checkedInAt = scannedAt;
    guest.lastScannedAt = scannedAt;
    guest.checkinCount = this.getCheckinCount(guest) + 1;

    const updatedGuests = this.allGuests.map((item, index) => index === guestIndex ? guest : item);
    this.saveGuests(activeDomain, updatedGuests);
    this.reloadGuestsFromStorage(activeDomain);
    this.loadAttendanceList();

    this.setScanResult({
      guestName: this.getGuestName(guest),
      invitationUrl: this.getGuestInvitationUrl(guest),
      status: alreadyCheckedIn ? 'Sudah Pernah Scan' : 'Berhasil',
      scannedAt,
      isError: false,
    });
    this.pauseScannerBriefly();
  }

  public exportPresentGuestsToExcel(): void {
    const rows = this.attendanceList.map((guest) => ({
      Nama: this.getGuestName(guest),
      Slug: guest.slug || '',
      Link: this.getGuestInvitationUrl(guest),
      'Waktu Hadir': this.getCheckedInAt(guest) || '',
      'Jumlah Scan': this.getCheckinCount(guest),
    }));

    if (!rows.length) {
      rows.push({
        Nama: 'Belum ada tamu hadir',
        Slug: '',
        Link: '',
        'Waktu Hadir': '',
        'Jumlah Scan': 0,
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 28 },
      { wch: 64 },
      { wch: 24 },
      { wch: 12 },
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

    const guests = this.allGuests.length ? this.allGuests : this.loadGuests(domain);
    const resetGuests = guests.map((guest) => this.resetGuestAttendanceFields(guest));
    this.saveGuests(domain, resetGuests);
    this.reloadGuestsFromStorage(domain);
    this.lastScanResult = null;
    this.showNotice('Semua data kehadiran berhasil direset.');
  }

  public resetGuestAttendance(guestToReset: GuestInvitation): void {
    const domain = this.resolvedDomain;
    const guestKey = this.getGuestIdentityKey(guestToReset);

    if (!domain || !guestKey) {
      this.showNotice('Data tamu tidak valid.');
      return;
    }

    const updatedGuests = this.allGuests.map((guest) =>
      this.getGuestIdentityKey(guest) === guestKey ? this.resetGuestAttendanceFields(guest) : guest
    );
    this.saveGuests(domain, updatedGuests);
    this.reloadGuestsFromStorage(domain);
    this.showNotice('Status hadir tamu berhasil direset.');
  }

  public resetAttendance(guest: GuestInvitation): void {
    this.resetGuestAttendance(guest);
  }

  public trackByGuest(index: number, guest: GuestInvitation): string {
    return `${this.getGuestIdentityKey(guest) || this.getGuestName(guest)}-${index}`;
  }

  public getGuestName(guest: GuestInvitation): string {
    return String(
      guest.name ||
      guest['guest_name'] ||
      guest['nama_tamu'] ||
      guest.guest?.name ||
      guest.guest?.nama ||
      'Tamu Undangan'
    ).trim();
  }

  public getGuestInvitationUrl(guest: GuestInvitation): string {
    return String(
      guest.url ||
      guest['invitation_link'] ||
      guest['link_undangan'] ||
      guest['guest_url'] ||
      ''
    ).trim();
  }

  public getCheckedInAt(guest: GuestInvitation): string | null {
    return this.getAttendanceTime(guest);
  }

  public getCheckinCount(guest: GuestInvitation): number {
    return Number(guest.checkinCount ?? guest['scan_count'] ?? guest['jumlah_scan'] ?? guest['total_scan'] ?? 0);
  }

  public get checkedInGuests(): GuestInvitation[] {
    return this.attendanceList;
  }

  public formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  private loadProfileDomain(): void {
    this.dashboardService.getProfile().subscribe({
      next: (response: ProfileResponse) => {
        this.activeDomain = this.getActiveDomainFromProfile(response);
        this.manualDomain = this.activeDomain;
        this.reloadGuestsFromStorage();
      },
      error: () => {
        this.showNotice('Gagal mengambil domain aktif. Silakan isi domain manual.');
      },
    });
  }

  private getActiveDomainFromProfile(response: ProfileResponse): string {
    const data: any = response?.data || {};

    return this.normalizeWeddingDomain(
      data?.activeWebsite?.domain ||
      data?.active_website?.domain ||
      data?.website_domain ||
      data?.domain_info?.domain ||
      data?.currentDomain ||
      data?.current_domain ||
      ''
    );
  }

  private parseInvitationUrl(decodedText: string): { domain: string; to: string } {
    try {
      const url = new URL(decodedText);
      const segments = url.pathname.split('/').filter(Boolean);
      const weddingIndex = segments.indexOf('wedding');
      const domain = weddingIndex >= 0 ? segments[weddingIndex + 1] || '' : '';

      return {
        domain: this.normalizeWeddingDomain(domain),
        to: String(url.searchParams.get('to') || '').trim(),
      };
    } catch {
      return { domain: '', to: '' };
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

  private reloadGuestsFromStorage(domainParam?: string): void {
    const domain = this.normalizeWeddingDomain(domainParam || this.resolvedDomain);
    this.allGuests = domain ? this.loadGuests(domain) : [];
    this.loadAttendanceList();
    this.cdr.detectChanges();
  }

  private loadGuests(domain: string): GuestInvitation[] {
    try {
      const raw = localStorage.getItem(this.getStorageKey(domain));
      const parsed = raw ? JSON.parse(raw) : [];
      const rows = this.extractAttendanceRows(parsed);

      return rows.length
        ? rows.reduce((guests: GuestInvitation[], guest) => {
          guests.push(this.normalizeStoredGuest(guest, domain, guests));
          return guests;
        }, [])
        : [];
    } catch {
      return [];
    }
  }

  private saveGuests(domain: string, guests: GuestInvitation[]): void {
    localStorage.setItem(this.getStorageKey(domain), JSON.stringify(guests.map((guest) => this.serializeGuest(guest))));
  }

  private getStorageKey(domain: string): string {
    return `guest_invitations_${this.normalizeWeddingDomain(domain) || 'unknown'}`;
  }

  private getGuestIdentityKey(guest: GuestInvitation): string {
    return String(guest.id || guest['guest_id'] || guest.slug || this.createGuestSlug(this.getGuestName(guest))).trim();
  }

  private loadAttendanceList(): void {
    this.attendanceList = [...this.extractAttendanceRows(this.allGuests)]
      .filter((guest) => this.isPresentGuest(guest))
      .sort((a, b) => {
        const timeA = new Date(this.getLastScanAt(a) || this.getCheckedInAt(a) || 0).getTime();
        const timeB = new Date(this.getLastScanAt(b) || this.getCheckedInAt(b) || 0).getTime();
        return timeB - timeA;
      });
  }

  private extractAttendanceRows(response: any): GuestInvitation[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.result)) return response.result;
    if (Array.isArray(response?.attendances)) return response.attendances;
    return [];
  }

  private isPresentGuest(guest: GuestInvitation): boolean {
    if (this.getAttendanceTime(guest, false)) {
      return true;
    }

    const status = this.normalizeStatus(this.getAttendanceStatus(guest));
    const presentValues = ['berhasil', 'success', 'hadir', 'present'];

    if (presentValues.includes(status)) {
      return true;
    }

    const attendedValue = guest['is_present'] ?? guest['attended'] ?? guest['present'];
    return attendedValue === true || attendedValue === 1 || String(attendedValue).toLowerCase() === 'true';
  }

  private getAttendanceStatus(guest: GuestInvitation): string {
    return String(guest['status'] ?? guest['scan_status'] ?? guest['attendance_status'] ?? '').trim();
  }

  private normalizeStatus(value: string): string {
    return String(value || '').trim().toLowerCase();
  }

  private getAttendanceTime(guest: GuestInvitation, includeCreatedAt = true): string | null {
    const value = guest.checkedInAt ||
      guest['checked_in_at'] ||
      guest['attended_at'] ||
      guest['waktu_hadir'] ||
      guest['scanned_at'] ||
      guest['scan_time'] ||
      (
        includeCreatedAt && this.normalizeStatus(this.getAttendanceStatus(guest))
          ? guest['created_at']
          : null
      );

    return value ? String(value) : null;
  }

  public getLastScanAt(guest: GuestInvitation): string | null {
    const value = guest.lastScannedAt ||
      guest['last_scan_at'] ||
      guest['scan_terakhir'] ||
      guest['updated_at'] ||
      this.getAttendanceTime(guest);

    return value ? String(value) : null;
  }

  private createGuestSlug(name: string): string {
    return createGuestSlug(name);
  }

  private normalizeStoredGuest(
    raw: GuestInvitation,
    domain: string,
    existingGuests: GuestInvitation[] = []
  ): GuestInvitation {
    const name = this.getGuestName(raw);
    const checkedInAt = this.getAttendanceTime(raw);
    const checkinCount = this.getCheckinCount(raw);
    const rawSlug = String(raw.slug || '').trim();
    const slugExists = rawSlug && existingGuests.some((guest) => guest.slug === rawSlug);
    const slug = rawSlug && !slugExists ? rawSlug : this.generateUniqueSlug(rawSlug || name, existingGuests);

    return {
      id: raw.id || slug,
      name,
      slug,
      url: this.getGuestInvitationUrl(raw) || this.buildGuestInvitationUrl(domain, slug),
      checkedInAt,
      checkinCount,
      lastScannedAt: this.getLastScanAt(raw),
    };
  }

  private buildGuestInvitationUrl(domain: string, slug: string): string {
    const origin = String(window.location.origin || '').replace(/\/$/, '');
    const shareOrigin = !origin || origin.includes('localhost') || origin.includes('127.0.0.1')
      ? 'https://www.sena-digital.com'
      : origin;

    return `${shareOrigin}/wedding/${encodeURIComponent(domain)}?to=${encodeURIComponent(slug)}`;
  }

  private generateUniqueSlug(name: string, existingGuests: GuestInvitation[]): string {
    const baseSlug = this.createGuestSlug(name) || 'tamu';
    const usedSlugs = new Set(existingGuests.map((guest) => guest.slug).filter(Boolean));

    if (!usedSlugs.has(baseSlug)) {
      return baseSlug;
    }

    let suffix = 2;
    let candidate = `${baseSlug}-${suffix}`;

    while (usedSlugs.has(candidate)) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private serializeGuest(guest: GuestInvitation): Record<string, any> {
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

    return serialized;
  }

  private resetGuestAttendanceFields(guest: GuestInvitation): GuestInvitation {
    return {
      ...guest,
      checkedInAt: null,
      lastScannedAt: null,
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
