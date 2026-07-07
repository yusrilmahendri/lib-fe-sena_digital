import { Component, OnDestroy, OnInit } from '@angular/core';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardService, ProfileResponse } from 'src/app/dashboard.service';
import {
  getCheckedInGuests,
  GuestInvitationRecord,
  GuestScanProcessResult,
  processGuestQrScan,
  resetAllGuestAttendance,
  resetGuestAttendance,
} from 'src/app/shared/guest-checkin/guest-checkin.utils';
import * as XLSX from 'xlsx';

interface LastScanResultView {
  guestName: string;
  url: string;
  status: string;
  statusClass: 'success' | 'warning' | 'danger';
  scannedAt: string;
  message: string;
}

@Component({
  selector: 'wc-scan-kehadiran',
  templateUrl: './scan-kehadiran.component.html',
  styleUrls: ['./scan-kehadiran.component.scss'],
})
export class ScanKehadiranComponent implements OnInit, OnDestroy {
  readonly scannerElementId = 'scan-kehadiran-qr-reader';
  readonly warningMessage =
    'Fitur scan kehadiran ini sementara tersimpan di browser. Jika panitia memakai perangkat berbeda, browser berbeda, cache dihapus, atau data tamu belum di-import, sistem tidak dapat menemukan tamu. Untuk penggunaan acara sebenarnya, data scan nanti harus disimpan ke backend.';

  publicWeddingDomain = '';
  manualDomain = '';
  noticeMessage = '';
  isScanning = false;
  isScannerLoading = false;
  scannerError = '';
  checkedInGuests: GuestInvitationRecord[] = [];
  lastScanResult: LastScanResultView | null = null;

