import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DashboardService, DashboardServiceType, ProfileResponse } from 'src/app/dashboard.service';
import {
  createGuestSlug,
  generateUniqueSlug,
  GuestInvitationRecord,
  normalizeGuestRecord,
} from 'src/app/shared/guest-checkin/guest-checkin.utils';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { DEFAULT_SALAM_ATAS, DEFAULT_SALAM_BAWAH, normalizeSalamValue } from 'src/app/shared/salam-defaults';
import {
  getReligionContentFromData,
  getResolvedReligionValue,
  ReligionContentLike,
} from 'src/app/shared/religion-content.util';
import * as XLSX from 'xlsx';

interface ImportedGuestRow {
  name: string;
  slug?: string;
}

interface WhatsappTemplateContext {
  guestName: string;
  brideName: string;
  groomName: string;
  eventDate: string;
  eventLocation: string;
  invitationUrl: string;
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
  public generatedGuests: GuestInvitationRecord[] = [];
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
  private religionContent: ReligionContentLike = {};
  private readonly storagePrefix = 'guest_invitations';
  private readonly legacyStoragePrefix = 'generated_guest_invitations';
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
      error: (error: any) => {
        this.showNotice(getFriendlyErrorMessage(error));
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
    this.religionContent = getReligionContentFromData(response);

    this.weddingData = {
      setting: this.salamSetting,
      settings: this.salamSetting,
      religion_content: this.religionContent,
      filter_undangan: response?.filter_undangan || response?.data?.filter_undangan || {},
      data: response || {}
    };
  }

