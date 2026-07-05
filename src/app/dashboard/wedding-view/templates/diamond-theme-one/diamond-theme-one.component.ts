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
    if (changes['weddingData']) {
      console.log('[DiamondThemeOne] weddingData events:', this.weddingData?.events);
      console.log('[DiamondThemeOne] main event:', this.getMainEvent());
      console.log('[DiamondThemeOne] hero date:', this.getHeroDateLabel());
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
    return this.getHeroDateLabel();
  }

  override getCoverPhoto(): string {
    return this.getCoverPhotoUrl();
  }

  getCoverPhotoUrl(): string {
    const gallery = Array.isArray(this.weddingData?.gallery) ? this.weddingData?.gallery || [] : [];
    const namedCover = gallery.find((item: any) => {
      const name = String(item?.nama_foto || item?.name || '').toLowerCase();
      return (name.includes('cover') || name.includes('outdoor')) && this.getGalleryCandidateUrl(item);
    });
    const firstGalleryPhoto = gallery.find((item: any) => this.getGalleryCandidateUrl(item));

    const candidates = [
      this.getGalleryCandidateUrl(namedCover),
      this.getGalleryCandidateUrl(firstGalleryPhoto),
      (this.weddingData as any)?.cover_photo_url,
      (this.weddingData as any)?.mempelai?.cover_photo_url,
      this.weddingData?.mempelai?.cover_photo,
      (this.weddingData as any)?.cover_photo,
      this.getBridePhoto(),
      this.getGroomPhoto(),
    ];

    for (const candidate of candidates) {
      const photoUrl = this.normalizePhotoUrl(candidate);
      if (photoUrl) {
        return photoUrl;
      }
    }

    return 'assets/thema-4/diamond-cover.jpg';
  }

  private getGalleryCandidateUrl(item: any): string {
    return item?.photo_url || item?.url || item?.photo || '';
  }

  getOpeningPhoto(): string {
    return this.getCoverPhotoUrl();
  }

  getPrayerPhotoUrl(): string {
    const gallery = Array.isArray(this.weddingData?.gallery) ? this.weddingData?.gallery || [] : [];

    const prayerPhoto =
      gallery.find((item: any) => {
        const name = String(item?.nama_foto || item?.name || item?.title || '').toLowerCase();
        return name.includes('couple') ||
          name.includes('pasangan') ||
          name.includes('outdoor') ||
          name.includes('prewedding');
      }) ||
      gallery[1] ||
      gallery[0];

    return this.normalizePhotoUrl(
      (prayerPhoto as any)?.photo_url ||
      (prayerPhoto as any)?.photo ||
      (prayerPhoto as any)?.url
    ) || this.getCoverPhotoUrl();
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

  override getEvents(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.acaras)) return data.acaras;
    if (Array.isArray(data.event)) return data.event;
    if (Array.isArray(data.detail_acara)) return data.detail_acara;
    if (Array.isArray(data.detail_acaras)) return data.detail_acaras;

    if (data.events && typeof data.events === 'object') {
      return Object.values(data.events);
    }

    return [];
  }

  getMainEvent(): any {
    const events = this.getEvents();

    if (!events.length) return null;

    return (
      events.find((event: any) => {
        const type = String(
          event?.jenis_acara ||
          event?.type ||
          event?.nama_acara ||
          event?.name ||
          ''
        ).toLowerCase();

        return type.includes('akad');
      }) ||
      events.find((event: any) => {
        return Boolean(
          event?.tanggal_acara ||
          event?.tanggal ||
          event?.date ||
          event?.event_date ||
          event?.start_date ||
          event?.wedding_date
        );
      }) ||
      events[0]
    );
  }

  getGroomPortrait(): string {
    return this.getGroomPhoto() || '';
  }

  getBridePortrait(): string {
    return this.getBridePhoto() || '';
  }

  getMainQuote(): string {
    const data: any = this.weddingData || {};
    const quote = Array.isArray(data?.quotes)
      ? data?.quotes?.[0]
      : data?.quotes;

    return String(quote?.quote || quote?.pesan || quote?.text || this.getDiamondQuoteText() || '').trim();
  }

  getMainQuoteSource(): string {
    const data: any = this.weddingData || {};
    const quote = Array.isArray(data?.quotes)
      ? data?.quotes?.[0]
      : data?.quotes;

    return String(quote?.name || quote?.source || quote?.sumber || this.getDiamondQuoteSource() || '').trim();
  }

  getBrideData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data?.mempelai || {};
    const list = Array.isArray(mempelai) ? mempelai : [];

    return (
      list.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('wanita') || gender.includes('perempuan') || gender.includes('bride');
      }) ||
      mempelai?.wanita ||
      mempelai?.bride ||
      mempelai?.female ||
      data?.mempelai_wanita ||
      this.getBride() ||
      mempelai
    );
  }

  getGroomData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data?.mempelai || {};
    const list = Array.isArray(mempelai) ? mempelai : [];

    return (
      list.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('pria') || gender.includes('laki') || gender.includes('groom');
      }) ||
      mempelai?.pria ||
      mempelai?.groom ||
      mempelai?.male ||
      data?.mempelai_pria ||
      this.getGroom() ||
      mempelai
    );
  }

  getBridePhotoUrl(): string {
    const bride = this.getBrideData();
    return this.normalizePhotoUrl(
      bride?.photo_url ||
      bride?.foto ||
      bride?.photo ||
      bride?.image ||
      bride?.avatar ||
      this.getBridePhoto()
    ) || this.getCoverPhotoUrl();
  }

  getGroomPhotoUrl(): string {
    const groom = this.getGroomData();
    return this.normalizePhotoUrl(
      groom?.photo_url ||
      groom?.foto ||
      groom?.photo ||
      groom?.image ||
      groom?.avatar ||
      this.getGroomPhoto()
    ) || this.getCoverPhotoUrl();
  }

  override getBrideParents(): string {
    const bride = this.getBrideData();
    return String(
      bride?.orang_tua ||
      bride?.nama_orang_tua ||
      bride?.parents ||
      bride?.putri_dari ||
      this.getBrideParentLine() ||
      ''
    ).trim();
  }

  override getGroomParents(): string {
    const groom = this.getGroomData();
    return String(
      groom?.orang_tua ||
      groom?.nama_orang_tua ||
      groom?.parents ||
      groom?.putra_dari ||
      this.getGroomParentLine() ||
      ''
    ).trim();
  }

  override getBrideInstagram(): string {
    const bride = this.getBrideData();
    return String(bride?.instagram || bride?.ig || bride?.sosmed || super.getBrideInstagram() || '').replace('@', '').trim();
  }

  override getGroomInstagram(): string {
    const groom = this.getGroomData();
    return String(groom?.instagram || groom?.ig || groom?.sosmed || super.getGroomInstagram() || '').replace('@', '').trim();
  }

  getInstagramUrl(username: string): string {
    const clean = String(username || '').replace('@', '').trim();
    return clean ? `https://instagram.com/${clean}` : '#';
  }

  onCoverImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;
    target.onerror = null;
    target.src = this.getCoverPhotoUrl();
  }

  onPersonImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;
    target.onerror = null;
    target.src = this.getCoverPhotoUrl();
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
    const event = this.getMainEvent();
    const data: any = this.weddingData || {};

    const rawDate =
      event?.tanggal_acara ||
      event?.tanggal ||
      event?.date ||
      event?.event_date ||
      event?.start_date ||
      event?.wedding_date ||
      event?.countdown?.tanggal_acara ||
      event?.countdown?.tanggal ||
      event?.countdown?.date ||
      data?.countdown?.tanggal_acara ||
      data?.countdown?.tanggal ||
      data?.countdown?.date ||
      data?.countdown?.tanggal_countdown ||
      data?.filter_undangan?.tanggal_acara ||
      data?.filter_undangan?.tanggal ||
      data?.website?.tanggal_acara ||
      data?.website?.tanggal ||
      '';

    return this.formatDiamondDate(rawDate);
  }

  formatDiamondDate(rawDate: any): string {
    if (!rawDate) return '';

    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      return this.formatDateParts(rawDate);
    }

    const value = String(rawDate).trim();

    if (!value) return '';

    const ymdMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymdMatch) {
      return `${ymdMatch[3]} · ${ymdMatch[2]} · ${ymdMatch[1]}`;
    }

    const dmyMatch = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (dmyMatch) {
      return `${dmyMatch[1]} · ${dmyMatch[2]} · ${dmyMatch[3]}`;
    }

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return this.formatDateParts(parsed);
    }

    return value;
  }

  formatDateParts(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day} · ${month} · ${year}`;
  }

  getFallbackDateLabel(): string {
    return '';
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
