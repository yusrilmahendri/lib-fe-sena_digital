import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LandingModalService } from '../../landing-modal.service';
import {
  DashboardService,
  DashboardServiceType,
  PublicCategoryWithThemes,
  PublicTheme,
  ThemeService,
} from 'src/app/dashboard.service';
import {
  buildThemeAccessMap,
  FALLBACK_THEME_ACCESS_MAP,
  getLowestPackageTierForTheme,
  getThemePresetBySlug,
  resolvePublicThemeSlug,
  ThemeAccessMap,
  ThemeCategoryName,
  ThemePackageTier,
} from '../../theme-package-access.util';

type ThemeFilter =
  | 'Semua'
  | 'Minimalis'
  | 'Floral'
  | 'Elegant'
  | 'Luxury';

interface ThemeFeatureItem {
  label: string;
}

interface ThemeCard {
  id?: number;
  slug: string;
  name: string;
  tier?: string;
  badge: string;
  description: string;
  features: ThemeFeatureItem[];
  image: string;
  fallbackImage: string;
  previewUrl: string;
  shareUrl: string;
}

interface FallbackThemeSeed {
  name: string;
  tier: ThemePackageTier;
  badge: ThemeCategoryName;
  slug: string;
  image: string;
  description: string;
  features: string[];
}

interface ThemePreviewState {
  isOpen: boolean;
  isLoading: boolean;
  errorMessage: string;
  shareMessage: string;
  theme: ThemeCard | null;
}

@Component({
  selector: 'wc-community',
  templateUrl: './community.component.html',
  styleUrls: ['./community.component.scss'],
})
export class CommunityComponent implements OnInit, OnDestroy {
  filters: ThemeFilter[] = [
    'Semua',
    'Minimalis',
    'Floral',
    'Elegant',
    'Luxury',
  ];

  activeFilter: ThemeFilter = 'Semua';
  isLoading = true;
  errorMessage = '';
  private readonly fallbackThemeSeeds: FallbackThemeSeed[] = [
    {
      name: 'Soft Ivory',
      tier: 'ruby',
      badge: 'Minimalis',
      slug: 'soft-ivory',
      image: 'assets/landing/template-2.png',
      description:
        'Tema minimalis bernuansa ivory yang bersih, hangat, dan cocok untuk pasangan yang menyukai tampilan tenang.',
      features: ['Animasi halus', 'RSVP & ucapan', 'Galeri foto', 'Google Maps'],
    },
    {
      name: 'Lavender Bloom',
      tier: 'ruby',
      badge: 'Floral',
      slug: 'lavender-bloom',
      image: 'assets/landing/template-1.png',
      description:
        'Tema floral bernuansa lavender dengan tipografi elegan untuk undangan yang manis dan romantis.',
      features: ['Animasi halus', 'RSVP & ucapan', 'Musik latar', 'Amplop digital'],
    },
    {
      name: 'Garden Whisper',
      tier: 'sapphire',
      badge: 'Floral',
      slug: 'garden-whisper',
      image: 'assets/landing/template-6.png',
      description:
        'Nuansa taman yang lembut dengan komposisi foto yang lapang untuk cerita pernikahan yang hangat.',
      features: ['Galeri foto', 'Countdown acara', 'Google Maps', 'Amplop digital'],
    },
    {
      name: 'Champagne Rose',
      tier: 'diamond',
      badge: 'Elegant',
      slug: 'diamond',
      image: 'assets/landing/template-5.png',
      description:
        'Palet champagne yang elegan dengan aksen romantis, cocok untuk undangan berkelas dan hangat.',
      features: ['Animasi halus', 'Google Maps', 'Amplop digital', 'Galeri foto'],
    },
    {
      name: 'Diamond Garden',
      tier: 'diamond',
      badge: 'Luxury',
      slug: 'diamond-garden',
      image: 'assets/landing/template-3.png',
      description:
        'Tema hijau gelap dengan aksen floral klasik dan nuansa kebun elegan untuk undangan yang hangat dan berkelas.',
      features: ['Hero elegan', 'Countdown acara', 'RSVP & ucapan', 'Amplop digital'],
    },
  ];
  themes: ThemeCard[] = this.createFallbackThemes();
  previewState: ThemePreviewState = {
    isOpen: false,
    isLoading: false,
    errorMessage: '',
    shareMessage: '',
    theme: null,
  };

