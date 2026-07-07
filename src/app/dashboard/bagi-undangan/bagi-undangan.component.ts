import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DashboardService, DashboardServiceType, ProfileResponse } from 'src/app/dashboard.service';
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

  public guestName = '';
  public generatedGuestUrl = '';
  public publicWeddingDomain = '';
  public noticeMessage = '';
  public generatedGuests: GeneratedGuestInvitation[] = [];
  public isImportingGuests = false;

  private weddingData: any = {};
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

    const testimoni =
      response?.testimoni ||
      response?.data?.testimoni ||
      setting;

    const mergedGreeting = { ...setting, ...testimoni };

    this.weddingData = {
      testimoni: mergedGreeting,
      setting: mergedGreeting,
      settings: mergedGreeting,
      invitation_setting: mergedGreeting,
      filter_undangan: response?.filter_undangan || response?.data?.filter_undangan || {},
      data: response || {}
    };

    console.log('[WhatsApp Share Settings Loaded]', {
      salam_atas: mergedGreeting?.salam_atas,
      salam_bawah: mergedGreeting?.salam_bawah
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

  public copyGuestInvitation(url = this.generatedGuestUrl): void {
    if (!url) return;

    navigator.clipboard?.writeText(url)
      .then(() => this.showNotice('Link undangan berhasil disalin.'))
      .catch(() => this.showNotice('Gagal menyalin link undangan.'));
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
      const message = this.buildWhatsAppShareMessage(resolvedGuestName, invitationUrl);
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    });
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
    const message = this.buildWhatsAppShareMessage(guestName, guestUrl);
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

  private getInvitationGreetingSetting(): any {
    const data: any = this.weddingData || {};
    const candidates = [
      data?.testimoni,
      data?.setting,
      data?.settings,
      data?.invitation_setting,
      data?.filter_undangan,
      data?.data?.testimoni,
      data?.data?.setting
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (
        String(candidate?.salam_atas ?? '').trim() ||
        String(candidate?.salam_bawah ?? '').trim()
      ) {
        return candidate;
      }
    }

    return (
      data?.testimoni ||
      data?.setting ||
      data?.settings ||
      data?.invitation_setting ||
      data?.filter_undangan ||
      data?.data?.testimoni ||
      data?.data?.setting ||
      {}
    );
  }

  private ensureInvitationGreetingSettings(onReady: () => void): void {
    const setting = this.getInvitationGreetingSetting();

    if (
      String(setting?.salam_atas ?? '').trim() ||
      String(setting?.salam_bawah ?? '').trim()
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

  private buildWhatsAppShareMessage(guestName?: string, invitationUrl?: string): string {
    const setting = this.getInvitationGreetingSetting();

    const salamAtasRaw = String(setting?.salam_atas ?? '');
    const salamBawahRaw = String(setting?.salam_bawah ?? '');
    const salamAtas = salamAtasRaw.trim();
    const salamBawah = salamBawahRaw.trim();

    const opening = salamAtas
      ? this.normalizeInvitationLineBreaks(salamAtasRaw)
      : [
          'Assalamualaikum Wr Wb.',
          'Dengan hormat kami mengundang Bapak/Ibu/Saudara/i untuk hadir pada acara pernikahan kami:'
        ].join('\n');

    const closing = salamBawah
      ? this.normalizeInvitationLineBreaks(salamBawahRaw)
      : 'Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.';

    const cleanGuestName = String(guestName || 'Tamu Undangan').trim();
    const finalInvitationUrl = invitationUrl || this.buildGuestInvitationUrl(cleanGuestName);

    const message = [
      opening,
      '',
      'Silakan buka undangan berikut:',
      finalInvitationUrl,
      '',
      closing
    ].join('\n');

    console.log('[WhatsApp Share Message]', {
      salamAtas,
      salamBawah,
      guestName: cleanGuestName,
      invitationUrl: finalInvitationUrl,
      message
    });

    return message;
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
