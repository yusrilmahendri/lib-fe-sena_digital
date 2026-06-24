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

type PaidPackageTier = Exclude<ThemePackageTier, 'trial'>;

interface ThemeCard {
  id: number;
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
    { id: -1, label: 'Scroll', title: 'Modern', name: 'Modern', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true },
    { id: -2, label: 'Slide', title: 'Blue', name: 'Blue', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true },
    { id: -3, label: 'Mobile', title: 'Minimalist', name: 'Minimalist', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true },
    { id: -4, label: 'Scroll', title: 'Pinky', name: 'Pinky', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true },
    { id: -5, label: 'Mobile', title: 'Elegant', name: 'Elegant', slug: '', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', url_thema: '', demo_url: '', price: 0, isCurrentTheme: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true, requiredPackageTier: null, is_active: true, category_is_active: true },
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
   */
  get canConfirmPendingTheme(): boolean {
    const theme = this.pendingThemeForConfirmation;
    return !!theme && this.canUseTheme(theme);
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
      return 'Tema sudah digunakan';
    }

    if (theme.isLegacy) {
      return 'Tema default trial';
    }

    if (!theme.is_active) {
      return 'Tema belum aktif';
    }

    if (!theme.category_is_active) {
      return 'Kategori belum aktif';
    }

    return this.canUseTheme(theme) ? 'Pilih tema' : 'Upgrade Paket';
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

        if (themes.status && Array.isArray(themes.data?.categories)) {
          this.processThemeData(themes.data.categories);
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
        if (response.status && response.data?.theme) {
          this.currentThemeId = response.data.theme.id;
          this.updateCurrentThemeStatus();
          this.syncSelectedThemeForVisibleTab();
        }
      },
      error: (error) => {
        console.log('No selected theme or authentication required:', error);
      }
    });

    this.subscriptions.add(selectedSubscription);
  }

  /**
   * Process theme data from API into display format
   */
  private processThemeData(categories: PublicCategoryWithThemes[]): void {
    const nextCards: ThemeCard[] = [];

    categories.forEach((category) => {
      const resolvedCategory = resolveThemeCategory(category?.name);
      if (!resolvedCategory) {
        return;
      }

      if (!Array.isArray(category.jenis_themas) || category.jenis_themas.length === 0) {
        return;
      }

      category.jenis_themas.forEach((theme) => {
        nextCards.push({
          id: theme.id,
          label: resolvedCategory,
          title: theme.name,
          name: theme.name,
          slug: theme.slug || this.toSlug(theme.name),
          image: this.getThemeImage(theme, resolvedCategory),
          imageFallback: this.getThemeFallbackImage(theme.name, resolvedCategory),
          url_thema: theme.url_thema || '',
          demo_url: theme.demo_url || '',
          price: theme.price || 0,
          isCurrentTheme: false,
          isLoading: false,
          category_id: category.id,
          category: resolvedCategory,
          requiredPackageTier: getLowestPackageTierForCategory(resolvedCategory, this.themeAccessMap),
          // Default to true when the field is absent (undefined/null); convert integer 0/1 to boolean
          is_active: theme.is_active == null ? true : Boolean(theme.is_active),
          category_is_active: category.is_active == null ? true : Boolean(category.is_active)
        });
      });
    });

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
   *   1. url_thema  — dedicated preview/demo page URL stored on the theme record
   *   2. demo_url   — secondary demo URL (may be the root domain; validated below)
   *   3. slug       — derive path as /themes/{slug} relative to the frontend origin
   *
   * A URL that is exactly the root origin (e.g. "https://sena-digital.com") without
   * any further path is considered invalid and skipped.
   */
  private resolvePreviewUrl(theme: ThemeCard): string | null {
    const candidates = [
      theme.url_thema?.trim(),
      theme.demo_url?.trim(),
    ];

    for (const raw of candidates) {
      if (!raw) continue;
      const normalized = this.normalizePreviewUrl(raw);
      if (normalized && !this.isRootOnlyUrl(normalized)) {
        return normalized;
      }
    }

    const slug = theme.slug?.trim();
    if (slug) {
      return `${window.location.origin}/themes/${slug}`;
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

    // Diagnostic log — remove after confirming fix
    console.log('[TampilanDebug] onPrimaryAction', {
      selectedTheme: theme,
      userPackageTier: this.userPackageTier,
      activeTab: this.activeTab,
      isPreviewOnlyTab: this.isPreviewOnlyTab,
      category: theme?.category,
      is_active: theme?.is_active,
      category_is_active: theme?.category_is_active,
      dynamicAccess: this.themeAccessMap,
      fallbackAccess: FALLBACK_THEME_ACCESS_MAP,
      canUse: theme ? this.canUseTheme(theme) : null,
      debugReason: theme ? this.getThemeDebugReason(theme) : 'no theme selected',
    });

    if (!theme || theme.isLoading || this.processingPrimaryAction) {
      return;
    }

    if (theme.isLegacy) {
      this.toastService.showToast('Paket Trial menggunakan tema default/legacy.', 'info');
      return;
    }

    if (this.isCurrentTheme(theme)) {
      return;
    }

    // Check theme/category active status before package check
    if (!theme.is_active) {
      this.toastService.showToast('Tema ini belum aktif. Silakan hubungi admin.', 'info');
      return;
    }
    if (!theme.category_is_active) {
      this.toastService.showToast('Kategori tema ini belum aktif. Silakan hubungi admin.', 'info');
      return;
    }

    if (!this.canUseTheme(theme)) {
      this.showUpgradeModal = true;
      return;
    }

    this.pendingThemeForConfirmation = theme;
    this.showSelectConfirmationModal = true;
  }

  confirmThemeSelection(): void {
    if (!this.pendingThemeForConfirmation) {
      this.closeSelectConfirmationModal();
      return;
    }

    this.selectTheme(this.pendingThemeForConfirmation);
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
    if (!theme.is_active) return 'theme inactive';
    if (!theme.category_is_active) return 'category inactive';
    const userTier = ((this.userPackageTier as string) || '').toLowerCase().trim() as ThemePackageTier;
    if (userTier === 'trial' || this.isPreviewOnlyTab) return 'package not allowed (trial/preview-tab)';
    const tier = userTier as PaidPackageTier;
    const accessible =
      isCategoryAccessibleForTier(tier, theme.category as ThemeCategoryName, this.themeAccessMap) ||
      isCategoryAccessibleForTier(tier, theme.category as ThemeCategoryName, FALLBACK_THEME_ACCESS_MAP);
    if (!accessible) return `package not allowed (tier=${tier}, category=${theme.category})`;
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

  canUseTheme(theme: ThemeCard): boolean {
    if (theme.isLegacy || theme.category === 'Legacy') {
      return false;
    }

    // Theme or its category must be active (admin-side activation)
    if (!theme.is_active || !theme.category_is_active) {
      return false;
    }

    const userTier = ((this.userPackageTier as string) || '').toLowerCase().trim() as ThemePackageTier;
    if (userTier === 'trial' || this.isPreviewOnlyTab) {
      return false;
    }

    // Normalize tier to lowercase to avoid 'Ruby' vs 'ruby' mismatch
    const tier = userTier as PaidPackageTier;
    return (
      isCategoryAccessibleForTier(tier, theme.category as ThemeCategoryName, this.themeAccessMap) ||
      isCategoryAccessibleForTier(tier, theme.category as ThemeCategoryName, FALLBACK_THEME_ACCESS_MAP)
    );
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

    this.processingPrimaryAction = true;
    theme.isLoading = true;

    const request: ThemeSelectionRequest = {
      theme_id: theme.id
    };

    const selectionSubscription = this.themeService.selectTheme(request).subscribe({
      next: (response) => {
        if (response.status) {
          this.currentThemeId = theme.id;
          this.updateCurrentThemeStatus();
          this.selectedThemeId = theme.id;
          this.toastService.showToast(`Theme "${theme.name}" selected successfully!`, 'success');
        } else {
          this.toastService.showToast('Failed to select theme', 'error');
        }

        theme.isLoading = false;
        this.processingPrimaryAction = false;
        this.closeSelectConfirmationModal();
      },
      error: (error) => {
        console.error('Error selecting theme:', error);
        let message = 'Failed to select theme';

        if (error.status === 401) {
          message = 'Please log in to select a theme';
        } else if (error.status === 422) {
          message = 'Invalid theme selection';
        }

        this.toastService.showToast(message, 'error');
        theme.isLoading = false;
        this.processingPrimaryAction = false;
        this.closeSelectConfirmationModal();
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
