import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  DashboardService,
  DashboardServiceType,
  PublicCategoryWithThemes,
  ThemeService,
} from '../../dashboard.service';
import {
  CreateInvitationThemePrefill,
  LandingModalService,
} from '../../landing-modal.service';
import {
  buildThemeAccessMap,
  FALLBACK_THEME_ACCESS_MAP,
  getLowestPackageTierForTheme,
  getThemePresetBySlug,
  isThemeAccessibleForTier,
  PaidThemePackageTier,
  PUBLIC_THEME_PRESETS,
  ThemeAccessMap,
  ThemeCategoryName,
} from '../../theme-package-access.util';

export type CreateInvitationStep =
  | 'couple-detail'
  | 'theme-selection'
  | 'account'
  | 'continue-wizard';

type ThemeTier = 'trial' | 'ruby' | 'sapphire' | 'diamond';

interface ThemeCategoryTab {
  key: ThemeTier;
  label: string;
}

interface ThemeOption {
  /** Real backend theme id when available (sent as theme_id). */
  id?: number;
  /** Stable slug, always available, sent as theme_slug. */
  slug: string;
  name: string;
  tier: ThemeTier;
  /** Thumbnail to display. Prefers backend image, falls back to local asset. */
  image?: string;
  /** Local landing-page asset used as the guaranteed fallback. */
  fallbackImage: string;
}

interface ThemeCatalogSeed {
  category: ThemeCategoryName;
  fallbackImage: string;
  id?: number;
  image?: string;
  name: string;
  slug: string;
  packageTier: PaidThemePackageTier;
}

/** Resolved package mapping for a tier (from /v1/paket-undangan). */
interface PaketByTier {
  id: number;
  price: string | number;
  name?: string;
}

/**
 * CreateInvitationModalComponent — REDESIGN ONLY.
 *
 * This is a new modal wizard UI (Step 1 detail pasangan → Step 2 pilih tema →
 * Step 3 buat akun → Success) that wraps the EXISTING create-invitation logic.
 *
 * The final submit reuses the existing one-step endpoint
 * (DashboardServiceType.MNL_STEP_ONE → POST /v1/one-step), the same call and
 * FormData shape used by the legacy DataRegistrasiComponent, and stores the
 * returned token in `access_token` exactly like before. The "Pilih tema" step
 * is the only new addition: the chosen category maps to the existing
 * paket_undangan_id, and the selected theme is sent as additive
 * theme_id/theme_slug fields without changing the legacy payload semantics.
 */
@Component({
  selector: 'wc-create-invitation-modal',
  templateUrl: './create-invitation-modal.component.html',
  styleUrls: ['./create-invitation-modal.component.scss'],
})
export class CreateInvitationModalComponent implements OnInit, OnDestroy {
  isOpen = false;
  step: CreateInvitationStep = 'couple-detail';

  isSubmitting = false;
  errorMessage = '';
  showPassword = false;

  /** Password draft lives only for this open wizard instance. */
  private accountPasswordDraft = '';

  coupleDetailForm: FormGroup;
  accountForm: FormGroup;

  /** Whether the user manually edited couple name (stop auto-generating it). */
  private coupleNameTouched = false;
  /** Whether the user manually edited domain (stop auto-generating it). */
  private domainTouched = false;

  /* Packages follow the legacy system (Trial kept). The selected package drives
     paket_undangan_id, price, available themes, payment and dashboard access —
     exactly like the old flow. Tabs are package selectors. */
  categories: ThemeCategoryTab[] = [
    { key: 'trial', label: 'Trial' },
    { key: 'ruby', label: 'Ruby' },
    { key: 'sapphire', label: 'Sapphire' },
    { key: 'diamond', label: 'Diamond' },
  ];
  activeCategory: ThemeTier = 'ruby';
  selectedTheme: ThemeOption | null = null;

  /* Local landing-page theme thumbnails (same assets as the Tema section). */
  private readonly defaultThemeImages: Record<string, string> = {
    lavender: 'assets/landing/template-1.png',
    ivory: 'assets/landing/template-2.png',
    mauve: 'assets/landing/template-3.png',
    modern: 'assets/landing/template-4.png',
    rose: 'assets/landing/template-5.png',
    garden: 'assets/landing/template-6.png',
    default: 'assets/landing/template-1.png',
  };

