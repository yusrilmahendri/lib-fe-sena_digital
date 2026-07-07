import { Component, OnInit, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DashboardService } from '../../../../dashboard.service';
import { ToastService } from '../../../../toast.service';
import { WeddingEvent } from '../../../../services/wedding-data.service';
import { DiamondThemeOneComponent } from '../diamond-theme-one/diamond-theme-one.component';

interface DiamondGardenGalleryItem {
  photoUrl: string;
  alt: string;
}

@Component({
  selector: 'wc-diamond-theme-two',
  templateUrl: './diamond-theme-two.component.html',
  styleUrls: ['./diamond-theme-two.component.scss'],
})
export class DiamondThemeTwoComponent extends DiamondThemeOneComponent implements OnInit {
  diamondGardenMapSrc = '';
  diamondGardenMapSafeSrc: SafeResourceUrl | null = null;
  diamondGardenMapLink = '';
  diamondGardenMapDebug: any = null;
  private diamondGardenMapInitialized = false;

  constructor(
    svc: DashboardService,
    private readonly diamondGardenSanitizer: DomSanitizer,
    toastService: ToastService
  ) {
    super(diamondGardenSanitizer, svc, toastService);
  }

  override ngOnInit(): void {
    super.ngOnInit();
    setTimeout(() => this.setupDiamondGardenMapOnce(), 500);
    setTimeout(() => this.setupDiamondGardenMapOnce(), 1200);
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);

    if (changes['invitationOpened'] && this.invitationOpened) {
      this.isInvitationOpened = true;
    }

