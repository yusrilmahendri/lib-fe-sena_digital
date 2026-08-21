import { Component, HostBinding, OnInit, AfterViewInit, ElementRef, Renderer2, OnDestroy, Type } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { WeddingDataService, WeddingData, SelectedThemeSummary, GuestWish } from '../../services/wedding-data.service';
import { MusicTrack, resolveInvitationMusicSourceType, resolveInvitationMusicUrl } from '../../shared/invitation-music.model';
import { normalizeInvitationMediaUrl } from '../../shared/user-photo.model';
import { getReligionContentFromData } from '../../shared/religion-content.util';
import {
  formatGuestNameFromQuery,
  resolveGuestName,
} from '../../shared/wedding-theme-data.util';
import { QRCodeModalComponent } from '../../shared/modal/qr-code-modal/qr-code-modal.component';
import { LavenderBloomThemeComponent } from './themes/lavender-bloom/lavender-bloom-theme.component';
import { RubyThemeOneComponent } from './templates/ruby-theme-one/ruby-theme-one.component';
import { RubyThemeTwoComponent } from './templates/ruby-theme-two/ruby-theme-two.component';
import { SapphireThemeOneComponent } from './templates/sapphire-theme-one/sapphire-theme-one.component';
import { DiamondThemeOneComponent } from './templates/diamond-theme-one/diamond-theme-one.component';
import { DiamondThemeTwoComponent } from './templates/diamond-theme-two/diamond-theme-two.component';
import {
  DEFAULT_THEME_SLUG,
  resolveThemeRenderKey,
  resolveThemeSlug,
  resolveThemeSlugFromCandidates,
  ThemeRenderKey,
  ThemeSlug,
} from '../../theme-render.registry';
import { environment } from '../../../environments/environment';

// Attendance interface for type safety
interface AttendanceRequest {
  user_id: number;
  domain: string;
  nama: string;
  kehadiran: 'hadir' | 'tidak_hadir' | 'mungkin';
  pesan: string;
}

interface AttendanceResponse {
  message: string;
  data?: {
    id: number;
    user_id: number;
    nama: string;
    kehadiran: string;
    pesan: string;
    created_at: string;
  };
  errors?: any;
  error?: string;
}

// Settings response interface for domain extraction
interface SettingsResponse {
  message: string;
  setting: {
    id: number;
    user_id: number;
    domain: string;
    token: string | null;
    musik: string;
    salam_pembuka: string;
    salam_atas: string;
    salam_bawah: string;
    resolved_music_url?: string | null;
    custom_music_url?: string | null;
    selected_music?: MusicTrack | null;
    default_music?: MusicTrack | null;
    can_upload_custom_music?: boolean;
    music_stream_url?: string | null;
    created_at: string;
    updated_at: string;
  };
  filter_undangan: any;
}

declare var bootstrap: any;
enum ContentView {
  MAIN = 'main',
  COUPLE = 'couple',
  MESSAGE = 'message',
  CALENDAR = 'calendar',
  BIRTHDAY = 'birthday',
  CHAT = 'chat',
  GALLERY = 'gallery',
  PROFILE = 'profile',
  GIFT = 'gift'
}