  private readonly legacyTrialThemes: ThemeOption[] = [
    { slug: 'trial-lavender', name: 'Lavender', tier: 'trial', fallbackImage: 'assets/landing/template-1.png' },
    { slug: 'trial-ivory', name: 'Ivory', tier: 'trial', fallbackImage: 'assets/landing/template-2.png' },
    { slug: 'trial-mauve', name: 'Mauve', tier: 'trial', fallbackImage: 'assets/landing/template-3.png' },
    { slug: 'trial-modern', name: 'Modern', tier: 'trial', fallbackImage: 'assets/landing/template-4.png' },
    { slug: 'trial-rose', name: 'Rose', tier: 'trial', fallbackImage: 'assets/landing/template-5.png' },
    { slug: 'trial-garden', name: 'Garden', tier: 'trial', fallbackImage: 'assets/landing/template-6.png' },
  ];

  private readonly defaultThemeCatalog: ThemeCatalogSeed[] = [
    ...PUBLIC_THEME_PRESETS,
  ];
  private themeCatalog: ThemeCatalogSeed[] = [...this.defaultThemeCatalog];
  private themeAccessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP;

  themesByCategory: Record<ThemeTier, ThemeOption[]> = this.buildThemesByCategory();

  private paketByTier: Partial<Record<ThemeTier, PaketByTier>> = {};
  private readonly themeService: ThemeService;
  private sub = new Subscription();
  private themePrefill: CreateInvitationThemePrefill | null = null;

  constructor(
    private fb: FormBuilder,
    private dashboardSvc: DashboardService,
    private router: Router,
    private modal: LandingModalService
  ) {
    this.themeService = new ThemeService(this.dashboardSvc);

    this.coupleDetailForm = this.fb.group({
      brideName: ['', [Validators.required]],
      groomName: ['', [Validators.required]],
      weddingDate: ['', [Validators.required]],
    });

    // Mirrors legacy DataRegistrasiComponent validators & field names.
    this.accountForm = this.fb.group({
      coupleName: ['', [Validators.required]],
      domain: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      terms: [false, [Validators.requiredTrue]],
    });

    this.accountForm.get('coupleName')?.valueChanges.subscribe(() => {
      if (this.accountForm.get('coupleName')?.dirty) {
        this.coupleNameTouched = true;
      }
      this.syncAutoFieldsFromCoupleName();
    });

    this.accountForm.get('domain')?.valueChanges.subscribe(() => {
      if (this.accountForm.get('domain')?.dirty) {
        this.domainTouched = true;
      }
    });

    this.accountForm.get('password')?.valueChanges.subscribe((password) => {
      this.accountPasswordDraft = password || '';
    });
  }