  private readonly themeService: ThemeService;
  private readonly subscriptions = new Subscription();
  private shareMessageTimer: ReturnType<typeof setTimeout> | null = null;
  private themeAccessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP;

  constructor(
    private router: Router,
    private dashboardService: DashboardService,
    private modal: LandingModalService
  ) {
    this.themeService = new ThemeService(this.dashboardService);
  }

  ngOnInit(): void {
    this.loadPackageAccessMap();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearShareMessageTimer();
    document.body.classList.remove('theme-preview-open');
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.previewState.isOpen) {
      this.closePreviewModal();
    }
  }

  get filteredThemes(): ThemeCard[] {
    if (this.activeFilter === 'Semua') {
      return this.themes;
    }

    return this.themes.filter((theme) => theme.badge === this.activeFilter);
  }

  get hasThemeList(): boolean {
    return this.filteredThemes.length > 0;
  }

  setFilter(filter: ThemeFilter): void {
    this.activeFilter = filter;
  }

  loadThemes(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.subscriptions.add(
      this.themeService.getPublicCategoriesWithThemes('website').subscribe({
        next: (res) => {
          const mapped = this.mapThemesFromCategories(res?.data?.categories || []);
          if (mapped.length) {
            this.themes = mapped;
            this.isLoading = false;
            return;
          }

          this.loadPopularThemesFallback(true);
        },
        error: () => {
          this.loadPopularThemesFallback(true);
        },
      })
    );
  }

  private loadPackageAccessMap(): void {
    this.subscriptions.add(
      this.dashboardService.list(DashboardServiceType.MNL_MD_PACK_INVITATION).subscribe({
        next: (res: any) => {
          this.themeAccessMap = buildThemeAccessMap(
            Array.isArray(res?.data) ? res.data : []
          );
          this.loadThemes();
        },
        error: () => {
          this.themeAccessMap = FALLBACK_THEME_ACCESS_MAP;
          this.loadThemes();
        },
      })
    );
  }

  onThemeImgError(theme: ThemeCard): void {
    if (theme.image !== theme.fallbackImage) {
      theme.image = theme.fallbackImage;
    }
  }

  openThemeDetail(theme: ThemeCard): void {
    this.openPreviewModal(theme);
  }

  openPreviewModal(theme: ThemeCard): void {
    this.previewState = {
      isOpen: true,
      isLoading: !!theme.id,
      errorMessage: '',
      shareMessage: '',
      theme,
    };
    document.body.classList.add('theme-preview-open');

    if (!theme.id) {
      this.previewState.isLoading = false;
      return;
    }

    this.subscriptions.add(
      this.themeService.getPublicThemeDetails(theme.id).subscribe({
        next: (res) => {
          const detailSlug = resolvePublicThemeSlug(res?.data);
          const preset =
            getThemePresetBySlug(detailSlug || theme.slug) ||
            this.getFallbackSeed(theme.slug);

          if (!preset) {
            this.previewState = {
              ...this.previewState,
              isLoading: false,
            };
            return;
          }

          const detailedTheme = this.mapTheme(
            res?.data as Partial<PublicTheme>,
            preset.slug
          );

          this.previewState = {
            ...this.previewState,
            isLoading: false,
            theme: {
              ...theme,
              ...detailedTheme,
              image: detailedTheme.image || theme.image,
              fallbackImage: theme.fallbackImage,
            },
          };
        },
        error: () => {
          const hasUsableFallback =
            !!theme.image && (!!theme.description || theme.features.length > 0 || !!theme.previewUrl);

          this.previewState = {
            ...this.previewState,
            isLoading: false,
            errorMessage: hasUsableFallback
              ? 'Detail lengkap tema belum berhasil dimuat. Kami tampilkan data yang tersedia dulu.'
              : 'Detail tema sedang tidak bisa ditampilkan. Silakan coba lagi sebentar lagi.',
            theme: hasUsableFallback ? theme : null,
          };
        },
      })
    );
  }

  closePreviewModal(): void {
    this.previewState = {
      isOpen: false,
      isLoading: false,
      errorMessage: '',
      shareMessage: '',
      theme: null,
    };
    this.clearShareMessageTimer();
    document.body.classList.remove('theme-preview-open');
  }

  openCreateInvitationModal(theme: ThemeCard): void {
    this.closePreviewModal();
    this.modal.openCreateInvitation({
      id: theme.id,
      slug: theme.slug,
      name: theme.name,
      tier: theme.tier,
      category: theme.badge,
      image: theme.image,
      fallbackImage: theme.fallbackImage,
    });
  }

  openFullThemePreview(theme: ThemeCard | null): void {
    if (!theme?.slug) {
      return;
    }

    this.closePreviewModal();
    this.router.navigate(['/preview-theme', theme.slug], {
      queryParams: {
        preview: 'true',
        source: 'landing',
      },
    });
  }

  async shareTheme(theme: ThemeCard): Promise<void> {
    const shareUrl = this.getThemePreviewShareUrl(theme);
    const payload = {
      title: `${theme.name} - Sena Digital`,
      text: `Lihat preview tema ${theme.name} di Sena Digital.`,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        this.setShareMessage('Tautan tema siap dibagikan.');
        return;
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        return;
      }
    }

    const copied = await this.copyToClipboard(shareUrl);
    this.setShareMessage(
      copied
        ? 'Tautan tema berhasil disalin.'
        : 'Browser ini belum mendukung bagikan otomatis. Silakan salin tautannya manual.'
    );
  }

  goToBuatUndangan(): void {
    this.router.navigate(['/buat-undangan']);
  }

  trackByTheme(_: number, theme: ThemeCard): string {
    return `${theme.id ?? 'theme'}-${theme.slug}`;
  }

  private loadPopularThemesFallback(useDefaultOnEmpty = false): void {
    this.subscriptions.add(
      this.themeService.getPublicPopularThemes({ type: 'website', limit: 24 }).subscribe({
        next: (res) => {
          const list = Array.isArray(res?.data) ? res.data : [];
          const mappedThemes = list
            .map((item) => {
              const slug = resolvePublicThemeSlug(item);
              return slug ? this.mapTheme(item, slug) : null;
            })
            .filter((theme): theme is ThemeCard => !!theme?.name);

          this.themes = mappedThemes.length
            ? this.mergeMappedThemesWithFallback(mappedThemes)
            : this.createFallbackThemes();
          this.isLoading = false;

          if (!mappedThemes.length && !useDefaultOnEmpty) {
            this.errorMessage = '';
          }
        },
        error: () => {
          this.themes = this.createFallbackThemes();
          this.isLoading = false;
          this.errorMessage = '';
        },
      })
    );
  }

  private mapThemesFromCategories(categories: PublicCategoryWithThemes[]): ThemeCard[] {
    const safeCategories = Array.isArray(categories) ? categories : [];
    const mappedThemes = safeCategories.flatMap((category) => {
      const themes = Array.isArray(category?.jenis_themas) ? category.jenis_themas : [];

      return themes
        .filter((item: any) => item?.is_active !== false)
        .map((item) => {
          const slug = resolvePublicThemeSlug(item);
          return slug ? this.mapTheme(item, slug) : null;
        })
        .filter((theme): theme is ThemeCard => !!theme);
    });

    return mappedThemes.length
      ? this.mergeMappedThemesWithFallback(mappedThemes)
      : this.createFallbackThemes();
  }

  private mapTheme(
    item: Partial<PublicTheme> & any,
    slug: string
  ): ThemeCard {
    const fallbackSeed = this.getFallbackSeed(slug);
    if (!fallbackSeed) {
      throw new Error(`Unknown theme preset: ${slug}`);
    }

    const fallbackImage = fallbackSeed.image;
    const name = fallbackSeed.name;
    const previewUrl = item?.demo_url || item?.preview_url || item?.url_thema || '';
    const image =
      item?.thumbnail_image ||
      item?.preview_image ||
      item?.image ||
      item?.preview ||
      fallbackImage;
    const description =
      item?.description ||
      item?.category_description ||
      fallbackSeed.description;
    const features = this.normalizeFeatures(item?.features, fallbackSeed.features);

    return {
      id: item?.id != null ? Number(item.id) : undefined,
      slug: fallbackSeed.slug,
      name,
      tier: getLowestPackageTierForTheme(fallbackSeed.slug, this.themeAccessMap),
      badge: fallbackSeed.badge,
      description,
      features,
      image,
      fallbackImage,
      previewUrl,
      shareUrl: previewUrl || this.getThemeFallbackShareUrl({ slug: fallbackSeed.slug } as ThemeCard),
    };
  }

  private normalizeFeatures(features: any, fallbackFeatures: string[] = []): ThemeFeatureItem[] {
    if (Array.isArray(features)) {
      const normalized = features
        .map((item) => (typeof item === 'string' ? item : item?.label || item?.name || ''))
        .filter((item) => !!item)
        .slice(0, 6)
        .map((label) => ({ label }));

      if (normalized.length) {
        return normalized;
      }
    }

    if (typeof features === 'string') {
      const normalized = features
        .split(/,|\n/)
        .map((item) => item.trim())
        .filter((item) => !!item)
        .slice(0, 6)
        .map((label) => ({ label }));

      if (normalized.length) {
        return normalized;
      }
    }

    return fallbackFeatures.map((label) => ({ label }));
  }

  private createFallbackThemes(): ThemeCard[] {
    const seeds = Array.isArray(this.fallbackThemeSeeds) ? this.fallbackThemeSeeds : [];

    return seeds.map((theme) => ({
      id: undefined,
      slug: theme.slug,
      name: theme.name,
      tier: theme.tier,
      badge: theme.badge,
      description: theme.description,
      features: theme.features.map((label) => ({ label })),
      image: theme.image,
      fallbackImage: theme.image,
      previewUrl: '',
      shareUrl: this.getThemeFallbackShareUrl({ slug: theme.slug }),
    }));
  }

  private mergeMappedThemesWithFallback(mappedThemes: ThemeCard[]): ThemeCard[] {
    const fallbackThemes = this.createFallbackThemes();
    const mappedBySlug = new Map(
      (Array.isArray(mappedThemes) ? mappedThemes : []).map((theme) => [theme.slug, theme] as const)
    );

    return fallbackThemes.map((fallbackTheme) => {
      const mappedTheme = mappedBySlug.get(fallbackTheme.slug);
      return mappedTheme
        ? {
            ...fallbackTheme,
            ...mappedTheme,
            features: mappedTheme.features?.length ? mappedTheme.features : fallbackTheme.features,
            description: mappedTheme.description || fallbackTheme.description,
            image: mappedTheme.image || fallbackTheme.image,
            fallbackImage: fallbackTheme.fallbackImage,
            shareUrl: mappedTheme.shareUrl || fallbackTheme.shareUrl,
          }
        : fallbackTheme;
    });
  }

  private getFallbackSeed(slug: string): FallbackThemeSeed | null {
    const normalizedSlug = resolvePublicThemeSlug(slug);
    if (!normalizedSlug) {
      return null;
    }

    return (
      this.fallbackThemeSeeds.find((theme) => theme.slug === normalizedSlug) ||
      null
    );
  }

  private getThemeFallbackShareUrl(theme: Partial<ThemeCard>): string {
    return this.getThemePreviewShareUrl(theme);
  }

  private getThemePreviewShareUrl(theme: Partial<ThemeCard>): string {
    const slug = theme?.slug || 'soft-ivory';
    const url = new URL(`/preview-theme/${slug}`, window.location.origin);
    url.searchParams.set('preview', 'true');
    return url.toString();
  }

  private async copyToClipboard(value: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // Fall through to legacy copy below.
    }

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }

    document.body.removeChild(textarea);
    return copied;
  }

  private setShareMessage(message: string): void {
    this.previewState = {
      ...this.previewState,
      shareMessage: message,
    };
    this.clearShareMessageTimer();
    this.shareMessageTimer = setTimeout(() => {
      this.previewState = {
        ...this.previewState,
        shareMessage: '',
      };
      this.shareMessageTimer = null;
    }, 2600);
  }

  private clearShareMessageTimer(): void {
    if (this.shareMessageTimer) {
      clearTimeout(this.shareMessageTimer);
      this.shareMessageTimer = null;
    }
  }
}
