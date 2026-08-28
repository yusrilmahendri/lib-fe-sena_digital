import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType, ThemeService, ThemeToggleRequest } from '../../dashboard.service';
import { CategoryUpdateRequest, WebsiteCategory } from '../../interfaces/admin-category.interfaces';
import { WebsiteCategoryService } from '../../services/website-category.service';
import {
  buildThemeAccessMap,
  FALLBACK_THEME_ACCESS_MAP,
  getThemePresetBySlug,
  PUBLIC_THEME_PRESETS,
  ThemeAccessMap,
  ThemeCategoryName,
} from '../../theme-package-access.util';

interface ThemePreset {
  key: string;
  adminSlug: string;
  name: string;
  category: ThemeCategoryName;
  fallbackImage: string;
}

interface AdminThemeCategory {
  id: number;
  name: string;
  type?: string;
  is_active?: boolean;
}

interface AdminTheme {
  id: number;
  slug: string;
  is_active?: boolean;
  nama_kategori?: string;
  category_id?: number;
  category?: AdminThemeCategory;
  [key: string]: any;
}

interface AdminThemeCard {
  key: string;
  id?: number | string | null;
  backendThemeId?: number | string | null;
  slug?: string | null;
  name: string;
  category: ThemePreset['category'];
  fallbackImage: string;
  displayOrder: number;
  categoryData: WebsiteCategory | null;
  adminThemeData: AdminTheme | null;
  image?: string | null;
  preview?: string | null;
  preview_image?: string | null;
  thumbnail_image?: string | null;
  image_url?: string | null;
  preview_url?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

interface AdminThemeConnectionDetail {
  masterThemeId: number | string | null;
  masterThemeSlug: string;
  categoryUserId: number | string | null;
  categoryUserSlug: string;
  packageRequired: string;
  isConnected: boolean;
}

type ThemeCategory = ThemePreset['category'];
type PackageTier = 'Ruby' | 'Sapphire' | 'Diamond';
type ThemePreviewFields = Pick<
  AdminThemeCard,
  'image' | 'preview' | 'preview_image' | 'thumbnail_image' | 'image_url' | 'preview_url' | 'updated_at'
> & { __preview_cache_buster?: string | number | null };

@Component({
  selector: 'wc-website',
  templateUrl: './website.component.html',
  styleUrls: ['./website.component.scss']
})
export class WebsiteComponent implements OnInit, OnDestroy {
  private readonly storageKey = 'admin-website-theme-order';
  private readonly themePlaceholderImage = 'assets/images/theme-placeholder.jpg';
  // Keep the public preset key stable, but allow admin master slugs to differ
  // when the backend uses the real theme slug (e.g. Champagne Rose).
  private readonly themePresets: ThemePreset[] = PUBLIC_THEME_PRESETS.map((preset) => ({
    key: preset.slug,
    adminSlug: preset.slug === 'diamond' ? 'champagne-rose' : preset.slug,
    name: preset.name,
    category: preset.category,
    fallbackImage: preset.fallbackImage,
  }));

  readonly filters: Array<'Semua' | ThemePreset['category']> = [
    'Semua',
    'Minimalis',
    'Floral',
    'Elegant',
    'Luxury'
  ];

  activeFilter: 'Semua' | ThemePreset['category'] = 'Semua';
  allData: WebsiteCategory[] = [];
  themeCards: AdminThemeCard[] = [];
  packageCategoryMap: Partial<Record<ThemeCategory, PackageTier[]>> = {};
  packageThemeMap: Partial<Record<string, PackageTier[]>> = {};
  adminThemesMap: Map<string, AdminTheme> = new Map();
  private themeAccessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP;
  loading = false;
  error: string | null = null;
  uploadingThemeKey: string | null = null;
  selectedThemeDetail: AdminThemeCard | null = null;
  previewTargetTheme: AdminThemeCard | null = null;

  private subscriptions: Subscription[] = [];
  private notyf: Notyf;

