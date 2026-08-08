import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, forkJoin, Subscription } from 'rxjs';
import {
  DashboardService,
  DashboardServiceType,
  ProfileResponse,
  ThemeService,
  PublicCategoriesResponse,
  PublicCategoryWithThemes,
  PublicTheme,
  UserSelectedThemeResponse,
  ThemeSelectionRequest
} from '../../../dashboard.service';
import { ToastService } from '../../../toast.service';
import {
  buildThemeAccessMap,
  FALLBACK_THEME_ACCESS_MAP,
  getLowestPackageTierForTheme,
  getThemePresetBySlug,
  getThemeTierForSlug,
  isTierAllowed,
  PaidThemePackageTier,
  PUBLIC_THEME_PRESETS,
  resolvePackageTier,
  ThemeAccessMap,
  ThemeCategoryName,
  ThemePackageTier,
} from '../../../theme-package-access.util';
import { normalizeThemeSlug } from '../../../theme-render.registry';
import { getFriendlyErrorMessage } from '../../../shared/api-error-message.util';
import { environment } from '../../../../environments/environment';
import { WeddingDataService } from '../../../services/wedding-data.service';

type PaidPackageTier = PaidThemePackageTier;

/** Tab/filter selection: a specific tier, or "all" (Semua) for every accessible tier. */
type ThemeFilterTier = 'all' | PaidPackageTier;

interface ThemeCard {
  id: number;
  backendThemeId: number | null;
  label: string;
  title: string;
  name: string;
  nama?: string;
  slug: string;
  image: string;
  url_thema: string;
  demo_url: string;
  price: number;
  isCurrentTheme: boolean;
  isLoading?: boolean;
  category_id: number;
  category: ThemeCategoryName | 'Legacy';
  isLegacy?: boolean;
  imageFallback?: string;
  requiredPackageTier: PaidPackageTier | null;
  is_active: boolean;
  category_is_active: boolean;
  isConnectedToBackend: boolean;
  availabilityMessage?: string;
  canPreview: boolean;
  canUse: boolean;
  canUseFromApi: boolean | null;
  lockedFromApi: boolean | null;
  lockReason: string;
  inactiveByAdmin: boolean;
  adminIsActive: boolean;
  upgradeRequired: boolean;
  targetPackage: string | null;
  targetPackageLabel: string;
  targetPackagePrice: number | null;
  targetPackageOriginalPrice?: number | string | null;
  targetPackageOriginalPriceLabel?: string;
  targetPackageDiscountPercentage?: number | string | null;
  targetPackageDiscountAmount?: number | string | null;
  targetPackageDiscountAmountLabel?: string;
  targetPackageUpgradePrice?: number | string | null;
  targetPackageUpgradePriceLabel?: string;
}

interface PackageTab {
  tier: ThemeFilterTier;
  label: string;
}

const PACKAGE_TABS: PackageTab[] = [
  { tier: 'ruby', label: 'Ruby' },
  { tier: 'sapphire', label: 'Sapphire' },
  { tier: 'diamond', label: 'Diamond' },
];

const FIXED_THEME_PRESETS = PUBLIC_THEME_PRESETS.map((preset) => ({
  ...preset,
  fallbackImage:
    preset.slug === 'soft-ivory' ? 'assets/themas3.png' : preset.fallbackImage,
}));

@Component({
  selector: 'wc-tampilan',
  templateUrl: './tampilan.component.html',
  styleUrls: ['./tampilan.component.scss']
})
export class TampilanComponent implements OnInit, OnDestroy {
  readonly packageTabs = PACKAGE_TABS;
  readonly upgradeRoute = '/user/upgrade-account';

  themeCards: ThemeCard[] = [];
  isLoading = false;
  errorMessage = '';
  currentThemeId: number | null = null;
  selectedThemeId: number | null = null;
  selectedThemeSlug = '';
  public selectedThemeForSubmit: ThemeCard | null = null;

  userPackageTier: ThemePackageTier = 'trial';
  activeTab: ThemeFilterTier = 'ruby';
  showSelectConfirmationModal = false;
  showUpgradeModal = false;
  processingPrimaryAction = false;
  processingUpgradeInvoice = false;
  isNavigatingToUpgrade = false;
  showThemeSuccessToast = false;
  themeSuccessMessage = 'Theme berhasil digunakan';
  showThemeFeedbackModal = false;
  themeFeedbackType: 'success' | 'error' = 'success';
  themeFeedbackMessage = '';
  isAccountActive = false;
  invitationWebsiteUrl = '';

