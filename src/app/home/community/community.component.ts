import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  DashboardService,
  PublicCategoryWithThemes,
  PublicTheme,
  ThemeService,
} from 'src/app/dashboard.service';
import { LandingModalService } from '../../landing-modal.service';

type ThemeFilter =
  | 'Semua'
  | 'Minimalis'
  | 'Floral'
  | 'Modern'
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
  tier: string;
  badge: ThemeFilter;
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
    'Modern',
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
      name: 'Modern Vows',
      tier: 'diamond',
      badge: 'Modern',
      slug: 'modern-vows',
      image: 'assets/landing/template-4.png',
      description:
        'Tema modern dengan layout tegas dan visual bersih untuk pasangan yang ingin tampil kontemporer.',
      features: ['Layout modern', 'RSVP & ucapan', 'Galeri foto', 'Share WhatsApp'],
    },
    {
      name: 'Champagne Rose',
      tier: 'diamond',
      badge: 'Elegant',
      slug: 'champagne-rose',
      image: 'assets/landing/template-5.png',
      description:
        'Palet champagne yang elegan dengan aksen romantis, cocok untuk undangan berkelas dan hangat.',
      features: ['Animasi halus', 'Google Maps', 'Amplop digital', 'Galeri foto'],
    },
    {
      name: 'Velvet Mauve',
      tier: 'sapphire',
      badge: 'Luxury',
      slug: 'velvet-mauve',
      image: 'assets/landing/template-3.png',
      description:
        'Tampilan mewah dengan warna mauve yang kaya, cocok untuk undangan dengan kesan eksklusif.',
      features: ['Hero mewah', 'RSVP & ucapan', 'Musik latar', 'Amplop digital'],
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

  constructor(
    private router: Router,
    private dashboardService: DashboardService,
    private landingModal: LandingModalService
  ) {
    this.themeService = new ThemeService(this.dashboardService);
  }

  ngOnInit(): void {
    this.loadThemes();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.clearShareMessageTimer();
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

  onThemeImgError(theme: ThemeCard): void {
    if (theme.image !== theme.fallbackImage) {
      theme.image = theme.fallbackImage;
    }
  }

  openPreviewModal(theme: ThemeCard): void {
    this.previewState = {
      isOpen: true,
      isLoading: !!theme.id,
      errorMessage: '',
      shareMessage: '',
      theme,
    };

    if (!theme.id) {
      this.previewState.isLoading = false;
      return;
    }

    this.subscriptions.add(
      this.themeService.getPublicThemeDetails(theme.id).subscribe({
        next: (res) => {
          const detailedTheme = this.mapTheme(
            res?.data as Partial<PublicTheme>,
            theme.badge,
            this.themes.findIndex((item) => item.slug === theme.slug)
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
  }

  useTheme(theme: ThemeCard): void {
    this.closePreviewModal();
    this.landingModal.openCreateInvitation({
      id: theme.id,
      slug: theme.slug,
      name: theme.name,
      tier: theme.tier,
      image: theme.image,
      fallbackImage: theme.fallbackImage,
    });
  }

  async shareTheme(theme: ThemeCard): Promise<void> {
    const shareUrl = theme.shareUrl || this.getThemeFallbackShareUrl(theme);
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
            .map((item, index) => this.mapTheme(item, this.resolveBadge(item), index))
            .filter((theme) => !!theme.name);

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
    const mappedThemes = safeCategories.flatMap((category, categoryIndex) => {
      const themes = Array.isArray(category?.jenis_themas) ? category.jenis_themas : [];

      return themes
        .filter((item: any) => item?.is_active !== false)
        .map((item, themeIndex) =>
          this.mapTheme(item, category?.name || this.resolveBadge(item), categoryIndex + themeIndex)
        );
    });

    return mappedThemes.length
      ? this.mergeMappedThemesWithFallback(mappedThemes)
      : this.createFallbackThemes();
  }

  private mapTheme(item: Partial<PublicTheme> & any, badge: string, index: number): ThemeCard {
    const fallbackSeed =
      this.fallbackThemeSeeds[index % this.fallbackThemeSeeds.length];
    const fallbackImage = fallbackSeed.image;
    const name = item?.name || item?.title || fallbackSeed.name;
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
    const slug = item?.slug || this.slugify(name) || fallbackSeed.slug;

    return {
      id: item?.id != null ? Number(item.id) : undefined,
      slug,
      name,
      tier: this.resolveTier(item, fallbackSeed.tier),
      badge: this.normalizeBadge(badge, fallbackSeed.badge),
      description,
      features,
      image,
      fallbackImage,
      previewUrl,
      shareUrl: previewUrl || this.getThemeFallbackShareUrl({ slug } as ThemeCard),
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

  private normalizeBadge(badge: string, fallbackBadge: ThemeFilter = 'Modern'): ThemeFilter {
    if (this.filters.includes(badge as ThemeFilter)) {
      return badge as ThemeFilter;
    }

    return fallbackBadge;
  }

  private resolveBadge(item: any): string {
    const badge =
      item?.category_name ||
      item?.category?.name ||
      item?.category ||
      item?.jenis_paket ||
      item?.package_tier ||
      '';

    if (/minimal/i.test(badge)) return 'Minimalis';
    if (/floral|bloom|garden/i.test(badge)) return 'Floral';
    if (/modern/i.test(badge)) return 'Modern';
    if (/elegant|rose|grace/i.test(badge)) return 'Elegant';
    if (/luxury|luxe|mauve|diamond/i.test(badge)) return 'Luxury';
    return 'Modern';
  }

  private resolveTier(item: any, fallbackTier = 'ruby'): string {
    const raw = `${item?.package_tier || item?.tier || item?.name_paket_display || item?.jenis_paket || ''}`.toLowerCase();
    if (raw.includes('trial')) return 'trial';
    if (/ruby|silver|standar/.test(raw)) return 'ruby';
    if (/sapphire|gold/.test(raw)) return 'sapphire';
    if (/diamond|platinum/.test(raw)) return 'diamond';
    return fallbackTier;
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
    const safeMappedThemes = Array.isArray(mappedThemes) ? mappedThemes.slice(0, fallbackThemes.length) : [];

    return fallbackThemes.map((fallbackTheme, index) => {
      const mappedTheme = safeMappedThemes[index];
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

  private slugify(value: string): string {
    return String(value || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getThemeFallbackShareUrl(theme: Partial<ThemeCard>): string {
    const url = new URL(window.location.href);
    url.hash = 'tema';
    if (theme?.slug) {
      url.searchParams.set('previewTema', theme.slug);
    }
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
