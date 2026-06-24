import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType, ThemeService, ThemeToggleRequest } from '../../dashboard.service';
import { WebsiteCategory } from '../../interfaces/admin-category.interfaces';
import { WebsiteCategoryService } from '../../services/website-category.service';

interface ThemePreset {
  key: string;
  name: string;
  category: 'Minimalis' | 'Floral' | 'Modern' | 'Elegant' | 'Luxury';
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
  name: string;
  category: ThemePreset['category'];
  fallbackImage: string;
  displayOrder: number;
  categoryData: WebsiteCategory | null;
  adminThemeData: AdminTheme | null;
}

type ThemeCategory = ThemePreset['category'];
type PackageTier = 'Ruby' | 'Sapphire' | 'Diamond';

interface PackageApiItem {
  id: number;
  package_tier?: string;
  name_paket?: string;
  name_paket_display?: string;
  jenis_paket?: string;
  accessible_categories?: any[];
}

@Component({
  selector: 'wc-website',
  templateUrl: './website.component.html',
  styleUrls: ['./website.component.scss']
})
export class WebsiteComponent implements OnInit, OnDestroy {
  private readonly storageKey = 'admin-website-theme-order';
  private readonly fallbackCategoryPackages: Record<ThemeCategory, PackageTier[]> = {
    Minimalis: ['Ruby'],
    Floral: ['Ruby'],
    Modern: ['Sapphire'],
    Elegant: ['Sapphire', 'Diamond'],
    Luxury: ['Diamond']
  };
  private readonly fallbackThemePackages: Record<string, PackageTier[]> = {
    'soft-ivory': ['Ruby'],
    'lavender-bloom': ['Ruby'],
    'garden-whisper': ['Ruby'],
    'modern-vows': ['Sapphire'],
    'champagne-rose': ['Sapphire', 'Diamond'],
    'velvet-mauve': ['Diamond']
  };
  // Slug aliases removed — preset keys match backend slugs exactly.
  // Each preset.key (e.g. 'soft-ivory') is looked up directly in adminThemesMap.
  private readonly themePresets: ThemePreset[] = [
    {
      key: 'soft-ivory',
      name: 'Soft Ivory',
      category: 'Minimalis',
      fallbackImage: 'assets/landing/template-2.png'
    },
    {
      key: 'lavender-bloom',
      name: 'Lavender Bloom',
      category: 'Floral',
      fallbackImage: 'assets/landing/template-1.png'
    },
    {
      key: 'garden-whisper',
      name: 'Garden Whisper',
      category: 'Floral',
      fallbackImage: 'assets/landing/template-6.png'
    },
    {
      key: 'modern-vows',
      name: 'Modern Vows',
      category: 'Modern',
      fallbackImage: 'assets/landing/template-4.png'
    },
    {
      key: 'champagne-rose',
      name: 'Champagne Rose',
      category: 'Elegant',
      fallbackImage: 'assets/landing/template-5.png'
    },
    {
      key: 'velvet-mauve',
      name: 'Velvet Mauve',
      category: 'Luxury',
      fallbackImage: 'assets/landing/template-3.png'
    }
  ];

  readonly filters: Array<'Semua' | ThemePreset['category']> = [
    'Semua',
    'Minimalis',
    'Floral',
    'Modern',
    'Elegant',
    'Luxury'
  ];