    if (changes['weddingData']) {
      this.diamondGardenMapInitialized = false;
      this.diamondGardenMapSafeSrc = null;
      this.diamondGardenMapSrc = '';
      this.diamondGardenMapLink = '';
      setTimeout(() => this.setupDiamondGardenMapOnce(), 300);
      setTimeout(() => this.setupDiamondGardenMapOnce(), 1200);
    }
  }

  override openInvitation(): void {
    this.isInvitationOpened = true;
    this.hasOpened = true;
    this.openInvitationRequested.emit();
    document.body.classList.remove('modal-open');

    setTimeout(() => {
      const target = document.querySelector('.diamond-garden-main');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  override getPrimaryDisplayName(): string {
    return this.getBrideNickname() || this.getBrideName() || 'Mempelai Wanita';
  }

  override getSecondaryDisplayName(): string {
    return this.getGroomNickname() || this.getGroomName() || 'Mempelai Pria';
  }

  override getBrideFullName(): string {
    return this.getBrideName() || 'Mempelai Wanita';
  }

  override getGroomFullName(): string {
    return this.getGroomName() || 'Mempelai Pria';
  }

  get guestName(): string {
    return this.getGuestName();
  }

  get wishFormData(): any {
    if (!this.wishForm.kehadiran) {
      this.wishForm.kehadiran = 'hadir';
    }

    return this.wishForm;
  }

  override getBrideData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data.mempelai || data.mempelais || data.couple || {};

    return (
      data.bride ||
      mempelai.bride ||
      mempelai.wanita ||
      mempelai.perempuan ||
      mempelai.mempelai_wanita ||
      (Array.isArray(mempelai) ? mempelai.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('wanita') || gender.includes('perempuan') || gender.includes('bride');
      }) : null) ||
      this.getBride() ||
      {}
    );
  }

  override getGroomData(): any {
    const data: any = this.weddingData || {};
    const mempelai = data.mempelai || data.mempelais || data.couple || {};

    return (
      data.groom ||
      mempelai.groom ||
      mempelai.pria ||
      mempelai.laki_laki ||
      mempelai.mempelai_pria ||
      (Array.isArray(mempelai) ? mempelai.find((item: any) => {
        const gender = String(item?.gender || item?.jenis_kelamin || item?.type || '').toLowerCase();
        return gender.includes('pria') || gender.includes('laki') || gender.includes('groom');
      }) : null) ||
      this.getGroom() ||
      {}
    );
  }

  override getBrideName(): string {
    const bride = this.getBrideData();
    const data: any = this.weddingData || {};

    return this.gardenFirstFilled([
      data?.mempelai?.nama_wanita,
      bride?.nama_lengkap,
      bride?.full_name,
      bride?.name,
      bride?.nama,
      bride?.nama_mempelai,
      super.getBrideName(),
    ], 'Mempelai Wanita');
  }

  override getGroomName(): string {
    const groom = this.getGroomData();
    const data: any = this.weddingData || {};

    return this.gardenFirstFilled([
      data?.mempelai?.nama_pria,
      groom?.nama_lengkap,
      groom?.full_name,
      groom?.name,
      groom?.nama,
      groom?.nama_mempelai,
      super.getGroomName(),
    ], 'Mempelai Pria');
  }

  override getBrideParents(): string {
    const bride = this.getBrideData();

    return this.gardenFirstFilled([
      bride?.nama_orang_tua,
      bride?.orang_tua,
      bride?.parents,
      bride?.parent,
      bride?.nama_ayah && bride?.nama_ibu ? `Putri dari ${bride.nama_ayah} & ${bride.nama_ibu}` : '',
      super.getBrideParents(),
    ], '');
  }

  override getGroomParents(): string {
    const groom = this.getGroomData();

    return this.gardenFirstFilled([
      groom?.nama_orang_tua,
      groom?.orang_tua,
      groom?.parents,
      groom?.parent,
      groom?.nama_ayah && groom?.nama_ibu ? `Putra dari ${groom.nama_ayah} & ${groom.nama_ibu}` : '',
      super.getGroomParents(),
    ], '');
  }

  override getBridePhotoUrl(): string {
    const bride = this.getBrideData();
    const rawUrl =
      bride?.photo_url ||
      bride?.foto_url ||
      bride?.photo ||
      bride?.foto ||
      bride?.image ||
      bride?.avatar ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || super.getBridePhotoUrl();
  }

  override getGroomPhotoUrl(): string {
    const groom = this.getGroomData();
    const rawUrl =
      groom?.photo_url ||
      groom?.foto_url ||
      groom?.photo ||
      groom?.foto ||
      groom?.image ||
      groom?.avatar ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || super.getGroomPhotoUrl();
  }

  override getBrideInstagram(): string {
    const bride = this.getBrideData();

    return this.gardenFirstFilled([
      bride?.instagram,
      bride?.ig,
      bride?.sosmed,
      bride?.social_media,
      super.getBrideInstagram(),
    ], '').replace('@', '');
  }

  override getGroomInstagram(): string {
    const groom = this.getGroomData();

    return this.gardenFirstFilled([
      groom?.instagram,
      groom?.ig,
      groom?.sosmed,
      groom?.social_media,
      super.getGroomInstagram(),
    ], '').replace('@', '');
  }

  override getInstagramUrl(username: string): string {
    const value = String(username || '').replace('@', '').trim();
    return value ? `https://instagram.com/${value}` : '#';
  }

  private gardenFirstFilled(values: any[], fallback = ''): string {
    const found = values.find((value) => {
      const text = String(value || '').trim();
      return !!text && text !== 'null' && text !== 'undefined';
    });

    return found ? String(found).trim() : fallback;
  }

  getHeroLabel(): string {
    return 'Wedding Invitation';
  }

  getOpeningQuote(): string {
    return this.getInvitationIntro();
  }

  getGardenCoverPhotoUrl(): string {
    return this.getGardenHeroImage(2);
  }

  getGardenGallery(): any[] {
    const gallery: any[] = this.weddingData?.gallery || [];

    return gallery.filter((item: any) => {
      return Boolean(item?.photo_url || item?.photo || item?.url || item?.image);
    });
  }

  getGardenHeroImage(index: number): string {
    const gallery = this.getGardenGallery();

    const preferred: any[] = [
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['wanita', 'bride', 'female', 'mempelai wanita', 'pengantin wanita'])),
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['pria', 'groom', 'male', 'mempelai pria', 'pengantin pria'])),
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['couple', 'pasangan', 'berdua', 'prewedding', 'outdoor', 'cover', 'sampul'])),
    ];

    const portraitFallback = [
      this.getBridePortrait(),
      this.getGroomPortrait(),
      this.getGardenGalleryCoverPhoto(),
    ];

    const item: any =
      preferred[index] ||
      gallery[index] ||
      gallery[0] ||
      null;

    const rawUrl =
      item?.photo_url ||
      item?.photo ||
      item?.url ||
      item?.image ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || portraitFallback[index] || this.getGardenFallbackImage(index);
  }

  getHeroImage(index: number): string {
    return this.getGardenHeroImage(index);
  }

  matchGardenPhotoName(photo: any, keywords: string[]): boolean {
    const name = String(
      photo?.nama_foto ||
      photo?.name ||
      photo?.title ||
      photo?.caption ||
      ''
    ).toLowerCase();

    return keywords.some((keyword) => name.includes(keyword));
  }

  getGardenFallbackImage(index: number): string {
    const fallback = [
      'assets/thema-5/hero-top.jpg',
      'assets/thema-5/hero-middle.jpg',
      'assets/thema-5/hero-bottom.jpg',
    ];

    return fallback[index] || fallback[0];
  }

  getGardenGalleryCoverPhoto(): string {
    const gallery = this.getGardenGallery();
    const item: any =
      gallery.find((photo: any) => this.matchGardenPhotoName(photo, ['couple', 'pasangan', 'berdua', 'prewedding', 'outdoor', 'cover', 'sampul'])) ||
      gallery[2] ||
      gallery[0] ||
      null;

    const rawUrl =
      item?.photo_url ||
      item?.photo ||
      item?.url ||
      item?.image ||
      (this.weddingData as any)?.cover_url ||
      (this.weddingData as any)?.cover ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl);
  }

  getGardenMomentGallery(): any[] {
    const gallery: any[] = this.weddingData?.gallery || [];

    return gallery.filter((item: any) => {
      return Boolean(
        item?.photo_url ||
        item?.photo ||
        item?.url ||
        item?.image
      );
    });
  }

  getGardenMomentFeatured(): any {
    const gallery = this.getGardenMomentGallery();

    return (
      gallery.find((item: any) => item?.url_video || item?.video_url || item?.link_video) ||
      gallery[0] ||
      null
    );
  }

  getGardenMomentPhotos(): string[] {
    const gallery = this.weddingData?.gallery || [];

    return gallery
      .map((item: any) => this.getGardenGalleryPhotoUrl(item))
      .filter((url: string) => !!url)
      .slice(0, 8);
  }

  getGardenFeaturedPhoto(): string {
    const photos = this.getGardenMomentPhotos();

    return photos[0] || this.getCoverPhotoUrl() || 'assets/thema-2/bg-wd.jpeg';
  }

  getGardenGalleryPhotoUrl(item: any): string {
    const raw = String(
      item?.photo_url ||
      item?.photo ||
      item?.url ||
      item?.image ||
      ''
    ).trim();

    if (!raw) return '';

    return this.normalizeGardenPhotoUrl(raw);
  }

  trackByGardenPhoto(index: number, item: string): string {
    return `${index}-${item}`;
  }

  getGardenMomentPhotoUrl(item: any): string {
    const rawUrl =
      item?.photo_url ||
      item?.photo ||
      item?.url ||
      item?.image ||
      item?.foto ||
      '';

    return this.normalizeGardenPhotoUrl(rawUrl) || this.getGardenFallbackImage(1);
  }

  getGardenMomentAlt(item: any, index: number): string {
    return String(
      item?.nama_foto ||
      item?.name ||
      item?.title ||
      `Moment ${index + 1}`
    );
  }

  hasGardenMomentVideo(item: any): boolean {
    return Boolean(
      item?.url_video ||
      item?.video_url ||
      item?.link_video
    );
  }

  openGardenMomentVideo(item: any): void {
    const videoUrl = String(
      item?.url_video ||
      item?.video_url ||
      item?.link_video ||
      ''
    ).trim();

    if (!videoUrl) return;

    window.open(videoUrl, '_blank');
  }

  getGardenGuestWishes(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.guest_wishes)) return data.guest_wishes;
    if (Array.isArray(data.ucapan)) return data.ucapan;
    if (Array.isArray(data.wishes)) return data.wishes;
    if (Array.isArray(data?.data?.guest_wishes)) return data.data.guest_wishes;

    return [];
  }

  isRealGardenWish(item: any): boolean {
    const name = String(item?.nama || item?.name || '').trim().toLowerCase();
    const message = String(item?.pesan || item?.message || item?.ucapan || '').trim();
    const normalized = message.toLowerCase();

    if (!message) return false;
    if (name === 'viewer') return false;
    if (normalized.startsWith('undangan ') && normalized.endsWith(' telah dilihat')) return false;

    return true;
  }

  getVisibleGardenWishes(): any[] {
    return this.getGardenGuestWishes()
      .filter((item: any) => this.isRealGardenWish(item))
      .slice(0, 3);
  }

  getWishAttendance(wish: any): string {
    return String(
      wish?.kehadiran ||
      wish?.attendance ||
      wish?.status_kehadiran ||
      'hadir'
    ).toLowerCase();
  }

  override getWishAttendanceLabel(wish: any): string {
    const status = typeof wish === 'string' ? wish.toLowerCase() : this.getWishAttendance(wish);

    if (status === 'tidak_hadir') return 'Tidak Hadir';
    if (status === 'mungkin') return 'Mungkin';

    return 'Hadir';
  }

  normalizeGardenPhotoUrl(rawUrl: any): string {
    if (!rawUrl) return '';

    let url = String(rawUrl).trim();
    if (!url) return '';

    url = url.replace('/storage/photos/photos/', '/storage/photos/');
    url = url.replace('/storage/photos//', '/storage/photos/');

    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;

    url = url.replace(/^\/+/, '');
    url = url.replace(/^storage\/photos\/photos\//, 'storage/photos/');
    url = url.replace(/^photos\/photos\//, 'photos/');

    const baseUrl = String(this.apiBaseUrl || (this as any).BASE_URL_API || '')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');

    if (url.startsWith('storage/')) return `${baseUrl}/${url}`;
    if (url.startsWith('photos/')) return `${baseUrl}/storage/${url}`;

    return `${baseUrl}/storage/photos/${url}`;
  }

  onGardenImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) return;

    target.style.visibility = 'hidden';
  }

  getGardenEvents(): any[] {
    const data: any = this.weddingData || {};

    if (Array.isArray(data.events)) return data.events;
    if (Array.isArray(data.acaras)) return data.acaras;
    if (Array.isArray(data?.data?.events)) return data.data.events;

    if (data.events && typeof data.events === 'object') {
      return Object.values(data.events);
    }

    return [];
  }

  getGardenMainEvent(): any {
    const events = this.getGardenEvents();

    return (
      events.find((event: any) => {
        const type = String(
          event?.jenis_acara ||
          event?.nama_acara ||
          event?.type ||
          event?.name ||
          ''
        ).toLowerCase();

        return type.includes('akad');
      }) ||
      events[0] ||
      null
    );
  }

  getGardenEventDate(event?: any): Date | null {
    const rawDate = String(
      event?.tanggal_acara ||
      event?.tanggal ||
      event?.date ||
      event?.event_date ||
      ''
    ).trim();

    if (!rawDate) return null;

    const datePart = rawDate.split('T')[0];
    const date = new Date(`${datePart}T00:00:00`);

    return isNaN(date.getTime()) ? null : date;
  }

  getGardenEventMonthLabel(event?: any): string {
    const date = this.getGardenEventDate(event);

    if (!date) return '';

    return date.toLocaleDateString('id-ID', { month: 'long' });
  }

  getGardenEventDayNumber(event?: any): string {
    const date = this.getGardenEventDate(event);

    if (!date) return '--';

    return String(date.getDate()).padStart(2, '0');
  }

  getGardenEventYearLabel(event?: any): string {
    const date = this.getGardenEventDate(event);

    if (!date) return '';

    return String(date.getFullYear());
  }

  override getEventVenueName(event?: any): string {
    const selectedEvent = event || this.getGardenMainEvent();

    return String(
      selectedEvent?.nama_tempat ||
      selectedEvent?.tempat ||
      selectedEvent?.venue ||
      selectedEvent?.lokasi ||
      selectedEvent?.location ||
      selectedEvent?.gedung ||
      selectedEvent?.nama_lokasi ||
      selectedEvent?.nama_acara ||
      ''
    ).trim();
  }

  override getDetailEventVenue(event?: any): string {
    const selectedEvent = event || this.getGardenMainEvent();

    return String(
      selectedEvent?.nama_tempat ||
      selectedEvent?.tempat ||
      selectedEvent?.venue ||
      selectedEvent?.lokasi ||
      selectedEvent?.location ||
      selectedEvent?.gedung ||
      selectedEvent?.nama_lokasi ||
      selectedEvent?.nama_acara ||
      ''
    ).trim();
  }

  getDetailEventAddress(event?: any): string {
    return String(
      event?.alamat ||
      event?.address ||
      event?.lokasi_detail ||
      event?.detail_lokasi ||
      event?.alamat_lengkap ||
      ''
    ).trim();
  }

  override getEventMapLink(event?: any): string {
    const selectedEvent = event || this.getGardenMainEvent();

    return String(
      selectedEvent?.link_maps ||
      selectedEvent?.link_map ||
      selectedEvent?.maps ||
      selectedEvent?.map_url ||
      selectedEvent?.google_maps ||
      selectedEvent?.google_map ||
      ''
    ).trim();
  }

  override getAkadMapLink(): string {
    return this.getEventMapLink(this.getAkadEvent());
  }

  getGardenAkadEvent(): any {
    const data: any = this.weddingData || {};
    const events = data.events || data.acaras || data.event || [];

    if (!Array.isArray(events)) return null;

    return (
      events.find((event: any) =>
        String(event?.jenis_acara || event?.type || event?.nama_acara || '')
          .toLowerCase()
          .includes('akad')
      ) ||
      events[0] ||
      null
    );
  }

  getGardenReceptionEvent(): any {
    const data: any = this.weddingData || {};
    const events = data.events || data.acaras || data.event || [];

    if (!Array.isArray(events)) return null;

    return (
      events.find((event: any) => {
        const type = String(
          event?.jenis_acara || event?.type || event?.nama_acara || ''
        ).toLowerCase();

        return (
          type.includes('resepsi') ||
          type.includes('reception') ||
          type.includes('walimah')
        );
      }) ||
      events[1] ||
      null
    );
  }

  override getReceptionEvent(): any {
    return this.getResepsiEvent();
  }

  private setupDiamondGardenMapOnce(): void {
    if (this.diamondGardenMapInitialized) {
      return;
    }

    const event: any = this.getDiamondGardenAkadEventForMap();

    const linkMaps = String(
      event?.link_maps ||
      event?.link_map ||
      event?.maps_link ||
      event?.google_maps ||
      event?.google_map ||
      event?.map_url ||
      event?.maps ||
      ''
    ).trim();

    const venue = String(
      event?.nama_acara ||
      event?.venue ||
      event?.nama_tempat ||
      event?.tempat ||
      event?.lokasi ||
      ''
    ).trim();

    const address = String(
      event?.alamat ||
      event?.address ||
      event?.alamat_acara ||
      ''
    ).trim();

    const query = [venue, address].filter(Boolean).join(', ').trim();
    const previewQuery = query || linkMaps;

    if (!previewQuery) {
      console.warn('[Diamond Garden Maps] preview query kosong', { event, linkMaps, venue, address });
      return;
    }

    const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(previewQuery)}&output=embed`;

    this.diamondGardenMapSrc = embedSrc;
    this.diamondGardenMapSafeSrc = this.diamondGardenSanitizer.bypassSecurityTrustResourceUrl(embedSrc);
    this.diamondGardenMapLink = linkMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(previewQuery)}`;

    this.diamondGardenMapDebug = {
      event,
      linkMaps,
      venue,
      address,
      query,
      previewQuery,
      embedSrc,
      openLink: this.diamondGardenMapLink
    };

    this.diamondGardenMapInitialized = true;

    console.log('[Diamond Garden Maps Ready]', this.diamondGardenMapDebug);
  }

  private getDiamondGardenAkadEventForMap(): any {
    const data: any = this.weddingData || {};

    const events = []
      .concat(Array.isArray(data.events) ? data.events : [])
      .concat(Array.isArray(data.acaras) ? data.acaras : [])
      .concat(Array.isArray(data.data?.events) ? data.data.events : [])
      .concat(Array.isArray(data.invitation_package?.events) ? data.invitation_package.events : []);

    const akad = events.find((item: any) => {
      const type = String(
        item?.jenis_acara ||
        item?.nama_acara ||
        item?.type ||
        item?.title ||
        ''
      ).toLowerCase();

      return type.includes('akad');
    });

    return akad || events[0] || {};
  }

  openDiamondGardenMap(): void {
    if (!this.diamondGardenMapLink) {
      return;
    }

    window.open(this.diamondGardenMapLink, '_blank', 'noopener,noreferrer');
  }

  getGardenGiftAccounts(): any[] {
    const data: any = this.weddingData || {};
    const nestedData: any = data.data || {};
    const packageData: any = data.invitation_package || {};
    const userInfo: any = data.user_info || {};
    const user: any = data.user || {};

    const candidates = [
      data.bank_accounts,
      nestedData.bank_accounts,
      data.bankAccounts,
      data.rekenings,
      data.rekening,
      data.rekenings_user,
      data.gift_accounts,
      data.wedding_gifts,
      data.gifts,
      packageData.bank_accounts,
      packageData.rekenings,
      packageData.rekening,
      userInfo.bank_accounts,
      userInfo.rekenings,
      user.bank_accounts,
      user.rekenings,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length > 0) {
        return candidate.filter(Boolean);
      }

      if (candidate && typeof candidate === 'object') {
        return [candidate];
      }
    }

    const parentAccounts = this.getBankAccounts();
    if (parentAccounts.length) {
      return parentAccounts;
    }

    const visibleAccounts = this.getVisibleBankAccounts();
    return visibleAccounts.length ? visibleAccounts : [];
  }

  getGardenGiftBankName(account: any): string {
    return String(
      account?.nama_bank ||
      account?.bank_name ||
      account?.bank?.nama_bank ||
      account?.bank?.name ||
      account?.name_bank ||
      ''
    ).trim();
  }

  getGardenGiftNumber(account: any): string {
    return String(
      account?.nomor_rekening ||
      account?.no_rekening ||
      account?.account_number ||
      account?.number ||
      ''
    ).trim();
  }

  getGardenGiftOwner(account: any): string {
    return String(
      account?.nama_pemilik ||
      account?.account_name ||
      account?.pemilik ||
      account?.atas_nama ||
      account?.owner ||
      ''
    ).trim();
  }

  copyGardenGiftNumber(account: any): void {
    const value = this.getGardenGiftNumber(account);
    if (!value) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  getGardenMapLink(event?: any): string {
    const rawLink = String(
      event?.link_maps ||
      event?.link_map ||
      event?.maps ||
      event?.google_maps ||
      event?.map_url ||
      ''
    ).trim();

    if (rawLink) {
      return rawLink;
    }

    const address = this.getGardenEventAddress(event);
    if (!address) return '';

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  getGardenEventAddress(event?: any): string {
    return String(
      event?.alamat ||
      event?.address ||
      event?.lokasi ||
      event?.location ||
      event?.venue ||
      ''
    ).trim();
  }

  getGardenMapEmbedUrl(event?: any): string {
    const rawLink = String(
      event?.link_maps ||
      event?.link_map ||
      event?.maps ||
      event?.google_maps ||
      event?.map_url ||
      ''
    ).trim();

    const venue = String(
      event?.nama_acara ||
      event?.venue ||
      event?.nama_tempat ||
      event?.tempat ||
      event?.lokasi ||
      ''
    ).trim();

    const address = this.getGardenEventAddress(event);
    const query = [venue, address].filter(Boolean).join(', ').trim();
    const previewQuery = query || rawLink;

    if (!previewQuery) {
      return '';
    }

    return `https://www.google.com/maps?q=${encodeURIComponent(previewQuery)}&output=embed`;
  }

  getGardenDateLabel(): string {
    const event = this.getGardenMainEvent();
    const rawDate =
      event?.tanggal_acara ||
      event?.tanggal ||
      event?.date ||
      event?.event_date ||
      (this.weddingData as any)?.tanggal_acara ||
      (this.weddingData as any)?.tanggal ||
      '';

    return this.formatGardenDate(rawDate);
  }

  formatGardenDate(rawDate: any): string {
    if (!rawDate) return '';

    const value = String(rawDate).trim();
    if (!value) return '';

    const datePart = value.split('T')[0];

    const ymd = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return `${ymd[3]} . ${ymd[2]} . ${ymd[1]}`;

    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const day = String(parsed.getDate()).padStart(2, '0');
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const year = parsed.getFullYear();
      return `${day} . ${month} . ${year}`;
    }

    return value;
  }

  getMomentGalleryItems(): DiamondGardenGalleryItem[] {
    const items = this.getSafeGalleryPhotos()
      .slice(0, 4)
      .map((item, index) => ({
        photoUrl: this.getGalleryPhotoUrl(item),
        alt: this.getGalleryAlt(item, index),
      }))
      .filter((item) => !!item.photoUrl);

    if (items.length) {
      return items;
    }

    return [
      { photoUrl: this.getGardenCoverPhotoUrl(), alt: `${this.getPrimaryDisplayName()} & ${this.getSecondaryDisplayName()}` },
      { photoUrl: this.getBridePortrait(), alt: this.getBrideFullName() },
      { photoUrl: this.getGroomPortrait(), alt: this.getGroomFullName() },
      { photoUrl: this.getGardenCoverPhotoUrl(), alt: 'Momen bahagia mempelai' },
    ];
  }

  getEventDay(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date ? String(date.getDate()).padStart(2, '0') : '--';
  }

  getEventMonthName(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date
      ? date.toLocaleDateString('id-ID', { month: 'long' })
      : 'Bulan';
  }

  getEventYear(event: WeddingEvent): string {
    const date = this.toValidDate(event?.tanggal_acara);
    return date ? String(date.getFullYear()) : '----';
  }

  getWishBadgeClass(kehadiran: string): string {
    switch (kehadiran) {
      case 'hadir':
        return 'diamond-garden-wish__badge--hadir';
      case 'mungkin':
        return 'diamond-garden-wish__badge--mungkin';
      default:
        return 'diamond-garden-wish__badge--tidak';
    }
  }

  override getGiftAddress(bank?: any): string {
    return bank?.nama_pemilik ? `a/n ${bank.nama_pemilik}` : 'Atas nama mempelai';
  }

  getMapPreviewCaption(event: WeddingEvent): string {
    return this.getEventAddress(event);
  }

  getGardenStories(): Array<{ year: string; title: string; description: string }> {
    const data: any = this.weddingData || {};
    const invitationPackage: any = data.invitation_package || {};

    const source =
      data.stories ||
      data.love_stories ||
      data.cerita ||
      data.cerita_perjalanan ||
      invitationPackage.stories ||
      [];

    if (Array.isArray(source) && source.length) {
      return source
        .map((item: any) => ({
          year: String(item?.year || item?.tahun || item?.date || item?.tanggal || '').trim(),
          title: String(item?.title || item?.judul || item?.nama_cerita || '').trim(),
          description: String(item?.description || item?.deskripsi || item?.cerita || item?.isi || '').trim(),
        }))
        .filter((item: any) => item.title || item.description);
    }

    return [
      {
        year: '2019',
        title: 'Pertama Bertemu',
        description: 'Dipertemukan di sebuah acara, percakapan singkat berubah menjadi awal dari segalanya.',
      },
      {
        year: '2022',
        title: 'Menjalin Hubungan',
        description: 'Setiap hari menjadi lebih berwarna. Kami belajar tumbuh dan saling melengkapi.',
      },
      {
        year: '2025',
        title: 'Lamaran',
        description: 'Di bawah langit senja, sebuah janji diucapkan untuk melangkah ke jenjang yang lebih serius.',
      },
      {
        year: '2026',
        title: 'Hari Bahagia',
        description: 'Dengan restu keluarga, kami siap memulai babak baru sebagai sepasang suami istri.',
      },
    ];
  }

  trackByGardenStory(index: number, item: any): string {
    return `${item?.year || index}-${item?.title || index}`;
  }

  getGardenHeroDateLabel(): string {
    return this.getGardenDateLabel();
  }

  getGardenFooterPhotoUrl(): string {
    const data: any = this.weddingData || {};
    const invitationPackage: any = data.invitation_package || {};

    const galleries =
      data.gallery ||
      data.galleries ||
      data.photos ||
      [];

    if (Array.isArray(galleries) && galleries.length) {
      const selected =
        galleries.find((item: any) => item?.photo_url || item?.photo || item?.image_url) ||
        galleries[0];

      const raw =
        selected?.photo_url ||
        selected?.photo ||
        selected?.image_url ||
        selected?.url ||
        '';

      if (raw) {
        return this.normalizeGardenPhotoUrl(raw);
      }
    }

    const cover =
      data.cover_url ||
      data.cover ||
      data.photo_cover ||
      invitationPackage.cover ||
      '';

    if (cover) {
      return this.normalizeGardenPhotoUrl(cover);
    }

    const groomPhoto = this.getGroomPhotoUrl();
    if (groomPhoto) return groomPhoto;

    const bridePhoto = this.getBridePhotoUrl();
    if (bridePhoto) return bridePhoto;

    return 'assets/thema-2/bg-wd.jpeg';
  }
}
