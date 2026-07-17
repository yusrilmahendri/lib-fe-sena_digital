import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Html5Qrcode } from 'html5-qrcode';
import { DashboardService, DashboardServiceType, ProfileResponse } from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { createGuestSlug } from 'src/app/shared/guest-checkin/guest-checkin.utils';

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

interface ParsedInvitationQr {
  domain: string;
  guestToken: string;
  to: string;
  isValidInvitationUrl: boolean;
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
  public attendanceTotal = 0;
  public isScanning = false;
  public isAttendanceLoading = false;

  private readonly scannerElementId = 'scan-kehadiran-reader';
  private scanner?: Html5Qrcode;
  private isScanPaused = false;
  private isSubmittingScan = false;

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
    this.loadAttendanceListFromBackend();
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
    if (this.isScanPaused || this.isSubmittingScan) {
      return;
    }

    const scannedAt = new Date().toISOString();
    const parsed = this.parseInvitationUrl(decodedText);
    const domain = parsed.domain;

    if (!String(decodedText || '').trim()) {
      this.setScanResult({
        guestName: '-',
        invitationUrl: decodedText,
        status: 'Format link undangan tidak valid.',
        scannedAt,
        isError: true,
      });
      this.pauseScannerBriefly();
      return;
    }

    const activeDomain = this.resolvedDomain;

    if (parsed.isValidInvitationUrl && domain && activeDomain && domain !== activeDomain) {
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

    this.submitAttendanceScan(decodedText, domain || activeDomain, parsed.guestToken, parsed.to, scannedAt);
  }

