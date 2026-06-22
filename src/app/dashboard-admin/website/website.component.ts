import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Notyf } from 'notyf';
import { WebsiteCategory } from '../../interfaces/admin-category.interfaces';
import { WebsiteCategoryService } from '../../services/website-category.service';

interface ThemePreset {
  key: string;
  name: string;
  category: 'Minimalis' | 'Floral' | 'Modern' | 'Elegant' | 'Luxury';
  fallbackImage: string;
}

interface AdminThemeCard {
  key: string;
  name: string;
  category: ThemePreset['category'];
  fallbackImage: string;
  displayOrder: number;
  categoryData: WebsiteCategory | null;
}

@Component({
  selector: 'wc-website',
  templateUrl: './website.component.html',
  styleUrls: ['./website.component.scss']
})
export class WebsiteComponent implements OnInit, OnDestroy {
  private readonly storageKey = 'admin-website-theme-order';
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
  loading = false;
  error: string | null = null;
  uploadingThemeId: number | null = null;
  selectedThemeDetail: AdminThemeCard | null = null;

  private subscriptions: Subscription[] = [];
  private notyf: Notyf;

  constructor(
    private websiteCategoryService: WebsiteCategoryService,
    private cdr: ChangeDetectorRef
  ) {
    this.notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });
  }

  ngOnInit(): void {
    this.initializeSubscriptions();
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

  getData(): void {
    this.websiteCategoryService.getCategories({ per_page: 100 }).subscribe({
      error: (error) => {
        console.error('Error loading website categories:', error);
      }
    });
  }

  toggleThemeStatus(theme: AdminThemeCard): void {
    if (!theme.categoryData?.id) {
      this.notyf.error('Tema ini belum terhubung ke data existing');
      return;
    }

    this.websiteCategoryService.toggleActivation(
      theme.categoryData.id,
      !theme.categoryData.is_active
    ).subscribe({
      next: (result) => {
        if (result.success) {
          this.notyf.success(`Status ${theme.name} berhasil diperbarui`);
        }
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

    if (!theme.categoryData?.id) {
      this.notyf.error('Tema ini belum terhubung ke data existing');
      target.value = '';
      return;
    }

    this.uploadingThemeId = theme.categoryData.id;

    this.websiteCategoryService.updateCategory(theme.categoryData.id, { image: file }).subscribe({
      next: (result) => {
        if (result.success) {
          this.notyf.success(`Preview ${theme.name} berhasil diperbarui`);
          this.getData();
        } else {
          this.notyf.error(result.error || 'Gagal memperbarui gambar preview');
        }

        target.value = '';
        this.uploadingThemeId = null;
      },
      error: (error) => {
        console.error('Error updating theme preview:', error);
        this.notyf.error(error.error || 'Gagal memperbarui gambar preview');
        target.value = '';
        this.uploadingThemeId = null;
      }
    });
  }

  openThemeDetail(theme: AdminThemeCard): void {
    this.selectedThemeDetail = theme;
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
    if (!theme.categoryData) {
      return 'Belum Terhubung';
    }

    return theme.categoryData.is_active ? 'Aktif' : 'Nonaktif';
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

  private buildThemeCards(categories: WebsiteCategory[]): AdminThemeCard[] {
    const linkedThemes = this.themePresets.map((preset, index) => ({
      key: preset.key,
      name: preset.name,
      category: preset.category,
      fallbackImage: preset.fallbackImage,
      displayOrder: index + 1,
      categoryData: categories[index] ?? null
    }));

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

  private syncSelectedThemeDetail(): void {
    if (!this.selectedThemeDetail) {
      return;
    }

    this.selectedThemeDetail = this.themeCards.find(
      (theme) => theme.key === this.selectedThemeDetail?.key
    ) ?? null;
  }
}
