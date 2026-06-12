import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService, ThemeService } from 'src/app/dashboard.service';

interface Theme {
  name: string;
  tier: string;
  badge: string;
  key: string;
  image: string;
  fallbackImage: string;
  preview?: string;
}

@Component({
  selector: 'wc-community',
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit {
  filters: string[] = [
    'Semua',
    'Minimalis',
    'Floral',
    'Modern',
    'Elegant',
    'Luxury',
  ];

  activeFilter = 'Semua';

  isLoading = true;

  /* Static fallback themes (match Figma). Also used as per-index defaults
     so the design stays identical when the API has partial data. */
  private fallbackThemes: Theme[] = [
    { name: 'Lavender Bloom', tier: 'Ruby template', badge: 'Floral', key: 'lavender', image: 'assets/landing/template-1.png', fallbackImage: 'assets/landing/template-1.png' },
    { name: 'Soft Ivory', tier: 'Ruby template', badge: 'Minimalis', key: 'ivory', image: 'assets/landing/template-2.png', fallbackImage: 'assets/landing/template-2.png' },
    { name: 'Velvet Mauve', tier: 'Sapphire template', badge: 'Luxury', key: 'mauve', image: 'assets/landing/template-3.png', fallbackImage: 'assets/landing/template-3.png' },
    { name: 'Modern Vows', tier: 'Diamond template', badge: 'Modern', key: 'modern', image: 'assets/landing/template-4.png', fallbackImage: 'assets/landing/template-4.png' },
    { name: 'Champagne Rose', tier: 'Diamond template', badge: 'Elegant', key: 'champagne', image: 'assets/landing/template-5.png', fallbackImage: 'assets/landing/template-5.png' },
    { name: 'Garden Whisper', tier: 'Sapphire template', badge: 'Floral', key: 'garden', image: 'assets/landing/template-6.png', fallbackImage: 'assets/landing/template-6.png' },
  ];

  themes: Theme[] = [...this.fallbackThemes];

  private themeService: ThemeService;

  constructor(private router: Router, private dashboardService: DashboardService) {
    this.themeService = new ThemeService(this.dashboardService);
  }

  ngOnInit(): void {
    this.loadThemes();
  }

  /**
   * Try the public popular-themes API. On any failure or empty/invalid
   * payload, silently keep the static fallback so the section never breaks.
   */
  private loadThemes(): void {
    this.isLoading = true;

    this.themeService.getPublicPopularThemes({ type: 'website', limit: 6 }).subscribe({
      next: (res: any) => {
        const list: any[] = this.extractThemeList(res);
        const mapped = this.mapThemes(list);
        if (mapped.length) {
          this.themes = mapped;
        }
        this.isLoading = false;
      },
      error: () => {
        // Fallback handles the visuals; only a dev-friendly warning.
        console.warn('[Templates] popular themes API unavailable, using static fallback.');
        this.isLoading = false;
      },
    });
  }

  /** Read the theme array out of the various shapes the API might return. */
  private extractThemeList(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data?.themes)) return res.data.themes;
    return [];
  }

  /** Map up to 6 API themes with flexible fields + local image fallback. */
  private mapThemes(list: any[]): Theme[] {
    if (!list || !list.length) return [];

    return list.slice(0, 6).map((item, i) => {
      const base = this.fallbackThemes[i] || this.fallbackThemes[this.fallbackThemes.length - 1];
      const name = item?.title || item?.name || item?.nama_tema || base.name;
      const apiImage =
        item?.thumbnail_image || item?.thumbnail || item?.preview_image || item?.image || item?.preview || '';
      const badge = item?.category_name || item?.category?.name || item?.category || base.badge;
      const tierRaw = item?.package_tier || item?.tier || item?.name_paket_display || '';
      const tier = tierRaw ? `${tierRaw} template` : base.tier;
      const preview = item?.demo_url || item?.preview_url || item?.url_thema || '';

      return {
        name,
        tier,
        badge,
        key: `${item?.id ?? base.key}`,
        image: apiImage || base.fallbackImage,
        fallbackImage: base.fallbackImage,
        preview: preview || undefined,
      };
    });
  }

  get filteredThemes(): Theme[] {
    if (this.activeFilter === 'Semua') {
      return this.themes;
    }
    return this.themes.filter((t) => t.badge === this.activeFilter);
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
  }

  /** Swap to the local template image if the API image fails to load. */
  onThemeImgError(theme: Theme): void {
    if (theme.image !== theme.fallbackImage) {
      theme.image = theme.fallbackImage;
    }
  }

  goToPreview(theme: Theme): void {
    if (theme.preview) {
      window.open(theme.preview, '_blank');
    }
  }

  goToBuatUndangan(): void {
    this.router.navigate(['/buat-undangan']);
  }
}
