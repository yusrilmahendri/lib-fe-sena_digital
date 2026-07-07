import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DashboardService, DashboardServiceType, ProfileResponse } from 'src/app/dashboard.service';
import { DEFAULT_SALAM_ATAS, DEFAULT_SALAM_BAWAH, normalizeSalamValue } from 'src/app/shared/salam-defaults';
import * as XLSX from 'xlsx';

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
  @ViewChild('guestExcelInput') guestExcelInput?: ElementRef<HTMLInputElement>;

  readonly DEFAULT_SALAM_ATAS = DEFAULT_SALAM_ATAS;
  readonly DEFAULT_SALAM_BAWAH = DEFAULT_SALAM_BAWAH;

  public guestName = '';
  public generatedGuestUrl = '';
  public publicWeddingDomain = '';
  public noticeMessage = '';
  public generatedGuests: GeneratedGuestInvitation[] = [];
  public isImportingGuests = false;
  readonly guestStorageUsesLocalStorage = true;

  get guestStorageWarningMessage(): string {
    if (this.guestStorageUsesLocalStorage) {
      return 'Daftar tamu tersimpan di browser ini. Jika cache browser dibersihkan atau dibuka di perangkat lain, data dapat hilang. Silakan gunakan Export Excel sebagai cadangan.';
    }

    return 'Daftar tamu pada halaman ini masih tersimpan sementara. Jika halaman di-refresh atau ditutup, data dapat hilang. Silakan gunakan Export Excel sebagai cadangan.';
  }

  private weddingData: any = {};
  private salamSetting: Record<string, any> = {};
  private readonly storagePrefix = 'generated_guest_invitations';
  private readonly maxStoredGuests = 500;

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadProfileDomain();
    this.loadInvitationGreetingSettings();
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

  private loadInvitationGreetingSettings(): void {
    this.dashboardService.list(DashboardServiceType.SETTINGS_GET_FILTER).subscribe({
      next: (response: any) => {
        this.applyInvitationGreetingSettings(response);
      },
      error: () => {
        // Share fallback greeting will be used when settings are unavailable.
      }
    });
  }

  private applyInvitationGreetingSettings(response: any): void {
    const setting =
      response?.setting ||
      response?.data?.setting ||
      {};

    this.salamSetting = { ...setting };

    this.weddingData = {
      setting: this.salamSetting,
      settings: this.salamSetting,
      filter_undangan: response?.filter_undangan || response?.data?.filter_undangan || {},
      data: response || {}
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

    this.generatedGuestUrl = this.buildGuestInvitationUrl(name);

    if (!this.addGuestLinkFromName(name)) {
      const existingGuest = this.generatedGuests.find(
        (guest) => String(guest.name || '').trim().toLowerCase() === name.toLowerCase()
      );

      if (existingGuest) {
        this.generatedGuestUrl = existingGuest.url;
        this.showNotice('Link undangan untuk tamu ini sudah ada.');
        return;
      }
    }

    this.showNotice('Link undangan personal berhasil dibuat.');
  }

  public copyGuestInvitation(guestOrUrl?: GeneratedGuestInvitation | string): void {
    const url = this.getGuestInvitationUrl(guestOrUrl);

    if (!url) {
      this.showNotice('Link undangan belum tersedia.');
      return;
    }

    this.ensureInvitationGreetingSettings(() => {
      const message = this.buildShareMessage(url);
      this.copyTextToClipboard(message);
    });
  }

  public shareGuestInvitationWhatsapp(url = this.generatedGuestUrl, guestName?: string): void {
    const resolvedGuestName =
      String(guestName || '').trim() ||
      this.extractGuestNameFromInvitationUrl(url) ||
      String(this.guestName || '').trim() ||
      'Tamu Undangan';

    const invitationUrl = url || this.buildGuestInvitationUrl(resolvedGuestName);

    if (!invitationUrl) {
      this.showNotice('Link undangan belum tersedia.');
      return;
    }

    this.ensureInvitationGreetingSettings(() => {
      const message = this.buildShareMessage(invitationUrl);
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    });
  }

  public getGuestInvitationUrl(guestOrUrl?: GeneratedGuestInvitation | string): string {
    if (typeof guestOrUrl === 'string') {
      return guestOrUrl.trim();
    }

    if (guestOrUrl && typeof guestOrUrl === 'object') {
      return String(guestOrUrl.url || '').trim() || this.buildGuestInvitationUrl(guestOrUrl.name);
    }

    return String(this.generatedGuestUrl || '').trim();
  }

  public trackByGuest(index: number, guest: GeneratedGuestInvitation): string {
    return `${guest.createdAt}-${guest.name}-${index}`;
  }

  public downloadGuestTemplate(): void {
    const rows = [
      { 'Nama Tamu': 'Bapak Andi' },
      { 'Nama Tamu': 'Ibu Sari' },
      { 'Nama Tamu': 'Yusril Mahendri' }
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Tamu');
    XLSX.writeFile(workbook, 'template-import-tamu.xlsx');
    this.showNotice('Template Excel berhasil diunduh.');
  }

  public downloadGuestExcelTemplate(): void {
    this.downloadGuestTemplate();
  }

  public triggerGuestExcelImport(): void {
    this.guestExcelInput?.nativeElement.click();
  }

  public importGuestsFromExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const fileName = String(file.name || '').toLowerCase();
    const isExcelFile = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

    if (!isExcelFile) {
      this.showNotice('File harus berformat Excel (.xlsx atau .xls).');
      input.value = '';
      return;
    }

    if (!this.publicWeddingDomain) {
      this.showNotice('Domain undangan belum tersedia.');
      input.value = '';
      return;
    }

    this.isImportingGuests = true;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
          this.showNotice('File Excel kosong.');
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const arrayRows = XLSX.utils.sheet_to_json<(string | number)[]>(worksheet, {
          header: 1,
          defval: ''
        });

        const guestNames = this.extractGuestNamesFromImportRows(jsonRows, arrayRows);

        if (!guestNames.length) {
          this.showNotice('Kolom Nama Tamu tidak ditemukan. Silakan gunakan template Excel.');
          return;
        }

        const { successCount, duplicateCount } = this.importGuestNames(guestNames);
        this.showNotice(
          `Import selesai. ${successCount} tamu berhasil ditambahkan, ${duplicateCount} duplikat dilewati.`
        );
      } catch {
        this.showNotice('Gagal membaca file Excel. Pastikan format file benar.');
      } finally {
        this.isImportingGuests = false;
        input.value = '';
      }
    };

    reader.onerror = () => {
      this.isImportingGuests = false;
      input.value = '';
      this.showNotice('Gagal membaca file Excel.');
    };

    reader.readAsArrayBuffer(file);
  }

  public onGuestExcelSelected(event: Event): void {
    this.importGuestsFromExcel(event);
  }

  public exportGuestsToExcel(): void {
    const rows = this.generatedGuests.map((guest, index) => ({
      No: index + 1,
      'Nama Tamu': guest.name,
      'Link Undangan': guest.url,
      'Link WhatsApp': this.buildWhatsappUrl(guest.name, guest.url)
    }));

    if (!rows.length) {
      rows.push({
        No: 1,
        'Nama Tamu': 'Belum ada tamu',
        'Link Undangan': '',
        'Link WhatsApp': ''
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 28 },
      { wch: 64 },
      { wch: 72 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Tamu');
    XLSX.writeFile(workbook, this.buildGuestExportFileName());
    this.showNotice('Daftar tamu berhasil diekspor ke Excel.');
  }

  public buildWhatsappUrl(guestName: string, guestUrl: string): string {
    const message = this.buildShareMessage(guestUrl);
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  private addGuestLinkFromName(name: string): boolean {
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return false;
    }

    const exists = this.generatedGuests.some(
      (guest) => String(guest.name || '').trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (exists) {
      return false;
    }

    const url = this.buildGuestInvitationUrl(cleanName);

    if (!url) {
      return false;
    }

    this.generatedGuests = [
      {
        name: cleanName,
        url,
        createdAt: new Date().toISOString()
      },
      ...this.generatedGuests
    ].slice(0, this.maxStoredGuests);

    this.persistGuestsToStorage();
    return true;
  }

  private importGuestNames(names: string[]): { successCount: number; duplicateCount: number } {
    let successCount = 0;
    let duplicateCount = 0;

    names.forEach((rawName) => {
      const name = String(rawName || '').trim();

      if (!name) {
        return;
      }

      const exists = this.generatedGuests.some(
        (guest) => String(guest.name || '').trim().toLowerCase() === name.toLowerCase()
      );

      if (exists) {
        duplicateCount += 1;
        return;
      }

      if (this.addGuestLinkFromName(name)) {
        successCount += 1;
      }
    });

    return { successCount, duplicateCount };
  }

  private extractGuestNamesFromImportRows(jsonRows: any[], arrayRows: (string | number)[][]): string[] {
    const jsonNames = jsonRows
      .map((row) =>
        String(
          row['Nama Tamu'] ||
          row['nama_tamu'] ||
          row['nama'] ||
          row['name'] ||
          ''
        ).trim()
      )
      .filter(Boolean);

    if (jsonNames.length) {
      return this.uniqueGuestNames(jsonNames);
    }

    return this.extractGuestNamesFromExcelRows(arrayRows);
  }

  private buildGuestExportFileName(): string {
    const domain = this.publicWeddingDomain || 'undangan';
    return `daftar-tamu-undangan-${domain}.xlsx`;
  }

  private getInvitationGreetingSetting(): Record<string, any> {
    return this.salamSetting || this.weddingData?.setting || {};
  }

  private getSettingText(key: 'salam_atas' | 'salam_bawah' | 'salam_pembuka'): string {
    const source =
      this.salamSetting ||
      this.weddingData?.setting ||
      this.weddingData?.settings ||
      this.weddingData?.data?.setting ||
      {};

    const raw = String(source?.[key] ?? '');

    if (!raw.trim()) {
      return '';
    }

    return this.normalizeInvitationLineBreaks(raw);
  }

  private normalizeText(value: unknown, fallback: string): string {
    return normalizeSalamValue(value, fallback);
  }

  private getWhatsappOpeningText(): string {
    return this.normalizeInvitationLineBreaks(
      this.normalizeText(
        this.salamSetting?.['salam_atas'] ??
        this.weddingData?.setting?.salam_atas ??
        this.weddingData?.settings?.salam_atas,
        this.DEFAULT_SALAM_ATAS
      )
    );
  }

  private getWhatsappClosingText(): string {
    return this.normalizeInvitationLineBreaks(
      this.normalizeText(
        this.salamSetting?.['salam_bawah'] ??
        this.weddingData?.setting?.salam_bawah ??
        this.weddingData?.settings?.salam_bawah,
        this.DEFAULT_SALAM_BAWAH
      )
    );
  }

  private ensureInvitationGreetingSettings(onReady: () => void): void {
    if (
      this.getSettingText('salam_atas') ||
      this.getSettingText('salam_bawah')
    ) {
      onReady();
      return;
    }

    this.dashboardService.list(DashboardServiceType.SETTINGS_GET_FILTER).subscribe({
      next: (response: any) => {
        this.applyInvitationGreetingSettings(response);
        onReady();
      },
      error: () => onReady()
    });
  }

  private buildShareMessage(url: string): string {
    const salamAtas = this.getWhatsappOpeningText();
    let salamBawah = this.getWhatsappClosingText();
    const invitationUrl = String(url || '').trim();

    if (
      salamAtas &&
      salamBawah &&
      salamAtas.trim().toLowerCase() === salamBawah.trim().toLowerCase()
    ) {
      salamBawah = '';
    }

    return [
      salamAtas,
      `Silakan buka undangan berikut:\n${invitationUrl}`,
      salamBawah
    ]
      .filter((item) => !!String(item || '').trim())
      .join('\n\n');
  }

  private copyTextToClipboard(message: string): void {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(message)
        .then(() => this.showNotice('Pesan undangan berhasil disalin.'))
        .catch(() => this.fallbackCopyText(message));
      return;
    }

    this.fallbackCopyText(message);
  }

  private fallbackCopyText(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      document.execCommand('copy');
      this.showNotice('Pesan undangan berhasil disalin.');
    } catch {
      this.showNotice('Gagal menyalin pesan undangan.');
    } finally {
      document.body.removeChild(textarea);
    }
  }

  private normalizeInvitationLineBreaks(value: string): string {
    return String(value || '').replace(/\r\n/g, '\n');
  }

  private buildGuestInvitationUrl(guestName?: string): string {
    const domain =
      this.publicWeddingDomain ||
      this.normalizeWeddingDomain(this.weddingData?.setting?.domain) ||
      this.normalizeWeddingDomain(this.weddingData?.testimoni?.domain) ||
      '';

    if (!domain) {
      return '';
    }

    const cleanGuestName = String(guestName || 'Tamu Undangan').trim();
    const origin = this.getInvitationShareOrigin();
    const baseUrl = `${origin}/wedding/${encodeURIComponent(domain)}`;

    return `${baseUrl}?to=${encodeURIComponent(cleanGuestName)}`;
  }

  private getInvitationShareOrigin(): string {
    const origin = String(window.location.origin || '').replace(/\/$/, '');

    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'https://www.sena-digital.com';
    }

    return origin;
  }

  private extractGuestNameFromInvitationUrl(url?: string): string {
    if (!url) {
      return '';
    }

    try {
      return decodeURIComponent(new URL(url).searchParams.get('to') || '').trim();
    } catch {
      const match = String(url).match(/[?&]to=([^&]+)/i);
      return match ? decodeURIComponent(match[1]).trim() : '';
    }
  }

  private saveGeneratedGuest(name: string, url: string): void {
    this.addGuestLinkFromName(name);
  }

  private extractGuestNamesFromExcelRows(rows: (string | number)[][]): string[] {
    const names: string[] = [];

    if (!rows.length) {
      return names;
    }

    const headerRow = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
    const nameColumnIndex = headerRow.findIndex((cell) =>
      /^(nama(\s*tamu)?|nama_tamu|name|guest(\s*name)?)$/.test(cell)
    );

    if (nameColumnIndex >= 0) {
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const name = String(rows[rowIndex][nameColumnIndex] || '').trim();

        if (name && !/^(no|nama(\s*tamu)?|name)$/i.test(name)) {
          names.push(name);
        }
      }

      return this.uniqueGuestNames(names);
    }

    rows.forEach((row, rowIndex) => {
      const firstCell = String(row[0] || '').trim();
      const secondCell = String(row[1] || '').trim();

      if (!firstCell && !secondCell) {
        return;
      }

      if (rowIndex === 0 && /^(no|nama(\s*tamu)?|name)$/i.test(firstCell)) {
        return;
      }

      if (/^\d+$/.test(firstCell) && secondCell) {
        names.push(secondCell);
        return;
      }

      if (firstCell) {
        names.push(firstCell);
      }
    });

    return this.uniqueGuestNames(names);
  }

  private uniqueGuestNames(names: string[]): string[] {
    const seen = new Set<string>();

    return names.filter((name) => {
      const normalized = name.trim().toLowerCase();

      if (!normalized || seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    });
  }

  private persistGuestsToStorage(): void {
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
