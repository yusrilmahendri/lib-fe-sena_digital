import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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

type PaidPackageTier = PaidThemePackageTier;

/** Tab/filter selection: a specific tier, or "all" (Semua) for every accessible tier. */
type ThemeFilterTier = 'all' | PaidPackageTier;

interface ThemeCard {
  id: number;
  backendThemeId: number | null;
  label: string;
  title: string;
  name: string;
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
  readonly upgradeRoute = '/dashboard/bill';

  themeCards: ThemeCard[] = [];
  isLoading = false;
  errorMessage = '';
  currentThemeId: number | null = null;
  currentActiveThemeSlug: string | null = null;
  selectedThemeId: number | null = null;
  currentPreviewTheme: ThemeCard | null = null;
  userPackageTier: ThemePackageTier = 'trial';
  activeTab: ThemeFilterTier = 'ruby';
  showSelectConfirmationModal = false;
  showUpgradeModal = false;
  processingPrimaryAction = false;
  showThemeSuccessToast = false;
  themeSuccessMessage = 'Theme berhasil digunakan';
  showThemeFeedbackModal = false;
  themeFeedbackType: 'success' | 'error' = 'success';
  themeFeedbackMessage = '';

  private subscriptions = new Subscription();
  private themeAccessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP;
  private pendingThemeForConfirmation: ThemeCard | null = null;
  private pendingThemeForUpgrade: ThemeCard | null = null;
  private readonly legacyTrialCards: ThemeCard[] = [
    { id: -1, backendThemeId: null, label: 'Scroll', title: 'Modern', name: 'Modern', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial' },
    { id: -2, backendThemeId: null, label: 'Slide', title: 'Blue', name: 'Blue', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial' },
    { id: -3, backendThemeId: null, label: 'Mobile', title: 'Minimalist', name: 'Minimalist', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial' },
    { id: -4, backendThemeId: null, label: 'Scroll', title: 'Pinky', name: 'Pinky', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial' },
    { id: -5, backendThemeId: null, label: 'Mobile', title: 'Elegant', name: 'Elegant', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true, isConnectedToBackend: false, availabilityMessage: 'Tema default trial' },
  ];

  constructor(
    private dashboardService: DashboardService,
    private themeService: ThemeService,
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
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
    if (this.userPackageTier === 'trial') {
      return this.themeCards;
    }

    return this.themeCards.filter(
      (theme) =>
        !theme.isLegacy &&
        theme.category !== 'Legacy' &&
        this.isThemeVisibleInTab(this.activeTab, theme)
    );
  }

  /**
   * Tabs are cumulative: a paid user can browse every tier at or below their own.
   * Ruby users see only "Ruby"; higher tiers also get a "Semua" (all) tab so they
   * can view every accessible tier at once (e.g. Sapphire → Semua/Ruby/Sapphire).
   */
  get availablePackageTabs(): PackageTab[] {
    if (this.userPackageTier === 'trial') {
      return [];
    }

    const orderedPaidTiers: PaidPackageTier[] = ['ruby', 'sapphire', 'diamond'];
    const accessibleTiers = orderedPaidTiers.filter((tier) =>
      isTierAllowed(this.userPackageTier, tier)
    );

    const tierTabs: PackageTab[] = accessibleTiers.map((tier) => ({
      tier,
      label: this.getPackageLabel(tier),
    }));

    if (tierTabs.length > 1) {
      return [{ tier: 'all', label: 'Semua' }, ...tierTabs];
    }

    return tierTabs;
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

    const themeTier = getThemeTierForSlug(theme.slug);
    if (!isTierAllowed(this.userPackageTier, themeTier)) {
      return false;
    }

    return tab === 'all' || themeTier === tab;
  }

  get currentTheme(): ThemeCard | null {
    return this.themeCards.find((theme) => theme.id === this.currentThemeId) ?? null;
  }

  get selectedTheme(): ThemeCard | null {
    if (this.currentPreviewTheme) {
      return this.currentPreviewTheme;
    }

    if (this.selectedThemeId === null) {
      return null;
    }

    return this.findThemeCardById(this.selectedThemeId);
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
    const theme = this.selectedTheme;
    return !!theme && !this.isCurrentActiveTheme(theme) && this.canUseTheme(theme);
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
    if (theme.is_active === false) return false;
    if (theme.category_is_active === false) return false;
    if (!this.hasValidBackendThemeConnection(theme)) return false;
    return this.canUseTheme(theme);
  }

  get hasThemeForConfirmation(): boolean {
    return !!(this.pendingThemeForConfirmation || this.selectedTheme);
  }

  get isPrimaryButtonDisabled(): boolean {
    const theme = this.selectedTheme;
    if (!theme) {
      return true;
    }

    return !this.canChooseTheme(theme);
  }

  get primaryButtonLabel(): string {
    const theme = this.selectedTheme;

    if (this.processingPrimaryAction) {
      return 'Memproses...';
    }

    if (!theme) {
      return 'Pilih Tema';
    }

    if (this.isCurrentActiveTheme(theme)) {
      return 'Tema Dipilih';
    }

    if (theme.isLegacy) {
      return 'Tema default trial';
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      return 'Tema belum terhubung';
    }

    if (theme.is_active === false) {
      return 'Tema belum aktif';
    }

    if (theme.category_is_active === false) {
      return 'Kategori belum aktif';
    }

    return this.canUseTheme(theme) ? 'Pilih Tema' : 'Upgrade Paket';
  }

  get confirmThemeButtonLabel(): string {
    return this.processingPrimaryAction ? 'Memproses...' : 'Konfirmasi';
  }

  get focusedThemeSubtitle(): string {
    const theme = this.selectedTheme;

    if (!theme) {
      return 'Pilih salah satu tema untuk melanjutkan.';
    }

    if (theme.isLegacy) {
      return 'Tema default trial';
    }

    return `${this.getPackageLabel(theme.requiredPackageTier || this.activeTab)} template`;
  }

  get upgradePackageLabel(): string {
    const theme = this.pendingThemeForUpgrade || this.selectedTheme;
    if (!theme || theme.isLegacy || theme.category === 'Legacy') {
      return 'Ruby';
    }

    return this.getPackageLabel(this.resolveRequiredPackageTier(theme));
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
        this.userPackageTier = resolvePackageTier(profile?.data?.package_info) || 'trial';
        this.activeTab = this.getInitialActiveTab();
        this.themeAccessMap = buildThemeAccessMap(Array.isArray(packages?.data) ? packages.data : []);

        if (this.userPackageTier === 'trial') {
          this.themeCards = this.legacyTrialCards.map((card) => ({ ...card }));
          this.syncSelectedThemeForVisibleTab();
          this.isLoading = false;
          return;
        }

        console.log('[ThemeCategories] Raw response /api/themes/categories:', themes);

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
        console.error('Error loading accessible themes:', error);
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
        console.log('[LoadSelectedTheme] Response:', response);

        if (response.status && response.data?.theme) {
          this.applySelectedThemeResponse(response);
        } else {
          console.warn('[LoadSelectedTheme] Tidak ada selected theme di response:', response);
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
    const resolvedThemeSlug = this.resolveThemeSlugFromSource(t);

    console.log('[LoadSelectedTheme] selected_theme dari backend:', {
      id: resolvedThemeId,
      slug: resolvedThemeSlug,
      name: t?.name,
    });

    this.currentThemeId = resolvedThemeId;
    this.currentActiveThemeSlug = resolvedThemeSlug || null;

    const activeCard = this.findThemeCardByActiveIdentity(resolvedThemeId, resolvedThemeSlug);
    const previewMatchesActive = !this.currentPreviewTheme
      || this.isCurrentActiveTheme(this.currentPreviewTheme);

    if (previewMatchesActive) {
      this.selectedThemeId = activeCard?.id ?? resolvedThemeId;
      this.currentPreviewTheme = activeCard;
    }

    this.updateCurrentThemeStatus();
    this.syncSelectedThemeForVisibleTab();
    this.cdr.markForCheck();
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

    console.log('[ThemeCards] Extracted backend themes:', Array.from(backendThemesBySlug.values()).map((entry) => ({
      id: entry.theme?.id,
      slug: entry.theme?.slug,
      name: entry.theme?.name,
      category_id: (entry.theme as any)?.category_id ?? entry.category?.id ?? null,
      category_name: (entry.theme as any)?.category?.name ?? entry.category?.name ?? null,
      is_active: entry.theme?.is_active,
      category_is_active: (entry.theme as any)?.category?.is_active ?? entry.category?.is_active,
    })));
    console.log('[ThemeCards] backendThemeMap keys:', Array.from(backendThemesBySlug.keys()));

    FIXED_THEME_PRESETS.forEach((preset) => {
      const matched = backendThemesBySlug.get(preset.slug);
      if (!matched) {
        console.warn('[ThemeCards] Preset frontend belum terhubung ke backend theme:', preset.slug);
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
          requiredPackageTier: getLowestPackageTierForTheme(preset.slug, this.themeAccessMap),
          is_active: false,
          category_is_active: false,
          isConnectedToBackend: false,
          availabilityMessage: 'Theme belum terhubung'
        });
        return;
      }

      const { theme, category } = matched;
      const resolvedThemeId = Number((theme as any)?.id) || null;
      const rawCategory = (theme as any)?.category || category;
      const resolvedCategoryId = Number((theme as any)?.category_id ?? rawCategory?.id) || 0;
      const isThemeActive = theme?.is_active === true;
      const isCategoryActive = rawCategory?.is_active == null ? true : rawCategory.is_active === true;
      const isConnectedToBackend = !!resolvedThemeId && !!preset.slug;
      const availabilityMessage = !isThemeActive
        ? 'Tema belum aktif'
        : !isCategoryActive
          ? 'Kategori belum aktif'
          : undefined;

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
        isCurrentTheme: false,
        isLoading: false,
        category_id: resolvedCategoryId,
        category: preset.category,
        requiredPackageTier: getLowestPackageTierForTheme(preset.slug, this.themeAccessMap),
        is_active: isThemeActive,
        category_is_active: isCategoryActive,
        isConnectedToBackend,
        availabilityMessage
      });
    });

    console.log('[ThemeCards] Built cards:', nextCards.map((card) => ({
      title: card.title,
      presetKey: card.slug,
      backendThemeId: card.backendThemeId,
      slug: card.slug,
      isActive: card.is_active,
      category: card.category,
      categoryIsActive: card.category_is_active,
      connected: card.isConnectedToBackend,
      message: card.availabilityMessage || null,
    })));

    this.themeCards = nextCards;
    this.updateCurrentThemeStatus();
  }

  /**
   * Update current theme status from backend
   */
  private updateCurrentThemeStatus(): void {
    this.themeCards.forEach((card) => {
      card.isCurrentTheme = this.isCurrentActiveTheme(card);
    });
  }

  /**
   * Get theme image from API response
   */
  private getThemeImage(theme: PublicTheme, category: ThemeCategoryName): string {
    const baseUrl = 'http://127.0.0.1:8000/storage/';

    if (theme.preview_image) {
      return theme.preview_image.startsWith('http') ? theme.preview_image : `${baseUrl}${theme.preview_image}`;
    }

    if (theme.thumbnail_image) {
      return theme.thumbnail_image.startsWith('http') ? theme.thumbnail_image : `${baseUrl}${theme.thumbnail_image}`;
    }

    if (theme.image) {
      return theme.image.startsWith('http') ? theme.image : `${baseUrl}${theme.image}`;
    }

    if (theme.preview && theme.preview.includes('http')) {
      return theme.preview;
    }

    return this.getThemeFallbackImage(theme.name, category);
  }

  setActiveTab(tab: ThemeFilterTier): void {
    this.activeTab = tab;
    this.syncSelectedThemeForVisibleTab();
  }

  /**
   * Initial tab after load: paid tiers with more than one accessible tier start
   * on "Semua" so every accessible theme is shown; Ruby (and trial) start on Ruby.
   */
  private getInitialActiveTab(): ThemeFilterTier {
    if (this.userPackageTier === 'trial' || this.userPackageTier === 'ruby') {
      return 'ruby';
    }
    return 'all';
  }

  onThemeCardClick(theme: ThemeCard): void {
    this.selectPreviewTheme(theme);
  }

  onPreviewClick(theme: ThemeCard, event: Event): void {
    event.stopPropagation();
    this.selectPreviewTheme(theme);

    const previewUrl = this.resolvePreviewUrl(theme);
    if (!previewUrl) {
      this.toastService.showToast('Preview tema belum tersedia.', 'info');
      return;
    }

    try {
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening preview:', error);
      this.toastService.showToast('Gagal membuka preview tema.', 'error');
    }
  }

  /**
   * Resolve the preview URL for a theme card.
   *
   * Priority:
   *   1. demo_url   — primary demo URL (may be the root domain; validated below)
   *   2. url_thema  — dedicated preview URL stored on the theme record
   *   3. slug       — derive path as /themes/{slug} relative to the frontend origin
   *
   * A URL that is exactly the root origin (e.g. "https://sena-digital.com") without
   * any further path is considered invalid and skipped.
   */
  private resolvePreviewUrl(theme: ThemeCard): string | null {
    const slug = theme.slug?.trim().toLowerCase();
    if (slug === 'soft-ivory') {
      return '/themes/soft-ivory';
    }

    const candidates = [
      theme.demo_url?.trim(),
      theme.url_thema?.trim(),
    ];

    for (const raw of candidates) {
      if (!raw) continue;
      const normalized = this.normalizePreviewUrl(raw);
      if (normalized && !this.isRootOnlyUrl(normalized)) {
        return normalized;
      }
    }

    const fallbackSlug = theme.slug?.trim();
    if (fallbackSlug) {
      return `/themes/${fallbackSlug}`;
    }

    return null;
  }

  private normalizePreviewUrl(url: string): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }
    return `${window.location.origin}/${url}`;
  }

  /** Returns true when the URL has no meaningful path beyond the origin root. */
  private isRootOnlyUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.pathname === '/' || parsed.pathname === '';
    } catch {
      return false;
    }
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  onPrimaryAction(): void {
    const theme = this.selectedTheme;

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

    if (this.isCurrentActiveTheme(theme)) {
      return;
    }

    // Use === false so that undefined/null/missing is_active never blocks a valid theme
    if (theme.is_active === false) {
      this.toastService.showToast('Tema ini belum aktif. Silakan hubungi admin.', 'info');
      return;
    }
    if (theme.category_is_active === false) {
      this.toastService.showToast('Kategori tema ini belum aktif. Silakan hubungi admin.', 'info');
      return;
    }

    if (!this.canUseTheme(theme)) {
      this.pendingThemeForUpgrade = theme;
      this.showUpgradeModal = true;
      this.showSelectConfirmationModal = false;
      return;
    }

    this.pendingThemeForConfirmation = theme;
    this.showSelectConfirmationModal = true;
    this.showUpgradeModal = false;

    console.log('[ThemeConfirmDebug]', {
      pendingThemeForConfirmation: this.pendingThemeForConfirmation,
      userPackageTier: this.userPackageTier,
      category: this.pendingThemeForConfirmation?.category,
      isActive: this.pendingThemeForConfirmation?.is_active,
      categoryIsActive: this.pendingThemeForConfirmation?.category_is_active,
      canUse: this.pendingThemeForConfirmation ? this.canUseTheme(this.pendingThemeForConfirmation) : false,
      canConfirm: this.canConfirmPendingTheme,
    });
  }

  confirmThemeSelection(): void {
    const theme = this.pendingThemeForConfirmation || this.selectedTheme;

    console.log('[ConfirmThemeClick]', theme);

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
  }

  closeThemeFeedbackModal(): void {
    this.showThemeFeedbackModal = false;
  }

  goToUpgradePackage(): void {
    this.closeUpgradeModal();
    this.router.navigate([this.upgradeRoute]);
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
    // Explicitly inactive themes are locked regardless of package tier
    if (theme.is_active === false || theme.category_is_active === false) {
      return true;
    }
    return !this.canUseTheme(theme);
  }

  isSelectedTheme(theme: ThemeCard): boolean {
    const previewTheme = this.currentPreviewTheme ?? this.selectedTheme;
    return !!previewTheme && this.themesShareIdentity(previewTheme, theme);
  }

  isCurrentActiveTheme(theme: ThemeCard | null | undefined): boolean {
    if (!theme) {
      return false;
    }

    const themeId = this.resolveThemeCardId(theme);
    const themeSlug = this.resolveThemeSlug(theme);

    if (this.currentThemeId && themeId) {
      return this.currentThemeId === themeId;
    }

    if (this.currentActiveThemeSlug && themeSlug) {
      return this.currentActiveThemeSlug === themeSlug;
    }

    return false;
  }

  canChooseTheme(theme: ThemeCard | null | undefined): boolean {
    if (!theme) {
      return false;
    }

    if (theme.isLoading || this.processingPrimaryAction) {
      return false;
    }

    if (this.isCurrentActiveTheme(theme)) {
      return false;
    }

    if (theme.isLegacy) {
      return false;
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      return false;
    }

    if (theme.is_active === false) {
      return false;
    }

    if (theme.category_is_active === false) {
      return false;
    }

    return true;
  }

  isCurrentTheme(theme: ThemeCard): boolean {
    return this.isCurrentActiveTheme(theme);
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

    if (!this.canUseTheme(theme)) {
      return 'Upgrade Paket';
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
    if (theme.is_active === false) return 'theme inactive';
    if (theme.category_is_active === false) return 'category inactive';
    if (!this.canUseTheme(theme)) {
      const userTier = ((this.userPackageTier as string) || '').toLowerCase().trim();
      return `package not allowed (tier=${userTier}, category=${theme.category})`;
    }
    return '';
  }

  onImageError(event: Event, theme: ThemeCard): void {
    const target = event.target as HTMLImageElement | null;
    if (target) {
      target.src = theme.imageFallback || 'assets/modern.svg';
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

    const userTier = ((this.userPackageTier as string) || '').toLowerCase().trim() as ThemePackageTier;
    if (userTier === 'trial') {
      return false;
    }

    // Cumulative access: a theme is usable when its tier is at/below the user's
    // tier (Sapphire may use Ruby themes; Diamond may use Ruby + Sapphire, etc.).
    const themeTier = getThemeTierForSlug(theme.slug);
    const allowed = isTierAllowed(userTier, themeTier);

    console.log('[ThemeAccessCumulative]', {
      userTier,
      themeSlug: theme.slug,
      themeTier,
      allowed,
    });

    return allowed;
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

  private selectTheme(theme: ThemeCard): void {
    if (theme.isLoading || this.processingPrimaryAction) {
      return;
    }

    if (this.isCurrentActiveTheme(theme)) {
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
        console.log('[SelectTheme] Response:', response);

        if (response.status) {
          console.log('[SelectTheme] Sukses:', {
            theme_id: theme.backendThemeId,
            theme_name: theme.name,
            theme_slug: theme.slug,
          });

          this.closeSelectConfirmationModal();
          this.showThemeFeedback('success', 'Theme berhasil digunakan');
          this.showThemeSuccess('Theme berhasil digunakan');

          // --- Optimistic update state di cards ---
          this.currentThemeId = theme.backendThemeId;
          this.currentActiveThemeSlug = this.resolveThemeSlug(theme) || null;
          this.selectedThemeId = theme.id;
          this.currentPreviewTheme = theme;
          this.updateCurrentThemeStatus();

          // --- Background refetch untuk sinkronisasi data dari server ---
          const refreshSub = this.themeService.getSelectedTheme().subscribe({
            next: (selectedResponse: UserSelectedThemeResponse) => {
              console.log('[SelectTheme] Refetch selected theme:', selectedResponse);
              if (selectedResponse.status && selectedResponse.data?.theme) {
                this.applySelectedThemeResponse(selectedResponse);
                const t = selectedResponse.data.theme as any;
                console.log('[SelectTheme] Slug setelah refresh:', t?.slug ?? 'TIDAK ADA');
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
        console.error('[SelectTheme] HTTP error:', error);
        const message =
          error?.error?.message ||
          error?.response?.message ||
          (error.status === 401
            ? 'Sesi telah habis. Silakan login kembali.'
            : error.status === 422
              ? 'Data tema tidak valid.'
              : error.status === 500
                ? 'Terjadi kesalahan server. Silakan coba beberapa saat lagi.'
                : 'Gagal menggunakan theme');

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
    if (this.currentPreviewTheme) {
      const previewStillExists = this.themeCards.some(
        (theme) => this.themesShareIdentity(theme, this.currentPreviewTheme)
      );

      if (previewStillExists) {
        return;
      }

      this.currentPreviewTheme = null;
    }

    const visibleThemes = this.visibleThemeCards;
    if (!visibleThemes.length) {
      this.selectedThemeId = null;
      return;
    }

    const selectedVisibleTheme = visibleThemes.find((theme) => theme.id === this.selectedThemeId);
    if (!selectedVisibleTheme) {
      this.selectedThemeId = null;
    }
  }

  private selectPreviewTheme(theme: ThemeCard): void {
    this.selectedThemeId = theme.id;
    this.currentPreviewTheme = theme;
    this.cdr.detectChanges();
  }

  private findThemeCardById(themeId: number | null): ThemeCard | null {
    if (themeId === null) {
      return null;
    }

    return this.themeCards.find((theme) => theme.id === themeId)
      ?? this.visibleThemeCards.find((theme) => theme.id === themeId)
      ?? null;
  }

  private findThemeCardByActiveIdentity(themeId: number | null, themeSlug: string): ThemeCard | null {
    if (themeId) {
      const byId = this.themeCards.find((theme) => this.resolveThemeCardId(theme) === themeId);
      if (byId) {
        return byId;
      }
    }

    if (themeSlug) {
      return this.themeCards.find((theme) => this.resolveThemeSlug(theme) === themeSlug) ?? null;
    }

    return null;
  }

  private resolveThemeCardId(theme: ThemeCard | null | undefined): number | null {
    if (!theme) {
      return null;
    }

    const backendThemeId = theme.backendThemeId;
    if (Number.isInteger(backendThemeId) && (backendThemeId as number) > 0) {
      return backendThemeId as number;
    }

    const cardId = theme.id;
    if (Number.isInteger(cardId) && cardId > 0) {
      return cardId;
    }

    return null;
  }

  private resolveThemeSlug(theme: ThemeCard | null | undefined): string {
    if (!theme?.slug) {
      return '';
    }

    return normalizeThemeSlug(theme.slug);
  }

  private resolveThemeSlugFromSource(source: { slug?: string; theme_slug?: string } | null | undefined): string {
    const rawSlug = source?.slug ?? source?.theme_slug ?? '';
    return rawSlug ? normalizeThemeSlug(rawSlug) : '';
  }

  private themesShareIdentity(
    left: ThemeCard | null | undefined,
    right: ThemeCard | null | undefined
  ): boolean {
    if (!left || !right) {
      return false;
    }

    const leftId = this.resolveThemeCardId(left);
    const rightId = this.resolveThemeCardId(right);
    if (leftId && rightId) {
      return leftId === rightId;
    }

    const leftSlug = this.resolveThemeSlug(left);
    const rightSlug = this.resolveThemeSlug(right);
    return !!leftSlug && !!rightSlug && leftSlug === rightSlug;
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