  constructor(
    private websiteCategoryService: WebsiteCategoryService,
    private dashboardService: DashboardService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });
  }

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.loadPackageAccessMapping();
    this.loadAdminThemes();
    this.getData();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get filteredThemes(): AdminThemeCard[] {
    if (this.activeFilter === 'Semua') {
      return this.themeCards;
    }

    return this.themeCards.filter((theme) => theme.category === this.activeFilter);
  }

  setFilter(filter: 'Semua' | ThemePreset['category']): void {
    this.activeFilter = filter;
  }

  getFilterLabel(filter: 'Semua' | ThemeCategory): string {
    if (filter === 'Semua') {
      return filter;
    }

    return `${filter} · ${this.formatPackageLabels(this.getCategoryPackageTiers(filter))}`;
  }

  getData(): void {
    this.websiteCategoryService.getCategories({ per_page: 100 }).subscribe({
      error: (error) => {
        console.error('Error loading website categories:', error);
      }
    });
  }

  loadAdminThemes(): void {
    this.dashboardService.list(DashboardServiceType.THEME_ADMIN_THEMES_LIST, { per_page: 100, page: 1 }).subscribe({
      next: (response: any) => {
        // Parse response - handle nested data structure
        let themes = response?.data?.data || response?.data || response || [];
        if (!Array.isArray(themes)) {
          themes = [];
        }

        this.adminThemesMap.clear();
        themes.forEach((theme: AdminTheme) => {
          const slug = this.normalizeSlug(this.resolveMasterThemeSlug(theme));
          if (slug) {
            this.adminThemesMap.set(slug, theme);
          }

          const legacySlug = this.normalizeSlug(theme.slug);
          if (legacySlug && legacySlug !== slug && !this.isPackageSlug(legacySlug)) {
            this.adminThemesMap.set(legacySlug, theme);
          }
        });

        // Debug logging
        console.log('Preset keys:', this.themePresets.map(p => p.key));
        console.log('Backend theme slugs:', themes.map((t: AdminTheme) => t.slug));
        console.log('Admin themes map keys:', Array.from(this.adminThemesMap.keys()));

        // Rebuild themeCards after adminThemesMap is updated
        this.themeCards = this.buildThemeCards(this.allData);

        // Update selectedThemeDetail if modal is open
        if (this.selectedThemeDetail) {
          const latest = this.themeCards.find(card => card.key === this.selectedThemeDetail?.key);
          this.selectedThemeDetail = latest || this.selectedThemeDetail;
        }

        // Debug built cards
        console.log('Built theme cards:', this.themeCards.map(card => ({
          key: card.key,
          name: card.name,
          adminSlug: card.adminThemeData?.slug,
          adminId: card.adminThemeData?.id,
          status: this.getThemeStatusLabel(card)
        })));

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading admin themes:', error);
      }
    });
  }

  toggleThemeStatus(theme: AdminThemeCard): void {
    const detail = this.getThemeConnectionDetail(theme);
    const adminId = Number(detail.masterThemeId);
    if (!adminId) {
      this.notyf.error('Data master tema tidak ditemukan. Tidak bisa mengubah status.');
      return;
    }

    const currentActive = theme.adminThemeData?.is_active ?? false;
    const newActive = !currentActive;
    const categoryPayload = this.buildWebsiteCategoryUpdatePayload(theme, {
      is_active: newActive,
      status: newActive,
    });

    if (theme.categoryData && !categoryPayload) {
      return;
    }

    const request: ThemeToggleRequest = { is_active: newActive };

    this.themeService.toggleThemeActivation(adminId, request).subscribe({
      next: (_result) => {
        const categoryId = theme.categoryData?.id;
        if (categoryId && categoryPayload) {
          this.websiteCategoryService.updateCategory(categoryId, categoryPayload).subscribe({
            next: () => this.handleThemeUpdateSuccess(`Status ${theme.name} berhasil diperbarui menjadi ${newActive ? 'Aktif' : 'Nonaktif'}`),
            error: (error) => {
              console.error('Error updating website category status:', error);
              this.notyf.error('Gagal mengubah status kategori tema');
            }
          });
          return;
        }

        this.handleThemeUpdateSuccess(`Status ${theme.name} berhasil diperbarui menjadi ${newActive ? 'Aktif' : 'Nonaktif'}`);
      },
      error: (error) => {
        console.error('Error toggling theme status:', error);
        this.notyf.error('Gagal mengubah status tema');
      }
    });
  }

  moveTheme(theme: AdminThemeCard, direction: 'up' | 'down'): void {
    const currentIndex = this.themeCards.findIndex((item) => item.key === theme.key);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= this.themeCards.length) {
      return;
    }

    const reordered = [...this.themeCards];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    this.themeCards = this.applyDisplayOrder(reordered);
    this.saveThemeOrder();

    const updatedTheme = this.themeCards.find((item) => item.key === theme.key);
    if (!updatedTheme?.categoryData?.id) {
      return;
    }

    const payload = this.buildWebsiteCategoryUpdatePayload(updatedTheme, {
      urutan: updatedTheme.displayOrder,
    });
    if (!payload) {
      return;
    }

    this.websiteCategoryService.updateCategory(updatedTheme.categoryData.id, payload).subscribe({
      next: () => this.handleThemeUpdateSuccess('Urutan tema berhasil diperbarui'),
      error: (error) => {
        console.error('Error updating theme order:', error);
        this.notyf.error('Gagal memperbarui urutan tema');
      }
    });
  }

  openPreviewModal(theme: AdminThemeCard): void {
    this.previewTargetTheme = theme;
    this.logPreviewTarget(theme);
  }

  onPreviewSelected(event: Event, theme: AdminThemeCard): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const targetTheme =
      this.previewTargetTheme && this.previewTargetTheme.key === theme.key
        ? this.previewTargetTheme
        : theme;

    this.previewTargetTheme = targetTheme;
    this.logPreviewTarget(targetTheme);

    if (!file) {
      return;
    }

    const themeId = this.resolvePreviewThemeId(targetTheme);
    if (!themeId) {
      this.notyf.error(this.getThemeDisabledReason(targetTheme) || 'ID master tema tidak ditemukan.');
      input.value = '';
      return;
    }

    this.uploadingThemeKey = targetTheme.key;

    this.themeService.updateThemePreview(themeId, file).subscribe({
      next: (response) => {
        if (response?.status === false) {
          this.notyf.error(response?.message || 'Gagal memperbarui gambar preview');
          this.resetPreviewUpload(input);
          return;
        }

        const patched = this.applyThemePreviewUpdate(targetTheme, response?.data ?? response, file);
        if (!patched) {
          this.notyf.error('Preview terunggah, tetapi kartu tema yang diklik tidak ditemukan.');
          this.resetPreviewUpload(input);
          this.loadAdminThemes();
          return;
        }

        this.notyf.success(response?.message || `Preview ${targetTheme.name} berhasil diperbarui.`);
        this.resetPreviewUpload(input);

        const updatedPreviewUrl = this.extractPreviewUrl(this.extractUpdatedTheme(response?.data ?? response));
        if (!updatedPreviewUrl) {
          this.loadAdminThemes();
        }
      },
      error: (error) => {
        console.error('Error updating theme preview:', error);
        this.notyf.error(this.resolveCategoryUpdateError(error));
        this.resetPreviewUpload(input);
      }
    });
  }

  openThemeDetail(theme: AdminThemeCard): void {
    const latest = this.themeCards.find(card => card.key === theme.key);
    this.selectedThemeDetail = latest || theme;
  }

  closeThemeDetail(): void {
    this.selectedThemeDetail = null;
  }

  getThemePreviewUrl(theme: AdminThemeCard | null | undefined): string {
    if (!theme) {
      return this.themePlaceholderImage;
    }

    const rawPreview =
      theme.preview_url ||
      theme.preview ||
      theme.preview_image ||
      theme.image_url ||
      theme.image ||
      theme.thumbnail_image ||
      theme.fallbackImage ||
      this.themePlaceholderImage;

    const absoluteUrl = this.toAbsoluteImageUrl(rawPreview) || this.themePlaceholderImage;
    return this.withCacheBuster(absoluteUrl, theme['__preview_cache_buster']);
  }

  getThemeImage(theme: any): string {
    return this.getThemePreviewUrl(theme);
  }

  getThemePreviewImage(item: any): string {
    return this.getThemePreviewUrl(item);
  }

  onThemeImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.includes('theme-placeholder')) {
      img.src = this.themePlaceholderImage;
    }
  }

  getThemeImageUrl(theme: AdminThemeCard): string {
    return this.getThemePreviewUrl(theme);
  }

  getThemeStatusLabel(theme: AdminThemeCard): string {
    const detail = this.getThemeConnectionDetail(theme);
    const adminActive = theme.adminThemeData?.is_active;

    if (!detail.isConnected) {
      return 'Belum Terhubung';
    }

    if (!theme.categoryData && !detail.categoryUserId && !detail.categoryUserSlug) {
      return 'Belum Terhubung';
    }

    if (adminActive === false) {
      return 'Nonaktif';
    }

    // Only show "Kategori Nonaktif" when is_active is explicitly false.
    // undefined/null = unknown → treat as active to avoid false negatives.
    if (theme.categoryData?.is_active === false) {
      return 'Kategori Nonaktif';
    }

    return 'Aktif';
  }

  getThemeDisabledReason(theme: AdminThemeCard): string {
    if (!this.getThemeConnectionDetail(theme).masterThemeId) {
      return 'Data master tema tidak ditemukan.';
    }
    return '';
  }

  canActivateTheme(theme: AdminThemeCard): boolean {
    const detail = this.getThemeConnectionDetail(theme);
    return detail.isConnected && !!detail.masterThemeId;
  }

  getThemeConnectionDetail(theme: AdminThemeCard): AdminThemeConnectionDetail {
    const item: any = theme.adminThemeData || {};
    const category: any = item?.category || {};
    const categoryData = theme.categoryData || null;
    const masterThemeId = this.firstPresent([
      item?.master_theme_id,
      item?.masterThemeId,
      item?.jenis_thema_id,
      item?.theme_id,
      item?.id,
    ]);
    const masterThemeSlug = this.resolveMasterThemeSlug(item, theme);
    const categoryUserId = this.firstPresent([
      item?.category_user_id,
      item?.categoryUserId,
      item?.category_thema_id,
      item?.category_id,
      category?.id,
      categoryData?.id,
    ]);
    const categoryUserSlug = String(this.firstPresent([
      item?.category_user_slug,
      item?.categoryUserSlug,
      item?.slug_kategori,
      category?.slug,
      categoryData?.slug,
      this.normalizeKey(category?.name || ''),
    ]) || '').trim();
    const packageRequired = this.resolvePackageRequired([
      item?.package_required,
      item?.packageRequired,
      item?.required_package,
      item?.target_package,
      item?.package,
      item?.nama_paket,
      this.getThemePackageBadge(theme),
    ]);
    const explicitConnected = this.firstPresent([
      item?.is_connected,
      item?.isConnected,
      item?.status_terhubung,
    ]);
    const isConnected = explicitConnected === null
      ? !!(masterThemeId || masterThemeSlug)
      : this.toBoolean(explicitConnected);

    return {
      masterThemeId,
      masterThemeSlug,
      categoryUserId,
      categoryUserSlug,
      packageRequired,
      isConnected,
    };
  }

  isThemeUploading(theme: AdminThemeCard): boolean {
    return this.uploadingThemeKey === theme.key;
  }

  getThemePackageBadge(theme: AdminThemeCard): string {
    return this.formatPackageLabels(this.getThemePackageTiers(theme));
  }

  formatDate(date: string | undefined): string {
    if (!date) {
      return '-';
    }

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(date));
  }

  trackByTheme(_: number, theme: AdminThemeCard): string {
    return theme.key;
  }

  private initializeSubscriptions(): void {
    this.subscriptions.push(
      this.websiteCategoryService.loading$.subscribe((loading) => {
        this.loading = loading;
      })
    );

    this.subscriptions.push(
      this.websiteCategoryService.error$.subscribe((error) => {
        this.error = error;
      })
    );

    this.subscriptions.push(
      this.websiteCategoryService.categories$.subscribe((categories) => {
        this.allData = categories;
        this.themeCards = this.buildThemeCards(categories);
        this.syncSelectedThemeDetail();
        this.cdr.detectChanges();
      })
    );
  }

  private loadWebsiteCategories(): void {
    this.getData();
  }

  private loadPackageAccessMapping(): void {
    this.dashboardService.list(DashboardServiceType.MNL_MD_PACK_INVITATION).subscribe({
      next: (res: any) => {
        const packages = Array.isArray(res?.data) ? res.data : [];
        this.themeAccessMap = buildThemeAccessMap(packages);
        this.packageThemeMap = this.buildPackageThemeMap(this.themeAccessMap);
        this.packageCategoryMap = this.buildPackageCategoryMap(this.packageThemeMap);
        this.cdr.detectChanges();
      },
      error: () => {
        this.themeAccessMap = FALLBACK_THEME_ACCESS_MAP;
        this.packageThemeMap = this.buildPackageThemeMap(this.themeAccessMap);
        this.packageCategoryMap = this.buildPackageCategoryMap(this.packageThemeMap);
      }
    });
  }

  private buildThemeCards(categories: WebsiteCategory[]): AdminThemeCard[] {
    const categoryById = this.buildCategoryById(categories);
    const linkedThemes = this.themePresets.map((preset, index) => {
      // Match by real backend theme slug. The UI key may be legacy (e.g. "diamond"),
      // while the master theme slug is "champagne-rose".
      const presetSlug = this.normalizeSlug(preset.adminSlug || preset.key);
      const legacyPresetSlug = this.normalizeSlug(preset.key);
      const adminThemeData =
        this.adminThemesMap.get(presetSlug) ??
        this.findAdminThemeByName(preset.name) ??
        this.adminThemesMap.get(legacyPresetSlug) ??
        null;
      const categoryData = this.resolveCategoryData(adminThemeData, categoryById);

      console.log(`[buildThemeCards] preset=${preset.key} slug=${presetSlug}`, {
        adminThemeId: adminThemeData?.id,
        adminSlug: adminThemeData?.slug,
        adminCategoryId: adminThemeData?.category_id,
        resolvedCategoryId: categoryData?.id,
        resolvedCategorySlug: categoryData?.slug,
      });

      const existingCard = this.themeCards.find((card) => card.key === preset.key);
      const previewFields = this.mergePreviewFields(
        this.pickPreviewFieldsFromSources(adminThemeData, categoryData),
        existingCard
      );

      return {
        key: preset.key,
        id: adminThemeData?.id ?? existingCard?.id ?? null,
        backendThemeId: adminThemeData?.id ?? existingCard?.backendThemeId ?? null,
        slug: this.normalizeSlug(adminThemeData?.slug) || preset.adminSlug,
        name: preset.name,
        category: preset.category,
        fallbackImage: preset.fallbackImage,
        displayOrder: index + 1,
        ...previewFields,
        categoryData,
        adminThemeData
      };
    });

    const savedOrder = this.getSavedThemeOrder();
    const orderedThemes = [...linkedThemes].sort((left, right) => {
      const leftIndex = savedOrder.indexOf(left.key);
      const rightIndex = savedOrder.indexOf(right.key);
      const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

      if (normalizedLeft === normalizedRight) {
        return this.themePresets.findIndex((preset) => preset.key === left.key)
          - this.themePresets.findIndex((preset) => preset.key === right.key);
      }

      return normalizedLeft - normalizedRight;
    });

    return this.applyDisplayOrder(orderedThemes);
  }

  private applyDisplayOrder(themes: AdminThemeCard[]): AdminThemeCard[] {
    return themes.map((theme, index) => ({
      ...theme,
      displayOrder: index + 1
    }));
  }

  private saveThemeOrder(): void {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(this.themeCards.map((theme) => theme.key))
    );
  }

  private getSavedThemeOrder(): string[] {
    const rawValue = localStorage.getItem(this.storageKey);
    if (!rawValue) {
      return this.themePresets.map((preset) => preset.key);
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      return Array.isArray(parsedValue) ? parsedValue : this.themePresets.map((preset) => preset.key);
    } catch {
      return this.themePresets.map((preset) => preset.key);
    }
  }

  private buildCategoryById(categories: WebsiteCategory[]): Map<number, WebsiteCategory> {
    const map = new Map<number, WebsiteCategory>();
    categories.forEach((category) => {
      if (category?.id) {
        map.set(category.id, category);
      }
    });
    return map;
  }

  private applyThemePreviewUpdate(
    targetTheme: AdminThemeCard,
    responseData: any,
    file?: File
  ): boolean {
    const updatedTheme = this.extractUpdatedTheme(responseData);
    const targetThemeId = this.resolvePreviewThemeId(targetTheme);
    const updatedThemeId = Number(updatedTheme?.id || updatedTheme?.backendThemeId || 0) || null;
    const rawPreviewUrl = this.extractPreviewUrl(updatedTheme);
    const cacheBuster = Date.now();
    const objectUrl = !rawPreviewUrl && file ? URL.createObjectURL(file) : '';
    const storedPreviewUrl = rawPreviewUrl || objectUrl;

    const idx = this.themeCards.findIndex((card) =>
      this.isSamePreviewTheme(card, targetTheme, targetThemeId, updatedThemeId)
    );

    if (idx < 0) {
      return false;
    }

    const current = this.themeCards[idx];
    const previewFields: ThemePreviewFields = {
      image: storedPreviewUrl || current.image,
      preview: storedPreviewUrl || current.preview,
      preview_image: storedPreviewUrl || current.preview_image,
      thumbnail_image: current.thumbnail_image,
      image_url: storedPreviewUrl || current.image_url,
      preview_url: storedPreviewUrl || current.preview_url,
      updated_at: updatedTheme?.updated_at || new Date().toISOString(),
      __preview_cache_buster: cacheBuster,
    };

    const nextCards = [...this.themeCards];
    nextCards[idx] = {
      ...current,
      ...previewFields,
      id: updatedThemeId || current.id,
      backendThemeId: updatedThemeId || current.backendThemeId,
      slug: this.normalizeSlug(updatedTheme?.slug) || current.slug,
      adminThemeData: current.adminThemeData
        ? {
            ...current.adminThemeData,
            ...previewFields,
            id: updatedThemeId || current.adminThemeData.id,
            slug: updatedTheme?.slug || current.adminThemeData.slug,
          }
        : current.adminThemeData,
    };
    this.themeCards = nextCards;

    if (current.adminThemeData) {
      const mapSlug = this.normalizeSlug(this.resolveMasterThemeSlug(current.adminThemeData, current));
      if (mapSlug) {
        this.adminThemesMap.set(mapSlug, {
          ...current.adminThemeData,
          ...previewFields,
          id: updatedThemeId || current.adminThemeData.id,
        });
      }
    }

    if (this.selectedThemeDetail && this.isSamePreviewTheme(this.selectedThemeDetail, targetTheme, targetThemeId, updatedThemeId)) {
      this.selectedThemeDetail = this.themeCards[idx];
    }

    this.cdr.detectChanges();
    return true;
  }

  private extractUpdatedTheme(responseData: any): any {
    if (!responseData || typeof responseData !== 'object') {
      return null;
    }

    return (
      responseData.theme ||
      responseData.jenis_thema ||
      responseData.admin_theme ||
      responseData.data ||
      responseData
    );
  }

  private extractPreviewUrl(source: any): string {
    if (!source || typeof source !== 'object') {
      return '';
    }

    const candidate = this.firstString([
      source.preview_url,
      source.preview,
      source.preview_image,
      source.image_url,
      source.image,
      source.thumbnail_image,
      source.url,
      source.path,
      source.file_url,
      source.preview_path,
    ]);

    return this.toAbsoluteImageUrl(candidate);
  }

  private isSamePreviewTheme(
    card: AdminThemeCard,
    targetTheme: AdminThemeCard,
    targetThemeId: number | null,
    updatedThemeId: number | null
  ): boolean {
    if (card.key && targetTheme.key && card.key === targetTheme.key) {
      return true;
    }

    const cardThemeId = this.resolvePreviewThemeId(card);
    if (targetThemeId && cardThemeId && cardThemeId === targetThemeId) {
      return true;
    }

    if (updatedThemeId && cardThemeId && cardThemeId === updatedThemeId) {
      return true;
    }

    return false;
  }

  private resolvePreviewThemeId(theme: AdminThemeCard | null | undefined): number | null {
    if (!theme) {
      return null;
    }

    const rawId = this.firstPresent([
      theme.backendThemeId,
      theme.id,
      this.getThemeConnectionDetail(theme).masterThemeId,
      theme.adminThemeData?.id,
    ]);
    const themeId = Number(rawId);
    return Number.isFinite(themeId) && themeId > 0 ? themeId : null;
  }

  private logPreviewTarget(theme: AdminThemeCard | null): void {
    console.log('[PreviewTarget]', {
      id: theme?.id,
      backendThemeId: theme?.backendThemeId,
      slug: theme?.slug || theme?.adminThemeData?.slug,
      name: theme?.name
    });
  }

  private resetPreviewUpload(input: HTMLInputElement): void {
    input.value = '';
    this.uploadingThemeKey = null;
    this.previewTargetTheme = null;
    this.cdr.detectChanges();
  }

  private toAbsoluteImageUrl(path: string | null | undefined): string {
    const raw = String(path || '').trim();
    if (!raw) {
      return '';
    }

    if (
      raw.startsWith('blob:') ||
      raw.startsWith('data:') ||
      raw.startsWith('assets/')
    ) {
      return raw;
    }

    const resolved = this.websiteCategoryService.getImageUrl(raw);
    if (resolved && resolved !== raw) {
      return resolved;
    }

    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
      return resolved || raw;
    }

    return this.websiteCategoryService.getImageUrl(
      raw.startsWith('storage/') ? raw : `storage/${raw}`
    ) || raw;
  }

  private withCacheBuster(url: string, buster?: string | number | null): string {
    if (!url || !buster) {
      return url;
    }

    if (
      url.startsWith('assets/') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      return url;
    }

    return `${url}${url.includes('?') ? '&' : '?'}v=${buster}`;
  }

  private hasPreviewValue(source: ThemePreviewFields | Record<string, any> | null | undefined): boolean {
    if (!source) {
      return false;
    }

    return !!(
      source.preview_url ||
      source.preview ||
      source.preview_image ||
      source.image_url ||
      source.image ||
      source.thumbnail_image
    );
  }

  private pickPreviewFields(source: any): ThemePreviewFields {
    return {
      image: source?.image,
      preview: source?.preview,
      preview_image: source?.preview_image,
      thumbnail_image: source?.thumbnail_image,
      image_url: source?.image_url,
      preview_url: source?.preview_url,
      updated_at: source?.updated_at || new Date().toISOString(),
      __preview_cache_buster: source?.['__preview_cache_buster'],
    };
  }

  private pickPreviewFieldsFromSources(
    adminThemeData: AdminTheme | null,
    categoryData: WebsiteCategory | null
  ): ThemePreviewFields {
    const fromTheme = this.pickPreviewFields(adminThemeData || {});
    if (this.hasPreviewValue(fromTheme)) {
      return fromTheme;
    }

    const categoryThemeId = Number(categoryData?.theme_id);
    const adminId = Number(adminThemeData?.id);
    const categoryBelongsToTheme =
      !!categoryThemeId &&
      !!adminId &&
      categoryThemeId === adminId;

    if (categoryBelongsToTheme && this.hasPreviewValue(categoryData)) {
      return this.pickPreviewFields(categoryData);
    }

    return fromTheme;
  }

  private mergePreviewFields(
    incoming: ThemePreviewFields,
    existing?: AdminThemeCard
  ): ThemePreviewFields {
    const hasIncoming = this.hasPreviewValue(incoming);
    const merged: ThemePreviewFields = hasIncoming
      ? { ...incoming }
      : {
          image: existing?.image,
          preview: existing?.preview,
          preview_image: existing?.preview_image,
          thumbnail_image: existing?.thumbnail_image,
          image_url: existing?.image_url,
          preview_url: existing?.preview_url,
          updated_at: incoming.updated_at || existing?.updated_at || new Date().toISOString(),
        };

    if (existing?.['__preview_cache_buster']) {
      merged['__preview_cache_buster'] = existing['__preview_cache_buster'];
    }

    return merged;
  }

  /**
   * Resolve categoryData for a theme card.
   *
   * Priority:
   * 1. Match by adminThemeData.category_id against /admin/website-categories (real record).
   * 2. Synthesize a WebsiteCategory-like object from the inline adminThemeData.category
   *    field that /api/admin/themes embeds, so UI is never empty when the category record
   *    exists in the backend but is simply missing from the local categories list.
   */
  private resolveCategoryData(
    adminThemeData: AdminTheme | null,
    categoryById: Map<number, WebsiteCategory>
  ): WebsiteCategory | null {
    if (!adminThemeData) {
      return null;
    }

    const categoryId =
      adminThemeData['category_user_id'] ??
      adminThemeData['category_thema_id'] ??
      adminThemeData.category_id ??
      adminThemeData.category?.id;

    if (categoryId) {
      const found = categoryById.get(categoryId);
      if (found) {
        return found;
      }
    }

    const inline: any = adminThemeData.category;
    if (inline?.id) {
      return {
        id: inline.id,
        nama_kategori: inline.name || '',
        slug: this.normalizeKey(inline.name || ''),
        image: inline.image || adminThemeData['image'] || '',
        preview_image: inline.preview_image || adminThemeData['preview_image'] || null,
        preview: inline.preview || adminThemeData['preview'] || null,
        thumbnail_image: inline.thumbnail_image || adminThemeData['thumbnail_image'] || null,
        image_url: inline.image_url || adminThemeData['image_url'] || null,
        preview_url: inline.preview_url || adminThemeData['preview_url'] || null,
        is_active: inline.is_active ?? true,
        created_at: inline.created_at || '',
        updated_at: inline.updated_at || adminThemeData['updated_at'] || '',
      } as WebsiteCategory;
    }

    return null;
  }

  private getThemePackageTiers(theme: AdminThemeCard): PackageTier[] {
    return this.packageThemeMap[this.normalizeKey(theme.key)] || [];
  }

  private getCategoryPackageTiers(category: ThemeCategory): PackageTier[] {
    return this.packageCategoryMap[category] || [];
  }

  private formatPackageLabels(packages: PackageTier[]): string {
    return packages.join(' & ');
  }

  private buildPackageThemeMap(
    accessMap: ThemeAccessMap
  ): Partial<Record<string, PackageTier[]>> {
    const map: Partial<Record<string, Set<PackageTier>>> = {};

    (['ruby', 'sapphire', 'diamond'] as const).forEach((tier) => {
      accessMap[tier].forEach((slug) => {
        map[slug] = map[slug] || new Set<PackageTier>();
        map[slug]?.add(this.toPackageLabel(tier));
      });
    });

    return this.convertSetMap(map);
  }

  private buildPackageCategoryMap(
    themeMap: Partial<Record<string, PackageTier[]>>
  ): Partial<Record<ThemeCategory, PackageTier[]>> {
    const map: Partial<Record<ThemeCategory, Set<PackageTier>>> = {};

    Object.entries(themeMap).forEach(([slug, packages]) => {
      const preset = getThemePresetBySlug(slug);
      if (!preset || !packages?.length) {
        return;
      }

      map[preset.category] = map[preset.category] || new Set<PackageTier>();
      packages.forEach((tier) => map[preset.category]?.add(tier));
    });

    return this.convertSetMap(map);
  }

  private convertSetMap(
    map: Partial<Record<string, Set<PackageTier>>>
  ): Partial<Record<string, PackageTier[]>> {
    const normalized: Partial<Record<string, PackageTier[]>> = {};

    Object.entries(map).forEach(([key, value]) => {
      if (!value?.size) {
        return;
      }

      normalized[key] = this.sortPackageTiers(Array.from(value));
    });

    return normalized;
  }

  private sortPackageTiers(tiers: PackageTier[]): PackageTier[] {
    const order: PackageTier[] = ['Ruby', 'Sapphire', 'Diamond'];
    return [...tiers].sort((left, right) => order.indexOf(left) - order.indexOf(right));
  }

  private toPackageLabel(tier: 'ruby' | 'sapphire' | 'diamond'): PackageTier {
    if (tier === 'ruby') return 'Ruby';
    if (tier === 'sapphire') return 'Sapphire';
    return 'Diamond';
  }

  private normalizeKey(value: string): string {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private syncSelectedThemeDetail(): void {
    if (!this.selectedThemeDetail) {
      return;
    }

    this.selectedThemeDetail = this.themeCards.find(
      (theme) => theme.key === this.selectedThemeDetail?.key
    ) ?? null;
  }

  private normalizeSlug(value: string | undefined | null): string {
    return (value || '').trim().toLowerCase();
  }

  private resolveMasterThemeSlug(item: any, theme?: AdminThemeCard): string {
    const hasBackendItem = !!item && Object.keys(item).length > 0;
    const candidates = [
      item?.master_theme_slug,
      item?.masterTheme?.slug,
      item?.theme?.slug,
      item?.masterThemeSlug,
      item?.slug_master,
      item?.slug,
      this.extractSlugFromUrl(item?.url_thema || item?.demo_url || item?.preview_url),
      hasBackendItem && theme ? this.findPresetAdminSlug(theme.key) : '',
    ];

    for (const candidate of candidates) {
      const slug = this.normalizeSlug(String(candidate || ''));
      if (slug && !this.isPackageSlug(slug)) {
        return slug;
      }
    }

    return '';
  }

  private findPresetAdminSlug(key: string): string {
    const preset = this.themePresets.find((item) => item.key === key || item.adminSlug === key);
    return preset?.adminSlug || '';
  }

  private findAdminThemeByName(name: string): AdminTheme | null {
    const targetName = this.normalizeKey(name);
    if (!targetName) {
      return null;
    }

    return Array.from(this.adminThemesMap.values()).find((theme) => {
      const themeName = this.normalizeKey(
        theme?.['name'] ||
        theme?.['nama'] ||
        theme?.['title'] ||
        theme?.['nama_tema'] ||
        ''
      );
      return themeName === targetName;
    }) || null;
  }

  private resolvePackageRequired(values: unknown[]): string {
    const rawValue = this.firstPresent(values);
    if (!rawValue) {
      return '';
    }

    if (typeof rawValue === 'object') {
      return this.resolvePackageRequired([
        (rawValue as any)?.package_required,
        (rawValue as any)?.package_code,
        (rawValue as any)?.code,
        (rawValue as any)?.name_paket,
        (rawValue as any)?.name,
        (rawValue as any)?.jenis_paket,
      ]);
    }

    const raw = String(rawValue).trim();
    const normalized = raw.toLowerCase();
    if (normalized === 'ruby') return 'Ruby';
    if (normalized === 'sapphire') return 'Sapphire';
    if (normalized === 'diamond') return 'Diamond';
    return raw;
  }

  private extractSlugFromUrl(value: string | undefined | null): string {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    const path = raw.split('?')[0].split('#')[0];
    const lastSegment = path.split('/').filter(Boolean).pop() || '';
    return this.normalizeSlug(lastSegment);
  }

  private isPackageSlug(value: string | undefined | null): boolean {
    return ['trial', 'ruby', 'sapphire', 'diamond'].includes(this.normalizeSlug(value));
  }

  private buildWebsiteCategoryUpdatePayload(
    theme: AdminThemeCard,
    overrides: Partial<CategoryUpdateRequest> = {}
  ): CategoryUpdateRequest | null {
    const payload: CategoryUpdateRequest = {};

    if (overrides.urutan !== undefined && overrides.urutan !== null && overrides.urutan !== '') {
      payload.urutan = overrides.urutan;
    }

    if (overrides.is_active !== undefined) {
      payload.is_active = overrides.is_active;
    }

    if (overrides.status !== undefined) {
      payload.status = overrides.status;
    }

    if (overrides.image) {
      payload.image = overrides.image;
    }

    if (overrides.preview_image) {
      payload.preview_image = overrides.preview_image;
    }

    if (!Object.keys(payload).length) {
      this.notyf.error(`Tidak ada perubahan untuk tema ${theme.name}.`);
      return null;
    }

    return payload;
  }

  private resolveCategoryUpdateError(error: any): string {
    if (error?.status === 422) {
      return error?.error || 'Beberapa data belum sesuai. Mohon periksa kembali input Anda.';
    }

    return error?.error || 'Gagal memperbarui gambar preview.';
  }

  private handleThemeUpdateSuccess(message: string): void {
    this.notyf.success(message);
    this.loadAdminThemes();
    this.getData();
  }

  private firstPresent(values: unknown[]): any {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }

    return null;
  }

  private firstString(values: unknown[]): string {
    const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof value === 'string' ? value.trim() : '';
  }

  private toBoolean(value: unknown): boolean {
    if (value === true || value === 1) return true;
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['true', '1', 'yes', 'ya', 'terhubung', 'connected'].includes(normalized);
  }
}