  private html5QrCode: Html5Qrcode | null = null;
  private scanLocked = false;
  private scanResumeTimer?: number;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadProfileDomain();
  }

  ngOnDestroy(): void {
    this.clearScanResumeTimer();
    void this.stopScan();
  }

  get activeDomain(): string {
    return String(this.publicWeddingDomain || this.manualDomain || '').trim();
  }

  async startScan(): Promise<void> {
    if (!this.activeDomain) {
      this.showNotice('Domain undangan belum tersedia.');
      return;
    }

    if (this.isScanning) {
      return;
    }

    this.scannerError = '';
    this.isScannerLoading = true;

    try {
      this.html5QrCode = new Html5Qrcode(this.scannerElementId);
      const cameras = await Html5Qrcode.getCameras();

      if (!cameras.length) {
        throw new Error('Kamera tidak ditemukan pada perangkat ini.');
      }

      const preferredCamera =
        cameras.find((camera) => /back|rear|environment/i.test(camera.label)) ||
        cameras[cameras.length - 1];

      await this.html5QrCode.start(
        preferredCamera.id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => this.handleScanResult(decodedText),
        () => undefined
      );

      this.isScanning = true;
    } catch (error) {
      this.scannerError = this.extractErrorMessage(error);
      await this.stopScan();
    } finally {
      this.isScannerLoading = false;
    }
  }

  async stopScan(): Promise<void> {
    this.clearScanResumeTimer();
    this.scanLocked = false;

    if (!this.html5QrCode) {
      this.isScanning = false;
      return;
    }

    try {
      if (this.isScanning) {
        await this.html5QrCode.stop();
      }

      await this.html5QrCode.clear();
    } catch {
      // Scanner may already be stopped.
    } finally {
      this.html5QrCode = null;
      this.isScanning = false;
    }
  }

  async restartScan(): Promise<void> {
    await this.stopScan();
    await this.startScan();
  }

  handleScanResult(decodedText: string): void {
    if (this.scanLocked || !this.activeDomain) {
      return;
    }

    const result = processGuestQrScan(
      decodedText,
      this.activeDomain,
      this.getInvitationShareOrigin()
    );

    this.applyScanResult(result);
    this.refreshCheckedInGuests();

    this.scanLocked = true;
    this.clearScanResumeTimer();
    this.scanResumeTimer = window.setTimeout(() => {
      this.scanLocked = false;
    }, 1500);
  }

  resetGuestCheckin(guest: GuestInvitationRecord): void {
    if (!this.activeDomain) {
      this.showNotice('Domain undangan belum tersedia.');
      return;
    }

    const confirmed = window.confirm(`Reset kehadiran untuk ${guest.name}?`);

    if (!confirmed) {
      return;
    }

    const success = resetGuestAttendance(
      this.activeDomain,
      guest.id,
      this.getInvitationShareOrigin()
    );

    if (success) {
      this.refreshCheckedInGuests();
      this.showNotice(`Kehadiran ${guest.name} berhasil direset.`);
    } else {
      this.showNotice('Gagal mereset kehadiran tamu.');
    }
  }

  resetAllCheckins(): void {
    if (!this.activeDomain) {
      this.showNotice('Domain undangan belum tersedia.');
      return;
    }

    const confirmed = window.confirm(
      'Reset semua kehadiran tamu untuk domain ini? Tindakan ini tidak dapat dibatalkan.'
    );

    if (!confirmed) {
      return;
    }

    resetAllGuestAttendance(this.activeDomain, this.getInvitationShareOrigin());
    this.refreshCheckedInGuests();
    this.lastScanResult = null;
    this.showNotice('Semua kehadiran tamu berhasil direset.');
  }

  exportCheckedInGuests(): void {
    const rows = this.checkedInGuests.map((guest) => ({
      nama_tamu: guest.name,
      link_undangan: guest.url,
      token: guest.token,
      status_hadir: 'Hadir',
      waktu_hadir: guest.checkedInAt || '',
      jumlah_scan: guest.checkinCount || 0,
      scan_terakhir: guest.lastScannedAt || guest.checkedInAt || '',
    }));

    if (!rows.length) {
      rows.push({
        nama_tamu: 'Belum ada tamu hadir',
        link_undangan: '',
        token: '',
        status_hadir: 'Hadir',
        waktu_hadir: '',
        jumlah_scan: 0,
        scan_terakhir: '',
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 72 },
      { wch: 36 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 22 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tamu Hadir');
    XLSX.writeFile(workbook, this.buildExportFileName());
    this.showNotice('Daftar tamu hadir berhasil diekspor.');
  }

  trackByGuestId(_index: number, guest: GuestInvitationRecord): string {
    return guest.id;
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  getShortToken(token: string): string {
    const cleanToken = String(token || '').trim();

    if (cleanToken.length <= 10) {
      return cleanToken;
    }

    return `${cleanToken.slice(0, 8)}...`;
  }

  onDomainInputChange(): void {
    this.refreshCheckedInGuests();
  }

  private loadProfileDomain(): void {
    this.dashboardService.getProfile().subscribe({
      next: (response: ProfileResponse) => {
        this.publicWeddingDomain = this.normalizeWeddingDomain(response?.data?.domain_info?.domain);
        this.refreshCheckedInGuests();

        if (!this.publicWeddingDomain) {
          this.showNotice('Domain undangan belum tersedia. Silakan isi domain manual.');
        }
      },
      error: () => {
        this.showNotice('Gagal mengambil domain undangan.');
      },
    });
  }

  private refreshCheckedInGuests(): void {
    if (!this.activeDomain) {
      this.checkedInGuests = [];
      return;
    }

    this.checkedInGuests = getCheckedInGuests(
      this.activeDomain,
      this.getInvitationShareOrigin()
    );
  }

  private applyScanResult(result: GuestScanProcessResult): void {
    const scannedAt = result.scannedAt || new Date().toISOString();
    let statusClass: LastScanResultView['statusClass'] = 'danger';

    if (result.status === 'Berhasil') {
      statusClass = 'success';
    } else if (result.status === 'Sudah Pernah Scan') {
      statusClass = 'warning';
    }

    this.lastScanResult = {
      guestName: result.guest?.name || '-',
      url: result.guest?.url || '',
      status: result.status,
      statusClass,
      scannedAt,
      message: result.message,
    };

    if (result.ok) {
      this.showNotice(result.message);
      return;
    }

    this.showNotice(result.message);
  }

  private normalizeWeddingDomain(value: unknown): string {
    if (!value) {
      return '';
    }

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

  private getInvitationShareOrigin(): string {
    const origin = String(window.location.origin || '').replace(/\/$/, '');

    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'https://www.sena-digital.com';
    }

    return origin;
  }

  private buildExportFileName(): string {
    const domain = this.activeDomain || 'undangan';
    return `tamu-hadir-${domain}.xlsx`;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Gagal membuka kamera scanner.';
  }

  private clearScanResumeTimer(): void {
    if (this.scanResumeTimer) {
      window.clearTimeout(this.scanResumeTimer);
      this.scanResumeTimer = undefined;
    }
  }

  private showNotice(message: string): void {
    this.noticeMessage = message;
    window.setTimeout(() => {
      if (this.noticeMessage === message) {
        this.noticeMessage = '';
      }
    }, 3500);
  }
}