  public exportPresentGuestsToExcel(): void {
    const domain = this.resolvedDomain;

    if (!domain) {
      this.showNotice('Domain undangan belum tersedia.');
      return;
    }

    const exportUrl = `${this.dashboardService.getUrl(DashboardServiceType.ATTENDANCE)}/export`;
    this.dashboardService.httpSvc.get(exportUrl, {
      params: { domain },
      responseType: 'blob',
    }).subscribe({
      next: (blob) => {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `tamu-hadir-${domain}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(objectUrl);
        this.showNotice('Data tamu hadir berhasil diekspor.');
      },
      error: (error) => {
        console.error('[ATTENDANCE_EXPORT_ERROR]', error);
        this.showNotice(this.resolveBackendErrorMessage(error, 'Gagal mengekspor data tamu hadir.'));
      }
    });
  }

  public resetAllAttendance(): void {
    this.showNotice('Reset kehadiran belum tersedia di backend final.');
  }

  public resetGuestAttendance(guestToReset: GuestInvitation): void {
    this.showNotice('Reset kehadiran belum tersedia di backend final.');
  }

  public resetAttendance(guest: GuestInvitation): void {
    this.resetGuestAttendance(guest);
  }

  // public trackByGuest(index: number, guest: GuestInvitation): string {
  //   return `${this.getGuestIdentityKey(guest) || this.getGuestName(guest)}-${index}`;
  // }
  public readonly trackByGuest = (
      index: number,
      guest: GuestInvitation
    ): string => {
      const identity =
        guest?.id ??
        guest?.['attendance_id'] ??
        guest?.['guest_id'] ??
        guest?.['invitation_guest_id'] ??
        guest?.['guest_token'] ??
        guest?.['token'] ??
        guest?.slug ??
        guest?.name ??
        guest?.['guest_name'] ??
        index;

      return String(identity);
    };

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
      guest['invitation_url'] ||
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
        this.loadAttendanceListFromBackend();
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

  private parseInvitationUrl(decodedText: string): ParsedInvitationQr {
    try {
      const url = new URL(decodedText);
      const segments = url.pathname.split('/').filter(Boolean);
      const weddingIndex = segments.indexOf('wedding');
      const domain = weddingIndex >= 0 ? segments[weddingIndex + 1] || '' : '';
      const host = url.hostname.toLowerCase();
      const isAllowedHost =
        host === 'sena-digital.com' ||
        host === 'www.sena-digital.com' ||
        host === window.location.hostname.toLowerCase() ||
        host === 'localhost' ||
        host === '127.0.0.1';

      return {
        domain: this.normalizeWeddingDomain(domain),
        guestToken: String(url.searchParams.get('guest') || url.searchParams.get('guest_token') || '').trim(),
        to: String(url.searchParams.get('to') || '').trim(),
        isValidInvitationUrl: isAllowedHost && weddingIndex >= 0 && !!domain,
      };
    } catch {
      return { domain: '', guestToken: '', to: '', isValidInvitationUrl: false };
    }
  }

  private upsertScannedGuest(
  response: any,
  scan: ScanResult,
  domain: string,
  guestCode: string
): void {
  const rawGuest =
    response?.data?.attendance ??
    response?.data?.scan ??
    response?.data?.guest ??
    response?.attendance ??
    response?.guest ??
    response?.data ??
    {};

  const guest = this.normalizeBackendAttendance(
    {
      ...rawGuest,
      id:
        rawGuest?.id ??
        rawGuest?.attendance_id ??
        rawGuest?.guest_id ??
        guestCode,
      name:
        rawGuest?.guest_name ??
        rawGuest?.nama_tamu ??
        rawGuest?.name ??
        scan.guestName,
      guest_token:
        rawGuest?.guest_token ??
        rawGuest?.token ??
        guestCode,
      invitation_url:
        rawGuest?.invitation_url ??
        rawGuest?.invitation_link ??
        scan.invitationUrl,
      checked_in_at:
        rawGuest?.checked_in_at ??
        rawGuest?.scanned_at ??
        scan.scannedAt,
      last_scan_at:
        rawGuest?.last_scan_at ??
        rawGuest?.scanned_at ??
        scan.scannedAt,
      scan_count:
        rawGuest?.scan_count ??
        rawGuest?.checkin_count ??
        1,
      status:
        rawGuest?.status ?? 'present',
    },
    domain
  );

  const identity = this.getGuestIdentityKey(guest);

  const existingIndex = this.attendanceList.findIndex(
    item => this.getGuestIdentityKey(item) === identity
  );

  if (existingIndex >= 0) {
    const updated = [...this.attendanceList];
    updated[existingIndex] = guest;
    this.attendanceList = updated;
  } else {
    this.attendanceList = [
      guest,
      ...this.attendanceList,
    ];
  }

  this.attendanceTotal = this.attendanceList.length;
  this.allGuests = [...this.attendanceList];
  this.cdr.detectChanges();
  }

  private submitAttendanceScan(scannedUrl: string, domain: string, guestToken: string, guestCode: string, scannedAt: string): void {
    this.isSubmittingScan = true;
    this.isScanPaused = true;

    try {
      this.scanner?.pause(true);
    } catch {
      // Scanner can already be paused between camera frames.
    }

    const payload = scannedUrl.includes('/') || scannedUrl.includes('?')
      ? { scanned_value: scannedUrl }
      : { guest_token: guestToken || scannedUrl };

    console.log('[ATTENDANCE_SCAN]', payload);

    this.dashboardService.scanAttendance(payload).subscribe({
      next: (response) => {
        const scan = this.normalizeScanResponse(
          response,
          scannedUrl,
          guestToken || guestCode,
          scannedAt
        );

        this.setScanResult(scan);
        this.showNotice(scan.status);

        this.upsertScannedGuest(
          response,
          scan,
          domain,
          guestToken || guestCode
        );

        this.loadAttendanceListFromBackend(domain);
        this.releaseScannerAfterDelay();
      },
      error: (error) => {
        console.error('[ATTENDANCE_SCAN_ERROR]', error);
        const errorMessage = this.resolveBackendErrorMessage(
          error,
          'Gagal mencatat kehadiran. Silakan coba lagi.'
        );
        const errorData = this.extractScanErrorData(error);

        if (errorData) {
          const scan = this.normalizeScanResponse(errorData, scannedUrl, guestToken || guestCode, scannedAt);
          this.setScanResult({ ...scan, status: errorMessage, isError: false });
          this.loadAttendanceListFromBackend(domain);
        } else {
          this.setScanResult({
            guestName: '-',
            invitationUrl: scannedUrl,
            status: errorMessage,
            scannedAt,
            isError: true,
          });
        }
        this.releaseScannerAfterDelay();
      }
    });
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

  private releaseScannerAfterDelay(): void {
    this.isSubmittingScan = false;
    window.setTimeout(() => {
      this.isScanPaused = false;
      if (this.isScanning) {
        try {
          this.scanner?.resume();
        } catch {
          // Resuming is best-effort; the Scan Ulang button can recover manually.
        }
      }
      this.cdr.detectChanges();
    }, 1500);
  }

  private setScanResult(result: ScanResult): void {
    this.lastScanResult = result;
  }

  private loadAttendanceListFromBackend(domainParam?: string): void {
    const domain = this.normalizeWeddingDomain(domainParam || this.resolvedDomain);

    this.isAttendanceLoading = true;
    this.dashboardService.getAttendanceGuests().subscribe({
      next: (response) => {
        this.attendanceList = this.extractAttendanceRows(response)
          .map((guest) => this.normalizeBackendAttendance(guest, domain))
          .sort((a, b) => {
            const timeA = new Date(this.getLastScanAt(a) || this.getCheckedInAt(a) || 0).getTime();
            const timeB = new Date(this.getLastScanAt(b) || this.getCheckedInAt(b) || 0).getTime();
            return timeB - timeA;
          });
        this.attendanceTotal = this.resolveAttendanceTotal(response, this.attendanceList.length);
        this.allGuests = [...this.attendanceList];
        this.isAttendanceLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('[ATTENDANCE_LIST_ERROR]', error);
        this.isAttendanceLoading = false;
        this.showNotice(this.resolveBackendErrorMessage(error, 'Gagal memuat list tamu hadir.'));
        this.cdr.detectChanges();
      }
    });
  }

  private getGuestIdentityKey(
    guest: GuestInvitation
  ): string {
    return String(
      guest.id ??
      guest['attendance_id'] ??
      guest['guest_id'] ??
      guest['invitation_guest_id'] ??
      guest['guest_token'] ??
      guest['token'] ??
      guest.slug ??
      this.createGuestSlug(this.getGuestName(guest))
    ).trim();
  }

  private extractAttendanceRows(response: any): GuestInvitation[] {
    const candidates = [
      response,
      response?.data,
      response?.data?.data,
      response?.data?.attendances,
      response?.data?.attendance,
      response?.data?.attendance_guests,
      response?.data?.attendanceGuests,
      response?.data?.guests,
      response?.data?.items,
      response?.data?.rows,
      response?.data?.records,
      response?.data?.list,
      response?.result,
      response?.attendances,
      response?.attendance,
      response?.attendance_guests,
      response?.attendanceGuests,
      response?.guests,
      response?.items,
      response?.rows,
      response?.records,
      response?.list,
    ];

    const rows = candidates.find(candidate =>
      Array.isArray(candidate)
    );

    return Array.isArray(rows) ? rows : [];
  }

  private resolveAttendanceTotal(response: any, fallback: number): number {
    const total = Number(
      response?.total ??
      response?.data?.total ??
      response?.meta?.total ??
      response?.data?.meta?.total ??
      fallback
    );

    return Number.isFinite(total) ? total : fallback;
  }

  private normalizeScanResponse(response: any, scannedUrl: string, guestCode: string, fallbackScannedAt: string): ScanResult {
    const data = response?.data?.attendance ||
      response?.data?.scan ||
      response?.data?.guest ||
      response?.data ||
      response?.attendance ||
      response?.guest ||
      response ||
      {};

    const guestName = String(
      data?.guest_name ||
      data?.nama_tamu ||
      data?.name ||
      data?.nama ||
      data?.guest?.name ||
      data?.guest?.nama ||
      response?.guest_name ||
      response?.nama_tamu ||
      ''
    ).trim() || 'Tamu Undangan';

    const scannedAt = String(
      data?.checked_in_at ||
      data?.scanned_at ||
      data?.scan_time ||
      data?.attended_at ||
      data?.created_at ||
      response?.data?.checked_in_at ||
      response?.scanned_at ||
      fallbackScannedAt
    );

    const statusCode = this.normalizeStatus(String(
      data?.status ||
      data?.scan_status ||
      data?.attendance_status ||
      response?.status ||
      response?.code ||
      ''
    ));
    const message = String(response?.message || response?.data?.message || '').trim();
    const alreadyScanned = data?.already_scanned === true ||
      data?.is_duplicate === true ||
      data?.duplicate === true ||
      ['already_scanned', 'duplicate', 'guest_already_checked_in', 'sudah pernah discan', 'sudah hadir'].includes(statusCode);

    return {
      guestName,
      invitationUrl: String(data?.invitation_url || data?.invitation_link || data?.url || scannedUrl || '').trim(),
      status: message || (alreadyScanned ? 'Tamu ini sudah tercatat hadir.' : 'Kehadiran berhasil dicatat.'),
      scannedAt,
      isError: false,
    };
  }

  private normalizeBackendAttendance(raw: GuestInvitation, domain: string): GuestInvitation {
    const nestedGuest: any = raw.guest || {};
    const guestCode = String(
      raw.slug ||
      raw['guest_token'] ||
      raw['token'] ||
      raw['guest_code'] ||
      raw['kode_tamu'] ||
      raw['to'] ||
      nestedGuest.slug ||
      ''
    ).trim();
    const name = this.getGuestName(raw);

    return {
      ...raw,
      id: raw.id || raw['attendance_id'] || raw['guest_id'] || guestCode || name,
      name,
      slug: guestCode || this.createGuestSlug(name),
      url: this.getGuestInvitationUrl(raw) || (guestCode ? this.buildGuestInvitationUrl(domain, guestCode) : ''),
      checkedInAt: this.getAttendanceTime(raw),
      lastScannedAt: this.getLastScanAt(raw),
      checkinCount: this.getCheckinCount(raw) || 1,
    };
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

  public getAttendanceStatusLabel(guest: GuestInvitation): string {
    const status = this.normalizeStatus(this.getAttendanceStatus(guest));
    if (['already_scanned', 'duplicate', 'sudah pernah discan', 'sudah hadir'].includes(status)) {
      return 'Sudah pernah discan';
    }

    if (status && !['success', 'berhasil', 'present'].includes(status)) {
      return guest['status_label'] || guest['kehadiran_label'] || status;
    }

    return 'Hadir';
  }

  private resolveBackendErrorMessage(error: any, fallback: string): string {
    const code = String(
      error?.error?.code ||
      error?.error?.error_code ||
      error?.error?.status ||
      ''
    ).trim().toUpperCase();

    if (error?.status === 0) {
      return 'Koneksi ke server gagal. Periksa koneksi internet Anda.';
    }

    if (error?.status === 403) {
      return 'Tamu tidak terdaftar pada undangan Anda.';
    }

    if (error?.status === 422) {
      return error?.error?.message || 'Data scan tidak valid.';
    }

    if (code === 'GUEST_NOT_FOUND') {
      return 'Data tamu tidak ditemukan. Pastikan link dibuat melalui menu Bagi Undangan.';
    }

    if (code === 'INVALID_GUEST_LINK' || code === 'INVALID_QR' || code === 'INVALID_INVITATION_QR') {
      return 'Format link undangan tidak valid.';
    }

    if (code === 'GUEST_ALREADY_CHECKED_IN') {
      return 'Tamu ini sudah tercatat hadir.';
    }

    return getFriendlyErrorMessage(error) || fallback;
  }

  private extractScanErrorData(error: any): any | null {
    const code = String(
      error?.error?.code ||
      error?.error?.error_code ||
      error?.error?.status ||
      ''
    ).trim().toUpperCase();

    if (code !== 'GUEST_ALREADY_CHECKED_IN') {
      return null;
    }

    return error?.error?.data ||
      error?.error?.guest ||
      error?.error?.attendance ||
      null;
  }

  private createGuestSlug(name: string): string {
    return createGuestSlug(name);
  }

  private buildGuestInvitationUrl(domain: string, slug: string): string {
    const origin = String(window.location.origin || '').replace(/\/$/, '');
    const shareOrigin = !origin || origin.includes('localhost') || origin.includes('127.0.0.1')
      ? 'https://www.sena-digital.com'
      : origin;

    return `${shareOrigin}/wedding/${encodeURIComponent(domain)}?guest=${encodeURIComponent(slug)}`;
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
