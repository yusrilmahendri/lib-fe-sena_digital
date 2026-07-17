import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { DashboardService, DashboardServiceType, ProfileResponse } from 'src/app/dashboard.service';
import {
  createGuestSlug,
  GuestInvitationRecord,
} from 'src/app/shared/guest-checkin/guest-checkin.utils';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { DEFAULT_SALAM_ATAS, DEFAULT_SALAM_BAWAH, normalizeSalamValue } from 'src/app/shared/salam-defaults';
import {
  getReligionContentFromData,
  getResolvedReligionValue,
  ReligionContentLike,
} from 'src/app/shared/religion-content.util';
import { resolveGuestName } from 'src/app/shared/wedding-theme-data.util';
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
  public isGuestListLoading = false;

  get guestStorageWarningMessage(): string {
    return 'Daftar tamu tersimpan pada akun Anda dan dapat diakses dari perangkat lain.';
  }

  private weddingData: any = {};
  private salamSetting: Record<string, any> = {};
  private religionContent: ReligionContentLike = {};
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
        this.loadGuestsFromBackend();
        this.loadPublicWeddingData();

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
      ...this.weddingData,
      setting: this.salamSetting,
      settings: this.salamSetting,
      religion_content: this.religionContent,
      filter_undangan: response?.filter_undangan || response?.data?.filter_undangan || {},
      settings_response: response || {}
    };
  }

  private loadPublicWeddingData(): void {
    const domain = this.publicWeddingDomain;
    if (!domain) {
      return;
    }

    this.dashboardService.getParam(
      DashboardServiceType.WEDDING_PUBLIC_BY_DOMAIN,
      `/${encodeURIComponent(domain)}`
    ).subscribe({
      next: (response: any) => {
        const payload = this.resolveWeddingDataPayload(response);
        if (!payload) {
          return;
        }

        this.weddingData = {
          ...payload,
          ...this.weddingData,
          public_wedding: payload,
          religion_content: this.religionContent || (payload as any)?.religion_content,
          setting: {
            ...((payload as any)?.setting || {}),
            ...this.salamSetting,
          },
          settings: {
            ...((payload as any)?.settings || {}),
            ...this.salamSetting,
          },
        };
      },
      error: () => {
        // Existing settings fallback is enough for sharing when public data is unavailable.
      }
    });
  }

  private resolveWeddingDataPayload(response: any): any | null {
    const candidates = [
      response?.data?.wedding,
      response?.data?.invitation,
      response?.data?.undangan,
      response?.data,
      response?.wedding,
      response?.invitation,
      response?.undangan,
      response,
    ];

    return candidates.find((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return false;
      }

      return !!(
        candidate?.mempelai ||
        candidate?.events ||
        candidate?.acara ||
        candidate?.settings ||
        candidate?.setting ||
        candidate?.domain ||
        candidate?.slug
      );
    }) || null;
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

    this.createGuestInBackend(name);
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

    const invitationUrl = url;

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
        || this.buildGuestInvitationUrl(guestOrUrl.guestToken, guestOrUrl.slug);
    }

    return String(this.generatedGuestUrl || '').trim();
  }

  public trackByGuest(index: number, guest: GuestInvitationRecord): string {
    return `${guest.id || guest.guestToken || guest.createdAt}-${guest.name}-${index}`;
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

    const formData = new FormData();
    formData.append('file', file);

    this.dashboardService.importInvitationGuests(formData).subscribe({
      next: (response) => {
        this.isImportingGuests = false;
        input.value = '';
        this.loadGuestsFromBackend();
        this.showNotice(this.buildImportSuccessMessage(response));
      },
      error: (error) => {
        this.isImportingGuests = false;
        input.value = '';
        this.showNotice(this.resolveBackendErrorMessage(error, 'Gagal mengimpor daftar tamu.'));
      }
    });
  }

  public onGuestExcelSelected(event: Event): void {
    this.importGuestsFromExcel(event);
  }

  public exportGuestsToExcel(): void {
    const rows = this.generatedGuests
      .map((guest) => ({
      'Nama Tamu': guest.name,
      'Guest Slug': guest.slug,
      'Invitation URL': guest.url,
      'Status Kehadiran': (guest as any).attendanceStatus || (guest as any).attendance_status || '',
      'Waktu Hadir': guest.checkedInAt || '',
    }));

    if (!rows.length) {
      rows.push({
        'Nama Tamu': 'Belum ada tamu',
        'Guest Slug': '',
        'Invitation URL': '',
        'Status Kehadiran': '',
        'Waktu Hadir': '',
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

  private createGuestInBackend(name: string): void {
    const cleanName = String(name || '').trim();

    if (!cleanName) {
      return;
    }

    this.dashboardService.createInvitationGuest({ name: cleanName }).subscribe({
      next: (response) => {
        const guest = this.normalizeBackendGuest(this.extractGuestPayload(response));
        this.generatedGuestUrl = guest.url;
        this.guestName = '';
        this.showNotice('Link undangan personal berhasil dibuat.');
        this.loadGuestsFromBackend();
      },
      error: (error) => {
        this.showNotice(this.resolveBackendErrorMessage(error, 'Gagal membuat link undangan personal.'));
      }
    });
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
    const messageTemplate = this.getSafeWhatsappMessageTemplate(this.getWhatsappMessageText(), context);
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

  private getSafeWhatsappMessageTemplate(template: string, context: WhatsappTemplateContext): string {
    const raw = String(template || '').trim();
    const hasTemplate = !!raw;
    const hasCompleteEventDetails = !!(
      context.brideName &&
      context.groomName &&
      context.eventDate &&
      context.eventLocation
    );

    if (!hasTemplate) {
      return hasCompleteEventDetails
        ? 'Dengan bahagia kami mengundang Anda untuk hadir di pernikahan {{bride_name}} dan {{groom_name}} pada {{event_date}} di {{event_location}}.'
        : 'Dengan bahagia kami mengundang Anda untuk menghadiri acara pernikahan kami.';
    }

    const detailPlaceholders = ['bride_name', 'groom_name', 'event_date', 'event_location'];
    const usesMissingDetail = detailPlaceholders.some((key) => {
      const value = (context as any)[this.toContextKey(key)];
      return !value && new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'i').test(raw);
    });

    if (!usesMissingDetail) {
      return raw;
    }

    const guestGreeting = raw
      .split(/\n+/)
      .map((line) => line.trim())
      .find((line) => /\{\{\s*guest_name\s*\}\}/i.test(line) && !/\{\{\s*(bride_name|groom_name|event_date|event_location)\s*\}\}/i.test(line));
    const safeMessage = 'Dengan bahagia kami mengundang Anda untuk menghadiri acara pernikahan kami.';

    return guestGreeting ? `${guestGreeting}\n\n${safeMessage}` : safeMessage;
  }

  private toContextKey(placeholder: string): keyof WhatsappTemplateContext {
    const map: Record<string, keyof WhatsappTemplateContext> = {
      guest_name: 'guestName',
      bride_name: 'brideName',
      groom_name: 'groomName',
      event_date: 'eventDate',
      event_location: 'eventLocation',
      invitation_url: 'invitationUrl',
    };

    return map[placeholder] || 'guestName';
  }

  private buildWhatsappTemplateContext(invitationUrl: string, guestName = ''): WhatsappTemplateContext {
    const source = this.weddingData || {};
    const data = source?.public_wedding || source?.data || {};
    const event = this.getPrimaryInvitationEvent(source);
    const resolvedInvitationUrl = this.readFirstDeepText(source, [
      'invitation_url',
      'personal_invitation_url',
      'personal_url',
      'guest.invitation_url',
      'guest.url',
      'public_wedding.invitation_url',
      'public_wedding.personal_invitation_url',
      'data.invitation_url',
      'data.personal_invitation_url',
    ]) || invitationUrl;
    const guestDisplayName = this.resolveGuestName(guestName, invitationUrl);
    const brideName = this.readFirstDeepText(source, [
      'mempelai.wanita.nama',
      'mempelai.wanita.name',
      'mempelai.wanita.nama_panggilan',
      'mempelai.wanita.nama_lengkap',
      'bride.name',
      'bride.nama',
      'female_name',
      'nama_wanita',
      'mempelai.female_name',
      'mempelai.nama_wanita',
      'mempelai_wanita',
      'mempelai_wanita.nama',
      'mempelai_wanita.nama_lengkap',
      'wanita.nama',
      'wanita.name',
      'wanita.nama_panggilan',
      'wanita.nama_lengkap',
      'public_wedding.mempelai.wanita.nama',
      'public_wedding.bride.name',
      'public_wedding.female_name',
      'public_wedding.nama_wanita',
      'data.mempelai.wanita.nama',
      'data.mempelai.wanita.nama_panggilan',
      'data.mempelai.wanita.nama_lengkap',
      'data.bride.name',
      'data.female_name',
      'data.nama_wanita',
    ]);
    const groomName = this.readFirstDeepText(source, [
      'mempelai.pria.nama',
      'mempelai.pria.name',
      'mempelai.pria.nama_panggilan',
      'mempelai.pria.nama_lengkap',
      'groom.name',
      'groom.nama',
      'male_name',
      'nama_pria',
      'mempelai.male_name',
      'mempelai.nama_pria',
      'mempelai_pria',
      'mempelai_pria.nama',
      'mempelai_pria.nama_lengkap',
      'pria.nama',
      'pria.name',
      'pria.nama_panggilan',
      'pria.nama_lengkap',
      'public_wedding.mempelai.pria.nama',
      'public_wedding.groom.name',
      'public_wedding.male_name',
      'public_wedding.nama_pria',
      'data.mempelai.pria.nama',
      'data.mempelai.pria.nama_panggilan',
      'data.mempelai.pria.nama_lengkap',
      'data.groom.name',
      'data.male_name',
      'data.nama_pria',
    ]);

    return {
      guestName: guestDisplayName,
      brideName,
      groomName,
      eventDate: this.readFirstDeepText(event, [
        'tanggal_formatted',
        'date_formatted',
        'tanggal',
        'date',
        'tanggal_acara',
        'event_date',
      ]) || this.readFirstDeepText(data, [
        'event_utama.tanggal',
        'event_utama.date',
        'main_event.tanggal',
        'main_event.date',
        'events.0.tanggal',
        'events.0.date',
        'acara.0.tanggal',
        'acara.0.date',
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
        'events.0.lokasi',
        'events.0.location',
        'events.0.alamat',
        'acara.0.lokasi',
        'acara.0.location',
        'acara.0.alamat',
        'lokasi',
        'location',
        'alamat',
        'address',
        'lokasi_acara',
        'event_location',
      ]),
      invitationUrl: resolvedInvitationUrl,
    };
  }

  private resolveGuestName(guestName: string, invitationUrl: string): string {
    return resolveGuestName(
      {
        ...(this.weddingData || {}),
        guest_name: guestName || this.weddingData?.guest_name,
      },
      this.extractGuestNameFromInvitationUrl(invitationUrl) || this.guestName
    );
  }

  private getPrimaryInvitationEvent(source: any): Record<string, any> {
    const candidates = [
      source?.event_utama,
      source?.main_event,
      source?.events,
      source?.event,
      source?.acara,
      source?.public_wedding?.event_utama,
      source?.public_wedding?.main_event,
      source?.public_wedding?.events,
      source?.public_wedding?.event,
      source?.public_wedding?.acara,
      source?.data?.event_utama,
      source?.data?.main_event,
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
      .reduce((value, key) => {
        if (Array.isArray(value) && /^\d+$/.test(key)) {
          return value[Number(key)];
        }

        return value?.[key];
      }, source);
  }

  private normalizeMessagePart(value: string): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private cleanupWhatsappMessage(value: string): string {
    const seenUrls = new Set<string>();

    return String(value || '')
      .replace(/\{\{[^}]+\}\}/g, '')
      .split('\n')
      .filter((line) => {
        const text = line.trim();
        if (!/^https?:\/\/\S+$/i.test(text)) {
          return true;
        }

        if (seenUrls.has(text)) {
          return false;
        }

        seenUrls.add(text);
        return true;
      })
      .join('\n')
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

  private buildGuestInvitationUrl(guestToken?: string, guestSlug?: string): string {
    const domain =
      this.publicWeddingDomain ||
      this.normalizeWeddingDomain(this.weddingData?.setting?.domain) ||
      this.normalizeWeddingDomain(this.weddingData?.testimoni?.domain) ||
      '';

    if (!domain) {
      return '';
    }

    const cleanGuestToken = String(guestToken || '').trim();
    const cleanGuestSlug = String(guestSlug || '').trim();
    const origin = this.getInvitationShareOrigin();
    const baseUrl = `${origin}/wedding/${encodeURIComponent(domain)}`;
    const params = new URLSearchParams();

    if (cleanGuestToken) {
      params.set('guest', cleanGuestToken);
    }

    if (cleanGuestSlug) {
      params.set('to', cleanGuestSlug);
    }

    return params.toString() ? `${baseUrl}?${params.toString()}` : '';
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
      const parsed = new URL(url);
      return decodeURIComponent(parsed.searchParams.get('to') || '').replace(/-/g, ' ').trim();
    } catch {
      const match = String(url).match(/[?&]to=([^&]+)/i);
      return match ? decodeURIComponent(match[1]).trim() : '';
    }
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

  private createGuestSlug(name: string): string {
    return createGuestSlug(name);
  }

  private loadGuestsFromBackend(): void {
    this.isGuestListLoading = true;
    this.dashboardService.getInvitationGuests().subscribe({
      next: (response) => {
        this.generatedGuests = this.extractGuestRows(response)
          .map((guest) => this.normalizeBackendGuest(guest))
          .filter((guest) => !!guest.name)
          .slice(0, this.maxStoredGuests);
        this.isGuestListLoading = false;
      },
      error: (error) => {
        this.isGuestListLoading = false;
        this.generatedGuests = [];
        this.showNotice(this.resolveBackendErrorMessage(error, 'Gagal memuat daftar tamu.'));
      }
    });
  }

  private extractGuestRows(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data?.guests)) return response.data.guests;
    if (Array.isArray(response?.data?.items)) return response.data.items;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.guests)) return response.guests;
    if (Array.isArray(response?.items)) return response.items;
    return [];
  }

  private extractGuestPayload(response: any): any {
    return response?.data?.guest ||
      response?.data?.data ||
      response?.data ||
      response?.guest ||
      response ||
      {};
  }

  private normalizeBackendGuest(raw: any): GuestInvitationRecord {
    const nestedGuest = raw?.guest || {};
    const name = String(
      raw?.name ||
      raw?.guest_name ||
      raw?.nama_tamu ||
      raw?.nama ||
      nestedGuest?.name ||
      nestedGuest?.nama ||
      ''
    ).trim();
    const guestToken = String(
      raw?.guest_token ||
      raw?.token ||
      raw?.guestToken ||
      nestedGuest?.guest_token ||
      nestedGuest?.token ||
      ''
    ).trim();
    const slug = String(
      raw?.slug ||
      raw?.to ||
      raw?.guest_slug ||
      raw?.kode_tamu ||
      nestedGuest?.slug ||
      this.createGuestSlug(name)
    ).trim();
    const invitationUrl = String(
      raw?.invitation_url ||
      raw?.invitation_link ||
      raw?.link_undangan ||
      raw?.url ||
      ''
    ).trim();

    const url = this.ensureGuestTokenInUrl(invitationUrl, guestToken, slug) ||
      this.buildGuestInvitationUrl(guestToken, slug);

    return {
      id: String(raw?.id || raw?.guest_id || nestedGuest?.id || guestToken || slug || name),
      name,
      guestToken,
      slug,
      url,
      attendanceStatus: raw?.attendance_status || raw?.status_kehadiran || raw?.status || '',
      checkedInAt: raw?.checked_in_at || raw?.attended_at || raw?.waktu_hadir || null,
      lastScannedAt: raw?.last_scan_at || raw?.scan_terakhir || raw?.updated_at || null,
      checkinCount: Number(raw?.checkin_count ?? raw?.scan_count ?? raw?.jumlah_scan ?? 0),
      createdAt: String(raw?.created_at || new Date().toISOString()),
    };
  }

  private buildImportSuccessMessage(response: any): string {
    const successCount = Number(
      response?.data?.success_count ??
      response?.data?.success ??
      response?.success_count ??
      response?.imported ??
      response?.data?.imported ??
      0
    );
    const failCount = Number(
      response?.data?.failed_count ??
      response?.data?.failed ??
      response?.failed_count ??
      response?.failed ??
      0
    );

    if (Number.isFinite(successCount) && (successCount || failCount)) {
      return `Import selesai. ${successCount} tamu berhasil ditambahkan, ${failCount} gagal.`;
    }

    return String(response?.message || 'Import daftar tamu berhasil.');
  }

  private ensureGuestTokenInUrl(url: string, guestToken: string, guestSlug: string): string {
    const cleanUrl = String(url || '').trim();
    const cleanToken = String(guestToken || '').trim();
    const cleanSlug = String(guestSlug || '').trim();

    if (!cleanUrl) {
      return '';
    }

    if (!cleanToken) {
      return cleanUrl;
    }

    try {
      const parsed = new URL(cleanUrl, this.getInvitationShareOrigin());
      parsed.searchParams.set('guest', cleanToken);

      if (cleanSlug && !parsed.searchParams.get('to')) {
        parsed.searchParams.set('to', cleanSlug);
      }

      return parsed.toString();
    } catch {
      const separator = cleanUrl.includes('?') ? '&' : '?';
      const toParam = cleanSlug && !/[?&]to=/i.test(cleanUrl)
        ? `&to=${encodeURIComponent(cleanSlug)}`
        : '';
      return `${cleanUrl}${separator}guest=${encodeURIComponent(cleanToken)}${toParam}`;
    }
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

    if (code === 'GUEST_NOT_FOUND') {
      return 'Data tamu tidak ditemukan. Pastikan link dibuat melalui menu Bagi Undangan.';
    }

    if (code === 'INVALID_GUEST_LINK') {
      return 'Format link undangan tidak valid.';
    }

    if (code === 'GUEST_ALREADY_CHECKED_IN') {
      return 'Tamu ini sudah tercatat hadir.';
    }

    return getFriendlyErrorMessage(error) || fallback;
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
