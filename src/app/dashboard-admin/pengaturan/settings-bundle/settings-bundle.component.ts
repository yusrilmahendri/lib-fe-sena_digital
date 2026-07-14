import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { Notyf } from 'notyf';
import { Subject, finalize, forkJoin, takeUntil } from 'rxjs';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { ModalComponent } from 'src/app/shared/modal/modal.component';
import {
  FALLBACK_THEME_ACCESS_MAP,
  PUBLIC_THEME_PRESETS,
  ThemePackageTier,
  buildThemeAccessMap,
  getThemeSlugsForTier,
  normalizeStableKey,
  resolvePackageTier,
  resolvePublicThemeSlug,
} from 'src/app/theme-package-access.util';
import { environment } from 'src/environments/environment';

type PackageTier = 'trial' | 'ruby' | 'sapphire' | 'diamond';

interface PackageData {
  id: number;
  code?: string;
  package_code?: string;
  package_tier?: string;
  jenis_paket: string;
  name_paket: string;
  price: string | number;
  masa_aktif: string | number;
  halaman_buku?: string | number | boolean;
  kirim_wa?: string | number | boolean;
  bebas_pilih_tema?: string | number | boolean;
  kirim_hadiah?: string | number | boolean;
  import_data?: string | number | boolean;
  musik_pribadi?: string | number | boolean;
  google_maps?: string | number | boolean;
  penyesuaian_agama?: string | number | boolean;
  gallery_video?: string | number | boolean;
  accessible_categories?: any[];
  [key: string]: any;
}

interface PackageFeature {
  key: string;
  label: string;
}

interface TierConfig {
  tier: PackageTier;
  title: string;
  badge: string;
  tone: string;
  description: string;
}

interface PackageCardState extends TierConfig {
  form: FormGroup;
  packageData: PackageData | null;
  loading: boolean;
}

interface ThemeOption {
  id: number | null;
  slug: string;
  name: string;
  thumbnail: string;
}

@Component({
  selector: 'wc-settings-bundle',
  templateUrl: './settings-bundle.component.html',
  styleUrls: ['./settings-bundle.component.scss']
})
export class SettingsBundleComponent implements OnInit, OnDestroy {
  readonly featureFields: PackageFeature[] = [
    { key: 'halaman_buku', label: 'Halaman Buku Tamu' },
    { key: 'kirim_wa', label: 'Bagikan WhatsApp' },
    { key: 'bebas_pilih_tema', label: 'Pilihan Tema' },
    { key: 'kirim_hadiah', label: 'Wedding Gift' },
    { key: 'import_data', label: 'Import Data Tamu Excel' },
    { key: 'musik_pribadi', label: 'Musik Pribadi' },
    { key: 'google_maps', label: 'Google Maps' },
    { key: 'penyesuaian_agama', label: 'Penyesuaian Agama' },
    { key: 'gallery_video', label: 'Gallery/Video' },
  ];

  readonly tierConfigs: TierConfig[] = [
    {
      tier: 'trial',
      title: 'Paket Trial',
      badge: 'Trial',
      tone: 'trial',
      description: 'Paket percobaan dengan satu tema Ruby.',
    },
    {
      tier: 'ruby',
      title: 'Paket Ruby',
      badge: 'Ruby',
      tone: 'ruby',
      description: 'Paket awal untuk undangan digital sederhana.',
    },
    {
      tier: 'sapphire',
      title: 'Paket Sapphire',
      badge: 'Sapphire',
      tone: 'sapphire',
      description: 'Akses tema dan fitur menengah.',
    },
    {
      tier: 'diamond',
      title: 'Paket Diamond',
      badge: 'Diamond',
      tone: 'diamond',
      description: 'Akses lengkap untuk undangan premium.',
    },
  ];

  cards: PackageCardState[] = [];
  rubyThemes: ThemeOption[] = [];
  dataLoading = true;
  errorMessage = '';

  private notyf: Notyf;
  private modalRef?: BsModalRef;
  private destroy$ = new Subject<void>();
  originalData: PackageData[] = [];
  private themeAccessMap = FALLBACK_THEME_ACCESS_MAP;

  constructor(
    private fb: FormBuilder,
    private dashboardSvc: DashboardService,
    private modalSvc: BsModalService
  ) {
    this.notyf = new Notyf({
      duration: 4000,
      position: { x: 'right', y: 'top' },
      dismissible: true
    });

    this.cards = this.tierConfigs.map((config) => ({
      ...config,
      form: this.createPackageForm(config.tier),
      packageData: null,
      loading: false,
    }));
  }

  ngOnInit(): void {
    this.getDataBundle();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.modalRef?.hide();
  }

