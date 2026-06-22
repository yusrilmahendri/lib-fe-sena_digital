import { Component, OnInit, OnDestroy } from '@angular/core';
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
  isCategoryAccessibleForTier,
  resolvePackageTier,
  resolveThemeCategory,
  ThemeCategoryName,
  ThemePackageTier,
} from '../../../theme-package-access.util';

interface ThemeCard {
  id: number;
  label: string;
  title: string;
  name: string;
  image: string;
  demo_url: string;
  price: number;
  isSelected: boolean;
  isLoading?: boolean;
  category_id: number;
  category: ThemeCategoryName | 'Legacy';
  isLegacy?: boolean;
  imageFallback?: string;
}

@Component({
  selector: 'wc-tampilan',
  templateUrl: './tampilan.component.html',
  styleUrls: ['./tampilan.component.scss']
})
export class TampilanComponent implements OnInit, OnDestroy {
  themeCards: ThemeCard[] = [];
  isLoading = false;
  errorMessage = '';
  selectedThemeId: number | null = null;
  userPackageTier: ThemePackageTier = 'trial';

  private subscriptions = new Subscription();
  private themeAccessMap = FALLBACK_THEME_ACCESS_MAP;
  private readonly legacyTrialCards: ThemeCard[] = [
    { id: -1, label: 'Scroll', title: 'Modern', name: 'Modern', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', demo_url: '', price: 0, isSelected: true, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true },
    { id: -2, label: 'Slide', title: 'Blue', name: 'Blue', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', demo_url: '', price: 0, isSelected: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true },
    { id: -3, label: 'Mobile', title: 'Minimalist', name: 'Minimalist', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', demo_url: '', price: 0, isSelected: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true },
    { id: -4, label: 'Scroll', title: 'Pinky', name: 'Pinky', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', demo_url: '', price: 0, isSelected: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true },
    { id: -5, label: 'Mobile', title: 'Elegant', name: 'Elegant', image: 'assets/modern.svg', imageFallback: 'assets/modern.svg', demo_url: '', price: 0, isSelected: false, isLoading: false, category_id: 0, category: 'Legacy', isLegacy: true },
  ];

  constructor(
    private dashboardService: DashboardService,
    private themeService: ThemeService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.loadAccessibleThemes();
    this.loadSelectedTheme();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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
        this.themeAccessMap = buildThemeAccessMap(Array.isArray(packages?.data) ? packages.data : []);

        if (this.userPackageTier === 'trial') {
          this.themeCards = this.legacyTrialCards.map((card) => ({ ...card }));
          this.isLoading = false;
          return;
        }

        if (themes.status && themes.data?.categories) {
          this.processThemeData(themes.data.categories);
          console.log('Themes loaded successfully:', themes.data.total_themes);
        } else {
          this.handleError('Invalid response format from server');
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading accessible themes:', error);
        this.handleError('Failed to load themes. Please try again later.');
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
          this.selectedThemeId = response.data.theme.id;
          this.updateSelectedStatus();
          console.log('Selected theme loaded:', response.data.theme.name);
        }
      },
      error: (error) => {
        // No selected theme or authentication error - this is acceptable
        console.log('No selected theme or authentication required:', error);
      }
    });

    this.subscriptions.add(selectedSubscription);
  }

  /**
   * Process theme data from API into display format
   */
  private processThemeData(categories: PublicCategoryWithThemes[]): void {
    this.themeCards = [];

    categories.forEach(category => {
      const resolvedCategory = resolveThemeCategory(category?.name);
      if (!resolvedCategory || !isCategoryAccessibleForTier(this.userPackageTier, resolvedCategory, this.themeAccessMap)) {
        return;
      }

      if (category.jenis_themas && category.jenis_themas.length > 0) {
        category.jenis_themas.forEach(theme => {
          this.themeCards.push({
            id: theme.id,
            label: resolvedCategory,
            title: theme.name,
            name: theme.name,
            image: this.getThemeImage(theme),
            imageFallback: this.getThemeFallbackImage(theme.name, resolvedCategory),
            demo_url: theme.demo_url || '',
            price: theme.price || 0,
            isSelected: false,
            isLoading: false,
            category_id: category.id,
            category: resolvedCategory
          });
        });
      }
    });

    // Update selected status if we have a selected theme
    if (this.selectedThemeId) {
      this.updateSelectedStatus();
    }
  }

  /**
   * Update selected status for themes
   */
  private updateSelectedStatus(): void {
    this.themeCards.forEach(card => {
      card.isSelected = card.id === this.selectedThemeId;
    });
  }

  /**
   * Get theme image from API response
   */
  private getThemeImage(theme: PublicTheme): string {
    const baseUrl = 'http://127.0.0.1:8000/storage/';

    // Priority order: preview_image -> thumbnail_image -> image -> preview -> fallback
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

    return this.getThemeFallbackImage(theme.name, resolveThemeCategory(theme.name) || 'Minimalis');
  }

  /**
   * Handle theme activation/deactivation
   */
  onToggleActivation(theme: ThemeCard): void {
    if (theme.isLoading) return;

    if (theme.isLegacy) {
      this.toastService.showToast('Paket Trial menggunakan tema default/legacy.', 'info');
      return;
    }

    theme.isLoading = true;

    if (theme.isSelected) {
      // Cannot deactivate selected theme - show message
      this.toastService.showToast('This theme is already selected', 'info');
      theme.isLoading = false;
      return;
    }

    const request: ThemeSelectionRequest = {
      theme_id: theme.id
    };

    const selectionSubscription = this.themeService.selectTheme(request).subscribe({
      next: (response) => {
        if (response.status) {
          // Update selected theme
          this.selectedThemeId = theme.id;
          this.updateSelectedStatus();

          this.toastService.showToast(`Theme "${theme.name}" selected successfully!`, 'success');
          console.log('Theme selected:', response.data.theme.name);
        } else {
          this.toastService.showToast('Failed to select theme', 'error');
        }
        theme.isLoading = false;
      },
      error: (error) => {
        console.error('Error selecting theme:', error);
        let errorMessage = 'Failed to select theme';

        if (error.status === 401) {
          errorMessage = 'Please log in to select a theme';
        } else if (error.status === 422) {
          errorMessage = 'Invalid theme selection';
        }

        this.toastService.showToast(errorMessage, 'error');
        theme.isLoading = false;
      }
    });

    this.subscriptions.add(selectionSubscription);
  }

  /**
   * Handle demo button click
   */
  onDemoClick(theme: ThemeCard): void {
    if (!theme.demo_url) {
      this.toastService.showToast('Demo not available for this theme', 'warning');
      return;
    }

    try {
      // Open demo in new window
      window.open(theme.demo_url, '_blank', 'noopener,noreferrer');
      console.log('Opening demo for theme:', theme.name);
    } catch (error) {
      console.error('Error opening demo:', error);
      this.toastService.showToast('Failed to open demo', 'error');
    }
  }

  /**
   * Handle errors
   */
  private handleError(message: string): void {
    this.errorMessage = message;
    this.toastService.showToast(message, 'error');
  }

  /**
   * Retry loading themes
   */
  retryLoadThemes(): void {
    this.errorMessage = '';
    this.loadAccessibleThemes();
  }

  /**
   * Get background class for theme card
   */
  getBackgroundClass(label: string): string {
    const labelLower = label.toLowerCase();
    if (labelLower.includes('scroll')) return 'bg-scroll';
    if (labelLower.includes('slide')) return 'bg-slide';
    if (labelLower.includes('mobile')) return 'bg-mobile';
    return 'bg-scroll'; // default
  }

  /**
   * Get activation button text
   */
  getActivationButtonText(theme: ThemeCard): string {
    if (theme.isLoading) return 'Loading...';
    if (theme.isLegacy) return 'Default Trial';
    return theme.isSelected ? 'Selected' : 'Select';
  }

  /**
   * Get activation button icon
   */
  getActivationButtonIcon(theme: ThemeCard): string {
    if (theme.isLoading) return 'fas fa-spinner fa-spin';
    if (theme.isLegacy) return 'fas fa-lock';
    return theme.isSelected ? 'fas fa-check' : 'fas fa-file-alt';
  }

  /**
   * Check if theme is loading
   */
  isThemeLoading(theme: ThemeCard): boolean {
    return theme.isLoading || false;
  }

  /**
   * Handle image loading errors
   */
  onImageError(event: any, theme: ThemeCard): void {
    console.warn(`Failed to load image for theme ${theme.name}:`, theme.image);
    event.target.src = theme.imageFallback || 'assets/modern.svg';
  }

  /**
   * Track function for ngFor performance
   */
  trackByThemeId(index: number, theme: ThemeCard): number {
    return theme.id;
  }

  /**
   * Format price for display
   */
  formatPrice(price: number): string {
    if (price === 0) return 'Free';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
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