  activeFilter: 'Semua' | ThemePreset['category'] = 'Semua';
  allData: WebsiteCategory[] = [];
  themeCards: AdminThemeCard[] = [];
  packageCategoryMap: Partial<Record<ThemeCategory, PackageTier[]>> = {};
  packageThemeMap: Partial<Record<string, PackageTier[]>> = {};
  adminThemesMap: Map<string, AdminTheme> = new Map();
  loading = false;
  error: string | null = null;
  uploadingThemeKey: string | null = null;
  selectedThemeDetail: AdminThemeCard | null = null;

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
          const slug = this.normalizeSlug(theme.slug);
          if (slug) {
            this.adminThemesMap.set(slug, theme);
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
    const adminId = theme.adminThemeData?.id;
    if (!adminId) {
      this.notyf.error('Data master tema tidak ditemukan. Tidak bisa mengubah status.');
      return;
    }

    const currentActive = theme.adminThemeData?.is_active ?? false;
    const newActive = !currentActive;

    const request: ThemeToggleRequest = { is_active: newActive };

    this.themeService.toggleThemeActivation(adminId, request).subscribe({
      next: (_result) => {
        this.notyf.success(`Status ${theme.name} berhasil diperbarui menjadi ${newActive ? 'Aktif' : 'Nonaktif'}`);
        // Refresh both admin themes (updates adminThemesMap + rebuilds cards)
        // and website categories (updates allData + triggers subscription rebuild).
        this.loadAdminThemes();
        this.getData();
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
  }

  onPreviewSelected(event: Event, theme: AdminThemeCard): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    const categoryId = theme.categoryData?.id;

    if (!categoryId) {
      this.notyf.error(this.getThemeDisabledReason(theme) || 'Tema ini belum terhubung ke kategori user');
      target.value = '';
      return;
    }

    this.uploadingThemeKey = theme.key;

    this.websiteCategoryService.updateCategory(categoryId, { image: file }).subscribe({
      next: (result) => {
        if (result.success) {
          this.notyf.success(`Preview ${theme.name} berhasil diperbarui`);
          this.getData();
        } else {
          this.notyf.error(result.error || 'Gagal memperbarui gambar preview');
        }

        target.value = '';
        this.uploadingThemeKey = null;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error updating theme preview:', error);
        this.notyf.error(error.error || 'Gagal memperbarui gambar preview');
        target.value = '';
        this.uploadingThemeKey = null;
        this.cdr.detectChanges();
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

  getThemeImageUrl(theme: AdminThemeCard): string {
    if (theme.categoryData?.image) {
      return this.websiteCategoryService.getImageUrl(theme.categoryData.image);
    }

    return theme.fallbackImage;
  }

  getThemeStatusLabel(theme: AdminThemeCard): string {
    const adminActive = theme.adminThemeData?.is_active;

    if (!theme.adminThemeData) {
      return 'Belum Terhubung';
    }

    if (!theme.categoryData) {
      return 'Belum Terhubung ke User';
    }

    if (adminActive === false) {
      return 'Nonaktif';
    }

    // Only show "Kategori Nonaktif" when is_active is explicitly false.
    // undefined/null = unknown → treat as active to avoid false negatives.
    if (theme.categoryData.is_active === false) {
      return 'Kategori Nonaktif';
    }

    return 'Aktif';
  }

  getThemeDisabledReason(theme: AdminThemeCard): string {
    if (!theme.adminThemeData?.id) {
      return 'Data master tema tidak ditemukan.';
    }
    return '';
  }

  canActivateTheme(theme: AdminThemeCard): boolean {
    return !!theme.adminThemeData?.id;
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

  private loadPackageAccessMapping(): void {
    this.dashboardService.list(DashboardServiceType.MNL_MD_PACK_INVITATION).subscribe({
      next: (res: any) => {
        const packages = Array.isArray(res?.data) ? res.data : [];
        const categoryMap: Partial<Record<ThemeCategory, Set<PackageTier>>> = {};
        const themeMap: Partial<Record<string, Set<PackageTier>>> = {};

        packages.forEach((paket: PackageApiItem) => {
          const tier = this.resolvePackageTier(paket);
          if (!tier) {
            return;
          }

          const accessibleCategories = Array.isArray(paket?.accessible_categories)
            ? paket.accessible_categories
            : [];

          accessibleCategories.forEach((entry) => {
            const category = this.resolveThemeCategory(entry);
            if (category) {
              categoryMap[category] = categoryMap[category] || new Set<PackageTier>();
              categoryMap[category]?.add(tier);
            }

            const themeKey = this.resolveThemeKey(entry);
            if (themeKey) {
              themeMap[themeKey] = themeMap[themeKey] || new Set<PackageTier>();
              themeMap[themeKey]?.add(tier);
            }
          });
        });

        this.packageCategoryMap = this.convertSetMap(categoryMap);
        this.packageThemeMap = this.convertSetMap(themeMap);
        this.cdr.detectChanges();
      },
      error: () => {
        this.packageCategoryMap = {};
        this.packageThemeMap = {};
      }
    });
  }

  private buildThemeCards(categories: WebsiteCategory[]): AdminThemeCard[] {
    const categoryById = this.buildCategoryById(categories);
    const linkedThemes = this.themePresets.map((preset, index) => {
      // Match directly by slug — preset.key must equal adminTheme.slug exactly.
      const presetSlug = this.normalizeSlug(preset.key);
      const adminThemeData = this.adminThemesMap.get(presetSlug) ?? null;
      const categoryData = this.resolveCategoryData(adminThemeData, categoryById);

      console.log(`[buildThemeCards] preset=${preset.key} slug=${presetSlug}`, {
        adminThemeId: adminThemeData?.id,
        adminCategoryId: adminThemeData?.category_id,
        resolvedCategoryId: categoryData?.id,
        resolvedCategorySlug: categoryData?.slug,
      });

      return {
        key: preset.key,
        name: preset.name,
        category: preset.category,
        fallbackImage: preset.fallbackImage,
        displayOrder: index + 1,
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

    const categoryId = adminThemeData.category_id ?? adminThemeData.category?.id;

    if (categoryId) {
      const found = categoryById.get(categoryId);
      if (found) {
        return found;
      }
    }

    const inline = adminThemeData.category;
    if (inline?.id) {
      return {
        id: inline.id,
        nama_kategori: inline.name || '',
        slug: this.normalizeKey(inline.name || ''),
        image: '',
        is_active: inline.is_active ?? true,
        created_at: '',
        updated_at: '',
      } as WebsiteCategory;
    }

    return null;
  }

  private getThemePackageTiers(theme: AdminThemeCard): PackageTier[] {
    const stableKey = this.normalizeKey(theme.categoryData?.slug || theme.key);
    return this.packageThemeMap[stableKey]
      || this.packageCategoryMap[theme.category]
      || this.fallbackThemePackages[theme.key]
      || this.fallbackCategoryPackages[theme.category]
      || [];
  }

  private getCategoryPackageTiers(category: ThemeCategory): PackageTier[] {
    return this.packageCategoryMap[category]
      || this.fallbackCategoryPackages[category]
      || [];
  }

  private formatPackageLabels(packages: PackageTier[]): string {
    return packages.join(' & ');
  }

  private resolvePackageTier(paket: PackageApiItem): PackageTier | null {
    const raw = `${paket?.package_tier || paket?.name_paket || paket?.name_paket_display || paket?.jenis_paket || ''}`.toLowerCase();
    if (/ruby|silver|standar/.test(raw)) return 'Ruby';
    if (/sapphire|gold/.test(raw)) return 'Sapphire';
    if (/diamond|platinum/.test(raw)) return 'Diamond';
    return null;
  }

  private resolveThemeCategory(value: any): ThemeCategory | null {
    const raw = this.normalizeKey(
      typeof value === 'string'
        ? value
        : value?.slug || value?.name || value?.nama_kategori || value?.category || ''
    );

    if (raw.includes('minimal')) return 'Minimalis';
    if (raw.includes('floral')) return 'Floral';
    if (raw.includes('modern')) return 'Modern';
    if (raw.includes('elegant')) return 'Elegant';
    if (raw.includes('luxury')) return 'Luxury';
    return null;
  }

  private resolveThemeKey(value: any): string | null {
    const raw = this.normalizeKey(
      typeof value === 'string'
        ? value
        : value?.slug || value?.theme_slug || value?.key || value?.name || ''
    );

    if (!raw) {
      return null;
    }

    return this.themePresets.find((preset) => raw === preset.key || raw.includes(preset.key))?.key || null;
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
}