  getDataBundle(): void {
    this.dataLoading = true;
    this.errorMessage = '';

    forkJoin({
      packages: this.dashboardSvc.list(DashboardServiceType.ST_BUNDLE_ADMIN),
      themes: this.dashboardSvc.list(DashboardServiceType.THEME_ADMIN_THEMES_LIST, { per_page: 100, page: 1 }),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.dataLoading = false)
      )
      .subscribe({
        next: ({ packages, themes }) => {
          const packageData = this.extractArray(packages);
          this.originalData = [...packageData];
          this.themeAccessMap = buildThemeAccessMap(packageData);
          this.populateCards(packageData);
          this.rubyThemes = this.buildRubyThemeOptions(themes);

          if (!packageData.length) {
            this.errorMessage = 'Data paket belum tersedia.';
          }
        },
        error: (err) => {
          console.error('Error fetching package data:', err);
          this.errorMessage = err?.error?.message || 'Gagal memuat data paket undangan.';
          this.notyf.error(this.errorMessage);
        }
      });
  }

  onSave(card: PackageCardState): void {
    if (card.loading) return;

    if (!card.form.valid) {
      this.markFormGroupTouched(card.form);
      this.notyf.error('Mohon lengkapi semua field yang wajib diisi.');
      return;
    }

    if (card.tier === 'trial' && !card.form.get('trial_theme_slug')?.value) {
      this.notyf.error('Pilih satu tema Ruby untuk paket Trial.');
      return;
    }

    this.showConfirmationModal(
      `Apakah Anda yakin ingin mengubah pengaturan ${card.title}?`,
      () => this.savePackage(card)
    );
  }

  isFieldInvalid(form: FormGroup, fieldName: string): boolean {
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(form: FormGroup, fieldName: string): string {
    const field = form.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'Field ini wajib diisi';
      if (field.errors['minlength']) return `Minimal ${field.errors['minlength'].requiredLength} karakter`;
      if (field.errors['min']) return `Nilai minimal ${field.errors['min'].min}`;
    }
    return '';
  }

  getVisibleFeatures(card: PackageCardState): PackageFeature[] {
    const packageData = card.packageData;
    if (!packageData) return this.featureFields.slice(0, 5);

    return this.featureFields.filter((feature) =>
      Object.prototype.hasOwnProperty.call(packageData, feature.key) &&
      !(card.tier === 'trial' && feature.key === 'bebas_pilih_tema')
    );
  }

  getThemeSummary(card: PackageCardState): string {
    if (card.tier === 'trial') {
      return '1 tema Ruby';
    }

    const slugs = getThemeSlugsForTier(card.tier as ThemePackageTier, this.themeAccessMap);
    if (card.tier === 'ruby') {
      return `${slugs.length} tema dapat digunakan`;
    }

    const categoryCount = this.countCategories(slugs);
    if (card.tier === 'sapphire') {
      return `${categoryCount} kategori / ${slugs.length} tema dapat digunakan`;
    }

    return 'Seluruh tema sesuai akses paket';
  }

  getSelectedTrialTheme(card: PackageCardState): ThemeOption | null {
    const selectedSlug = String(card.form.get('trial_theme_slug')?.value || '');
    return this.rubyThemes.find((theme) => theme.slug === selectedSlug) || null;
  }

  getThemeThumb(theme: ThemeOption | null): string {
    return theme?.thumbnail || 'assets/landing/template-2.png';
  }

  trackCard(_index: number, card: PackageCardState): string {
    return card.tier;
  }

  trackFeature(_index: number, feature: PackageFeature): string {
    return feature.key;
  }

  trackTheme(_index: number, theme: ThemeOption): string {
    return theme.slug;
  }

  private createPackageForm(tier: PackageTier): FormGroup {
    const group = this.fb.group({
      id: [null],
      code: [tier],
      name_paket: ['', [Validators.required, Validators.minLength(3)]],
      price: ['', [Validators.required, Validators.min(0)]],
      masa_aktif: ['', [Validators.required, Validators.min(1)]],
      halaman_buku: [false],
      kirim_wa: [false],
      bebas_pilih_tema: [false],
      kirim_hadiah: [false],
      import_data: [false],
      musik_pribadi: [false],
      google_maps: [false],
      penyesuaian_agama: [false],
      gallery_video: [false],
    });

    if (tier === 'trial') {
      group.addControl('trial_theme_slug', this.fb.control('', Validators.required));
    }

    return group;
  }