@Component({
  selector: 'wc-wedding-view',
  templateUrl: './wedding-view.component.html',
  styleUrls: ['./wedding-view.component.scss']
})
export class WeddingViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly STORAGE_VERSION = '2026-06-28-ruby-theme-refresh';
  private readonly themeComponentRegistry: Record<ThemeRenderKey, Type<unknown>> = {
    'ruby-theme-one': RubyThemeOneComponent,
    'ruby-theme-two': RubyThemeTwoComponent,
    'sapphire-theme-one': SapphireThemeOneComponent,
    'diamond-theme-one': DiamondThemeOneComponent,
    'diamond-theme-two': DiamondThemeTwoComponent,
    'lavender-bloom': LavenderBloomThemeComponent,
  };

  ContentView = ContentView;

  isPlaying: boolean = false;
  isMuted: boolean = false;
  sideIconsVisible: boolean = false;
  invitationOpened: boolean = false;

  /** Once the guest opens the invitation it must stay open for the whole session,
      even if the view re-initialises or the theme child is recreated. */
  private invitationOpenedSticky = false;

  currentView: ContentView = ContentView.MAIN;

  // Wedding data properties
  weddingData: WeddingData | null = null;
  guestName = 'Tamu Undangan';
  activeThemeSlug: ThemeSlug | null = null;
  activeThemeRenderKey: ThemeRenderKey = 'ruby-theme-one';

  @HostBinding('class.no-outer-bg') get isNeutralBackgroundTheme(): boolean {
    return this.activeThemeRenderKey === 'ruby-theme-two'
      || this.activeThemeRenderKey === 'sapphire-theme-one'
      || this.activeThemeRenderKey === 'diamond-theme-one'
      || this.activeThemeRenderKey === 'diamond-theme-two';
  }

  @HostBinding('class.theme-full-frame') get isFullFrameTheme(): boolean {
    return this.activeThemeRenderKey === 'ruby-theme-one'
      || this.activeThemeRenderKey === 'ruby-theme-two'
      || this.activeThemeRenderKey === 'sapphire-theme-one'
      || this.activeThemeRenderKey === 'diamond-theme-one'
      || this.activeThemeRenderKey === 'diamond-theme-two';
  }
  activeThemeComponent: Type<unknown> | null = null;
  domain: string | null = null; // Changed from coupleName to domain
  guestCode: string | null = null;
  guestToken: string | null = null;
  guestSlug: string | null = null;
  isLoading: boolean = false;
  errorMessage: string | null = null;

  // Audio management properties
  private audioElement: HTMLAudioElement | null = null;
  private audioInitialized: boolean = false;
  private currentMusicUrl: string | null = null;
  isAudioLoading: boolean = false;
  audioError: string | null = null;
  currentVolume: number = 0.7; // Default volume (70%)

  // Subscriptions
  private subscriptions = new Subscription();

  // QR Code Modal
  private qrModalRef?: BsModalRef;

  // LocalStorage keys - Updated to use domain instead of couple name
  private readonly STORAGE_KEYS = {
    CACHE_VERSION: 'wedding_cache_version',
    CURRENT_VIEW: 'wedding_current_view',
    INVITATION_OPENED: 'wedding_invitation_opened',
    SIDE_ICONS_VISIBLE: 'wedding_side_icons_visible',
    IS_PLAYING: 'wedding_is_playing',
    IS_MUTED: 'wedding_is_muted',
    WEDDING_DATA: 'wedding_data',
    DOMAIN: 'wedding_domain', // Changed from couple_name to domain
    AUDIO_VOLUME: 'wedding_audio_volume'
  };

  constructor(
    private elementRef: ElementRef,
    private renderer: Renderer2,
    private route: ActivatedRoute,
    private router: Router,
    private dashboardService: DashboardService,
    private weddingDataService: WeddingDataService,
    private modalService: BsModalService
  ) { }

  ngOnInit() {
    this.injectRippleStyles();
    this.loadStateFromLocalStorage();
    this.listenForGuestName();
    this.initializeWeddingData();
  }

  private listenForGuestName(): void {
    const querySubscription = this.route.queryParams.subscribe(params => {
      const previousGuestCode = this.guestCode;
      this.guestToken = this.sanitizeRouteValue(params['guest'] || params['guest_token']);
      this.guestSlug = this.sanitizeRouteValue(params['to']);
      this.guestCode = this.guestToken || this.guestSlug;
      this.guestName = formatGuestNameFromQuery(this.guestSlug) || 'Tamu Undangan';

      if (this.weddingData && this.domain && previousGuestCode !== this.guestCode) {
        this.loadWeddingDataFromAPI(this.domain, false, true);
        return;
      }

      if (this.weddingData) {
        this.weddingData = this.applyGuestNameToWeddingData(this.weddingData);
        this.weddingDataService.setWeddingData(this.weddingData);
      }
    });

    this.subscriptions.add(querySubscription);
  }

  ngAfterViewInit() {
    this.initializeBootstrapTooltips();
    this.addClickFunctionality();
    this.addTouchSupport();
    this.addSideIconClickFunctionality();
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    // Save current state before component destruction
    this.saveStateToLocalStorage();
    // Cleanup audio resources
    this.cleanupAudio();
    // Clean up QR modal subscription
    if (this.qrModalRef) {
      this.qrModalRef.hide();
    }
  }

  /**
   * Load component state from localStorage
   */
  private loadStateFromLocalStorage(): void {
    try {
      const savedVersion = localStorage.getItem(this.STORAGE_KEYS.CACHE_VERSION);
      if (savedVersion !== this.STORAGE_VERSION) {
        console.log('localStorage version mismatch, clearing stale cache:', {
          savedVersion,
          expectedVersion: this.STORAGE_VERSION,
        });
        this.clearLocalStorage();
        localStorage.setItem(this.STORAGE_KEYS.CACHE_VERSION, this.STORAGE_VERSION);
        return;
      }

      // Validate localStorage data first
      if (!this.validateLocalStorageData()) {
        console.log('localStorage data invalid, clearing...');
        this.clearLocalStorage();
        localStorage.setItem(this.STORAGE_KEYS.CACHE_VERSION, this.STORAGE_VERSION);
        return;
      }

      // Load basic state
      const savedCurrentView = localStorage.getItem(this.STORAGE_KEYS.CURRENT_VIEW) as ContentView;
      const savedSideIconsVisible = localStorage.getItem(this.STORAGE_KEYS.SIDE_ICONS_VISIBLE);
      const savedIsMuted = localStorage.getItem(this.STORAGE_KEYS.IS_MUTED);
      const savedDomain = localStorage.getItem(this.STORAGE_KEYS.DOMAIN);
      const savedWeddingData = localStorage.getItem(this.STORAGE_KEYS.WEDDING_DATA);

      // Restore state if exists
      if (savedCurrentView && Object.values(ContentView).includes(savedCurrentView)) {
        this.currentView = savedCurrentView;
        console.log('Restored current view from localStorage:', savedCurrentView);
      }

      this.invitationOpened = this.invitationOpenedSticky;
      this.currentView = ContentView.MAIN;
      localStorage.removeItem(this.STORAGE_KEYS.INVITATION_OPENED);
      localStorage.removeItem(this.STORAGE_KEYS.IS_PLAYING);

      if (savedSideIconsVisible !== null) {
        this.sideIconsVisible = savedSideIconsVisible === 'true';
      }

      this.isPlaying = false;

      if (savedIsMuted !== null) {
        this.isMuted = savedIsMuted === 'true';
      }

      // Load saved volume
      const savedVolume = localStorage.getItem(this.STORAGE_KEYS.AUDIO_VOLUME);
      if (savedVolume !== null) {
        this.currentVolume = parseFloat(savedVolume);
      }

      if (savedDomain) {
        this.domain = savedDomain;
        console.log('Restored domain from localStorage:', savedDomain);
      }

      // Keep wedding data in storage for debugging/fallback, but public
      // invitations should wait for a fresh API response before rendering.
      if (savedWeddingData) {
        try {
          JSON.parse(savedWeddingData);
          console.log('Found cached wedding data in localStorage; waiting for fresh API response before rendering');
        } catch (parseError) {
          console.error('Failed to parse saved wedding data:', parseError);
          localStorage.removeItem(this.STORAGE_KEYS.WEDDING_DATA);
        }
      }

    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
      this.clearLocalStorage();
      localStorage.setItem(this.STORAGE_KEYS.CACHE_VERSION, this.STORAGE_VERSION);
    }
  }

  /**
   * Save component state to localStorage
   */
  private saveStateToLocalStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEYS.CACHE_VERSION, this.STORAGE_VERSION);
      localStorage.setItem(this.STORAGE_KEYS.CURRENT_VIEW, this.currentView);
      localStorage.setItem(this.STORAGE_KEYS.INVITATION_OPENED, this.invitationOpened.toString());
      localStorage.setItem(this.STORAGE_KEYS.SIDE_ICONS_VISIBLE, this.sideIconsVisible.toString());
      localStorage.setItem(this.STORAGE_KEYS.IS_PLAYING, this.isPlaying.toString());
      localStorage.setItem(this.STORAGE_KEYS.IS_MUTED, this.isMuted.toString());
      localStorage.setItem(this.STORAGE_KEYS.AUDIO_VOLUME, this.currentVolume.toString());

      if (this.domain) {
        localStorage.setItem(this.STORAGE_KEYS.DOMAIN, this.domain);
      }

      if (this.weddingData) {
        localStorage.setItem(this.STORAGE_KEYS.WEDDING_DATA, JSON.stringify(this.weddingData));
      }

      console.log('State saved to localStorage');
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
    }
  }

  /**
   * Clear localStorage data (useful for testing or logout)
   */
  private clearLocalStorage(): void {
    Object.values(this.STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('localStorage cleared');
  }

  /**
   * Check if wedding data exists in localStorage
   */
  private hasLocalStorageData(): boolean {
    return localStorage.getItem(this.STORAGE_KEYS.WEDDING_DATA) !== null;
  }

  /**
   * Validate localStorage data integrity
   */
  private validateLocalStorageData(): boolean {
    try {
      const savedVersion = localStorage.getItem(this.STORAGE_KEYS.CACHE_VERSION);
      const savedWeddingData = localStorage.getItem(this.STORAGE_KEYS.WEDDING_DATA);
      const savedDomain = localStorage.getItem(this.STORAGE_KEYS.DOMAIN);

      if (savedVersion !== this.STORAGE_VERSION) {
        return false;
      }

      if (!savedWeddingData || !savedDomain) {
        return false;
      }

      const parsedData = JSON.parse(savedWeddingData);
      return !!(parsedData && parsedData.user_info && parsedData.mempelai);
    } catch (error) {
      console.error('localStorage validation failed:', error);
      return false;
    }
  }

  /**
   * Debug method to export localStorage data (development only)
   */
  public exportLocalStorageData(): any {
    const data: any = {};
    Object.entries(this.STORAGE_KEYS).forEach(([key, storageKey]) => {
      const value = localStorage.getItem(storageKey);
      data[key] = value;
    });
    console.log('LocalStorage Data Export:', data);
    return data;
  }

  /**
   * Initialize wedding data using domain-based approach
   * New implementation: Always gets domain first from SETTINGS_GET_FILTER or route params
   */
  private initializeWeddingData(): void {
    console.log('Initializing wedding data with domain-based approach');

    // Get route params first (check if domain is passed via route)
    const routeSubscription = this.route.params.subscribe(params => {
      const routeDomain = this.sanitizeRouteValue(params['coupleName'] || params['domain']); // Support both old and new param names
      this.guestToken = this.sanitizeRouteValue(
        this.route.snapshot.queryParamMap.get('guest') ||
        this.route.snapshot.queryParamMap.get('guest_token')
      );
      this.guestSlug = this.sanitizeRouteValue(this.route.snapshot.queryParamMap.get('to'));
      this.guestCode = this.guestToken || this.guestSlug;

      console.log('Route params:', {
        coupleName: params['coupleName'],
        domain: params['domain'],
        routeDomain,
        guestToken: this.guestToken,
        guestSlug: this.guestSlug,
        guestCode: this.guestCode
      });

      // Priority: route domain > localStorage domain > get from settings
      if (routeDomain) {
        this.domain = routeDomain;
        console.log('Using domain from route params:', routeDomain);
        this.weddingData = null;
        this.loadWeddingDataFromAPI(this.domain!, false, true);
      } else if (this.domain) {
        console.log('Using domain from localStorage:', this.domain);
        this.weddingData = null;
        this.loadWeddingDataFromAPI(this.domain!, false, true);
      } else {
        // No domain available, get it from settings
        console.log('No domain available, fetching from SETTINGS_GET_FILTER');
        this.loadDomainFromSettings();
      }
    });

    this.subscriptions.add(routeSubscription);
  }

  /**
   * Load domain from SETTINGS_GET_FILTER API
   * New method to get domain when not available from route or localStorage
   */
  private loadDomainFromSettings(): void {
    this.isLoading = true;
    this.errorMessage = null;

    console.log('Fetching domain from SETTINGS_GET_FILTER API');

    const settingsSubscription = this.dashboardService.list(DashboardServiceType.SETTINGS_GET_FILTER).subscribe({
      next: (response: SettingsResponse) => {
        console.log('SETTINGS_GET_FILTER response:', response);

        try {
          const domain = response?.setting?.domain;

          if (!domain) {
            console.warn('Domain not found in settings response:', response);
            this.handleDataNotFound('Domain not found in user settings');
            return;
          }

          console.log('Domain extracted from settings:', domain);
          this.domain = domain;

          // Now load wedding data using the domain
          this.loadWeddingDataFromAPI(domain);

        } catch (error) {
          console.error('Error processing domain from settings:', error);
          this.handleDataNotFound('Error processing domain from settings');
        }
      },
      error: (error) => {
        console.error('Error fetching settings for domain:', error);
        this.handleAPIError(error);
      }
    });

    this.subscriptions.add(settingsSubscription);
  }

  /**
   * Load wedding data from API using domain
   * Updated to use domain parameter instead of coupleName
   * @param domain - Domain for API call (e.g., 'domainkuasna')
   * @param isBackgroundUpdate - Whether this is a background update (don't show loading)
   */
  private loadWeddingDataFromAPI(
    domain: string,
    isBackgroundUpdate: boolean = false,
    includeGuestCode: boolean = true,
    useLegacyEndpoint: boolean = false
  ): void {
    const cleanDomain = this.sanitizeRouteValue(domain);
    const cleanGuestToken = includeGuestCode ? this.sanitizeRouteValue(this.guestToken) : null;
    const cleanGuestSlug = includeGuestCode ? this.sanitizeRouteValue(this.guestSlug) : null;
    const cleanGuestCode = cleanGuestToken || cleanGuestSlug;

    if (!cleanDomain) {
      this.handleDataNotFound('Domain undangan tidak valid');
      return;
    }

    if (!isBackgroundUpdate) {
      this.isLoading = true;
      this.errorMessage = null;
    }

    const apiPath = `/${encodeURIComponent(cleanDomain)}`;
    const queryParams = this.buildPublicWeddingQueryParams(cleanGuestToken, cleanGuestSlug);
    const endpointType = useLegacyEndpoint
      ? DashboardServiceType.WEDDING_VIEW_COUPLE
      : DashboardServiceType.WEDDING_PUBLIC_BY_DOMAIN;
    const apiUrl = `${this.dashboardService.getUrl(endpointType)}${apiPath}${queryParams ? `?${new URLSearchParams(queryParams as Record<string, string>).toString()}` : ''}`;

    console.log('Loading fresh wedding data from API for domain:', cleanDomain, isBackgroundUpdate ? '(background)' : '');
    console.log('[PUBLIC_WEDDING]', { domain: cleanDomain, guestCode: cleanGuestCode, apiUrl });

    const apiSubscription = this.dashboardService.getParam(endpointType, apiPath, queryParams).subscribe({
      next: (response) => {
        console.log('API Response:', response);
        console.log('API Response (formatted):', JSON.stringify(response, null, 2));

        const weddingPayload = this.resolveWeddingDataPayload(response);

        if (weddingPayload) {
          const raw = weddingPayload as any;
          console.log('[WeddingPublicResponse]', raw);
          console.log('[WeddingView] API raw response.data keys:', Object.keys(raw));
          console.log('[WeddingView] selected_theme from API:', raw.selected_theme ?? 'TIDAK ADA');
          console.log('[WeddingView] themes.selected_theme from API:', raw.themes?.selected_theme ?? 'TIDAK ADA');
          console.log('[WeddingView] jenis_thema from API:', raw.jenis_thema ?? 'TIDAK ADA');
          console.log('[WeddingView] theme_slug from API:', raw.theme_slug ?? 'TIDAK ADA');
          console.log('[WeddingView] selected_theme_slug from API:', raw.selected_theme_slug ?? 'TIDAK ADA');
          console.log('[WeddingViewMedia] raw response media:', {
            gallery: raw.gallery,
            galleries: raw.galleries,
            photos: raw.photos,
            metadata: raw.metadata,
          });

          this.domain = cleanDomain;
          this.weddingData = this.applyGuestNameToWeddingData(
            this.attachReligionContentToWeddingData(weddingPayload, response)
          );
          this.weddingDataService.setWeddingData(this.weddingData);

          this.updateWeddingContent(this.weddingData);

          // Save to localStorage after successful API call
          this.saveStateToLocalStorage();

          console.log('Fresh wedding data loaded successfully from API using domain:', cleanDomain);
        } else {
          if (!isBackgroundUpdate) {
            this.handleDataNotFound('No data returned from API');
          }
        }
      },
      error: (error) => {
        console.error('API Error:', error);
        console.error('API Error (formatted):', JSON.stringify(error, null, 2));
        console.error('[PUBLIC_WEDDING_ERROR]', error?.status, error?.error || error);

        if (!isBackgroundUpdate) {
          if (this.resolvePublicWeddingErrorCode(error) === 'PAYMENT_NOT_CONFIRMED') {
            this.errorMessage = 'Undangan belum aktif karena pembayaran belum dikonfirmasi.';
            this.isLoading = false;
            return;
          }

          if (cleanGuestCode && this.shouldRetryWithoutGuest(error)) {
            console.warn('Guest code failed to load, retrying public wedding without guest code:', cleanGuestCode);
            this.guestName = 'Tamu Undangan';
            this.loadWeddingDataFromAPI(cleanDomain, false, false, useLegacyEndpoint);
            return;
          }

          if (!useLegacyEndpoint && this.shouldRetryLegacyPublicEndpoint(error)) {
            console.warn('Public wedding endpoint failed, retrying legacy wedding-profile endpoint:', {
              domain: cleanDomain,
              status: error?.status,
            });
            this.loadWeddingDataFromAPI(cleanDomain, false, includeGuestCode, true);
            return;
          }

          // Enhanced error handling for domain-based requests
          if (error.status === 404) {
            this.handleDataNotFound('Undangan tidak ditemukan.');
          } else {
            this.handleAPIError(error);
          }
        }
      },
      complete: () => {
        if (!isBackgroundUpdate) {
          this.isLoading = false;
        }
      }
    });

    this.subscriptions.add(apiSubscription);
  }

  /**
   * Load wedding data from service (fallback)
   */
  private loadWeddingDataFromService(): void {
    const serviceSubscription = this.weddingDataService.getWeddingData().subscribe(data => {
      if (data) {
        this.weddingData = this.applyGuestNameToWeddingData(data);
        this.updateWeddingContent(this.weddingData);
        console.log('Wedding data loaded from service');
      } else {
        this.handleDataNotFound('No data available in service');
      }
    });

    this.subscriptions.add(serviceSubscription);
  }

  /**
   * Handle case when wedding data is not found
   * @param reason - Reason for data not being found
   */
  private handleDataNotFound(reason: string): void {
    this.errorMessage = reason === 'Undangan tidak ditemukan.'
      ? reason
      : `Wedding invitation not found. ${reason}`;
    this.isLoading = false;

    console.warn('Wedding data not found:', reason);

    // Clear localStorage if data is not found
    this.clearLocalStorage();

    // Optional: Redirect to home after 5 seconds
    setTimeout(() => {
      if (!this.weddingData) {
        console.log('Redirecting to home due to missing wedding data');
        this.router.navigate(['/']);
      }
    }, 5000);
  }

  private applyGuestNameToWeddingData(data: WeddingData): WeddingData {
    const guestName = this.resolveGuestNameFromWeddingData(data);
    this.guestName = guestName;
    const enriched = {
      ...(data as any),
      resolvedGuestName: guestName,
      guest_name: guestName,
      nama_tamu: guestName,
      guest: {
        ...((data as any)?.guest || {}),
        name: guestName,
        nama: guestName
      }
    } as WeddingData;

    return enriched;
  }

  private buildPublicWeddingQueryParams(guestToken?: string | null, guestSlug?: string | null): Record<string, string> | undefined {
    const params: Record<string, string> = {};
    const cleanGuestToken = this.sanitizeRouteValue(guestToken);
    const cleanGuestSlug = this.sanitizeRouteValue(guestSlug);

    if (cleanGuestToken) {
      params['guest'] = cleanGuestToken;
      params['guest_token'] = cleanGuestToken;
    }

    if (cleanGuestSlug) {
      params['to'] = cleanGuestSlug;
    }

    return Object.keys(params).length ? params : undefined;
  }

  private attachReligionContentToWeddingData(data: WeddingData, response?: any): WeddingData {
    const existingReligion =
      (data as any)?.religion_content ||
      (data as any)?.religionContent;
    const responseReligion = getReligionContentFromData(response);
    const religionContent = existingReligion || responseReligion;

    if (!religionContent || !Object.keys(religionContent).length) {
      return data;
    }

    return {
      ...(data as any),
      religion_content: religionContent,
      religionContent: religionContent,
    } as WeddingData;
  }

  getInvitationQrUrl(): string {
    const baseUrl = this.getWeddingUrl();
    const guestLabel = String(this.guestCode || '').trim();

    if (guestLabel) {
      return `${baseUrl}?to=${encodeURIComponent(guestLabel)}`;
    }

    return baseUrl;
  }


  private getPublicShareOrigin(): string {
    const origin = String(globalThis.location?.origin || '').replace(/\/$/, '');

    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return 'https://www.sena-digital.com';
    }

    return origin;
  }

  /**
   * Handle API errors
   * @param error - Error that occurred during API call
   */
  private handleAPIError(error: any): void {
    this.isLoading = false;

    let errorMsg = 'Unable to load wedding invitation.';

    if (this.resolvePublicWeddingErrorCode(error) === 'PAYMENT_NOT_CONFIRMED') {
      errorMsg = 'Undangan belum aktif karena pembayaran belum dikonfirmasi.';
    } else if (error.status === 401) {
      errorMsg = 'Authentication required to access this wedding invitation.';
    } else if (error.status === 404) {
      errorMsg = 'Undangan tidak ditemukan.';
    } else if (error.status === 500) {
      errorMsg = 'Server error occurred. Please try again later.';
    }

    this.errorMessage = errorMsg;
    console.error('API Error details:', error);
  }

  private resolveWeddingDataPayload(response: any): WeddingData | null {
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

    const payload = candidates.find((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return false;
      }

      return !!(
        candidate?.mempelai ||
        candidate?.settings ||
        candidate?.invitation_package ||
        candidate?.user_info ||
        candidate?.domain ||
        candidate?.slug
      );
    });

    return payload ? payload as WeddingData : null;
  }

  /**
   * Update wedding content based on received data
   * @param data - Wedding data from API
   */
  private updateWeddingContent(data: WeddingData): void {
    try {
      console.log('[WeddingView] updateWeddingContent called:', {
        groom: data.mempelai?.pria?.nama_lengkap || 'Unknown',
        bride: data.mempelai?.wanita?.nama_lengkap || 'Unknown',
        user: data.user_info?.email || 'Unknown',
        domain: this.domain,
        selected_theme: (data as any).selected_theme ?? null,
        theme_slug_field: (data as any).theme_slug ?? null,
        jenis_thema_field: (data as any).jenis_thema ?? null,
        tema_field: (data as any).tema ?? null,
        themes_field: (data as any).themes ?? null,
      });

      this.activeThemeSlug = this.getThemeSlugFromInvitation(data);
      this.activeThemeRenderKey = resolveThemeRenderKey(this.activeThemeSlug);
      this.activeThemeComponent = this.resolveThemeComponent(this.activeThemeSlug);

      if (
        (data as any)?.selected_theme?.slug === 'soft-ivory' ||
        (data as any)?.themes?.selected_theme?.slug === 'soft-ivory'
      ) {
        this.activeThemeSlug = 'soft-ivory';
        this.activeThemeRenderKey = 'ruby-theme-one';
        this.activeThemeComponent = this.resolveThemeComponent(this.activeThemeSlug);
      }

      console.log('[WeddingThemeDebug]', {
        selectedTheme: (data as any)?.selected_theme ?? null,
        themesSelectedTheme: (data as any)?.themes?.selected_theme ?? null,
        activeThemeSlug: this.activeThemeSlug,
        activeThemeRenderKey: this.activeThemeRenderKey
      });

      console.log('[WeddingView] Theme resolved:', {
        activeThemeSlug: this.activeThemeSlug,
        activeThemeRenderKey: this.activeThemeRenderKey,
        hasActiveThemeComponent: !!this.activeThemeComponent,
      });

      // Initialize audio when wedding data is updated
      this.initializeAudio();

      // Here you would update component properties based on wedding data
      // Example implementation for when you add UI binding:
      // this.groomName = data.mempelai.pria.nama_lengkap;
      // this.brideName = data.mempelai.wanita.nama_lengkap;
      // this.coverPhoto = data.mempelai.cover_photo;
      // this.weddingDate = data.acara?.tanggal;
      // etc.

    } catch (error) {
      console.error('Error updating wedding content:', error);
      this.errorMessage = 'Error displaying wedding content';
    }
  }

  /**
   * Retry loading wedding data - always fetch fresh from API
   */
  retryLoadData(): void {
    this.errorMessage = null;

    if (this.domain) {
      this.loadWeddingDataFromAPI(this.domain, false, true);
    } else {
      // Try to get domain from settings first
      this.loadDomainFromSettings();
    }
  }

  /**
   * Refresh wedding data - fetch fresh data from API
   */
  refreshWeddingData(): void {
    if (this.domain) {
      console.log('Refreshing wedding data for domain:', this.domain);
      this.loadWeddingDataFromAPI(this.domain, false, true);
    } else {
      console.log('No domain available, fetching from settings');
      this.loadDomainFromSettings();
    }
  }

  /**
   * Check if wedding data is available
   * @returns boolean - Whether wedding data is loaded
   */
  hasWeddingData(): boolean {
    return this.weddingData !== null;
  }

  /**
   * Get couple display name for UI
   * @returns string - Formatted couple name for display
   */
  getCoupleDisplayName(): string {
    if (!this.weddingData?.mempelai) {
      return this.domain?.replace('-', ' & ') || 'Wedding Invitation';
    }

    const groom = this.weddingData.mempelai.pria?.nama_panggilan ||
      this.weddingData.mempelai.pria?.nama_lengkap || 'Groom';
    const bride = this.weddingData.mempelai.wanita?.nama_panggilan ||
      this.weddingData.mempelai.wanita?.nama_lengkap || 'Bride';

    return `${groom} & ${bride}`;
  }

  /**
   * Get wedding URL for sharing using domain
   * @returns string - Wedding URL with domain
   */
  getWeddingUrl(): string {
    const baseUrl = globalThis.location?.origin || '';
    return this.domain ? `${baseUrl}/wedding/${this.domain}` : `${baseUrl}/wedding`;
  }

  /**
   * Get cover photo URL
   * @returns string - Cover photo URL or default
   */
  getCoverPhotoUrl(): string {
    return this.normalizeMediaUrl(
      (this.weddingData as any)?.cover_photo_url ||
      (this.weddingData as any)?.mempelai?.cover_photo_url ||
      this.weddingData?.mempelai?.cover_photo ||
      (this.weddingData as any)?.cover_photo
    ) || 'assets/default-cover.jpg';
  }

  /**
   * Get groom photo URL
   * @returns string - Groom photo URL or default
   */
  getGroomPhotoUrl(): string {
    return this.normalizeMediaUrl(
      (this.weddingData as any)?.photo_pria_url ||
      (this.weddingData as any)?.mempelai?.photo_pria_url ||
      (this.weddingData as any)?.mempelai?.pria?.photo_url ||
      (this.weddingData as any)?.mempelai?.pria?.image_url ||
      (this.weddingData as any)?.mempelai?.pria?.preview_url ||
      (this.weddingData as any)?.photo_pria ||
      (this.weddingData as any)?.mempelai?.photo_pria ||
      this.weddingData?.mempelai?.pria?.photo
    ) || 'assets/default-groom.jpg';
  }

  /**
   * Get bride photo URL
   * @returns string - Bride photo URL or default
   */
  getBridePhotoUrl(): string {
    return this.normalizeMediaUrl(
      (this.weddingData as any)?.photo_wanita_url ||
      (this.weddingData as any)?.mempelai?.photo_wanita_url ||
      (this.weddingData as any)?.mempelai?.wanita?.photo_url ||
      (this.weddingData as any)?.mempelai?.wanita?.image_url ||
      (this.weddingData as any)?.mempelai?.wanita?.preview_url ||
      (this.weddingData as any)?.photo_wanita ||
      (this.weddingData as any)?.mempelai?.photo_wanita ||
      this.weddingData?.mempelai?.wanita?.photo
    ) || 'assets/default-bride.jpg';
  }

  private getApiOrigin(): string {
    const env = environment as any;
    const apiUrl =
      env.apiUrl ||
      env.baseUrl ||
      'https://cloud-api.sena-digital.com';

    return String(apiUrl)
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');
  }

  normalizeMediaUrl(value: any): string {
    return normalizeInvitationMediaUrl(value);
  }

  private sanitizeRouteValue(value: any): string | null {
    const normalized = String(value ?? '').trim();
    if (!normalized || normalized === 'undefined' || normalized === 'null') {
      return null;
    }

    return normalized;
  }

  private shouldRetryWithoutGuest(error: any): boolean {
    return !!error;
  }

  private shouldRetryLegacyPublicEndpoint(error: any): boolean {
    return [0, 404, 405].includes(Number(error?.status));
  }

  private resolvePublicWeddingErrorCode(error: any): string {
    return String(
      error?.error?.code ||
      error?.error?.error_code ||
      error?.error?.status_code ||
      error?.error?.type ||
      ''
    ).trim().toUpperCase();
  }

  private resolveGuestNameFromWeddingData(data: any): string {
    return resolveGuestName(data, formatGuestNameFromQuery(this.guestSlug));
  }

  /**
   * Initialize audio system with wedding music settings
   * Sets up HTML5 Audio element with proper event listeners
   */
  private initializeAudio(): void {
    if (!this.weddingData?.settings) {
      console.warn('No wedding settings available for audio initialization');
      return;
    }

    const musicUrl = resolveInvitationMusicUrl(this.weddingData);
    const sourceType = resolveInvitationMusicSourceType(this.weddingData);

    console.log('[Invitation Music] raw info', this.weddingData?.settings?.music_info || (this.weddingData as any)?.music_info);
    console.log('[Invitation Music] resolved URL', musicUrl);

    if (!musicUrl) {
      console.warn('[InvitationAudio] No valid music URL available in wedding settings', {
        sourceType,
        settings: this.weddingData?.settings,
      });
      return;
    }

    if (this.audioInitialized && this.audioElement && this.currentMusicUrl === musicUrl) {
      this.audioElement.volume = this.currentVolume;
      this.audioElement.muted = this.isMuted;
      console.log('[InvitationAudio] Audio already initialized with current URL', {
        musicUrl,
        sourceType,
      });
      return;
    }

    if (this.audioElement) {
      this.cleanupAudio();
    }

    try {
      console.log('[InvitationAudio] Initializing audio', {
        resolvedMusicUrl: musicUrl,
        sourceType,
      });
      this.isAudioLoading = true;
      this.audioError = null;

      // Create new audio element
      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';
      this.audioElement.loop = true; // Loop the wedding music
      this.audioElement.volume = this.currentVolume;
      this.audioElement.muted = this.isMuted;
      this.audioElement.crossOrigin = 'anonymous'; // Handle CORS if needed

      // Set the audio source
      this.audioElement.src = musicUrl;
      this.currentMusicUrl = musicUrl;

      // Add event listeners for audio management
      this.setupAudioEventListeners();

      // Mark as initialized
      this.audioInitialized = true;

      this.audioElement.load();
      console.log('[Invitation Music] audio src', this.audioElement.src);
      console.log('[Invitation Music] paused', this.audioElement.paused);
      console.log('[InvitationAudio] Audio system initialized successfully');

    } catch (error) {
      console.error('[InvitationAudio] Error initializing audio:', error);
      this.audioError = 'Failed to initialize audio system';
      this.isAudioLoading = false;
    }
  }

  /**
   * Setup event listeners for audio element
   * Manages audio state and error handling
   */
  private setupAudioEventListeners(): void {
    if (!this.audioElement) return;

    // Audio loaded and ready to play
    this.audioElement.addEventListener('canplay', () => {
      console.log('[InvitationAudio] canplay', {
        src: this.audioElement?.currentSrc || this.audioElement?.src,
        readyState: this.audioElement?.readyState,
      });
      this.isAudioLoading = false;
      this.audioError = null;
    });

    // Audio is playing
    this.audioElement.addEventListener('play', () => {
      console.log('[InvitationAudio] play event');
      this.isPlaying = true;
      this.saveStateToLocalStorage();
    });

    // Audio is paused
    this.audioElement.addEventListener('pause', () => {
      console.log('[InvitationAudio] pause event');
      this.isPlaying = false;
      this.saveStateToLocalStorage();
    });

    // Audio loading started
    this.audioElement.addEventListener('loadstart', () => {
      console.log('[InvitationAudio] loadstart', {
        src: this.audioElement?.src,
      });
      this.isAudioLoading = true;
    });

    // Audio metadata loaded
    this.audioElement.addEventListener('loadedmetadata', () => {
      console.log('[InvitationAudio] loadedmetadata', {
        duration: this.audioElement?.duration,
        src: this.audioElement?.currentSrc || this.audioElement?.src,
      });
    });

    // Audio loading error
    this.audioElement.addEventListener('error', (event) => {
      const error = this.audioElement?.error;
      console.error('[InvitationAudio] error event', {
        error,
        src: this.audioElement?.currentSrc || this.audioElement?.src,
        networkState: this.audioElement?.networkState,
        readyState: this.audioElement?.readyState,
      });

      let errorMessage = 'Audio loading failed';
      if (error) {
        switch (error.code) {
          case error.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio loading was aborted';
            break;
          case error.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading audio';
            break;
          case error.MEDIA_ERR_DECODE:
            errorMessage = 'Audio decoding error';
            break;
          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Audio format not supported';
            break;
        }
      }

      this.audioError = errorMessage;
      this.isAudioLoading = false;
      this.isPlaying = false;
    });

    // Audio volume changed
    this.audioElement.addEventListener('volumechange', () => {
      if (this.audioElement) {
        this.currentVolume = this.audioElement.volume;
        this.isMuted = this.audioElement.muted;
        this.saveStateToLocalStorage();
      }
    });

    // Audio ended (shouldn't happen with loop=true)
    this.audioElement.addEventListener('ended', () => {
      console.log('[InvitationAudio] ended');
      this.isPlaying = false;
      this.saveStateToLocalStorage();
    });

    // Audio stalled
    this.audioElement.addEventListener('stalled', () => {
      console.warn('[InvitationAudio] stalled');
    });

    // Audio waiting for data
    this.audioElement.addEventListener('waiting', () => {
      console.log('[InvitationAudio] waiting');
      this.isAudioLoading = true;
    });

    // Audio can play through
    this.audioElement.addEventListener('canplaythrough', () => {
      console.log('[InvitationAudio] canplaythrough');
      this.isAudioLoading = false;
    });
  }

  /**
   * Cleanup audio resources
   * Called in ngOnDestroy
   */
  private cleanupAudio(): void {
    if (this.audioElement) {
      console.log('Cleaning up audio resources');

      // Pause and reset
      this.audioElement.pause();
      this.audioElement.currentTime = 0;

      // Remove event listeners
      this.audioElement.removeEventListener('canplay', () => {});
      this.audioElement.removeEventListener('play', () => {});
      this.audioElement.removeEventListener('pause', () => {});
      this.audioElement.removeEventListener('error', () => {});
      this.audioElement.removeEventListener('volumechange', () => {});
      this.audioElement.removeEventListener('ended', () => {});

      // Clear source and element
      this.audioElement.src = '';
      this.audioElement.load(); // Force cleanup
      this.audioElement = null;

      this.audioInitialized = false;
      this.currentMusicUrl = null;
      this.isPlaying = false;
      this.isAudioLoading = false;
    }
  }

  /**
   * Set audio volume
   * @param volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    if (volume < 0 || volume > 1) {
      console.warn('Volume must be between 0 and 1');
      return;
    }

    this.currentVolume = volume;

    if (this.audioElement) {
      this.audioElement.volume = volume;
    }

    this.saveStateToLocalStorage();
    console.log('Volume set to:', volume);
  }

  /**
   * Get current audio time
   * @returns number - Current playback time in seconds
   */
  getCurrentTime(): number {
    return this.audioElement?.currentTime || 0;
  }

  /**
   * Get audio duration
   * @returns number - Total audio duration in seconds
   */
  getDuration(): number {
    return this.audioElement?.duration || 0;
  }

  /**
   * Check if audio is ready to play
   * @returns boolean - Whether audio is ready
   */
  isAudioReady(): boolean {
    return this.audioInitialized && !this.isAudioLoading && !this.audioError;
  }

  /**
   * Get music information from wedding settings
   * @returns object with music info or null
   */
  getMusicInfo(): any {
    return this.weddingData?.settings?.music_info || null;
  }

  /**
   * Check if music streaming is supported
   * @returns boolean - Whether music streaming is supported
   */
  isMusicStreamingSupported(): boolean {
    const musicInfo = this.getMusicInfo();
    return musicInfo?.supports_streaming === true;
  }

  /**
   * Get available music formats
   * @returns string[] - Array of supported formats
   */
  getSupportedFormats(): string[] {
    const musicInfo = this.getMusicInfo();
    return musicInfo?.format_support || [];
  }

  togglePlay(forceAudible: boolean = false): void {
    const latestMusicUrl = resolveInvitationMusicUrl(this.weddingData);

    if (!latestMusicUrl) {
      console.warn('[InvitationAudio] Play requested but no valid music URL is available', {
        sourceType: resolveInvitationMusicSourceType(this.weddingData),
        settings: this.weddingData?.settings,
      });
      this.audioError = 'URL musik tidak tersedia.';
      return;
    }

    if (!this.audioElement || this.currentMusicUrl !== latestMusicUrl) {
      console.warn('[InvitationAudio] Audio not initialized or URL changed, initializing before play', {
        latestMusicUrl,
        currentMusicUrl: this.currentMusicUrl,
      });
      this.initializeAudio();
      if (!this.audioElement) {
        return;
      }
    }

    if (this.audioError) {
      console.warn('[InvitationAudio] Audio error present, retrying with fresh element:', this.audioError);
      this.cleanupAudio();
      this.audioError = null;
      this.initializeAudio();
      if (!this.audioElement) {
        return;
      }
    }

    if (!this.audioElement.src) {
      console.warn('[InvitationAudio] Audio element has no src before play', {
        latestMusicUrl,
      });
      this.audioElement.src = latestMusicUrl;
      this.audioElement.load();
    }

    if (this.audioElement.muted && !this.isMuted) {
      this.audioElement.muted = false;
    }

    if (forceAudible) {
      this.isMuted = false;
      this.currentVolume = 1;
      this.audioElement.muted = false;
      this.audioElement.volume = 1;
    }

    if (this.audioElement.volume === 0 && this.currentVolume > 0) {
      this.audioElement.volume = this.currentVolume;
    }

    if (this.audioElement.volume === 0) {
      this.audioElement.volume = 0.7;
      this.currentVolume = 0.7;
    }

    if (this.isMuted) {
      console.warn('[InvitationAudio] Play requested while audio is muted');
    }

    if (!this.audioElement.src) {
      this.audioError = 'URL musik tidak valid.';
      return;
    }

    try {
      if (this.isPlaying) {
        this.audioElement.pause();
        console.log('[InvitationAudio] Audio paused by user');
      } else {
        // Handle browser autoplay policies
        console.log('[InvitationAudio] Manual play requested', {
          src: this.audioElement.currentSrc || this.audioElement.src,
          sourceType: resolveInvitationMusicSourceType(this.weddingData),
          muted: this.audioElement.muted,
          volume: this.audioElement.volume,
          loop: this.audioElement.loop,
          preload: this.audioElement.preload,
        });
        console.log('[Invitation Music] opened', this.invitationOpened);
        console.log('[Invitation Music] audio src', this.audioElement.src);
        console.log('[Invitation Music] paused', this.audioElement.paused);
        const playPromise = this.audioElement.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('[InvitationAudio] play() resolved');
            })
            .catch(error => {
              console.error('[Invitation Music] play rejected', {
                error,
                src: this.audioElement?.src,
                readyState: this.audioElement?.readyState,
                networkState: this.audioElement?.networkState
              });
              console.error('[InvitationAudio] play() rejected', {
                reason: error,
                src: this.audioElement?.currentSrc || this.audioElement?.src,
              });
              this.audioError = 'Pemutaran musik gagal. Ketuk tombol play sekali lagi.';
              this.isPlaying = false;
            });
        }
      }
    } catch (error) {
      console.error('[InvitationAudio] Error toggling audio play:', error);
      this.audioError = 'Kontrol musik gagal dijalankan.';
    }

    // State will be updated by event listeners
  }

  toggleMute(): void {
    if (!this.audioElement) {
      console.warn('Audio not initialized, cannot toggle mute');
      this.initializeAudio();
      return;
    }

    try {
      this.audioElement.muted = !this.audioElement.muted;
      console.log('Audio muted:', this.audioElement.muted);

      // State will be updated by volumechange event listener
    } catch (error) {
      console.error('Error toggling audio mute:', error);
    }
  }

  toggleSideIcons(): void {
    this.sideIconsVisible = !this.sideIconsVisible;
    this.saveStateToLocalStorage();
  }

  openInvitation(): void {
    // Match preview contract: flip opened + keep MAIN host mounted, then
    // fire-and-forget side effects. Never gate theme destroy/recreate on this.
    this.invitationOpenedSticky = true;
    this.invitationOpened = true;
    this.currentView = ContentView.MAIN;

    // Audio is a side-effect only — never block opening or scroll on play promise.
    if (!this.isPlaying) {
      setTimeout(() => this.togglePlay(true), 0);
    }

    // Track invitation view via attendance API
    this.submitAttendanceView();

    // Save state immediately after opening invitation
    this.saveStateToLocalStorage();
  }

  /**
   * Submit attendance record for view tracking
   * Note: This uses the RSVP attendance API with default values for view tracking purposes
   */
  private submitAttendanceView(): void {
    if (!this.weddingData?.user_info?.id) {
      console.warn('Cannot track attendance: user_info.id not available');
      return;
    }

    const domain = this.getInvitationDomain();
    if (!domain) {
      console.warn('Cannot track attendance: invitation domain not available');
      return;
    }

    const attendanceData: AttendanceRequest = {
      user_id: this.weddingData.user_info.id,
      domain,
      nama: 'Viewer', // Default name for view tracking
      kehadiran: 'hadir', // Default status for view tracking
      pesan: `Undangan ${domain} telah dilihat` // Include domain in tracking message
    };

    console.log('Tracking invitation view with attendance data:', attendanceData);

    const attendanceSubscription = this.dashboardService.create(
      DashboardServiceType.ATTENDANCE,
      attendanceData
    ).subscribe({
      next: (response: AttendanceResponse) => {
        console.log('Attendance view tracked successfully:', response);
        if (response.data) {
          console.log('View tracking record created with ID:', response.data.id);
        }
      },
      error: (error) => {
        console.error('Failed to track attendance view:', error);

        // Log specific error details without blocking the user experience
        if (error.status === 422) {
          console.error('Validation error for attendance tracking:', error.error?.errors);
        } else if (error.status === 500) {
          console.error('Server error during attendance tracking:', error.error?.error);
        }

        // Don't show error to user since this is background tracking
        // The invitation should still open normally
      },
      complete: () => {
        console.log('Attendance view tracking request completed');
      }
    });

    this.subscriptions.add(attendanceSubscription);
  }

  setCurrentView(view: ContentView): void {
    this.currentView = view;
    this.saveStateToLocalStorage();
  }

  hasActiveThemeComponent(): boolean {
    return !!this.activeThemeComponent;
  }

  shouldRenderLegacyTemplate(): boolean {
    // Always use the active theme template when wedding data is available.
    // Both ruby-theme-one and lavender-bloom are self-contained scrollable
    // templates that include all sections. The ngSwitch default in the
    // active theme template handles the fallback to lavender-bloom.
    return false;
  }

  onGuestWishSubmitted(wish: GuestWish): void {
    if (!this.weddingData || !wish) {
      return;
    }

    const currentWishes = Array.isArray(this.weddingData.guest_wishes)
      ? this.weddingData.guest_wishes
      : [];
    const hasWish = currentWishes.some((item) => this.isSameGuestWish(item, wish));

    this.weddingData = {
      ...this.weddingData,
      guest_wishes: hasWish ? currentWishes : [wish, ...currentWishes],
      metadata: this.weddingData.metadata
        ? {
            ...this.weddingData.metadata,
            total_guest_wishes: hasWish
              ? this.weddingData.metadata.total_guest_wishes
              : (this.weddingData.metadata.total_guest_wishes || currentWishes.length) + 1,
          }
        : this.weddingData.metadata,
    };
    this.weddingDataService.setWeddingData(this.weddingData);
    this.saveStateToLocalStorage();

    const domain = this.getInvitationDomain();
    if (domain) {
      this.loadWeddingDataFromAPI(domain, true, true);
    }
  }

  private isSameGuestWish(a: GuestWish, b: GuestWish): boolean {
    if (a?.id && b?.id && a.id === b.id) {
      return true;
    }

    return String(a?.nama || '').trim() === String(b?.nama || '').trim()
      && String(a?.pesan || '').trim() === String(b?.pesan || '').trim()
      && String(a?.kehadiran || '').trim() === String(b?.kehadiran || '').trim();
  }

  private getInvitationDomain(): string {
    const data: any = this.weddingData || {};
    const domain = String(
      this.domain ||
      data?.settings?.domain ||
      data?.domain ||
      data?.domain_slug ||
      data?.invitation?.domain ||
      data?.wedding?.slug ||
      data?.profile?.domain ||
      ''
    ).trim();

    return domain.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0];
  }

  showMessages(): void {
    this.setCurrentView(ContentView.MESSAGE);
  }

  toggleFavorite(event: MouseEvent): void {
    this.currentView = this.currentView === ContentView.COUPLE ? ContentView.MAIN : ContentView.COUPLE;
  }

  showCalendar(): void {
    this.setCurrentView(ContentView.CALENDAR);
  }

  showBirthday(): void {
    this.setCurrentView(ContentView.BIRTHDAY);
  }

  showChat(): void {
    this.setCurrentView(ContentView.CHAT);
  }

  showGallery(): void {
    this.setCurrentView(ContentView.GALLERY);
  }

  showProfile(): void {
    this.setCurrentView(ContentView.PROFILE);
  }

  showGifts(): void {
    this.setCurrentView(ContentView.GIFT);
  }

  isCurrentView(view: ContentView): boolean {
    return this.currentView === view;
  }

  /**
   * Open QR Code modal for sharing wedding URL
   */
  openQRCodeModal(): void {
    if (!this.domain) {
      alert('Domain undangan belum tersedia.');
      return;
    }

    const initialState = {
      url: window.location.href
    };

    try {
      this.qrModalRef = this.modalService.show(QRCodeModalComponent, {
        initialState,
        class: 'qr-modal-dialog',
        backdrop: true,
        keyboard: true,
        animated: true
      });

      this.qrModalRef.onHide?.subscribe(() => {
        this.qrModalRef = undefined;
      });
    } catch (error) {
      alert('Gagal membuka QR undangan.');
    }
  }

  /**
   * Test modal opening for debugging
   */
  testModal(): void {
    console.log('Test modal button clicked');
    console.log('Modal service available:', !!this.modalService);
    console.log('QRCodeModalComponent:', QRCodeModalComponent);

    try {
      const testModalRef = this.modalService.show(QRCodeModalComponent, {
        initialState: {
          url: 'https://test.example.com',
          title: 'Test Modal',
          description: 'This is a test modal'
        },
        class: 'modal-lg'
      });

      console.log('Test modal opened:', testModalRef);
    } catch (error) {
      console.error('Test modal error:', error);
      alert('Test modal error: ' + error);
    }
  }

  /**
   * Check if messages page should be visible based on filter_undangan.halaman_ucapan
   */
  isMessagesVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_ucapan === 1;
  }

  /**
   * Check if calendar page should be visible based on filter_undangan.halaman_acara
   */
  isCalendarVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_acara === 1;
  }

  /**
   * Check if birthday/events page should be visible based on filter_undangan.halaman_acara
   */
  isBirthdayVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_acara === 1;
  }

  /**
   * Check if chat/stories page should be visible based on filter_undangan.halaman_cerita
   */
  isChatVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_cerita === 1;
  }

  /**
   * Check if gallery page should be visible based on filter_undangan.halaman_galery
   */
  isGalleryVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_galery === 1;
  }

  /**
   * Check if profile/location page should be visible based on filter_undangan.halaman_lokasi
   */
  isProfileVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_lokasi === 1;
  }

  /**
   * Check if gifts page should be visible based on filter_undangan.halaman_send_gift
   */
  isGiftsVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_send_gift === 1;
  }

  /**
   * Check if favorite button should be visible (always visible when invitation is opened)
   */
  isFavoriteVisible(): boolean {
    return this.weddingData?.filter_undangan?.halaman_sampul === 1;
  }

  private initializeBootstrapTooltips(): void {
    const tooltipTriggerList = Array.from(
      this.elementRef.nativeElement.querySelectorAll('[data-bs-toggle="tooltip"]')
    );

    tooltipTriggerList.forEach((tooltipTriggerEl: any) => {
      new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  private addClickFunctionality(): void {
    const navItems = this.elementRef.nativeElement.querySelectorAll('.nav-item');

    navItems.forEach((item: HTMLElement, index: number) => {
      this.renderer.listen(item, 'click', () => {
        navItems.forEach((nav: HTMLElement) => {
          this.renderer.setStyle(nav, 'background', 'transparent');
          this.renderer.removeClass(nav, 'active');
        });

        this.renderer.setStyle(item, 'background', 'rgba(44, 85, 48, 0.15)');
        this.renderer.addClass(item, 'active');

        this.createRippleEffect(item);
      });
    });
  }

  private createRippleEffect(element: HTMLElement): void {
    const ripple = this.renderer.createElement('span');

    const rippleStyles = `
      position: absolute;
      border-radius: 50%;
      background: rgba(44, 85, 48, 0.3);
      width: 20px;
      height: 20px;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    `;

    this.renderer.setAttribute(ripple, 'style', rippleStyles);
    this.renderer.appendChild(element, ripple);

    setTimeout(() => {
      this.renderer.removeChild(element, ripple);
    }, 600);
  }

  private addTouchSupport(): void {
    const navItems = this.elementRef.nativeElement.querySelectorAll('.nav-item');

    navItems.forEach((item: HTMLElement) => {
      this.renderer.listen(item, 'touchstart', () => {
        this.renderer.setStyle(item, 'transform', 'translateY(-2px) scale(1.02)');
      });

      this.renderer.listen(item, 'touchend', () => {
        this.renderer.setStyle(item, 'transform', '');
      });
    });
  }

  private addSideIconClickFunctionality(): void {
    const sideIcons = this.elementRef.nativeElement.querySelectorAll('.side-icon-btn');

    sideIcons.forEach((icon: HTMLElement) => {
      this.renderer.listen(icon, 'click', () => {
        this.renderer.setStyle(icon, 'transform', 'scale(0.95)');
        setTimeout(() => {
          this.renderer.setStyle(icon, 'transform', '');
        }, 150);
      });
    });
  }

  private injectRippleStyles(): void {
    const style = this.renderer.createElement('style');
    const styleContent = `
      @keyframes ripple {
        to {
          transform: translate(-50%, -50%) scale(4);
          opacity: 0;
        }
      }

      .wedding-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        padding: 2rem;
        text-align: center;
      }

      .loading-spinner {
        font-size: 3rem;
        margin-bottom: 1rem;
        animation: pulse 1.5s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.05); }
      }

      .wedding-error {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 50vh;
        padding: 2rem;
        text-align: center;
      }

      .error-message {
        color: #dc3545;
        margin-bottom: 1rem;
        font-size: 1.1rem;
        max-width: 400px;
      }

      .retry-button {
        background: #007bff;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .retry-button:hover {
        background: #0056b3;
        transform: translateY(-1px);
      }

      .error-links {
        margin-top: 1rem;
        color: #666;
        font-size: 0.9rem;
      }

      .error-links a {
        color: #007bff;
        text-decoration: none;
      }

      .error-links a:hover {
        text-decoration: underline;
      }
    `;

    this.renderer.setProperty(style, 'textContent', styleContent);
    this.renderer.appendChild(document.head, style);
  }

  private getThemeSlugFromInvitation(data: WeddingData | null | undefined): ThemeSlug | null {
    if (!data) {
      return null;
    }

    const selected = data.selected_theme as SelectedThemeSummary | null | undefined;
    const nestedSelectedTheme = (data as any)?.themes?.selected_theme ?? null;
    console.log('[WeddingView] getThemeSlugFromInvitation - selected_theme object:', selected);
    console.log('[WeddingView] getThemeSlugFromInvitation - themes.selected_theme object:', nestedSelectedTheme);

    const selectedSlug = resolveThemeSlugFromCandidates([
      selected?.slug,
      (selected as any)?.theme_slug,
      (selected as any)?.jenis_thema,
      (selected as any)?.tema,
      selected?.name,
      nestedSelectedTheme?.slug,
      nestedSelectedTheme?.theme_slug,
      nestedSelectedTheme?.jenis_thema,
      nestedSelectedTheme?.tema,
      nestedSelectedTheme?.name,
    ]);
    if (selectedSlug) {
      console.log('[WeddingView] Resolved slug from selected theme priority:', selectedSlug);
      return selectedSlug;
    }

    const candidateValues = [
      (data as any)?.themes?.selected_theme?.slug,
      (data as any)?.themes?.selected_theme?.theme_slug,
      (data as any)?.themes?.selected_theme?.jenis_thema,
      (data as any)?.themes?.selected_theme?.tema,
      (data as any)?.themes?.selected_theme?.name,
      (data as any)?.theme_slug,
      (data as any)?.slug_theme,
      (data as any)?.jenis_thema,
      (data as any)?.tema,
      (data as any)?.theme,
      (data as any)?.selected_theme_slug,
      (data as any)?.selected_theme?.name,
      (data as any)?.selected_theme?.theme_slug,
      (data as any)?.selected_theme?.jenis_thema,
      (data as any)?.selected_theme?.tema,
    ];

    if (!selected) {
      console.log('[WeddingView] selected_theme tidak tersedia, field alternatif yang tersedia:', {
        theme_slug: (data as any)?.theme_slug ?? null,
        slug_theme: (data as any)?.slug_theme ?? null,
        jenis_thema: (data as any)?.jenis_thema ?? null,
        tema: (data as any)?.tema ?? null,
        theme: (data as any)?.theme ?? null,
        selected_theme_slug: (data as any)?.selected_theme_slug ?? null,
        themes_selected_theme_slug: (data as any)?.themes?.selected_theme?.slug ?? null,
      });
    }

    console.log('[WeddingView] Fallback candidates (selected_theme.slug not valid):', candidateValues);
    const fallbackSlug = resolveThemeSlugFromCandidates(candidateValues);
    const resolvedSlug = fallbackSlug || DEFAULT_THEME_SLUG;
    console.log('[WeddingView] Resolved fallback slug:', resolvedSlug);
    return resolvedSlug;
  }

  private resolveThemeComponent(slug: ThemeSlug | null): Type<unknown> | null {
    const renderKey = resolveThemeRenderKey(slug);
    return this.themeComponentRegistry[renderKey] || null;
  }
}
