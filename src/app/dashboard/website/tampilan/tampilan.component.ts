import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
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
  getLowestPackageTierForCategory,
  isCategoryAccessibleForTier,
  resolvePackageTier,
  resolveThemeCategory,
  ThemeCategoryName,
  ThemePackageTier,
} from '../../../theme-package-access.util';
import { normalizeThemeSlug } from '../../../theme-render.registry';

type PaidPackageTier = Exclude<ThemePackageTier, 'trial'>;

interface FixedThemePreset {
  slug: string;
  name: string;
  category: ThemeCategoryName;
  fallbackImage: string;
}

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
  tier: PaidPackageTier;
  label: string;
}

const PACKAGE_TABS: PackageTab[] = [
  { tier: 'ruby', label: 'Ruby' },
  { tier: 'sapphire', label: 'Sapphire' },
  { tier: 'diamond', label: 'Diamond' },
];

const FIXED_THEME_PRESETS: FixedThemePreset[] = [
  { slug: 'soft-ivory', name: 'Soft Ivory', category: 'Minimalis', fallbackImage: 'assets/themas3.png' },
  { slug: 'lavender-bloom', name: 'Lavender Bloom', category: 'Floral', fallbackImage: 'assets/landing/template-1.png' },
  { slug: 'garden-whisper', name: 'Garden Whisper', category: 'Floral', fallbackImage: 'assets/landing/template-6.png' },
  { slug: 'modern-vows', name: 'Modern Vows', category: 'Modern', fallbackImage: 'assets/themas2.png' },
  { slug: 'champagne-rose', name: 'Champagne Rose', category: 'Elegant', fallbackImage: 'assets/landing/template-5.png' },
  { slug: 'velvet-mauve', name: 'Velvet Mauve', category: 'Luxury', fallbackImage: 'assets/landing/template-3.png' },
];

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
  selectedThemeId: number | null = null;
  userPackageTier: ThemePackageTier = 'trial';
  activeTab: PaidPackageTier = 'ruby';
  showSelectConfirmationModal = false;
  showUpgradeModal = false;
  processingPrimaryAction = false;

  private subscriptions = new Subscription();
  private themeAccessMap = FALLBACK_THEME_ACCESS_MAP;
  private pendingThemeForConfirmation: ThemeCard | null = null;
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
    private router: Router
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
        this.isThemeCategoryVisible(this.activeTab, theme.category)
    );
  }

  private isThemeCategoryVisible(tier: PaidPackageTier, category: ThemeCategoryName | 'Legacy'): boolean {
    if (category === 'Legacy') return false;
    return (
      isCategoryAccessibleForTier(tier, category as ThemeCategoryName, this.themeAccessMap) ||
      isCategoryAccessibleForTier(tier, category as ThemeCategoryName, FALLBACK_THEME_ACCESS_MAP)
    );
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

    if (theme.isLoading || this.processingPrimaryAction) {
      return true;
    }

    if (this.isCurrentTheme(theme)) {
      return true;
    }

    if (theme.isLegacy) {
      return true;
    }

    if (!this.hasValidBackendThemeConnection(theme)) {
      return true;
    }

    if (theme.is_active === false) {
      return true;
    }

    if (theme.category_is_active === false) {
      return true;
    }

    return false;
  }

  get primaryButtonLabel(): string {
    const theme = this.selectedTheme;

    if (this.processingPrimaryAction) {
      return 'Memproses...';
    }

    if (!theme) {
      return 'Pilih tema';
    }

    if (this.isCurrentTheme(theme)) {
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

    return this.canUseTheme(theme) ? 'Pilih tema' : 'Upgrade Paket';
  }

  get confirmThemeButtonLabel(): string {
    return this.processingPrimaryAction ? 'Menyimpan...' : 'Konfirmasi';
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
    const theme = this.selectedTheme;
    if (!theme || theme.isLegacy || theme.category === 'Legacy') {
      return 'Ruby';
    }

    return this.getPackageLabel(
      theme.requiredPackageTier || getLowestPackageTierForCategory(theme.category, this.themeAccessMap)
    );
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
        this.activeTab = this.userPackageTier === 'trial' ? 'ruby' : this.userPackageTier;
        this.themeAccessMap = buildThemeAccessMap(Array.isArray(packages?.data) ? packages.data : []);

        if (this.userPackageTier === 'trial') {
          this.themeCards = this.legacyTrialCards.map((card) => ({ ...card }));
          this.syncSelectedThemeForVisibleTab();
          this.isLoading = false;
          return;
        }

        console.log('[ThemeCategories] Raw response /api/themes/categories:', themes);

        const extractedCategories = this.extractCategoriesFromThemesResponse(themes);
        if (themes?.status !== false && extractedCategories.length) {
          this.processThemeData(extractedCategories);
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
    const resolvedThemeSlug = t?.slug ?? t?.theme_slug ?? 'TIDAK ADA SLUG';

    console.log('[LoadSelectedTheme] selected_theme dari backend:', {
      id: resolvedThemeId,
      slug: resolvedThemeSlug,
      name: t?.name,
    });

    this.currentThemeId = resolvedThemeId;
    this.selectedThemeId = resolvedThemeId;
    this.updateCurrentThemeStatus();
    this.syncSelectedThemeForVisibleTab();
  }

  /**
   * Process theme data from API into display format
   */
  private extractCategoriesFromThemesResponse(response: PublicCategoriesResponse | any): PublicCategoryWithThemes[] {
    const data = response?.data;
    const candidates = [
      data?.categories,
      data?.data,
      data,
      response?.categories,
      response?.data?.items,
      response?.items,
    ];

    const rawCategories = candidates.find((entry) => Array.isArray(entry));
    if (!Array.isArray(rawCategories)) {
      console.warn('[ThemeCategories] Tidak menemukan array categories pada response:', response);
      return [];
    }

    return rawCategories
      .map((rawCategory: any) => {
        const extractedThemes = this.extractThemesFromCategory(rawCategory);
        return {
          ...rawCategory,
          jenis_themas: extractedThemes,
        } as PublicCategoryWithThemes;
      })
      .filter((category) => Array.isArray(category.jenis_themas) && category.jenis_themas.length > 0);
  }

  private extractThemesFromCategory(rawCategory: any): PublicTheme[] {
    if (!rawCategory) {
      return [];
    }

    const themeCandidates = [
      rawCategory?.jenis_themas,
      rawCategory?.themes,
      rawCategory?.theme,
      rawCategory?.data,
      rawCategory?.items,
    ];

    const rawThemes = themeCandidates.find((entry) => Array.isArray(entry));
    if (!Array.isArray(rawThemes)) {
      return [];
    }

    return rawThemes
      .map((theme: any) => ({
        ...theme,
        category: theme?.category || rawCategory,
        category_id: theme?.category_id ?? rawCategory?.id ?? null,
      }))
      .filter((theme: any) => {
        const normalizedSlug = normalizeThemeSlug(theme?.slug);
        return !!normalizedSlug;
      });
  }

  private processThemeData(categories: PublicCategoryWithThemes[]): void {
    const nextCards: ThemeCard[] = [];
    const backendThemesBySlug = new Map<string, { theme: PublicTheme; category: PublicCategoryWithThemes; resolvedCategory: ThemeCategoryName }>();

    categories.forEach((category) => {
      const categoryThemes = this.extractThemesFromCategory(category);
      const resolvedCategory = resolveThemeCategory(category?.name);
      if (!Array.isArray(categoryThemes) || categoryThemes.length === 0) {
        return;
      }

      categoryThemes.forEach((theme) => {
        const normalizedSlug = normalizeThemeSlug(theme?.slug);
        if (!normalizedSlug) {
          console.warn('[ThemeCards] Mengabaikan theme backend tanpa slug valid:', {
            id: theme?.id,
            name: theme?.name,
            slug: theme?.slug ?? null,
          });
          return;
        }

        if (!FIXED_THEME_PRESETS.some((preset) => preset.slug === normalizedSlug)) {
          console.log('[ThemeCards] Mengabaikan theme backend non-fixed:', {
            id: theme?.id,
            name: theme?.name,
            slug: normalizedSlug,
          });
          return;
        }

        const categoryNameSource = (theme as any)?.category?.name ?? category?.name;
        const normalizedCategory = resolveThemeCategory(categoryNameSource) || resolvedCategory;
        if (!normalizedCategory) {
          console.warn('[ThemeCards] Theme diabaikan karena kategori tidak dikenali:', {
            id: theme?.id,
            slug: normalizedSlug,
            categoryName: categoryNameSource,
          });
          return;
        }

        backendThemesBySlug.set(normalizedSlug, { theme, category, resolvedCategory: normalizedCategory });
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
          requiredPackageTier: getLowestPackageTierForCategory(preset.category, this.themeAccessMap),
          is_active: false,
          category_is_active: false,
          isConnectedToBackend: false,
          availabilityMessage: 'Theme belum terhubung'
        });
        return;
      }

      const { theme, category, resolvedCategory } = matched;
      const resolvedThemeId = Number((theme as any)?.id) || null;
      const resolvedThemeSlug = normalizeThemeSlug(theme?.slug);
      const rawCategory = (theme as any)?.category || category;
      const resolvedCategoryId = Number((theme as any)?.category_id ?? rawCategory?.id) || 0;
      const isThemeActive = theme?.is_active === true;
      const isCategoryActive = rawCategory?.is_active == null ? true : rawCategory.is_active === true;
      const isConnectedToBackend = !!resolvedThemeId && !!resolvedThemeSlug;
      const availabilityMessage = !isThemeActive
        ? 'Tema belum aktif'
        : !isCategoryActive
          ? 'Kategori belum aktif'
          : undefined;

      nextCards.push({
        id: resolvedThemeId || -100 - nextCards.length,
        backendThemeId: resolvedThemeId,
        label: resolvedCategory,
        title: theme.name || preset.name,
        name: theme.name || preset.name,
        slug: preset.slug,
        image: this.getThemeImage(theme, resolvedCategory),
        imageFallback: preset.fallbackImage,
        url_thema: theme.url_thema || '',
        demo_url: theme.demo_url || '',
        price: theme.price || 0,
        isCurrentTheme: false,
        isLoading: false,
        category_id: resolvedCategoryId,
        category: resolvedCategory,
        requiredPackageTier: getLowestPackageTierForCategory(resolvedCategory, this.themeAccessMap),
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
      card.isCurrentTheme = card.id === this.currentThemeId;
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

  setActiveTab(tab: PaidPackageTier): void {
    this.activeTab = tab;
    this.syncSelectedThemeForVisibleTab();
  }

  onThemeCardClick(theme: ThemeCard): void {
    this.selectedThemeId = theme.id;
  }

  onPreviewClick(theme: ThemeCard, event: Event): void {
    event.stopPropagation();
    this.selectedThemeId = theme.id;

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

    if (this.isCurrentTheme(theme)) {
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
    return this.selectedTheme?.id === theme.id;
  }

  isCurrentTheme(theme: ThemeCard): boolean {
    return this.currentThemeId === theme.id || theme.isCurrentTheme;
  }

  isThemeLoading(theme: ThemeCard): boolean {
    return theme.isLoading || false;
  }

  getPackageLabel(tier: PaidPackageTier | null | undefined): string {
    switch (tier) {
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
    if (userTier === 'trial' || this.isPreviewOnlyTab) {
      return false;
    }

    const tier = userTier as PaidPackageTier;
    return (
      isCategoryAccessibleForTier(tier, theme.category as ThemeCategoryName, this.themeAccessMap) ||
      isCategoryAccessibleForTier(tier, theme.category as ThemeCategoryName, FALLBACK_THEME_ACCESS_MAP)
    );
  }

  private hasValidBackendThemeConnection(theme: ThemeCard | null | undefined): boolean {
    if (!theme || theme.isLegacy || !theme.isConnectedToBackend) {
      return false;
    }

    if (!Number.isInteger(theme.backendThemeId) || (theme.backendThemeId ?? 0) <= 0) {
      return false;
    }

    const normalizedSlug = normalizeThemeSlug(theme.slug);
    return FIXED_THEME_PRESETS.some((preset) => preset.slug === normalizedSlug);
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

    const selectionSubscription = this.themeService.selectTheme(request).subscribe({
      next: (response) => {
        console.log('[SelectTheme] Response:', response);

        if (response.status) {
          console.log('[SelectTheme] Sukses. Theme yang dipilih:', {
            theme_id: theme.backendThemeId,
            theme_name: theme.name,
            theme_slug: theme.slug,
            response_data: response.data,
          });

          const refreshSelectedSubscription = this.themeService.getSelectedTheme().subscribe({
            next: (selectedResponse: UserSelectedThemeResponse) => {
              console.log('[SelectTheme] Refetch selected theme response:', selectedResponse);

              if (selectedResponse.status && selectedResponse.data?.theme) {
                this.applySelectedThemeResponse(selectedResponse);

                const refreshedTheme = selectedResponse.data.theme as any;
                const refreshedSlug = refreshedTheme?.slug ?? refreshedTheme?.theme_slug ?? null;
                console.log('[SelectTheme] Selected theme setelah refresh:', {
                  id: refreshedTheme?.id,
                  slug: refreshedSlug ?? 'TIDAK ADA SLUG',
                  name: refreshedTheme?.name,
                });

                if (theme.slug && refreshedSlug && refreshedSlug !== theme.slug) {
                  console.warn('[SelectTheme] Slug selected theme setelah refresh tidak sama dengan theme yang diklik:', {
                    clickedThemeSlug: theme.slug,
                    refreshedThemeSlug: refreshedSlug,
                  });
                }
              } else {
                console.warn('[SelectTheme] Refetch selected theme tidak berisi theme:', selectedResponse);
                this.loadSelectedTheme();
              }

              this.closeSelectConfirmationModal();
              this.toastService.showToast('Tema berhasil dipilih', 'success');
              theme.isLoading = false;
              this.processingPrimaryAction = false;
            },
            error: (selectedError) => {
              console.error('[SelectTheme] Gagal refresh selected theme setelah select:', selectedError);
              this.loadSelectedTheme();
              this.closeSelectConfirmationModal();
              this.toastService.showToast('Tema berhasil dipilih', 'success');
              theme.isLoading = false;
              this.processingPrimaryAction = false;
            }
          });

          this.subscriptions.add(refreshSelectedSubscription);
        } else {
          console.warn('[SelectTheme] Gagal. Response status false:', response);
          const message = response.message || 'Gagal memilih tema. Silakan coba lagi.';
          this.toastService.showToast(message, 'error');
          theme.isLoading = false;
          this.processingPrimaryAction = false;
        }
      },
      error: (error) => {
        console.error('[SelectTheme] Error:', error);
        console.log('[SelectTheme] Error response payload:', error?.error ?? error);
        let message = 'Gagal memilih tema. Silakan coba lagi.';

        if (error.status === 401) {
          message = 'Sesi telah habis. Silakan login kembali.';
        } else if (error.status === 403) {
          message = error.error?.message || 'Tema ini tidak tersedia untuk paket Anda.';
        } else if (error.status === 422) {
          message = error.error?.message || 'Data tema tidak valid.';
        } else if (error.status === 500) {
          message = 'Terjadi kesalahan server. Silakan coba beberapa saat lagi.';
        } else if (error?.error?.message) {
          message = error.error.message;
        }

        this.toastService.showToast(message, 'error');
        theme.isLoading = false;
        this.processingPrimaryAction = false;
      }
    });

    this.subscriptions.add(selectionSubscription);
  }

  private handleError(message: string): void {
    this.errorMessage = message;
    this.toastService.showToast(message, 'error');
  }

  private syncSelectedThemeForVisibleTab(): void {
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
      case 'Modern':
        return 'assets/themas2.png';
      case 'Elegant':
        return 'assets/landing/template-5.png';
      case 'Luxury':
        return 'assets/landing/template-3.png';
      default:
        return 'assets/themas2.png';
    }
  }
}