  private populateCards(data: PackageData[]): void {
    const packageMap = new Map<PackageTier, PackageData>();

    data.forEach((pkg) => {
      const tier = this.resolveTier(pkg);
      if (tier) {
        packageMap.set(tier, pkg);
      }
    });

    this.cards.forEach((card) => {
      const packageData = packageMap.get(card.tier) || null;
      card.packageData = packageData;

      if (packageData) {
        this.updateCardForm(card, packageData);
      } else {
        card.form.reset({
          id: null,
          code: card.tier,
          name_paket: '',
          price: '',
          masa_aktif: '',
          halaman_buku: false,
          kirim_wa: false,
          bebas_pilih_tema: false,
          kirim_hadiah: false,
          import_data: false,
          musik_pribadi: false,
          google_maps: false,
          penyesuaian_agama: false,
          gallery_video: false,
          ...(card.tier === 'trial' ? { trial_theme_slug: '' } : {}),
        }, { emitEvent: false });
      }
    });
  }

  private updateCardForm(card: PackageCardState, packageData: PackageData): void {
    const value: any = {
      id: packageData.id,
      code: this.resolvePackageCode(packageData) || card.tier,
      name_paket: packageData.name_paket,
      price: this.formatPrice(packageData.price),
      masa_aktif: packageData.masa_aktif,
    };

    this.featureFields.forEach((feature) => {
      value[feature.key] = this.convertToBoolean(packageData[feature.key]);
    });

    if (card.tier === 'trial') {
      value.trial_theme_slug = this.resolveTrialThemeSlug(packageData);
    }

    card.form.patchValue(value, { emitEvent: false });
  }