  ngOnInit(): void {
    this.sub.add(
      this.modal.createOpen$.subscribe((open) => {
        this.isOpen = open;
        if (open) {
          this.themePrefill = this.modal.consumeCreateInvitationPrefill();
          this.resetWizard(this.themePrefill);
          this.loadPaketTiers();
          this.loadThemes();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  /* ----------------------------- modal controls ----------------------------- */
  closeModal(): void {
    this.modal.closeCreateInvitation();
  }

  onBackdropClick(): void {
    this.closeModal();
  }

  /** "Sudah punya akun? Masuk" → open the login modal instead of a route. */
  openLoginModal(): void {
    this.modal.openLogin();
  }

  private resetWizard(prefill?: CreateInvitationThemePrefill | null): void {
    const prefilledTheme = this.buildPrefilledTheme(prefill);

    this.step = 'couple-detail';
    this.isSubmitting = false;
    this.errorMessage = '';
    this.showPassword = false;
    this.coupleNameTouched = false;
    this.domainTouched = false;
    this.activeCategory = prefilledTheme?.tier || this.resolvePrefillTier(prefill?.tier);
    this.coupleDetailForm.reset();
    this.accountForm.reset({ terms: false });
    this.selectedTheme =
      prefilledTheme ||
      this.themesByCategory[this.activeCategory][0] ||
      null;

    this.accountPasswordDraft = '';
  }

  /** Currently selected package (drives price, themes, payment rules). */
  get selectedPaket(): PaketByTier | null {
    return this.paketByTier[this.activeCategory] ?? null;
  }

  get activeCategoryLabel(): string {
    return (
      this.categories.find((c) => c.key === this.activeCategory)?.label ||
      this.activeCategory
    );
  }

  /** Human-readable price for the selected package (legacy field `price`). */
  get selectedPaketPriceLabel(): string {
    const price = this.selectedPaket?.price;
    if (price === undefined || price === null || price === '') {
      return '';
    }
    const num = typeof price === 'number' ? price : Number(price);
    if (isNaN(num)) {
      return String(price);
    }
    if (num >= 1_000_000) {
      return `Rp ${num / 1_000_000} jt`;
    }
    if (num >= 1000) {
      return `Rp ${num / 1000} rb`;
    }
    return num === 0 ? 'Gratis' : `Rp ${num}`;
  }

  /* ------------------------------- data loading ------------------------------ */
  /** Map Trial/Ruby/Sapphire/Diamond tabs to existing paket_undangan ids. */
  private loadPaketTiers(): void {
    this.dashboardSvc.list(DashboardServiceType.MNL_MD_PACK_INVITATION).subscribe({
      next: (res: any) => {
        const list: any[] = Array.isArray(res?.data) ? res.data : [];
        const byTier: Partial<Record<ThemeTier, PaketByTier>> = {};
        this.themeAccessMap = buildThemeAccessMap(list);
        list.forEach((paket) => {
          const tier = this.resolveTier(paket);
          if (tier && !byTier[tier]) {
            byTier[tier] = {
              id: paket.id,
              price: paket.price ?? '',
              name:
                paket.name_paket_display ||
                paket.name_paket ||
                paket.jenis_paket ||
                tier,
            };
          }
        });
        this.paketByTier = byTier;
        this.themesByCategory = this.buildThemesByCategory();
        this.applyThemePrefill();
      },
      error: () => {
        console.warn('[BuatUndangan] paket-undangan API unavailable.');
        this.themeAccessMap = FALLBACK_THEME_ACCESS_MAP;
        this.themesByCategory = this.buildThemesByCategory();
        this.applyThemePrefill();
      },
    });
  }

  private resolveTier(paket: any): ThemeTier | null {
    const raw = `${paket?.package_tier || paket?.name_paket || paket?.jenis_paket || ''}`.toLowerCase();
    if (raw.includes('trial')) return 'trial';
    if (/ruby|silver|standar/.test(raw)) return 'ruby';
    if (/sapphire|gold/.test(raw)) return 'sapphire';
    if (/diamond|platinum/.test(raw)) return 'diamond';
    return null;
  }

  /** Build available themes from public categories, filtered by explicit theme access. */
  private loadThemes(): void {
    this.themeService.getPublicCategoriesWithThemes('website').subscribe({
      next: (res: any) => {
        const categories: PublicCategoryWithThemes[] = Array.isArray(res?.data?.categories)
          ? res.data.categories
          : [];
        if (categories.length) {
          this.themeCatalog = this.buildThemeCatalogFromApi(categories);
        } else {
          this.themeCatalog = [...this.defaultThemeCatalog];
        }

        this.themesByCategory = this.buildThemesByCategory();
        this.applyThemePrefill();
      },
      error: () => {
        console.warn('[BuatUndangan] public categories API unavailable, using static themes.');
        this.themeCatalog = [...this.defaultThemeCatalog];
        this.themesByCategory = this.buildThemesByCategory();
        this.applyThemePrefill();
      },
    });
  }

  private buildThemesByCategory(): Record<ThemeTier, ThemeOption[]> {
    const buildTierThemes = (tier: Exclude<ThemeTier, 'trial'>): ThemeOption[] => {
      const filtered = this.themeCatalog
        .filter((theme) => isThemeAccessibleForTier(tier, theme.slug, this.themeAccessMap))
        .map((theme) => ({
          id: theme.id,
          slug: theme.slug,
          name: theme.name,
          tier,
          image: theme.image,
          fallbackImage: theme.fallbackImage,
        }));

      if (filtered.length) {
        return filtered;
      }

      return this.defaultThemeCatalog
        .filter((theme) => isThemeAccessibleForTier(tier, theme.slug, this.themeAccessMap))
        .map((theme) => ({
          slug: theme.slug,
          name: theme.name,
          tier,
          fallbackImage: theme.fallbackImage,
        }));
    };

    return {
      trial: [...this.legacyTrialThemes],
      ruby: buildTierThemes('ruby'),
      sapphire: buildTierThemes('sapphire'),
      diamond: buildTierThemes('diamond'),
    };
  }

  private buildThemeCatalogFromApi(categories: PublicCategoryWithThemes[]): ThemeCatalogSeed[] {
    const catalog = categories.flatMap((category) => {
      const themes = Array.isArray(category?.jenis_themas) ? category.jenis_themas : [];
      return themes.reduce<ThemeCatalogSeed[]>((result, theme) => {
        const preset = getThemePresetBySlug(
          (theme as any)?.slug || this.slugifyThemeName(theme.name)
        );
        if (!preset) {
          return result;
        }

        result.push({
          id: theme.id,
          slug: preset.slug,
          name: preset.name,
          category: preset.category,
          packageTier: preset.packageTier,
          image:
            theme.thumbnail_image ||
            theme.preview_image ||
            theme.image ||
            undefined,
          fallbackImage: preset.fallbackImage,
        });

        return result;
      }, []);
    });

    return catalog.length ? catalog : [...this.defaultThemeCatalog];
  }

  private slugifyThemeName(value: string): string {
    return String(value || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* ------------------------------ step navigation ---------------------------- */
  get currentThemes(): ThemeOption[] {
    return this.themesByCategory[this.activeCategory] || [];
  }

  /** Select package tab — determines price, themes, payment & dashboard access. */
  setCategory(tier: ThemeTier): void {
    this.activeCategory = tier;
    if (!this.selectedTheme || this.selectedTheme.tier !== tier) {
      this.selectedTheme = this.currentThemes[0] || null;
    }
  }

  selectPaket(tier: ThemeTier): void {
    this.setCategory(tier);
  }

  selectTheme(theme: ThemeOption): void {
    this.selectedTheme = theme;
  }

  /** Image priority: backend image → local landing asset → default fallback. */
  getThemeImage(theme: ThemeOption): string {
    return (
      theme.image ||
      theme.fallbackImage ||
      this.defaultThemeImages[theme.slug] ||
      this.defaultThemeImages['default']
    );
  }

  /** Swap to the local landing asset if a backend image fails to load. */
  onThemeImgError(theme: ThemeOption): void {
    const fallback =
      theme.fallbackImage ||
      this.defaultThemeImages[theme.slug] ||
      this.defaultThemeImages['default'];
    if (theme.image !== fallback) {
      theme.image = fallback;
    }
  }

  isThemeSelected(theme: ThemeOption): boolean {
    return (
      !!this.selectedTheme &&
      this.selectedTheme.tier === theme.tier &&
      this.selectedTheme.slug === theme.slug
    );
  }

  goToCoupleDetailStep(): void {
    this.errorMessage = '';
    this.step = 'couple-detail';
  }

  goToThemeSelectionStep(): void {
    this.errorMessage = '';
    if (this.coupleDetailForm.invalid) {
      this.coupleDetailForm.markAllAsTouched();
      return;
    }
    this.step = 'theme-selection';
  }

  goToAccountStep(): void {
    this.errorMessage = '';
    if (!this.selectedTheme || this.selectedTheme.tier !== this.activeCategory) {
      this.errorMessage = 'Pilih salah satu tema untuk paket ini.';
      return;
    }
    if (!this.selectedPaket?.id) {
      this.errorMessage = 'Paket undangan belum tersedia. Coba lagi sebentar lagi.';
      return;
    }

    const bride = (this.coupleDetailForm.value.brideName || '').trim();
    const groom = (this.coupleDetailForm.value.groomName || '').trim();
    const generatedCouple = bride && groom ? `${bride} & ${groom}` : bride || groom;

    if (!this.coupleNameTouched && generatedCouple) {
      this.accountForm.patchValue({ coupleName: generatedCouple }, { emitEvent: false });
    }

    if (!this.domainTouched) {
      const baseName = this.accountForm.get('coupleName')?.value || generatedCouple;
      if (baseName) {
        this.accountForm.patchValue({ domain: this.buildDomain(baseName) }, { emitEvent: false });
      }
    }

    if (!this.accountForm.get('password')?.value && this.accountPasswordDraft) {
      this.accountForm.patchValue({ password: this.accountPasswordDraft });
    }

    this.step = 'account';
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  /* -------------------------------- submit ---------------------------------- */
  submitCreateInvitation(): void {
    this.errorMessage = '';
    if (this.accountForm.invalid || this.isSubmitting) {
      this.accountForm.markAllAsTouched();
      return;
    }

    const paket = this.paketByTier[this.activeCategory];
    if (!paket?.id) {
      this.errorMessage =
        'Paket undangan belum tersedia. Coba lagi sebentar lagi.';
      return;
    }

    const account = this.accountForm.value;
    this.accountPasswordDraft = account.password || '';
    this.isSubmitting = true;
    const domain = String(account.domain || '').trim();
    const payload = new FormData();
    // --- Legacy one-step payload (unchanged field names) ---
    payload.append('paket_undangan_id', String(paket.id));
    payload.append('price', String(paket.price ?? ''));
    payload.append('domain', domain);
    payload.append('email', account.email);
    payload.append('password', account.password);
    payload.append('phone', account.phone);
    payload.append('kode_pemesanan', '');
    // --- Additive theme fields (do not affect legacy semantics) ---
    if (this.selectedTheme?.id != null) {
      payload.append('theme_id', String(this.selectedTheme.id));
    }
    if (this.selectedTheme?.slug) {
      payload.append('theme_slug', this.selectedTheme.slug);
    }

    this.dashboardSvc.create(DashboardServiceType.MNL_STEP_ONE, payload).subscribe({
      next: (res: any) => {
        // Persist token exactly like the legacy flow (res.token), with a
        // defensive fallback in case the response nests it differently.
        const token = res?.token || res?.access_token || res?.data?.token;
        if (token) {
          localStorage.setItem('access_token', token);
        }
        if (res?.token_type) {
          localStorage.setItem('token_type', res.token_type);
        }

        const invitationId =
          res?.invitation?.id ?? res?.data?.invitation?.id ?? null;
        const amount =
          res?.invitation?.package_price_snapshot ??
          res?.data?.invitation?.package_price_snapshot ??
          paket.price;

        if (!token || invitationId == null) {
          this.isSubmitting = false;
          this.errorMessage =
            'Pendaftaran berhasil tetapi data sesi tidak lengkap. Silakan masuk ke form undangan untuk melanjutkan.';
          return;
        }

        this.persistLegacyFormState(res, account, paket);

        this.isSubmitting = false;
        this.step = 'continue-wizard';
      },
      error: (err: any) => {
        this.isSubmitting = false;
        this.errorMessage =
          this.firstValidationError(err) ||
          err?.error?.message ||
          err?.message ||
          'Pendaftaran gagal. Silakan periksa data dan coba lagi.';
      },
    });
  }


  /** Resume legacy wizard at step 2 (informasi mempelai). */
  continueToBuatUndangan(): void {
    try {
      sessionStorage.setItem(
        'landingOnboardingNotice',
        'Data dasar berhasil dibuat. Silakan lengkapi data undangan sebelum melakukan pembayaran.'
      );
    } catch {
      /* non-critical */
    }
    this.closeModal();
    this.router.navigate(['/buat-undangan'], {
      state: {
        registrationDraft: {
          password: this.accountPasswordDraft,
        },
      },
    });
  }

  /* ------------------------------- helpers ---------------------------------- */
  /** Build a domain slug from the couple name (min 3 chars, url-safe). */
  private buildDomain(coupleName: string): string {
    const slug = (coupleName || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, '-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug.length >= 3 ? slug : `${slug}-undangan`;
  }

  /** Auto-suggest domain from couple name until the user edits domain manually. */
  private syncAutoFieldsFromCoupleName(): void {
    if (this.domainTouched) {
      return;
    }
    const coupleName = this.accountForm.get('coupleName')?.value;
    if (coupleName) {
      this.accountForm.patchValue(
        { domain: this.buildDomain(coupleName) },
        { emitEvent: false }
      );
    }
  }

  /**
   * Mirror the legacy GenerateUndanganComponent localStorage shape so a user
   * who later opens /buat-undangan can resume the remaining steps. This only
   * writes the same keys the old flow already uses.
   */
  private persistLegacyFormState(res: any, account: any, paket: PaketByTier): void {
    const domain = String(account.domain || '').trim();
    const userId = res?.user?.id ?? res?.data?.user?.id ?? null;
    const kodePemesanan =
      res?.user?.kode_pemesanan ?? res?.data?.user?.kode_pemesanan ?? '';
    const brideName = String(this.coupleDetailForm.value.brideName || '').trim();
    const groomName = String(this.coupleDetailForm.value.groomName || '').trim();

    const registrasiValues = {
      paket_undangan_id: paket.id,
      price: paket.price,
      domain,
      email: account.email,
      phone: account.phone,
      kode_pemesanan: kodePemesanan,
    };

    // Shape mirrors the legacy DataRegistrasiComponent emit so the legacy
    // payment step (regis-pembayaran/payment-confirm) can read it if the user
    // later resumes via /buat-undangan: registrasi.formData.price and
    // registrasi.response.user.{id,kode_pemesanan}.
    const registrasi = {
      ...registrasiValues,
      formData: registrasiValues,
      response: res,
    };

    const formData = {
      registrasi,
      informasiMempelai: {
        updatedData: {
          name_lengkap_wanita: brideName,
          name_panggilan_wanita: brideName,
          name_lengkap_pria: groomName,
          name_panggilan_pria: groomName,
          user_id: userId,
          status: 1,
        },
        couple_name: account.coupleName,
        tanggal: this.coupleDetailForm.value.weddingDate,
      },
      cerita: {},
      pembayaran: {},
      theme: this.selectedTheme,
      response: res,
      step: 2,
    };

    try {
      localStorage.setItem('formData', JSON.stringify(formData));
      localStorage.setItem('formRegis', JSON.stringify(registrasi));
      if (userId != null) {
        localStorage.setItem('oneStepUserId', String(userId));
      }
      if (kodePemesanan) {
        localStorage.setItem('oneStepKodePemesanan', kodePemesanan);
      }
    } catch {
      // Storage failures must never block the success flow.
    }
  }

  private firstValidationError(err: any): string | null {
    const errors = err?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const firstVal = firstKey ? errors[firstKey] : null;
      if (Array.isArray(firstVal) && firstVal.length) {
        return firstVal[0];
      }
      if (typeof firstVal === 'string') {
        return firstVal;
      }
    }
    return null;
  }

  private resolvePrefillTier(tier?: string | null): ThemeTier {
    const raw = `${tier || ''}`.toLowerCase();
    if (raw.includes('trial')) return 'trial';
    if (raw.includes('sapphire')) return 'sapphire';
    if (raw.includes('diamond')) return 'diamond';
    return 'ruby';
  }

  private buildPrefilledTheme(
    prefill?: CreateInvitationThemePrefill | null
  ): ThemeOption | null {
    if (!prefill?.slug) {
      return null;
    }

    const preset = getThemePresetBySlug(prefill.slug);
    const resolvedTier = preset?.packageTier || this.resolvePrefillTier(prefill.tier);

    return {
      id: prefill.id,
      slug: preset?.slug || prefill.slug,
      name: preset?.name || prefill.name || prefill.slug,
      tier: resolvedTier,
      image: prefill.image,
      fallbackImage:
        prefill.fallbackImage || preset?.fallbackImage || this.defaultThemeImages['default'],
    };
  }

  private applyThemePrefill(): void {
    if (!this.themePrefill?.slug) {
      return;
    }

    const tier =
      getThemePresetBySlug(this.themePrefill.slug)?.packageTier ||
      this.resolvePrefillTier(this.themePrefill.tier);
    const prefills = this.themesByCategory[tier];
    const matchedTheme =
      prefills.find((theme) => theme.slug === this.themePrefill?.slug) ||
      prefills.find((theme) => theme.id === this.themePrefill?.id);

    this.activeCategory = tier;

    if (matchedTheme) {
      this.selectedTheme = matchedTheme;
      return;
    }

    const prefilledTheme = this.buildPrefilledTheme(this.themePrefill);
    if (!prefilledTheme) {
      return;
    }

    this.themesByCategory[tier] = [prefilledTheme, ...prefills];
    this.selectedTheme = prefilledTheme;
  }

}