  private loadReligionContent(onComplete?: () => void): void {
    this.dashboardService.getReligionContent().subscribe({
      next: (religionResponse) => {
        this.religionContent = getReligionContentFromData(religionResponse);
        this.weddingData = {
          ...this.weddingData,
          religion_content: this.religionContent,
        };
        onComplete?.();
      },
      error: () => onComplete?.(),
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

    const createdGuest = this.addGuestLinkFromName(name);

    if (!createdGuest) {
      return;
    }

    this.generatedGuestUrl = this.getGuestInvitationUrl(createdGuest);
    this.showNotice('Link undangan personal berhasil dibuat.');
  }

  public copyGuestInvitation(guestOrUrl?: GuestInvitationRecord | string): void {
    const url = this.getGuestInvitationUrl(guestOrUrl);
    const guestName = typeof guestOrUrl === 'object'
      ? String(guestOrUrl?.name || '').trim()
      : this.extractGuestNameFromInvitationUrl(url) || String(this.guestName || '').trim();

    if (!url) {
      this.showNotice('Link undangan belum tersedia.');
      return;
    }

    this.ensureInvitationGreetingSettings(() => {
      const message = this.buildShareMessage(url, guestName);
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
      const message = this.buildShareMessage(invitationUrl, resolvedGuestName);
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    });
  }

  public getGuestInvitationUrl(guestOrUrl?: GuestInvitationRecord | string): string {
    if (typeof guestOrUrl === 'string') {
      return guestOrUrl.trim();
    }

    if (guestOrUrl && typeof guestOrUrl === 'object') {
      return String(guestOrUrl.url || '').trim()
        || this.buildGuestInvitationUrl(guestOrUrl.slug);
    }

    return String(this.generatedGuestUrl || '').trim();
  }

  public trackByGuest(index: number, guest: GuestInvitationRecord): string {
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
    const rows = this.generatedGuests
      .filter((guest) => !!guest.checkedInAt)
      .map((guest) => ({
      Nama: guest.name,
      Slug: guest.slug,
      Link: guest.url,
      'Waktu Hadir': guest.checkedInAt || '',
      'Jumlah Scan': guest.checkinCount,
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
      { wch: 16 },
      { wch: 24 },
      { wch: 12 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Tamu');
    XLSX.writeFile(workbook, this.buildGuestExportFileName());
    this.showNotice('Daftar tamu berhasil diekspor ke Excel.');
  }

  public buildWhatsappUrl(guestName: string, guestUrl: string): string {
    const message = this.buildShareMessage(guestUrl, guestName);
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }

  private addGuestLinkFromName(name: string, requestedSlug = ''): GuestInvitationRecord | null {
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return null;
    }

    const slug = generateUniqueSlug(requestedSlug || cleanName, this.generatedGuests);
    const guestRecord = normalizeGuestRecord(
      { name: cleanName, slug },
      this.getInvitationShareOrigin(),
      this.publicWeddingDomain,
      this.generatedGuests
    );

    if (!guestRecord.url) {
      return null;
    }

    this.generatedGuests = [
      guestRecord,
      ...this.generatedGuests
    ].slice(0, this.maxStoredGuests);

    this.persistGuestsToStorage();
    return guestRecord;
  }

  private importGuestNames(names: ImportedGuestRow[]): { successCount: number; duplicateCount: number } {
    let successCount = 0;
    let duplicateCount = 0;

    names.forEach((rawName) => {
      const name = String(rawName?.name || '').trim();
      const slug = String(rawName?.slug || '').trim();

      if (!name) {
        return;
      }

      if (this.addGuestLinkFromName(name, slug)) {
        successCount += 1;
      } else {
        duplicateCount += 1;
      }
    });

    return { successCount, duplicateCount };
  }

  private extractGuestNamesFromImportRows(jsonRows: any[], arrayRows: (string | number)[][]): ImportedGuestRow[] {
    const jsonNames = jsonRows
      .map((row) => ({
        name: String(
          row['Nama Tamu'] ||
          row['nama_tamu'] ||
          row['nama'] ||
          row['tamu'] ||
          row['name'] ||
          ''
        ).trim(),
        slug: String(row['slug'] || row['Slug'] || '').trim(),
      }))
      .filter((row) => !!row.name);

    if (jsonNames.length) {
      return this.uniqueGuestNames(jsonNames);
    }

    return this.extractGuestNamesFromExcelRows(arrayRows);
  }

  private normalizeStoredGuests(records: any[]): GuestInvitationRecord[] {
    const origin = this.getInvitationShareOrigin();
    const domain = this.publicWeddingDomain;

    return records
      .reduce((guests: GuestInvitationRecord[], record) => {
        const guest = normalizeGuestRecord(record, origin, domain, guests);

        if (String(guest.name || '').trim()) {
          guests.push(guest);
        }

        return guests;
      }, []);
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

  private getResolvedReligionValue(...keys: string[]): string {
    return getResolvedReligionValue(
      this.religionContent || this.weddingData?.religion_content,
      ...keys
    );
  }

  private hasResolvedReligionContent(): boolean {
    return !!(
      this.getResolvedReligionValue('whatsapp_opening', 'opening_greeting', 'salam_atas') ||
      this.getResolvedReligionValue('whatsapp_message', 'invitation_intro', 'message') ||
      this.getResolvedReligionValue('whatsapp_closing', 'closing_greeting', 'salam_bawah')
    );
  }

  private normalizeText(value: unknown, fallback: string): string {
    return normalizeSalamValue(value, fallback);
  }

  private getWhatsappOpeningText(): string {
    const religionText = this.getResolvedReligionValue('whatsapp_opening', 'opening_greeting', 'salam_atas');
    if (religionText) {
      return this.normalizeInvitationLineBreaks(religionText);
    }

    return this.normalizeInvitationLineBreaks(
      this.normalizeText(
        this.salamSetting?.['salam_atas'] ??
        this.weddingData?.setting?.salam_atas ??
        this.weddingData?.settings?.salam_atas,
        this.DEFAULT_SALAM_ATAS
      )
    );
  }

  private getWhatsappMessageText(): string {
    return this.normalizeInvitationLineBreaks(
      this.getResolvedReligionValue('whatsapp_message', 'invitation_intro', 'message')
    );
  }

  private getWhatsappClosingText(): string {
    const religionText = this.getResolvedReligionValue('whatsapp_closing', 'closing_greeting', 'salam_bawah');
    if (religionText) {
      return this.normalizeInvitationLineBreaks(religionText);
    }

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
    if (this.hasResolvedReligionContent()) {
      onReady();
      return;
    }

    if (this.getSettingText('salam_atas') || this.getSettingText('salam_bawah')) {
      this.loadReligionContent(onReady);
      return;
    }

    this.dashboardService.list(DashboardServiceType.SETTINGS_GET_FILTER).subscribe({
      next: (response: any) => {
        this.applyInvitationGreetingSettings(response);
        if (this.hasResolvedReligionContent()) {
          onReady();
          return;
        }

        this.loadReligionContent(onReady);
      },
      error: () => onReady()
    });
  }

  private buildShareMessage(url: string, guestName = ''): string {
    const invitationUrl = String(url || '').trim();
    const context = this.buildWhatsappTemplateContext(invitationUrl, guestName);
    const openingTemplate = this.getWhatsappOpeningText();
    const messageTemplate = this.getWhatsappMessageText();
    const closingTemplate = this.getWhatsappClosingText();
    const opening = this.renderWhatsappTemplate(openingTemplate, context);
    const message = this.renderWhatsappTemplate(messageTemplate, context);
    const closing = this.renderWhatsappTemplate(closingTemplate, context);
    const messageContainsUrl =
      (!!context.invitationUrl && message.includes(context.invitationUrl)) ||
      /\{\{\s*invitation_url\s*\}\}/i.test(messageTemplate);
    const normalizedOpening = this.normalizeMessagePart(opening);
    const normalizedMessage = this.normalizeMessagePart(message);
    const openingAlreadyIncluded =
      !!normalizedOpening &&
      normalizedMessage.includes(normalizedOpening);
    const openingPart = openingAlreadyIncluded ? '' : opening;
    const combinedBeforeClosing = [openingPart, message].filter(Boolean).join('\n\n');
    const normalizedBeforeClosing = this.normalizeMessagePart(combinedBeforeClosing);
    const normalizedClosing = this.normalizeMessagePart(closing);
    const closingAlreadyIncluded =
      !!normalizedClosing &&
      normalizedBeforeClosing.includes(normalizedClosing);
    const result = [
      openingPart,
      message,
      messageContainsUrl ? '' : context.invitationUrl,
      closingAlreadyIncluded ? '' : closing
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .join('\n\n');

    return this.cleanupWhatsappMessage(result);
  }

  private renderWhatsappTemplate(template: string, context: WhatsappTemplateContext): string {
    const replacements: Record<string, string> = {
      '{{guest_name}}': context.guestName || 'Bapak/Ibu/Saudara/i',
      '{{bride_name}}': context.brideName || '',
      '{{groom_name}}': context.groomName || '',
      '{{event_date}}': context.eventDate || '',
      '{{event_location}}': context.eventLocation || '',
      '{{invitation_url}}': context.invitationUrl || '',
    };

    return Object.entries(replacements).reduce(
      (result, [placeholder, value]) => {
        const key = placeholder.replace(/[{}]/g, '');
        return result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), value);
      },
      String(template || '')
    ).trim();
  }

  private buildWhatsappTemplateContext(invitationUrl: string, guestName = ''): WhatsappTemplateContext {
    const source = this.weddingData || {};
    const data = source?.data || {};
    const event = this.getPrimaryInvitationEvent(source);

    return {
      guestName: this.resolveGuestName(guestName, invitationUrl),
      brideName: this.readFirstDeepText(source, [
        'mempelai.wanita.nama_panggilan',
        'mempelai.wanita.nama_lengkap',
        'mempelai_wanita',
        'bride.name',
        'bride.nama',
        'wanita.nama_panggilan',
        'wanita.nama_lengkap',
        'nama_mempelai_wanita',
        'data.mempelai.wanita.nama_panggilan',
        'data.mempelai.wanita.nama_lengkap',
        'data.mempelai_wanita',
        'data.bride.name',
        'data.wanita.nama_panggilan',
        'data.nama_mempelai_wanita',
      ]),
      groomName: this.readFirstDeepText(source, [
        'mempelai.pria.nama_panggilan',
        'mempelai.pria.nama_lengkap',
        'mempelai_pria',
        'groom.name',
        'groom.nama',
        'pria.nama_panggilan',
        'pria.nama_lengkap',
        'nama_mempelai_pria',
        'data.mempelai.pria.nama_panggilan',
        'data.mempelai.pria.nama_lengkap',
        'data.mempelai_pria',
        'data.groom.name',
        'data.pria.nama_panggilan',
        'data.nama_mempelai_pria',
      ]),
      eventDate: this.readFirstDeepText(event, [
        'tanggal_formatted',
        'date_formatted',
        'tanggal',
        'date',
        'tanggal_acara',
        'event_date',
      ]) || this.readFirstDeepText(data, [
        'tanggal_formatted',
        'date_formatted',
        'tanggal',
        'date',
        'tanggal_acara',
        'event_date',
      ]),
      eventLocation: this.readFirstDeepText(event, [
        'lokasi',
        'location',
        'alamat',
        'address',
        'lokasi_acara',
        'event_location',
      ]) || this.readFirstDeepText(data, [
        'lokasi',
        'location',
        'alamat',
        'address',
        'lokasi_acara',
        'event_location',
      ]),
      invitationUrl,
    };
  }

  private resolveGuestName(guestName: string, invitationUrl: string): string {
    return String(
      guestName ||
      this.extractGuestNameFromInvitationUrl(invitationUrl) ||
      this.guestName ||
      this.readFirstDeepText(this.weddingData, ['guest_name', 'nama_tamu', 'guest.name', 'guest.nama', 'name']) ||
      ''
    ).trim();
  }

  private getPrimaryInvitationEvent(source: any): Record<string, any> {
    const candidates = [
      source?.events,
      source?.event,
      source?.acara,
      source?.data?.events,
      source?.data?.event,
      source?.data?.acara,
      source?.data?.data?.events,
      source?.data?.data?.acara,
    ];
    const event = candidates.find((item) => Array.isArray(item) ? item.length : !!item);

    return Array.isArray(event) ? event[0] || {} : event || {};
  }

  private readFirstDeepText(source: any, paths: string[]): string {
    for (const path of paths) {
      const value = this.readDeepValue(source, path);
      const text = String(value ?? '').trim();
      if (text) {
        return text;
      }
    }

    return '';
  }

  private readDeepValue(source: any, path: string): any {
    return String(path || '')
      .split('.')
      .reduce((value, key) => value?.[key], source);
  }

  private normalizeMessagePart(value: string): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private cleanupWhatsappMessage(value: string): string {
    return String(value || '')
      .replace(/\{\{[^}]+\}\}/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

  private buildGuestInvitationUrl(guestSlug?: string): string {
    const domain =
      this.publicWeddingDomain ||
      this.normalizeWeddingDomain(this.weddingData?.setting?.domain) ||
      this.normalizeWeddingDomain(this.weddingData?.testimoni?.domain) ||
      '';

    if (!domain) {
      return '';
    }

    const cleanGuestSlug = String(guestSlug || '').trim();
    const origin = this.getInvitationShareOrigin();
    const baseUrl = `${origin}/wedding/${encodeURIComponent(domain)}`;

    return cleanGuestSlug ? `${baseUrl}?to=${encodeURIComponent(cleanGuestSlug)}` : '';
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
      return decodeURIComponent(new URL(url).searchParams.get('to') || '').replace(/-/g, ' ').trim();
    } catch {
      const match = String(url).match(/[?&]to=([^&]+)/i);
      return match ? decodeURIComponent(match[1]).trim() : '';
    }
  }

  private saveGeneratedGuest(name: string, url: string): void {
    this.addGuestLinkFromName(name);
  }

  private extractGuestNamesFromExcelRows(rows: (string | number)[][]): ImportedGuestRow[] {
    const names: ImportedGuestRow[] = [];

    if (!rows.length) {
      return names;
    }

    const headerRow = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
    const nameColumnIndex = headerRow.findIndex((cell) =>
      /^(nama(\s*tamu)?|nama_tamu|nama|tamu|name|guest(\s*name)?)$/.test(cell)
    );
    const slugColumnIndex = headerRow.findIndex((cell) => cell === 'slug');

    if (nameColumnIndex >= 0) {
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const name = String(rows[rowIndex][nameColumnIndex] || '').trim();
        const slug = slugColumnIndex >= 0 ? String(rows[rowIndex][slugColumnIndex] || '').trim() : '';

        if (name && !/^(no|nama(\s*tamu)?|name)$/i.test(name)) {
          names.push({ name, slug });
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
        names.push({ name: secondCell });
        return;
      }

      if (firstCell) {
        names.push({ name: firstCell });
      }
    });

    return this.uniqueGuestNames(names);
  }

  private uniqueGuestNames(names: ImportedGuestRow[]): ImportedGuestRow[] {
    return names.filter((guest) => !!String(guest.name || '').trim());
  }

  private persistGuestsToStorage(): void {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.generatedGuests.map((guest) => this.serializeGuest(guest))));
    } catch {
      // Local history is optional; link generation should still work.
    }
  }

  private loadStoredGuests(): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      const legacyRaw = raw ? '' : localStorage.getItem(this.getLegacyStorageKey());
      const parsed = raw ? JSON.parse(raw) : legacyRaw ? JSON.parse(legacyRaw) : [];
      const records = Array.isArray(parsed) ? parsed : [];
      this.generatedGuests = this.normalizeStoredGuests(records);

      if (records.length && this.generatedGuests.length) {
        this.persistGuestsToStorage();
      }
    } catch {
      this.generatedGuests = [];
    }
  }

  private getStorageKey(): string {
    return `${this.storagePrefix}_${this.publicWeddingDomain || 'unknown'}`;
  }

  private getLegacyStorageKey(): string {
    return `${this.legacyStoragePrefix}_${this.publicWeddingDomain || 'unknown'}`;
  }

  private createGuestSlug(name: string): string {
    return createGuestSlug(name);
  }

  private getGuestCheckedInAt(guest: GuestInvitationRecord): string | null {
    return guest.checkedInAt || null;
  }

  private getGuestCheckinCount(guest: GuestInvitationRecord): number {
    return Number(guest.checkinCount ?? 0);
  }

  private serializeGuest(guest: GuestInvitationRecord): Record<string, any> {
    const serialized: Record<string, any> = {
      id: guest.id,
      name: guest.name,
      slug: guest.slug || this.createGuestSlug(guest.name),
      url: guest.url,
      checkedInAt: this.getGuestCheckedInAt(guest),
      checkinCount: this.getGuestCheckinCount(guest),
      lastScannedAt: guest.lastScannedAt || null,
      createdAt: guest.createdAt,
    };

    return serialized;
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