  private savePackage(card: PackageCardState): void {
    if (!card.packageData?.id) {
      this.notyf.error('ID paket tidak valid.');
      this.modalRef?.hide();
      return;
    }

    card.loading = true;
    const formData = this.prepareFormData(card);
    const packageId = card.packageData.id;

    this.dashboardSvc.update(DashboardServiceType.ST_BUNDLE_ADMIN, `/${packageId}`, formData)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          card.loading = false;
          this.modalRef?.hide();
        })
      )
      .subscribe({
        next: (res) => {
          this.notyf.success(res?.message || `${card.title} berhasil diperbarui.`);
          this.refreshSinglePackage(card);
        },
        error: (err) => {
          console.error('Error updating package:', err);
          this.notyf.error(err?.error?.message || 'Gagal memperbarui paket.');
        }
      });
  }

  private prepareFormData(card: PackageCardState): any {
    const formValue = card.form.value;
    const packageData = card.packageData as PackageData;
    const payload: any = {
      id: packageData.id,
      name_paket: formValue.name_paket,
      price: this.parseNumber(formValue.price),
      masa_aktif: parseInt(formValue.masa_aktif, 10),
    };

    ['code', 'package_code', 'package_tier', 'jenis_paket'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(packageData, key)) {
        payload[key] = packageData[key];
      }
    });

    this.featureFields.forEach((feature) => {
      if (Object.prototype.hasOwnProperty.call(packageData, feature.key)) {
        payload[feature.key] = formValue[feature.key] ? 1 : 0;
      }
    });

    if (card.tier === 'trial') {
      this.applyTrialThemePayload(payload, packageData, formValue['trial_theme_slug']);
    }

    return payload;
  }

  private applyTrialThemePayload(payload: any, packageData: PackageData, selectedSlug: string): void {
    const selectedTheme = this.rubyThemes.find((theme) => theme.slug === selectedSlug);

    if (Object.prototype.hasOwnProperty.call(packageData, 'accessible_categories')) {
      payload.accessible_categories = [selectedSlug];
    }

    const themeIdFields = ['trial_theme_id', 'theme_id', 'selected_theme_id'];
    themeIdFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(packageData, field)) {
        payload[field] = selectedTheme?.id || null;
      }
    });

    const themeSlugFields = ['trial_theme_slug', 'theme_slug', 'selected_theme_slug'];
    themeSlugFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(packageData, field)) {
        payload[field] = selectedSlug;
      }
    });
  }

  private refreshSinglePackage(card: PackageCardState): void {
    this.dashboardSvc.list(DashboardServiceType.ST_BUNDLE_ADMIN)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const packages = this.extractArray(res);
          const updatedPackage = packages.find((pkg) => pkg.id === card.packageData?.id);
          if (updatedPackage) {
            card.packageData = updatedPackage;
            this.updateCardForm(card, updatedPackage);
            this.originalData = packages;
            this.themeAccessMap = buildThemeAccessMap(packages);
          }
        },
        error: (err) => {
          console.error('Error refreshing package data:', err);
        }
      });
  }

  private showConfirmationModal(message: string, confirmCallback: () => void): void {
    const initialState = {
      message,
      cancelClicked: () => this.modalRef?.hide(),
      submitClicked: confirmCallback,
      submitMessage: 'Simpan Perubahan',
    };

    this.modalRef = this.modalSvc.show(ModalComponent, { initialState });

    if (this.modalRef?.content) {
      this.modalRef.content.onClose
        .pipe(takeUntil(this.destroy$))
        .subscribe((res: any) => {
          if (res?.state === 'cancel') {
            this.modalRef?.hide();
          }
        });
    }
  }

  private buildRubyThemeOptions(response: any): ThemeOption[] {
    const themes = this.extractArray(response);
    const rubyPresetSlugs = new Set(PUBLIC_THEME_PRESETS
      .filter((preset) => preset.packageTier === 'ruby')
      .map((preset) => preset.slug));

    const mappedThemes = themes
      .map((theme) => this.toThemeOption(theme))
      .filter((theme): theme is ThemeOption => !!theme && rubyPresetSlugs.has(theme.slug as any));

    if (mappedThemes.length) {
      return mappedThemes;
    }

    return PUBLIC_THEME_PRESETS
      .filter((preset) => preset.packageTier === 'ruby')
      .map((preset) => ({
        id: null,
        slug: preset.slug,
        name: preset.name,
        thumbnail: preset.fallbackImage,
      }));
  }

  private toThemeOption(theme: any): ThemeOption | null {
    const slug = resolvePublicThemeSlug(theme);
    if (!slug) return null;

    const preset = PUBLIC_THEME_PRESETS.find((item) => item.slug === slug);
    return {
      id: Number(theme.id) || null,
      slug,
      name: theme.name || theme.nama_kategori || preset?.name || slug,
      thumbnail: this.resolveThemeImage(theme) || preset?.fallbackImage || 'assets/landing/template-2.png',
    };
  }

  private resolveThemeImage(theme: any): string {
    const image = theme.thumbnail_image || theme.preview_image || theme.image || theme.preview;
    if (!image) return '';
    const value = String(image);
    if (/^https?:\/\//i.test(value) || value.startsWith('assets/')) {
      return value;
    }
    if (value.startsWith('/storage')) {
      return `${environment.apiBaseUrl.replace(/\/api\/?$/, '')}${value}`;
    }
    return value;
  }

  private resolveTrialThemeSlug(packageData: PackageData): string {
    const candidates = [
      packageData['trial_theme_slug'],
      packageData['theme_slug'],
      packageData['selected_theme_slug'],
      packageData['trial_theme'],
      packageData['theme'],
      ...(Array.isArray(packageData.accessible_categories) ? packageData.accessible_categories : []),
    ];

    for (const candidate of candidates) {
      const slug = resolvePublicThemeSlug(candidate);
      if (slug && PUBLIC_THEME_PRESETS.find((preset) => preset.slug === slug && preset.packageTier === 'ruby')) {
        return slug;
      }
    }

    return '';
  }

  private resolveTier(packageData: PackageData): PackageTier | null {
    const explicit = this.resolvePackageCode(packageData);
    if (explicit === 'trial' || explicit === 'ruby' || explicit === 'sapphire' || explicit === 'diamond') {
      return explicit;
    }

    const tier = resolvePackageTier(packageData);
    return tier === 'trial' || tier === 'ruby' || tier === 'sapphire' || tier === 'diamond'
      ? tier
      : null;
  }

  private resolvePackageCode(packageData: PackageData): string {
    const candidates = [
      packageData.code,
      packageData.package_code,
      packageData.package_tier,
      packageData.jenis_paket,
      packageData.name_paket,
    ];
    const raw = normalizeStableKey(candidates.filter(Boolean).join(' '));

    if (raw.includes('trial')) return 'trial';
    if (raw.includes('diamond') || raw.includes('platinum')) return 'diamond';
    if (raw.includes('sapphire') || raw.includes('gold')) return 'sapphire';
    if (raw.includes('ruby') || raw.includes('silver') || raw.includes('standar')) return 'ruby';
    return '';
  }

  private countCategories(slugs: string[]): number {
    const categories = new Set(
      slugs
        .map((slug) => PUBLIC_THEME_PRESETS.find((preset) => preset.slug === slug)?.category)
        .filter(Boolean)
    );
    return categories.size;
  }

  private extractArray(response: any): any[] {
    const candidates = [
      response?.data?.data,
      response?.data,
      response,
    ];
    const array = candidates.find((candidate) => Array.isArray(candidate));
    return array || [];
  }

  private convertToBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
  }

  private formatPrice(price: string | number): string {
    return Math.floor(parseFloat(String(price || 0))).toString();
  }

  private parseNumber(value: unknown): number {
    return parseFloat(String(value || '0').replace(/[^\d]/g, '')) || 0;
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }
}
