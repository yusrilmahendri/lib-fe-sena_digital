import { Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DashboardService } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
import { BankAccount, GalleryItem, WeddingEvent, WeddingStory } from '../../../../services/wedding-data.service';
import { RubyThemeOneComponent } from '../ruby-theme-one/ruby-theme-one.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'wc-diamond-theme-one',
  templateUrl: './diamond-theme-one.component.html',
  styleUrls: ['./diamond-theme-one.component.scss'],
})
export class DiamondThemeOneComponent extends RubyThemeOneComponent implements OnInit, OnChanges {
  isInvitationOpened = false;
  readonly apiBaseUrl = (environment as any).apiBaseUrl || (environment as any).apiUrl || '';

  constructor(
    sanitizer: DomSanitizer,
    dashboardService: DashboardService,
    toastService: ToastService
  ) {
    super(sanitizer, dashboardService, toastService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.syncInvitationState();
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);
    if (changes['invitationOpened'] || changes['weddingData']) {
      this.syncInvitationState();
    }
  }

  override openInvitation(): void {
    this.isInvitationOpened = true;
    this.openInvitationRequested.emit();
    this.hasOpened = true;
    document.body.classList.remove('modal-open');
    setTimeout(() => {
      const main = document.querySelector('.diamond-main');
      main?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }

  override getPrimaryDisplayName(): string {
    return this.getGroomShortName();
  }

  override getSecondaryDisplayName(): string {
    return this.getBrideShortName();
  }

  override getBrideName(): string {
    const bride = this.getBride() as any;
    const data = this.weddingData as any;
    return this.firstFilled([
      data?.mempelai?.nama_wanita,
      bride?.nama_lengkap,
      bride?.name,
      bride?.nama,
      data?.mempelai_wanita?.nama_lengkap,
      data?.mempelai?.wanita?.nama_lengkap,
      data?.mempelai?.wanita?.nama,
      data?.mempelai?.female_name,
    ], '');
  }

  override getGroomName(): string {
    const groom = this.getGroom() as any;
    const data = this.weddingData as any;
    return this.firstFilled([
      data?.mempelai?.nama_pria,
      groom?.nama_lengkap,
      groom?.name,
      groom?.nama,
      data?.mempelai_pria?.nama_lengkap,
      data?.mempelai?.pria?.nama_lengkap,
      data?.mempelai?.pria?.nama,
      data?.mempelai?.male_name,
    ], '');
  }

  getGroomFullName(): string {
    return this.getGroomName() || this.getGroomShortName();
  }

  getBrideFullName(): string {
    return this.getBrideName() || this.getBrideShortName();
  }

  getGroomShortName(): string {
    const groom = this.getGroom() as any;
    return this.firstFilled([
      groom?.nama_panggilan,
      groom?.nickname,
      groom?.nama_lengkap,
      this.getGroomName(),
    ], '');
  }

  getBrideShortName(): string {
    const bride = this.getBride() as any;
    return this.firstFilled([
      bride?.nama_panggilan,
      bride?.nickname,
      bride?.nama_lengkap,
      this.getBrideName(),
    ], '');
  }

  getCoupleNames(): string {
    const groom = this.getGroomShortName() || this.getGroomName();
    const bride = this.getBrideShortName() || this.getBrideName();
    if (groom && bride) {
      return `${groom} & ${bride}`;
    }
    return groom || bride || 'Bride & Groom';
  }

  getWeddingDateText(): string {
    return this.getOpeningDateLabel();
  }

  getWeddingDayPart(): string {
    const date = this.getCeremonyDateSource();
    return date ? String(date.getDate()).padStart(2, '0') : '--';
  }

  getWeddingMonthPart(): string {
    const date = this.getCeremonyDateSource();
    return date ? String(date.getMonth() + 1).padStart(2, '0') : '--';
  }

  getWeddingYearPart(): string {
    const date = this.getCeremonyDateSource();
    return date ? String(date.getFullYear()) : '----';
  }

  override getOpeningDateLabel(): string {
    const event = this.getMainEvent();
    const rawDate = event?.tanggal_acara || event?.date || event?.tanggal;
    if (!rawDate) {
      return '';
    }

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day} · ${month} · ${year}`;
  }

  override getCoverPhoto(): string {
    return this.getCoverPhotoUrl();
  }

  getCoverPhotoUrl(): string {
    const gallery = Array.isArray(this.weddingData?.gallery) ? this.weddingData?.gallery || [] : [];
    const cover = gallery.find((item: any) => {
      const name = String(item?.nama_foto || item?.name || '').toLowerCase();
      return name.includes('cover');
    }) || gallery[0];

    const url = (cover as any)?.photo_url || (cover as any)?.url || (cover as any)?.photo;
    const candidates = [
      url,
      (this.weddingData as any)?.cover_photo_url,
      (this.weddingData as any)?.mempelai?.cover_photo_url,
      this.weddingData?.mempelai?.cover_photo,
      (this.weddingData as any)?.cover_photo,
    ];

    for (const candidate of candidates) {
      const photoUrl = this.normalizePhotoUrl(candidate);
      if (photoUrl) {
        return photoUrl;
      }
    }

    return 'assets/thema-4/diamond-cover.jpg';
  }

  getOpeningPhoto(): string {
    return this.getCoverPhotoUrl();
  }

  override getGuestName(): string {
    return String(
      (this.weddingData as any)?.guest_name ||
      (this.weddingData as any)?.nama_tamu ||
      (this.weddingData as any)?.filter_undangan?.nama_tamu ||
      (this.weddingData as any)?.filter_undangan?.guest_name ||
      (this.weddingData as any)?.guest?.nama ||
      (this.weddingData as any)?.guest?.name ||
      'Tamu Undangan'
    ).trim();
  }

  override getEvents(): WeddingEvent[] {
    return Array.isArray(this.weddingData?.events) ? this.weddingData?.events || [] : [];
  }

  getMainEvent(): any {
    const events = this.getEvents();
    return events.find((event: any) => String(event?.jenis_acara || '').toLowerCase().includes('akad')) || events[0] || null;
  }

  getGroomPortrait(): string {
    return this.getGroomPhoto() || '';
  }

  getBridePortrait(): string {
    return this.getBridePhoto() || '';
  }

  getDiamondQuoteText(): string {
    return this.getQuoteText();
  }

  getDiamondQuoteSource(): string {
    return this.getQuoteName();
  }

  getInvitingFamilies(): string[] {
    return [
      this.getGroomParentLine(),
      this.getBrideParentLine(),
    ].filter((line) => !!line && line.trim().length > 0);
  }

  getOrderedEvents(): WeddingEvent[] {
    const events = this.getEvents();
    if (!events.length) {
      return [];
    }

    const weight = (event: WeddingEvent): number => {
      const label = `${(event as any).jenis_acara || ''} ${event.nama_acara || ''}`.toLowerCase();
      if (/akad|nikah|pemberkatan/.test(label)) {
        return 0;
      }
      if (/resepsi|reception|ngunduh/.test(label)) {
        return 1;
      }
      return 2;
    };

    return [...events].sort((left, right) => weight(left) - weight(right));
  }

  getEventTypeLabel(event: WeddingEvent): string {
    const label = `${(event as any).jenis_acara || ''} ${event.nama_acara || ''}`.toLowerCase();
    if (/akad|nikah|pemberkatan/.test(label)) {
      return 'Akad Nikah';
    }
    if (/resepsi|reception|ngunduh/.test(label)) {
      return 'Resepsi';
    }
    return event.nama_acara || 'Acara';
  }

  getEventMapsLink(event: WeddingEvent): string | null {
    const link = String(event?.link_maps || '').trim();
    return link || null;
  }

  getCalendarLink(event: WeddingEvent): string | null {
    if (!event?.tanggal_acara) {
      return null;
    }

    const start = this.toCalendarStamp(event.tanggal_acara, event.start_acara);
    const end = this.toCalendarStamp(event.tanggal_acara, event.end_acara || event.start_acara);
    if (!start) {
      return null;
    }

    const title = encodeURIComponent(event.nama_acara || 'Acara Pernikahan');
    const location = encodeURIComponent(event.alamat || '');
    const dates = end ? `${start}/${end}` : start;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}`;
  }

  getLoveStoryItems(): Array<{ title: string; date: string; description: string }> {
    return this.getStories().map((story: WeddingStory) => ({
      title: story.title || 'Cerita Kami',
      date: story.tanggal_cerita ? String(story.tanggal_cerita).slice(0, 4) : '',
      description: story.lead_cerita || '',
    })).filter((item) => !!item.title || !!item.description);
  }

  getStoryTrackBy(index: number, item: { title: string }): string {
    return `${index}-${item.title}`;
  }

  trackByEvent(index: number, event: WeddingEvent): number {
    return event.id || index;
  }

  getBankPhotoUrl(bank: BankAccount): string {
    return this.normalizeMediaUrl(bank?.photo_rek);
  }

  override getPackageLabelText(): string {
    return 'Paket Diamond';
  }

  getHeroDateLabel(): string {
    return this.getOpeningDateLabel();
  }

  normalizePhotoUrl(url: string | null | undefined): string {
    if (!url) {
      return '';
    }

    const value = String(url).trim();
    if (!value || value === 'null' || value === 'undefined') {
      return '';
    }

    if (value.startsWith('data:')) {
      return value;
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value.replace('/storage/photos/photos/', '/storage/photos/');
    }

    const clean = value
      .replace(/^\/+/, '')
      .replace(/^storage\/photos\/photos\//, 'storage/photos/')
      .replace(/^photos\/photos\//, 'photos/');

    const baseUrl = String(this.apiBaseUrl || '')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');

    if (clean.startsWith('storage/')) {
      return `${baseUrl}/${clean}`;
    }
    if (clean.startsWith('photos/')) {
      return `${baseUrl}/storage/${clean}`;
    }
    return `${baseUrl}/storage/photos/${clean}`;
  }

  getDetailEventVenue(event?: WeddingEvent | any): string {
    return String(
      event?.nama_acara ||
      event?.nama_lokasi ||
      event?.venue ||
      event?.tempat ||
      event?.lokasi ||
      ''
    ).trim();
  }

  getAkadMapLink(): string {
    const event = this.getAkadCard();
    const data = event as any;
    return String(event?.link_maps || data?.maps || data?.map_url || '').trim();
  }

  getGiftAddress(bank?: any): string {
    if (bank) {
      return String(
        bank.alamat_kado ||
        bank.gift_address ||
        bank.alamat ||
        bank.address ||
        ''
      ).trim();
    }

    const data = this.weddingData as any;
    const candidates = [
      data?.alamat_kado,
      data?.gift_address,
      data?.settings?.alamat_kado,
    ];

    return candidates
      .map((value) => String(value || '').trim())
      .find((value) => !!value) || '';
  }

  override getVisibleBankAccounts(): BankAccount[] {
    const bankAccounts = this.weddingData?.bank_accounts ?? [];
    return Array.isArray(bankAccounts) ? bankAccounts : [];
  }

  private syncInvitationState(): void {
    this.isInvitationOpened = this.invitationOpened;
    if (this.invitationOpened) {
      this.hasOpened = true;
    }
  }

  private getCeremonyDateSource(): Date | null {
    const akad = this.getAkadEvent();
    if (akad?.tanggal_acara) {
      return this.toValidDate(akad.tanggal_acara);
    }

    const firstEvent = this.getEvents()[0];
    if (firstEvent?.tanggal_acara) {
      return this.toValidDate(firstEvent.tanggal_acara);
    }

    const countdownDate = (this.weddingData as any)?.countdown?.tanggal_countdown
      || (this.weddingData as any)?.countdown?.date;
    if (countdownDate) {
      return this.toValidDate(countdownDate);
    }

    return null;
  }

  protected toValidDate(dateValue?: string | null): Date | null {
    if (!dateValue) {
      return null;
    }

    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private firstFilled(values: any[], fallback: string): string {
    return values
      .map((value) => String(value || '').trim())
      .find((value) => !!value) || fallback;
  }

  private toCalendarStamp(date?: string | null, time?: string | null): string | null {
    if (!date) {
      return null;
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const datePart = parsed.toISOString().slice(0, 10).replace(/-/g, '');
    const safeTime = (time || '00:00').slice(0, 5).replace(':', '');
    return `${datePart}T${safeTime}00`;
  }
}