  private subscriptions = new Subscription();
  private themeAccessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP;
  private packageCatalog: any[] = [];
  private pendingThemeForConfirmation: ThemeCard | null = null;
  private pendingThemeForUpgrade: ThemeCard | null = null;
  private readonly legacyTrialCards: ThemeCard[] = [
    { id: -1, backendThemeId: null, label: 'Scroll', title: 'Modern', name: 'Modern', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial', canPreview: true, canUse: false, canUseFromApi: null, lockedFromApi: null, lockReason: '', inactiveByAdmin: false, adminIsActive: true, upgradeRequired: false, targetPackage: null, targetPackageLabel: 'Trial', targetPackagePrice: null },
    { id: -2, backendThemeId: null, label: 'Slide', title: 'Blue', name: 'Blue', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial', canPreview: true, canUse: false, canUseFromApi: null, lockedFromApi: null, lockReason: '', inactiveByAdmin: false, adminIsActive: true, upgradeRequired: false, targetPackage: null, targetPackageLabel: 'Trial', targetPackagePrice: null },
    { id: -3, backendThemeId: null, label: 'Mobile', title: 'Minimalist', name: 'Minimalist', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial', canPreview: true, canUse: false, canUseFromApi: null, lockedFromApi: null, lockReason: '', inactiveByAdmin: false, adminIsActive: true, upgradeRequired: false, targetPackage: null, targetPackageLabel: 'Trial', targetPackagePrice: null },
    { id: -4, backendThemeId: null, label: 'Scroll', title: 'Pinky', name: 'Pinky', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial', canPreview: true, canUse: false, canUseFromApi: null, lockedFromApi: null, lockReason: '', inactiveByAdmin: false, adminIsActive: true, upgradeRequired: false, targetPackage: null, targetPackageLabel: 'Trial', targetPackagePrice: null },
    { id: -5, backendThemeId: null, label: 'Mobile', title: 'Elegant', name: 'Elegant', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial', canPreview: true, canUse: false, canUseFromApi: null, lockedFromApi: null, lockReason: '', inactiveByAdmin: false, adminIsActive: true, upgradeRequired: false, targetPackage: null, targetPackageLabel: 'Trial', targetPackagePrice: null },
  ];

  constructor(
    private dashboardService: DashboardService,
    private themeService: ThemeService,
    private weddingDataService: WeddingDataService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.handleUpgradeReturnMessage();
    this.loadAccessibleThemes();
    this.loadSelectedTheme();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.showSelectConfirmationModal) {
      this.closeSelectConfirmationModal();
    }

    if (this.showUpgradeModal) {
      this.closeUpgradeModal();
    }
  }

  get visibleThemeCards(): ThemeCard[] {
    return this.themeCards.filter(
      (theme) =>
        !theme.isLegacy &&
        theme.category !== 'Legacy' &&
        this.isThemeVisibleInTab(this.activeTab, theme)
    );
  }

  public get selectedThemeActionTarget(): ThemeCard | null {
    return (
      this.selectedThemeForSubmit ||
      this.pendingThemeForUpgrade ||
      this.pendingThemeForConfirmation ||
      this.selectedTheme ||
      null
    );
  }

  public isSelectedThemeUpgradeAction(): boolean {
    const theme = this.selectedThemeActionTarget;

    return !!theme && theme.upgradeRequired === true && !this.canUseTheme(theme);
  }

  /**
   * Tabs are cumulative: a paid user can browse every tier at or below their own.
   * Ruby users see only "Ruby"; higher tiers also get a "Semua" (all) tab so they
   * can view every accessible tier at once (e.g. Sapphire → Semua/Ruby/Sapphire).
   */
  get availablePackageTabs(): PackageTab[] {
    const tierTabs: PackageTab[] = PACKAGE_TABS.map(({ tier }) => ({
      tier,
      label: this.getPackageLabel(tier),
    }));

    return [{ tier: 'all', label: 'Semua' }, ...tierTabs];
  }

  /**
   * A theme is visible in a tab when the user's (cumulative) tier grants access
   * to the theme's own tier AND it matches the active tab filter ("all" = any
   * accessible tier).
   */
  private isThemeVisibleInTab(tab: ThemeFilterTier, theme: ThemeCard): boolean {
    if (theme.category === 'Legacy') {
      return false;
    }

    const themeTier = theme.requiredPackageTier || getThemeTierForSlug(theme.slug);
    return tab === 'all' || themeTier === tab;
  }

  get currentTheme(): ThemeCard | null {
    return this.themeCards.find((theme) => theme.id === this.currentThemeId) ?? null;
  }

  get selectedTheme(): ThemeCard | null {
    if (this.selectedThemeId === null) {
      return null;
    }

    return this.visibleThemeCards.find((theme) => theme.id === this.selectedThemeId) ?? null;
  }

  public getThemeDisplayName(theme: ThemeCard | any): string {
    return (
      theme?.name ||
      theme?.title ||
      theme?.nama ||
      theme?.label ||
      theme?.slug ||
      'Tema'
    );
  }

  public get canSubmitSelectedTheme(): boolean {
    const theme =
      this.selectedThemeForSubmit ||
      this.pendingThemeForConfirmation ||
      this.selectedTheme ||
      null;

    if (!theme) {
      return false;
    }

    if (theme.isLoading || this.processingPrimaryAction || this.processingUpgradeInvoice) {
      return false;
    }

    if (this.isCurrentTheme(theme) || theme.isLegacy) {
      return false;
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      return false;
    }

    if (!this.isAccountActive) {
      return false;
    }

    if (this.isThemeInactiveByAdmin(theme)) {
      return false;
    }

    return this.canUseTheme(theme) || theme.upgradeRequired === true;
  }

  get isPreviewOnlyTab(): boolean {
    const userTier = ((this.userPackageTier as string) || '').toLowerCase().trim() as ThemePackageTier;
    if (userTier === 'trial') {
      return true;
    }

    const activeTabNorm = ((this.activeTab as string) || '').toLowerCase().trim() as PaidPackageTier;
    const order: ThemePackageTier[] = ['trial', 'ruby', 'sapphire', 'diamond'];
    return order.indexOf(activeTabNorm) > order.indexOf(userTier);
  }

  get canSubmitFocusedTheme(): boolean {
    const theme = this.selectedThemeForSubmit || this.selectedTheme;
    return !!theme && !this.isCurrentTheme(theme) && this.canUseTheme(theme);
  }

  /**
   * True when the pending theme (stored at modal-open time) is still
   * eligible for confirmation.  Used by the modal Konfirmasi button *ngIf.
   *
   * Uses explicit === false checks so that a missing/undefined is_active field
   * from the public API never silently hides the button.
   */
  get canConfirmPendingTheme(): boolean {
    const theme = this.pendingThemeForConfirmation;
    if (!theme || !theme.id || theme.id <= 0) return false;
    if (theme.isLoading || this.processingPrimaryAction) return false;
    if (!this.hasValidBackendThemeConnection(theme)) return false;
    return this.canUseTheme(theme);
  }

  get hasThemeForConfirmation(): boolean {
    return !!(this.pendingThemeForConfirmation || this.selectedTheme);
  }

  get isPrimaryButtonDisabled(): boolean {
    const theme = this.selectedThemeForSubmit || this.selectedTheme;
    if (!theme) {
      return true;
    }

    if (theme.isLoading || this.processingPrimaryAction) {
      return true;
    }

    if (this.isCurrentTheme(theme)) {
      return true;
    }

    if (theme.isLegacy) {
      return true;
    }

    return !this.canSubmitSelectedTheme;
  }

  get primaryButtonLabel(): string {
    const theme = this.selectedThemeForSubmit || this.selectedTheme;

    if (this.processingPrimaryAction) {
      return 'Memproses...';
    }

    if (!theme) {
      return 'Pilih tema';
    }

    if (this.isCurrentTheme(theme)) {
      return 'Tema Telah Digunakan';
    }

    if (theme.isLegacy) {
      return 'Tema default trial';
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      return 'Tema belum terhubung';
    }

    if (!this.isAccountActive) {
      return 'Menunggu Konfirmasi Pembayaran';
    }

    if (this.isThemeInactiveByAdmin(theme)) {
      return 'Tema belum aktif';
    }

    if (this.canUseTheme(theme)) {
      return 'Pilih Tema';
    }

    if (theme.upgradeRequired) {
      return `Upgrade ke ${theme.targetPackageLabel}`;
    }

    return 'Pilih tema';
  }

  get confirmThemeButtonLabel(): string {
    return this.processingPrimaryAction ? 'Memproses...' : 'Konfirmasi';
  }

  get focusedThemeSubtitle(): string {
    const theme = this.selectedThemeForSubmit || this.selectedTheme;

    if (!theme) {
      return 'Pilih salah satu tema untuk melanjutkan.';
    }

    if (theme.isLegacy) {
      return 'Tema default trial';
    }

    if (this.isCurrentTheme(theme)) {
      return 'Tema yang Digunakan';
    }

    if (this.canUseTheme(theme)) {
      return 'Tema tersedia';
    }

    if (theme.upgradeRequired) {
      return `Upgrade ke ${theme.targetPackageLabel}`;
    }

    return `${this.getPackageLabel(theme.requiredPackageTier || this.activeTab)} template`;
  }

  get upgradePackageLabel(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    if (!theme || theme.isLegacy || theme.category === 'Legacy') {
      return 'Ruby';
    }

    return this.getPackageLabel(this.resolveRequiredPackageTier(theme));
  }

  private resolveUpgradeTargetPackage(theme: ThemeCard | null | undefined): string {
    if (!theme) {
      return '';
    }

    const targetPackage =
      theme?.targetPackage ||
      theme?.requiredPackageTier ||
      this.resolveRequiredPackageTier(theme);

    return String(targetPackage || '').trim().toLowerCase();
  }

  private resolveThemeReturnUrl(): string {
    const path = String(this.router?.url || '').split('?')[0].split('#')[0];
    return path || '/user/tampilan';
  }

  /**
   * Load themes from API
   */
  private loadAccessibleThemes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    const themesSubscription = forkJoin({
      profile: this.dashboardService.getProfile(),
      packages: this.dashboardService.list(DashboardServiceType.MNL_MD_PACK_INVITATION),
      themes: this.themeService.getPublicCategoriesWithThemes('website'),
    }).subscribe({
      next: ({ profile, packages, themes }: {
        profile: ProfileResponse;
        packages: any;
        themes: PublicCategoriesResponse;
      }) => {
        this.userPackageTier = this.resolveUserPackageTier(profile?.data);
        this.isAccountActive = this.resolveAccountActive(profile?.data);
        this.invitationWebsiteUrl = this.resolveInvitationWebsiteUrl(profile?.data);
        this.activeTab = this.getInitialActiveTab();
        this.packageCatalog = Array.isArray(packages?.data) ? packages.data : [];
        this.themeAccessMap = buildThemeAccessMap(this.packageCatalog);

        // console.log('[ThemeCategories] Raw response /api/themes/categories:', themes);

        const categories = themes?.data?.categories || [];
        if (Array.isArray(categories)) {
          this.processThemeData(categories);
        } else {
          this.handleError('Format data tema tidak valid.');
        }

        this.syncSelectedThemeForVisibleTab();
        this.isLoading = false;
      },
      error: (error) => {
        // console.error('Error loading accessible themes:', error);
        this.handleError('Gagal memuat tema. Silakan coba lagi.');
        this.isLoading = false;
      }
    });

    this.subscriptions.add(themesSubscription);
  }

  /**
   * Load currently selected theme
   */
  private loadSelectedTheme(): void {
    const selectedSubscription = this.themeService.getSelectedTheme().subscribe({
      next: (response: UserSelectedThemeResponse) => {
        // console.log('[LoadSelectedTheme] Response:', response);

        if (response.status && response.data?.theme) {
          this.applySelectedThemeResponse(response);
        } else {
          // console.warn('[LoadSelectedTheme] Tidak ada selected theme di response:', response);
        }
      },
      error: (error) => {
        console.log('[LoadSelectedTheme] Error:', error);
      }
    });

    this.subscriptions.add(selectedSubscription);
  }

  private applySelectedThemeResponse(response: UserSelectedThemeResponse): void {
    const t = response.data.theme as any;
    const resolvedThemeId = Number(t?.id) || null;
    const resolvedThemeSlug = t?.slug ?? t?.theme_slug ?? 'TIDAK ADA SLUG';

    // console.log('[LoadSelectedTheme] selected_theme dari backend:', {
    //   id: resolvedThemeId,
    //   slug: resolvedThemeSlug,
    //   name: t?.name,
    // });

    this.currentThemeId = resolvedThemeId;
    this.selectedThemeId = resolvedThemeId;
    this.updateCurrentThemeStatus();
    this.syncSelectedThemeForVisibleTab();
  }

  private processThemeData(categories: PublicCategoryWithThemes[]): void {
    const nextCards: ThemeCard[] = [];
    const backendThemesBySlug = new Map<string, { theme: PublicTheme; category: PublicCategoryWithThemes }>();

    const flattenedThemes = categories.flatMap((category) =>
      (category?.jenis_themas || []).map((theme) => ({
        ...theme,
        category,
      }))
    );

    flattenedThemes.forEach((entry: any) => {
      const normalizedSlug = normalizeThemeSlug(entry?.slug);
      const preset = getThemePresetBySlug(normalizedSlug);
      if (!preset) {
        return;
      }

      backendThemesBySlug.set(preset.slug, {
        theme: entry as PublicTheme,
        category: (entry?.category || {}) as PublicCategoryWithThemes,
      });
    });

    // console.log('[ThemeCards] Extracted backend themes:', Array.from(backendThemesBySlug.values()).map((entry) => ({
    //   id: entry.theme?.id,
    //   slug: entry.theme?.slug,
    //   name: entry.theme?.name,
    //   category_id: (entry.theme as any)?.category_id ?? entry.category?.id ?? null,
    //   category_name: (entry.theme as any)?.category?.name ?? entry.category?.name ?? null,
    //   is_active: entry.theme?.is_active,
    //   category_is_active: (entry.theme as any)?.category?.is_active ?? entry.category?.is_active,
    // })));
    // console.log('[ThemeCards] backendThemeMap keys:', Array.from(backendThemesBySlug.keys()));

    FIXED_THEME_PRESETS.forEach((preset) => {
      const matched = backendThemesBySlug.get(preset.slug);
      if (!matched) {
        console.warn('[ThemeCards] Preset frontend belum terhubung ke backend theme:', preset.slug);
        const requiredPackageTier = getLowestPackageTierForTheme(preset.slug, this.themeAccessMap);
        nextCards.push({
          id: -100 - nextCards.length,
          backendThemeId: null,
          label: preset.category,
          title: preset.name,
          name: preset.name,
          slug: preset.slug,
          image: preset.fallbackImage,
          imageFallback: preset.fallbackImage,
          url_thema: '',
          demo_url: '',
          price: 0,
          isCurrentTheme: false,
          isLoading: false,
          category_id: 0,
          category: preset.category,
          requiredPackageTier,
          is_active: false,
          category_is_active: false,
          isConnectedToBackend: false,
          availabilityMessage: 'Theme belum terhubung',
          canPreview: true,
          canUse: false,
          canUseFromApi: null,
          lockedFromApi: null,
          lockReason: 'Theme belum terhubung',
          inactiveByAdmin: true,
          adminIsActive: false,
          upgradeRequired: true,
          targetPackage: requiredPackageTier,
          targetPackageLabel: this.getPackageLabel(requiredPackageTier),
          targetPackagePrice: this.resolvePackagePrice(requiredPackageTier),
        });
        return;
      }

      const { theme, category } = matched;
      const resolvedThemeId = Number((theme as any)?.id) || null;
      const rawCategory = (theme as any)?.category || category;
      const resolvedCategoryId = Number((theme as any)?.category_id ?? rawCategory?.id) || 0;
      const adminIsActive = this.resolveAdminThemeActive(theme, rawCategory);
      const inactiveByAdmin = this.toBoolean((theme as any)?.inactive_by_admin) || adminIsActive === false;
      const isThemeActive = adminIsActive;
      const isCategoryActive = rawCategory?.is_active == null ? true : this.toBoolean(rawCategory.is_active);
      const isConnectedToBackend = !!resolvedThemeId && !!preset.slug;
      const explicitRequiredPackageTier =
        this.normalizeTargetPackage(
          (theme as any)?.required_package ||
          (theme as any)?.package_required ||
          (theme as any)?.packageRequired ||
          (theme as any)?.target_package
        );
      const requiredPackageTier = this.resolveMinimumRequiredTier(
        preset.packageTier,
        explicitRequiredPackageTier || getLowestPackageTierForTheme(preset.slug, this.themeAccessMap)
      );
      const tierCanUse = this.canUseThemeByTier(preset.slug, requiredPackageTier);
      const canPreview = true;
      const canUseFromApi = (theme as any)?.can_use == null ? null : this.toBoolean((theme as any).can_use);
      const lockedValue = this.firstDefined([
        (theme as any)?.is_locked,
        (theme as any)?.locked,
      ]);
      const lockedFromApi = lockedValue == null ? null : this.toBoolean(lockedValue);
      const canUse = isConnectedToBackend && tierCanUse && adminIsActive && this.isAccountActive;
      const upgradeRequired = !canUse && this.isAccountActive && adminIsActive && !tierCanUse;
      const targetPackageRaw =
        (theme as any)?.required_package ||
        (theme as any)?.package_required ||
        (theme as any)?.packageRequired ||
        (theme as any)?.target_package ||
        requiredPackageTier;
      const targetPackage = this.resolveMinimumRequiredTier(
        requiredPackageTier,
        this.normalizeTargetPackage(targetPackageRaw) || requiredPackageTier
      );
      const availabilityMessage = canUse
        ? undefined
        : !this.isAccountActive
          ? 'Menunggu konfirmasi pembayaran'
          : inactiveByAdmin || !isCategoryActive
            ? 'Tema belum diaktifkan admin'
            : upgradeRequired
              ? `Tersedia mulai Paket ${this.getPackageLabel(targetPackage)}`
              : lockedFromApi === true
                ? ((theme as any)?.lock_reason || `Tersedia mulai Paket ${this.getPackageLabel(targetPackage)}`)
                : undefined;

      const targetPackagePriceInfo = this.resolveTargetPackagePriceInfo(targetPackageRaw, targetPackage);

      nextCards.push({
        id: resolvedThemeId || -100 - nextCards.length,
        backendThemeId: resolvedThemeId,
        label: preset.category,
        title: preset.name,
        name: preset.name,
        slug: preset.slug,
        image: this.getThemeImage(theme, preset.category),
        imageFallback: preset.fallbackImage,
        url_thema: theme.url_thema || '',
        demo_url: theme.demo_url || '',
        price: theme.price || 0,
        isCurrentTheme: this.toBoolean((theme as any)?.is_current_theme),
        isLoading: false,
        category_id: resolvedCategoryId,
        category: preset.category,
        requiredPackageTier,
        is_active: isThemeActive,
        category_is_active: isCategoryActive,
        isConnectedToBackend,
        availabilityMessage,
        canPreview,
        canUse,
        canUseFromApi,
        lockedFromApi: canUse ? false : (lockedFromApi ?? !tierCanUse),
        lockReason: String((theme as any)?.lock_reason || '').trim(),
        inactiveByAdmin,
        adminIsActive,
        upgradeRequired,
        targetPackage,
        targetPackageLabel: this.getPackageLabel(targetPackage),
        targetPackagePrice: targetPackagePriceInfo.normalPrice,
        targetPackageOriginalPrice: targetPackagePriceInfo.originalPrice,
        targetPackageOriginalPriceLabel: targetPackagePriceInfo.originalPriceLabel,
        targetPackageDiscountPercentage: targetPackagePriceInfo.discountPercentage,
        targetPackageDiscountAmount: targetPackagePriceInfo.discountAmount,
        targetPackageDiscountAmountLabel: targetPackagePriceInfo.discountAmountLabel,
        targetPackageUpgradePrice: targetPackagePriceInfo.upgradePrice,
        targetPackageUpgradePriceLabel: targetPackagePriceInfo.upgradePriceLabel,
      });
    });

    // console.log('[ThemeCards] Built cards:', nextCards.map((card) => ({
    //   title: card.title,
    //   presetKey: card.slug,
    //   backendThemeId: card.backendThemeId,
    //   slug: card.slug,
    //   isActive: card.is_active,
    //   category: card.category,
    //   categoryIsActive: card.category_is_active,
    //   connected: card.isConnectedToBackend,
    //   message: card.availabilityMessage || null,
    // })));

    this.themeCards = nextCards;
    const currentFromApi = nextCards.find((card) => card.isCurrentTheme);
    if (!this.currentThemeId && currentFromApi?.id) {
      this.currentThemeId = currentFromApi.id;
    }
    this.updateCurrentThemeStatus();
  }

  /**
   * Update current theme status from backend
   */
  private updateCurrentThemeStatus(): void {
    this.themeCards.forEach((card) => {
      card.isCurrentTheme = card.id === this.currentThemeId;
    });
  }

  private resolveInvitationWebsiteUrl(profileData: ProfileResponse['data'] | null | undefined): string {
    const data = profileData as any;
    const domain = String(
      data?.domain_info?.domain ||
      data?.domain ||
      data?.settings?.domain ||
      ''
    ).trim();

    return domain ? this.weddingDataService.generateWeddingUrlWithDomain(domain) : '';
  }

  /**
   * Get theme image from API response
   */
  private getThemeImage(theme: PublicTheme, category: ThemeCategoryName): string {
    const url =
      theme.preview_image ||
      theme.preview ||
      theme.image ||
      theme.thumbnail_image ||
      theme.image_url ||
      theme.preview_url;

    return url ? this.resolveThemeImageUrl(url) : this.getThemeFallbackImage(theme.name, category);
  }

  private resolveThemeImageUrl(url: string): string {
    const raw = String(url || '').trim();
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('assets/')) {
      return raw;
    }

    const apiOrigin = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    const cleanPath = raw.replace(/^\/+/, '');
    if (cleanPath.startsWith('storage/')) {
      return `${apiOrigin}/${cleanPath}`;
    }

    return `${apiOrigin}/storage/${cleanPath}`;
  }

  setActiveTab(tab: ThemeFilterTier): void {
    // console.log('[THEME_TAB_CLICK]', tab);
    this.activeTab = tab;
    this.syncSelectedThemeForVisibleTab();
  }

  /**
   * Initial tab after load: paid tiers with more than one accessible tier start
   * on "Semua" so every accessible theme is shown; Ruby (and trial) start on Ruby.
   */
  private getInitialActiveTab(): ThemeFilterTier {
    return 'all';
  }

  onThemeCardClick(theme: ThemeCard, event?: Event): void {
    event?.stopPropagation();

    this.selectedThemeId = theme.id;
    this.selectedThemeSlug = theme.slug;
    this.selectedThemeForSubmit = theme;

    if (this.canUseTheme(theme)) {
      this.pendingThemeForConfirmation = theme;
      this.pendingThemeForUpgrade = null;
      this.logThemeSubmitState();
      return;
    }

    if (theme.upgradeRequired || this.isCardLocked(theme)) {
      this.pendingThemeForConfirmation = null;
      this.pendingThemeForUpgrade = theme;
      this.logThemeSubmitState();
      return;
    }

    this.pendingThemeForConfirmation = null;
    this.pendingThemeForUpgrade = null;
    this.cdr.detectChanges();
    this.logThemeSubmitState();
  }

  onPreviewClick(theme: ThemeCard, event: Event): void {
    event.stopPropagation();
    if (!this.canPreviewTheme(theme)) return;
    this.selectedThemeId = theme.id;
    this.selectedThemeSlug = theme.slug;
    this.selectedThemeForSubmit = theme;

    if (!this.canPreviewTheme(theme)) {
      this.toastService.showToast('Preview tema belum tersedia.', 'info');
      return;
    }

    const previewUrl = this.resolvePreviewUrl(theme);
    if (!previewUrl) {
      this.toastService.showToast('Preview tema belum tersedia.', 'info');
      return;
    }

    try {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      // console.error('Error opening preview:', error);
      this.toastService.showToast('Gagal membuka preview tema.', 'error');
    }
  }

  public onThemeOptionChange(value: string): void {
    const selectedSlug = String(value || '').trim();

    const theme =
      this.visibleThemeCards?.find(item => item.slug === selectedSlug) ||
      this.themeCards?.find(item => item.slug === selectedSlug) ||
      null;

    this.selectedThemeSlug = selectedSlug;
    this.selectedThemeForSubmit = theme;
    this.pendingThemeForConfirmation = theme && this.canUseTheme(theme) ? theme : null;
    this.pendingThemeForUpgrade = theme?.upgradeRequired ? theme : null;
    this.selectedThemeId = theme?.id ?? null;

    // console.log('[MobileThemeOptionChange]', {
    //   selectedSlug,
    //   theme,
    //   canUse: theme ? this.canUseTheme(theme) : false,
    //   canSubmitSelectedTheme: this.canSubmitSelectedTheme
    // });

    this.logThemeSubmitState();
  }

  /**
   * Resolve the preview URL for a theme card.
   *
   * Dashboard preview must stay on the frontend-only preview route so it never
   * opens a user's public wedding domain or backend-provided demo URL.
   */
  private resolvePreviewUrl(theme: ThemeCard): string | null {
    const fallbackSlug = theme.slug?.trim();
    if (fallbackSlug) {
      return `/preview-theme/${fallbackSlug}?preview=true`;
    }

    return null;
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  onPrimaryAction(): void {
    this.confirmSelectedTheme();
  }

  public confirmSelectedTheme(): void {
    const theme =
      this.selectedThemeForSubmit ||
      this.pendingThemeForConfirmation ||
      this.selectedTheme ||
      null;

    if (!theme || theme.isLoading || this.processingPrimaryAction) {
      return;
    }

    if (theme.isLegacy) {
      this.toastService.showToast('Paket Trial menggunakan tema default/legacy.', 'info');
      return;
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      this.toastService.showToast('Theme belum terhubung dengan data backend.', 'error');
      return;
    }

    if (this.isCurrentTheme(theme)) {
      return;
    }

    if (!this.isAccountActive) {
      this.toastService.showToast('Menunggu konfirmasi pembayaran.', 'info');
      return;
    }

    // Use canUseTheme as the source of truth so an API can_use=true or Diamond
    // fallback access is not blocked by a separate presentation status.
    if (this.isThemeInactiveByAdmin(theme)) {
      this.toastService.showToast('Tema ini belum aktif. Silakan hubungi admin.', 'info');
      return;
    }

    if (!this.canUseTheme(theme) && theme.upgradeRequired) {
      this.onUpgradeClick(theme);
      return;
    }

    if (!this.canUseTheme(theme)) {
      this.toastService.showToast('Tema belum tersedia untuk akun Anda.', 'info');
      return;
    }

    this.pendingThemeForConfirmation = theme;
    this.openThemeConfirmationModal();
    this.showUpgradeModal = false;

    // console.log('[ThemeConfirmDebug]', {
    //   pendingThemeForConfirmation: this.pendingThemeForConfirmation,
    //   userPackageTier: this.userPackageTier,
    //   category: this.pendingThemeForConfirmation?.category,
    //   isActive: this.pendingThemeForConfirmation?.is_active,
    //   categoryIsActive: this.pendingThemeForConfirmation?.category_is_active,
    //   canUse: this.pendingThemeForConfirmation ? this.canUseTheme(this.pendingThemeForConfirmation) : false,
    //   canConfirm: this.canConfirmPendingTheme,
    // });
    this.logThemeSubmitState();
  }

  private openThemeConfirmationModal(): void {
    this.showSelectConfirmationModal = true;
  }

  confirmThemeSelection(): void {
    const theme = this.pendingThemeForConfirmation || this.selectedThemeForSubmit || this.selectedTheme;

    // console.log('[ConfirmThemeClick]', theme);

    if (!theme?.backendThemeId) {
      this.toastService.showToast('Tidak ada tema yang dipilih.', 'error');
      return;
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      this.toastService.showToast('Theme belum terhubung dengan data backend.', 'error');
      return;
    }

    this.selectTheme(theme);
  }

  closeSelectConfirmationModal(): void {
    this.showSelectConfirmationModal = false;
    this.pendingThemeForConfirmation = null;
  }

  closeUpgradeModal(): void {
    this.showUpgradeModal = false;
    this.pendingThemeForUpgrade = null;
    this.isNavigatingToUpgrade = false;
  }

  closeThemeFeedbackModal(): void {
    this.showThemeFeedbackModal = false;
  }

  goToUpgradePackage(): void {
    if (this.isNavigatingToUpgrade || !this.canShowUpgradeCta) {
      return;
    }

    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    if (!theme) {
      this.toastService.showToast('Silakan pilih tema terlebih dahulu.', 'info');
      return;
    }

    const targetPackage = this.resolveUpgradeTargetPackage(theme);
    if (!targetPackage || !theme.slug) {
      this.toastService.showToast('Data paket tujuan belum lengkap. Silakan pilih tema kembali.', 'error');
      return;
    }

    this.isNavigatingToUpgrade = true;
    this.router.navigate(['/user/upgrade-account'], {
      queryParams: {
        package: targetPackage,
        theme: theme.backendThemeId || theme.id || theme.slug,
        themeSlug: theme.slug,
        returnUrl: this.resolveThemeReturnUrl(),
      },
    });
  }

  createUpgradeInvoice(): void {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    if (!theme || this.processingUpgradeInvoice) {
      return;
    }

    const targetPackage = this.resolveUpgradeTargetPackage(theme);
    if (!targetPackage || !theme.slug) {
      this.toastService.showToast('Data upgrade paket belum lengkap. Silakan pilih tema kembali.', 'error');
      return;
    }

    this.processingUpgradeInvoice = true;
    const upgradeSubscription = this.themeService.createUpgradeInvoice({
      target_package: targetPackage,
      theme_slug: theme.slug,
    }).pipe(
      finalize(() => {
        this.processingUpgradeInvoice = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        const paymentUrl = this.resolveUpgradePaymentUrl(response);
        this.closeUpgradeModal();
        this.toastService.showToast(response?.message || 'Invoice upgrade berhasil dibuat.', 'success');

        if (paymentUrl) {
          if (/^https?:\/\//i.test(paymentUrl)) {
            window.location.href = paymentUrl;
            return;
          }

          this.router.navigateByUrl(paymentUrl);
          return;
        }

        this.router.navigate(['/payment-pending'], {
          state: {
            paymentStatusMessage: response?.message || 'Invoice upgrade berhasil dibuat. Silakan lanjutkan pembayaran.',
          },
        });
      },
      error: (error) => {
        const message = getFriendlyErrorMessage(error);
        this.toastService.showToast(message, 'error');
        this.showThemeFeedback('error', message);
      }
    });

    this.subscriptions.add(upgradeSubscription);
  }

  private resolveUpgradePaymentUrl(response: any): string {
    const data = response?.data || response || {};
    const candidates = [
      data.payment_url,
      data.invoice_url,
      data.redirect_url,
      data.checkout_url,
      data.snap_redirect_url,
      data.invoice?.payment_url,
      data.invoice?.invoice_url,
      data.invoice?.redirect_url,
      data.tagihan?.payment_url,
      data.tagihan?.invoice_url,
    ];

    const url = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    return String(url || '').trim();
  }

  retryLoadThemes(): void {
    this.errorMessage = '';
    this.loadAccessibleThemes();
  }

  isCardLocked(theme: ThemeCard): boolean {
    if (theme.isLegacy) {
      return true;
    }

    if (!theme.isConnectedToBackend || !this.hasValidBackendThemeConnection(theme)) {
      return true;
    }

    if (this.isThemeInactiveByAdmin(theme)) {
      return true;
    }

    return theme.lockedFromApi === true && !this.canUseTheme(theme);
  }

  isSelectedTheme(theme: ThemeCard): boolean {
    return (this.selectedThemeForSubmit || this.selectedTheme)?.id === theme.id;
  }

  isCurrentTheme(theme: ThemeCard): boolean {
    return this.currentThemeId === theme.id || theme.isCurrentTheme;
  }

  isThemeLoading(theme: ThemeCard): boolean {
    return theme.isLoading || false;
  }

  getPackageLabel(tier: string | null | undefined): string {
    switch (tier) {
      case 'all':
        return 'Semua';
      case 'ruby':
        return 'Ruby';
      case 'sapphire':
        return 'Sapphire';
      case 'diamond':
        return 'Diamond';
      default:
        return 'Trial';
    }
  }

  getCardSubtitle(theme: ThemeCard): string {
    if (theme.isLegacy) {
      return 'Tema default trial';
    }

    if (!theme.isConnectedToBackend) {
      return 'Theme belum terhubung';
    }

    if (theme.availabilityMessage) {
      return theme.availabilityMessage;
    }

    if (this.shouldShowUsedTheme(theme)) {
      return 'Tema yang Digunakan';
    }

    if (this.canUseTheme(theme)) {
      return 'Tema tersedia';
    }

    if (theme.inactiveByAdmin || theme.adminIsActive === false) {
      return 'Tema belum diaktifkan admin';
    }

    if (!this.isAccountActive) {
      return 'Menunggu konfirmasi pembayaran';
    }

    if (theme.upgradeRequired) {
      return `Upgrade ke ${theme.targetPackageLabel}`;
    }

    return `${this.getPackageLabel(theme.requiredPackageTier)} template`;
  }

  getEmptyStateMessage(): string {
    if (this.userPackageTier === 'trial') {
      return 'Tema default trial belum tersedia.';
    }

    return `Belum ada tema untuk paket ${this.getPackageLabel(this.activeTab)}.`;
  }

  /** Debug: returns human-readable reason why a theme cannot be confirmed. Empty string = no issue. */
  getThemeDebugReason(theme: ThemeCard): string {
    if (!theme.id || theme.id <= 0) return 'theme id missing';
    if (!theme.isConnectedToBackend) return 'theme not connected';
    if (!this.canUseTheme(theme) && theme.is_active === false) return 'theme inactive';
    if (!this.canUseTheme(theme) && theme.category_is_active === false) return 'category inactive';
    if (!this.canUseTheme(theme)) {
      const userTier = ((this.userPackageTier as string) || '').toLowerCase().trim();
      return `package not allowed (tier=${userTier}, category=${theme.category})`;
    }
    return '';
  }

  onImageError(event: Event, theme: ThemeCard): void {
    const target = event.target as HTMLImageElement | null;
    if (target) {
      const fallback = theme.imageFallback || 'assets/images/theme-placeholder.jpg';
      if (!target.src.includes(fallback)) {
        target.src = fallback;
      }
    }
  }

  trackByThemeId(index: number, theme: ThemeCard): number {
    return theme.id;
  }

  /**
   * Returns true when the user's current package tier allows access to this theme's category.
   * Deliberately does NOT check is_active — that is handled separately in onPrimaryAction
   * and canConfirmPendingTheme so that a falsy/0/undefined value from the public API never
   * silently blocks a legitimate theme selection.
   */
  canUseTheme(theme: ThemeCard): boolean {
    if (theme.isLegacy || theme.category === 'Legacy') {
      return false;
    }

    return theme.canUse === true;
  }

  private isThemeInactiveByAdmin(theme: ThemeCard): boolean {
    return theme.inactiveByAdmin === true ||
      theme.adminIsActive === false ||
      theme.is_active === false ||
      theme.category_is_active === false;
  }

  private canUseThemeByTier(themeSlug: string, requiredTier?: PaidPackageTier | null): boolean {
    if (!themeSlug) {
      return false;
    }

    const userTier = ((this.userPackageTier as string) || '').toLowerCase().trim() as ThemePackageTier;
    if (userTier === 'trial') {
      return false;
    }

    // Cumulative access: a theme is usable when its tier is at/below the user's
    // tier (Sapphire may use Ruby themes; Diamond may use Ruby + Sapphire, etc.).
    const themeTier = requiredTier || getThemeTierForSlug(themeSlug);
    const allowed = isTierAllowed(userTier, themeTier);

    // console.log('[ThemeAccessCumulative]', {
    //   userTier,
    //   themeSlug,
    //   themeTier,
    //   allowed,
    // });

    return allowed;
  }

  canPreviewTheme(theme: ThemeCard): boolean {
    return !!theme.slug;
  }

  shouldShowUsedTheme(theme: ThemeCard): boolean {
    return this.isCurrentTheme(theme) || theme.isCurrentTheme === true;
  }

  shouldShowUseTheme(theme: ThemeCard): boolean {
    return !this.shouldShowUsedTheme(theme) && this.canUseTheme(theme);
  }

  shouldShowUpgradeTheme(theme: ThemeCard): boolean {
    return !this.shouldShowUsedTheme(theme) && !this.canUseTheme(theme) && theme.upgradeRequired === true;
  }

  onUseThemeClick(theme: ThemeCard, event: Event): void {
    event.stopPropagation();
    if (theme.isLoading || this.processingPrimaryAction) return;
    this.selectedThemeId = theme.id;
    this.selectedThemeSlug = theme.slug;
    this.selectedThemeForSubmit = theme;
    this.pendingThemeForConfirmation = theme;
    this.pendingThemeForUpgrade = null;

    this.cdr.detectChanges();
    this.confirmSelectedTheme();
  }

  onUpgradeClick(theme: ThemeCard, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedThemeId = theme.id;
    this.selectedThemeSlug = theme.slug;
    this.selectedThemeForSubmit = theme;
    this.pendingThemeForUpgrade = theme;
    this.showUpgradeModal = true;
    this.showSelectConfirmationModal = false;
  }

  get selectedUpgradeTheme(): ThemeCard | null {
    return this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme || null;
  }

  get canShowUpgradeCta(): boolean {
    const theme = this.selectedUpgradeTheme;
    return !!(
      theme &&
      theme.upgradeRequired === true &&
      this.resolveUpgradeTargetPackage(theme)
    );
  }

  get upgradeModalTitle(): string {
    return this.canShowUpgradeCta ? 'Upgrade paket diperlukan' : 'Tema Tidak Tersedia';
  }

  get upgradeModalDescription(): string {
    if (this.canShowUpgradeCta) {
      return `Tema ini tersedia untuk Paket ${this.upgradeTargetPackageLabel}. Silakan lanjutkan ke halaman Upgrade Akun untuk menggunakan tema ini.`;
    }

    return 'Tema ini sedang tidak tersedia. Silakan pilih tema lain atau kembali ke daftar tema.';
  }

  get upgradeModalIconClass(): string {
    return this.canShowUpgradeCta ? 'fas fa-crown' : 'fas fa-ban';
  }

  get upgradeCurrentPackageLabel(): string {
    return this.getPackageLabel(this.userPackageTier);
  }

  get upgradeTargetPackageLabel(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    return theme?.targetPackageLabel || this.upgradePackageLabel;
  }

  get upgradeThemeName(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    return theme ? this.getThemeDisplayName(theme) : '-';
  }

  get upgradeTargetPackagePriceLabel(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    return theme?.targetPackageUpgradePriceLabel || this.formatCurrencyLabel(theme?.targetPackageUpgradePrice) || 'Belum tersedia';
  }

  get upgradeTargetPackageOriginalPriceLabel(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    return theme?.targetPackageOriginalPriceLabel || this.formatCurrencyLabel(theme?.targetPackageOriginalPrice) || this.formatCurrencyLabel(theme?.targetPackagePrice);
  }

  get upgradeTargetPackageDiscountLabel(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    const percent = theme?.targetPackageDiscountPercentage;
    if (percent === null || percent === undefined || percent === '') return 'Diskon Upgrade';
    return `Diskon Upgrade ${this.formatPercentLabel(percent)}`;
  }

  get upgradeTargetPackageDiscountAmountLabel(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedThemeForSubmit || this.selectedTheme;
    return theme?.targetPackageDiscountAmountLabel || this.formatCurrencyLabel(theme?.targetPackageDiscountAmount);
  }

  private normalizeTargetPackage(value: unknown): PaidPackageTier | null {
    if (value && typeof value === 'object') {
      const objectValue = value as any;
      return this.normalizeTargetPackage(
        objectValue.package_code ||
        objectValue.package_tier ||
        objectValue.code ||
        objectValue.name_paket ||
        objectValue.name ||
        objectValue.jenis_paket
      );
    }

    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) return null;
    if (raw.includes('diamond')) return 'diamond';
    if (raw.includes('sapphire')) return 'sapphire';
    if (raw.includes('ruby')) return 'ruby';
    return null;
  }

  private resolvePackagePrice(tier: string | null | undefined): number | null {
    const normalizedTier = this.normalizeTargetPackage(tier);
    if (!normalizedTier) return null;

    const matchedPackage = this.packageCatalog.find((paket) => resolvePackageTier(paket) === normalizedTier);
    const price = Number(matchedPackage?.price ?? matchedPackage?.harga ?? matchedPackage?.amount);
    return Number.isFinite(price) ? price : null;
  }

  private resolveTargetPackageLabel(rawTargetPackage: unknown, tier: PaidPackageTier): string {
    if (rawTargetPackage && typeof rawTargetPackage === 'object') {
      const packageObject = rawTargetPackage as any;
      const label = String(
        packageObject.name_paket_display ||
        packageObject.name_paket ||
        packageObject.name ||
        packageObject.jenis_paket ||
        ''
      ).trim();

      if (label) return label;
    }

    return this.getPackageLabel(tier);
  }

  private resolveTargetPackagePrice(rawTargetPackage: unknown, tier: PaidPackageTier): number | null {
    if (rawTargetPackage && typeof rawTargetPackage === 'object') {
      const packageObject = rawTargetPackage as any;
      const price = Number(packageObject.price ?? packageObject.harga ?? packageObject.amount);
      if (Number.isFinite(price)) return price;
    }

    return this.resolvePackagePrice(tier);
  }

  private resolveTargetPackagePriceInfo(rawTargetPackage: unknown, tier: PaidPackageTier): {
    normalPrice: number | null;
    originalPrice: number | string | null;
    originalPriceLabel: string;
    discountPercentage: number | string | null;
    discountAmount: number | string | null;
    discountAmountLabel: string;
    upgradePrice: number | string | null;
    upgradePriceLabel: string;
  } {
    const packageObject = rawTargetPackage && typeof rawTargetPackage === 'object' ? rawTargetPackage as any : null;
    const normalPrice = this.resolveTargetPackagePrice(rawTargetPackage, tier);
    const firstPriceValue = (values: unknown[]): number | string | null => {
      const value = this.firstDefined(values);
      return value === undefined ? null : value as number | string | null;
    };
    const originalPrice = firstPriceValue([
      packageObject?.original_price,
      packageObject?.normal_price,
      packageObject?.regular_price,
      packageObject?.package_price,
      packageObject?.price,
      packageObject?.harga,
      packageObject?.amount,
      normalPrice,
    ]);
    const discountPercentage = firstPriceValue([
      packageObject?.discount_percentage,
      packageObject?.upgrade_discount_percentage,
      packageObject?.discount_percent,
      packageObject?.diskon_persen,
    ]);
    const discountAmount = firstPriceValue([
      packageObject?.discount_amount,
      packageObject?.upgrade_discount_amount,
      packageObject?.diskon_nominal,
      packageObject?.discount_value,
    ]);
    const upgradePrice = firstPriceValue([
      packageObject?.upgrade_price,
      packageObject?.upgrade_amount,
      packageObject?.payment_amount,
      packageObject?.amount_due,
      packageObject?.total_payment,
      packageObject?.total_bayar,
      packageObject?.final_price,
      packageObject?.payable_amount,
    ]);

    return {
      normalPrice,
      originalPrice,
      originalPriceLabel: this.formatCurrencyLabel(originalPrice, packageObject?.original_price_label ?? packageObject?.normal_price_label ?? packageObject?.regular_price_label),
      discountPercentage,
      discountAmount,
      discountAmountLabel: this.formatCurrencyLabel(discountAmount, packageObject?.discount_amount_label ?? packageObject?.upgrade_discount_amount_label ?? packageObject?.diskon_nominal_label),
      upgradePrice,
      upgradePriceLabel: this.formatCurrencyLabel(upgradePrice, packageObject?.upgrade_price_label ?? packageObject?.upgrade_amount_label ?? packageObject?.payment_amount_label ?? packageObject?.amount_due_label ?? packageObject?.total_payment_label ?? packageObject?.total_bayar_label ?? packageObject?.final_price_label ?? packageObject?.payable_amount_label),
    };
  }

  private formatCurrencyLabel(value: unknown, fallback?: unknown): string {
    const fallbackText = String(fallback ?? '').trim();
    if (fallbackText) return fallbackText;
    if (value === null || value === undefined || value === '') return '';

    const numeric = Number(String(value).replace(/[^\d.-]/g, ''));
    if (!Number.isFinite(numeric)) return String(value || '').trim();

    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  private formatPercentLabel(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.includes('%')) return text;
    const numeric = Number(text);
    return Number.isFinite(numeric) ? `${numeric}%` : text;
  }

  private hasValidBackendThemeConnection(theme: ThemeCard | null | undefined): boolean {
    if (!theme || theme.isLegacy || !theme.isConnectedToBackend) {
      return false;
    }

    if (!Number.isInteger(theme.backendThemeId) || (theme.backendThemeId ?? 0) <= 0) {
      return false;
    }

    return !!getThemePresetBySlug(normalizeThemeSlug(theme.slug));
  }

  private resolveRequiredPackageTier(theme: ThemeCard): PaidPackageTier {
    if (theme.requiredPackageTier) {
      return theme.requiredPackageTier;
    }

    return getLowestPackageTierForTheme(theme.slug, this.themeAccessMap);
  }

  private resolveMinimumRequiredTier(
    themeTier: PaidPackageTier,
    candidateTier: PaidPackageTier
  ): PaidPackageTier {
    const order: PaidPackageTier[] = ['ruby', 'sapphire', 'diamond'];
    const themeIndex = order.indexOf(themeTier);
    const candidateIndex = order.indexOf(candidateTier);
    return order[Math.max(themeIndex, candidateIndex, 0)];
  }

  private resolveUserPackageTier(profileData: any): ThemePackageTier {
    const candidates = [
      profileData?.package_info,
      profileData?.invitation_package,
      profileData?.paket,
      profileData?.paket_undangan,
      profileData,
    ];

    for (const candidate of candidates) {
      const tier = resolvePackageTier(candidate);
      if (tier) return tier;
    }

    return 'trial';
  }

  private resolveAccountActive(profileData: any): boolean {
    const explicitPayment = this.firstDefined([
      profileData?.is_payment_confirmed,
      profileData?.payment_confirmed,
      profileData?.is_paid,
      profileData?.package_info?.is_payment_confirmed,
      profileData?.package_info?.payment_confirmed,
      profileData?.package_info?.is_paid,
      profileData?.invitation_package?.is_payment_confirmed,
      profileData?.invitation_package?.payment_confirmed,
      profileData?.invitation_package?.is_paid,
    ]);

    if (explicitPayment !== undefined) {
      return this.toBoolean(explicitPayment);
    }

    const statusValues = [
      profileData?.account_status,
      profileData?.payment_status,
      profileData?.status_bayar,
      profileData?.status_pembayaran,
      profileData?.paket_status,
      profileData?.status_tagihan,
      profileData?.package_info?.account_status,
      profileData?.package_info?.payment_status,
      profileData?.package_info?.status_bayar,
      profileData?.package_info?.status_pembayaran,
      profileData?.invitation_package?.account_status,
      profileData?.invitation_package?.payment_status,
      profileData?.invitation_package?.status,
      profileData?.invitation_package?.status_bayar,
    ]
      .map((value) => String(value ?? '').toLowerCase().trim())
      .filter(Boolean);

    const inactiveStatuses = [
      'pending_payment',
      'pending',
      'belum selesai',
      'menunggu pembayaran',
      'unpaid',
      'expired',
      'kedaluwarsa',
    ];

    const activeStatuses = [
      'active',
      'aktif',
      'paid',
      'settlement',
      'settled',
      'confirmed',
      'success',
      'sukses',
      'selesai',
    ];

    if (statusValues.some((status) => inactiveStatuses.includes(status))) {
      return false;
    }

    if (statusValues.some((status) => activeStatuses.includes(status))) {
      return true;
    }

    return true;
  }

  private resolveAdminThemeActive(theme: PublicTheme, category: any): boolean {
    const inactiveFlag = this.firstDefined([
      (theme as any)?.inactive_by_admin,
      (theme as any)?.inactiveByAdmin,
    ]);

    if (inactiveFlag !== undefined) {
      return !this.toBoolean(inactiveFlag);
    }

    const activeFlag = this.firstDefined([
      (theme as any)?.admin_is_active,
      (theme as any)?.adminIsActive,
      (theme as any)?.is_active,
      (theme as any)?.status,
      category?.is_active,
      category?.status,
    ]);

    if (activeFlag === undefined) {
      return true;
    }

    const normalized = String(activeFlag).toLowerCase().trim();
    if (['inactive', 'nonaktif', 'disabled', 'false', '0'].includes(normalized)) {
      return false;
    }

    if (['active', 'aktif', 'enabled', 'true', '1'].includes(normalized)) {
      return true;
    }

    return this.toBoolean(activeFlag);
  }

  private firstDefined(values: unknown[]): unknown {
    return values.find((value) => value !== undefined && value !== null && value !== '');
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1' || String(value ?? '').toLowerCase() === 'true';
  }

  private resolveThemeErrorCode(error: any): string {
    return String(
      error?.error?.code ||
      error?.error?.error_code ||
      error?.error?.status_code ||
      error?.error?.type ||
      ''
    ).trim().toUpperCase();
  }

  private selectTheme(theme: ThemeCard): void {
    if (theme.isLoading || this.processingPrimaryAction) {
      return;
    }

    if (this.isCurrentTheme(theme)) {
      this.toastService.showToast('Tema ini sudah sedang digunakan.', 'info');
      this.closeSelectConfirmationModal();
      return;
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      this.toastService.showToast('Theme belum terhubung dengan data backend.', 'error');
      return;
    }

    this.processingPrimaryAction = true;
    theme.isLoading = true;

    const request: ThemeSelectionRequest = {
      theme_id: theme.backendThemeId as number
    };

    const selectionSubscription = this.themeService.selectTheme(request).pipe(
      finalize(() => {
        theme.isLoading = false;
        this.processingPrimaryAction = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        // console.log('[SelectTheme] Response:', response);

        if (response.status) {
          // console.log('[SelectTheme] Sukses:', {
          //   theme_id: theme.backendThemeId,
          //   theme_name: theme.name,
          //   theme_slug: theme.slug,
          // });

          this.closeSelectConfirmationModal();
          this.showThemeFeedback('success', 'Tema berhasil digunakan');
          this.showThemeSuccess('Tema berhasil digunakan');

          // --- Optimistic update state di cards ---
          this.currentThemeId = theme.backendThemeId;
          this.selectedThemeId = theme.backendThemeId;
          this.selectedThemeSlug = theme.slug;
          this.selectedThemeForSubmit = theme;
          this.updateCurrentThemeStatus();
          this.loadAccessibleThemes();

          // --- Background refetch untuk sinkronisasi data dari server ---
          const refreshSub = this.themeService.getSelectedTheme().subscribe({
            next: (selectedResponse: UserSelectedThemeResponse) => {
              // console.log('[SelectTheme] Refetch selected theme:', selectedResponse);
              if (selectedResponse.status && selectedResponse.data?.theme) {
                this.applySelectedThemeResponse(selectedResponse);
                const t = selectedResponse.data.theme as any;
                // console.log('[SelectTheme] Slug setelah refresh:', t?.slug ?? 'TIDAK ADA');
              }
            },
            error: (err) => {
              console.warn('[SelectTheme] Refetch selected theme gagal (diabaikan):', err);
            }
          });

          this.subscriptions.add(refreshSub);
        } else {
          console.warn('[SelectTheme] Response status false:', response);
          const message = (response as any)?.message || 'Gagal menggunakan theme';
          this.closeSelectConfirmationModal();
          this.showThemeFeedback('error', message);
          this.toastService.showToast(message, 'error');
        }
      },
      error: (error) => {
        // console.error('[SelectTheme] HTTP error:', error);
        if (error?.status === 403) {
          this.closeSelectConfirmationModal();
          const errorCode = this.resolveThemeErrorCode(error);
          const message = getFriendlyErrorMessage(error);

          if (errorCode === 'PAYMENT_NOT_CONFIRMED') {
            const paymentMessage = getFriendlyErrorMessage(error);
            this.showThemeFeedback('error', paymentMessage);
            this.toastService.showToast(paymentMessage, 'info');
            return;
          }

          if (errorCode === 'THEME_UPGRADE_REQUIRED' || errorCode === 'PACKAGE_UPGRADE_REQUIRED') {
            this.applyUpgradeRequirementFromError(theme, error);
            this.showUpgradeModal = true;
            this.toastService.showToast(message, 'info');
            return;
          }

          if (errorCode === 'THEME_INACTIVE') {
            const inactiveMessage = getFriendlyErrorMessage(error);
            this.showThemeFeedback('error', inactiveMessage);
            this.toastService.showToast(inactiveMessage, 'info');
            return;
          }

          this.showThemeFeedback('error', message);
          this.toastService.showToast(message, 'error');
          return;
        }

        const message = getFriendlyErrorMessage(error);

        this.closeSelectConfirmationModal();
        this.showThemeFeedback('error', message);
        this.toastService.showToast(message, 'error');
      }
    });

    this.subscriptions.add(selectionSubscription);
  }

  private showThemeFeedback(type: 'success' | 'error', message: string): void {
    this.themeFeedbackType = type;
    this.themeFeedbackMessage = message;
    this.showThemeFeedbackModal = true;
    this.cdr.detectChanges();
  }

  private handleUpgradeReturnMessage(): void {
    const querySub = this.route.queryParams.subscribe((params) => {
      if (String(params?.['upgradeSuccess'] || '') !== '1') return;

      const packageLabel = this.getPackageLabel(String(params?.['package'] || '').toLowerCase());
      const themeName = this.humanizeThemeSlug(params?.['theme'] || '');
      this.toastService.showToast(`${packageLabel} berhasil diaktifkan. Tema ${themeName} sekarang dapat digunakan.`, 'success');

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    });

    this.subscriptions.add(querySub);
  }

  private humanizeThemeSlug(value: string): string {
    return String(value || 'tema')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private applyUpgradeRequirementFromError(theme: ThemeCard, error: any): void {
    const errorData = error?.error?.data || error?.error || {};
    const requiredPackageRaw =
      errorData?.required_package ||
      errorData?.package_required ||
      errorData?.target_package ||
      errorData?.package ||
      theme.targetPackage ||
      theme.requiredPackageTier;
    const targetPackage = this.normalizeTargetPackage(requiredPackageRaw) || theme.requiredPackageTier || 'ruby';

    theme.requiredPackageTier = targetPackage;
    theme.targetPackage = targetPackage;
    theme.targetPackageLabel = this.resolveTargetPackageLabel(requiredPackageRaw, targetPackage);
    theme.targetPackagePrice = this.resolveTargetPackagePrice(requiredPackageRaw, targetPackage);
    theme.lockReason = String(errorData?.lock_reason || errorData?.message || '').trim();
    theme.availabilityMessage = theme.lockReason || `Tersedia mulai Paket ${theme.targetPackageLabel}`;
    theme.upgradeRequired = true;
    theme.canUse = false;
    theme.lockedFromApi = true;

    this.pendingThemeForConfirmation = null;
    this.pendingThemeForUpgrade = theme;
    this.selectedThemeForSubmit = theme;
  }

  private showThemeSuccess(message = 'Theme berhasil digunakan'): void {
    this.themeSuccessMessage = message;
    this.showThemeSuccessToast = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.showThemeSuccessToast = false;
      this.cdr.detectChanges();
    }, 3000);
  }

  private handleError(message: string): void {
    this.errorMessage = message;
    this.toastService.showToast(message, 'error');
  }

  private syncSelectedThemeForVisibleTab(): void {
    const visibleThemes = this.visibleThemeCards;
    if (!visibleThemes.length) {
      this.selectedThemeId = null;
      this.selectedThemeSlug = '';
      this.selectedThemeForSubmit = null;
      return;
    }

    const selectedVisibleTheme = visibleThemes.find((theme) => theme.id === this.selectedThemeId);
    if (!selectedVisibleTheme) {
      this.selectedThemeId = null;
      this.selectedThemeSlug = '';
      this.selectedThemeForSubmit = null;
      this.pendingThemeForConfirmation = null;
      return;
    }

    this.selectedThemeSlug = selectedVisibleTheme.slug;
    this.selectedThemeForSubmit = selectedVisibleTheme;
  }

  private logThemeSubmitState(): void {
    // console.log('[ThemeSubmitState]', {
    //   selectedThemeForSubmit: this.selectedThemeForSubmit,
    //   pendingThemeForConfirmation: this.pendingThemeForConfirmation,
    //   selectedTheme: this.selectedTheme,
    //   canSubmitSelectedTheme: this.canSubmitSelectedTheme
    // });
  }

  private getThemeFallbackImage(name: string, category: ThemeCategoryName): string {
    const themeName = String(name || '').toLowerCase();
    if (themeName.includes('modern')) return 'assets/themas2.png';
    if (themeName.includes('blue')) return 'assets/themas4.png';
    if (themeName.includes('pinky')) return 'assets/themas1.png';
    if (themeName.includes('minimalist') || themeName.includes('ivory')) return 'assets/themas3.png';
    if (themeName.includes('lavender')) return 'assets/landing/template-1.png';
    if (themeName.includes('garden')) return 'assets/landing/template-6.png';
    if (themeName.includes('champagne')) return 'assets/landing/template-5.png';
    if (themeName.includes('velvet')) return 'assets/landing/template-3.png';

    switch (category) {
      case 'Minimalis':
        return 'assets/themas3.png';
      case 'Floral':
        return 'assets/landing/template-1.png';
      case 'Elegant':
        return 'assets/landing/template-5.png';
      case 'Luxury':
        return 'assets/landing/template-3.png';
      default:
        return 'assets/themas2.png';
    }
  }
}
