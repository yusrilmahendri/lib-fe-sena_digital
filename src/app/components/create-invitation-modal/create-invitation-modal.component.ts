import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  DashboardService,
  DashboardServiceType,
  ThemeService,
} from '../../dashboard.service';
import { LandingModalService } from '../../landing-modal.service';

export type CreateInvitationStep =
  | 'couple-detail'
  | 'theme-selection'
  | 'account'
  | 'payment'
  | 'success';

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

  /* ---- Payment step state (reuses legacy endpoints/payloads) ---- */
  paymentMethods: any[] = [];
  selectedPaymentMethod: number | null = null;
  paymentDetails: any[] = [];
  isLoadingPaymentDetails = false;
  isConfirmingPayment = false;
  paymentError = '';
  /** Captured from the one-step response for the confirm-payment payload. */
  private oneStepUserId: number | null = null;
  private oneStepKodePemesanan = '';

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

  /* Static themes per Figma — structured so they can be swapped by the API.
     Each tier shows a 3x2 grid (6 items) and reuses the landing thumbnails. */
  themesByCategory: Record<ThemeTier, ThemeOption[]> = {
    trial: [
      { slug: 'trial-lavender', name: 'Lavender', tier: 'trial', fallbackImage: 'assets/landing/template-1.png' },
      { slug: 'trial-ivory', name: 'Ivory', tier: 'trial', fallbackImage: 'assets/landing/template-2.png' },
      { slug: 'trial-mauve', name: 'Mauve', tier: 'trial', fallbackImage: 'assets/landing/template-3.png' },
      { slug: 'trial-modern', name: 'Modern', tier: 'trial', fallbackImage: 'assets/landing/template-4.png' },
      { slug: 'trial-rose', name: 'Rose', tier: 'trial', fallbackImage: 'assets/landing/template-5.png' },
      { slug: 'trial-garden', name: 'Garden', tier: 'trial', fallbackImage: 'assets/landing/template-6.png' },
    ],
    ruby: [
      { slug: 'lavender', name: 'Lavender', tier: 'ruby', fallbackImage: 'assets/landing/template-1.png' },
      { slug: 'ivory', name: 'Ivory', tier: 'ruby', fallbackImage: 'assets/landing/template-2.png' },
      { slug: 'mauve', name: 'Mauve', tier: 'ruby', fallbackImage: 'assets/landing/template-3.png' },
      { slug: 'modern', name: 'Modern', tier: 'ruby', fallbackImage: 'assets/landing/template-4.png' },
      { slug: 'rose', name: 'Rose', tier: 'ruby', fallbackImage: 'assets/landing/template-5.png' },
      { slug: 'garden', name: 'Garden', tier: 'ruby', fallbackImage: 'assets/landing/template-6.png' },
    ],
    sapphire: [
      { slug: 'sapphire-aurora', name: 'Aurora', tier: 'sapphire', fallbackImage: 'assets/landing/template-3.png' },
      { slug: 'sapphire-pearl', name: 'Pearl', tier: 'sapphire', fallbackImage: 'assets/landing/template-2.png' },
      { slug: 'sapphire-azure', name: 'Azure', tier: 'sapphire', fallbackImage: 'assets/landing/template-4.png' },
      { slug: 'sapphire-noir', name: 'Noir', tier: 'sapphire', fallbackImage: 'assets/landing/template-6.png' },
      { slug: 'sapphire-bloom', name: 'Bloom', tier: 'sapphire', fallbackImage: 'assets/landing/template-1.png' },
      { slug: 'sapphire-velvet', name: 'Velvet', tier: 'sapphire', fallbackImage: 'assets/landing/template-5.png' },
    ],
    diamond: [
      { slug: 'diamond-royal', name: 'Royal', tier: 'diamond', fallbackImage: 'assets/landing/template-4.png' },
      { slug: 'diamond-luxe', name: 'Luxe', tier: 'diamond', fallbackImage: 'assets/landing/template-5.png' },
      { slug: 'diamond-grace', name: 'Grace', tier: 'diamond', fallbackImage: 'assets/landing/template-3.png' },
      { slug: 'diamond-eternal', name: 'Eternal', tier: 'diamond', fallbackImage: 'assets/landing/template-6.png' },
      { slug: 'diamond-crystal', name: 'Crystal', tier: 'diamond', fallbackImage: 'assets/landing/template-2.png' },
      { slug: 'diamond-opal', name: 'Opal', tier: 'diamond', fallbackImage: 'assets/landing/template-1.png' },
    ],
  };

  private paketByTier: Partial<Record<ThemeTier, PaketByTier>> = {};
  private readonly themeService: ThemeService;
  private sub = new Subscription();

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
  }

  ngOnInit(): void {
    this.sub.add(
      this.modal.createOpen$.subscribe((open) => {
        this.isOpen = open;
        if (open) {
          this.resetWizard();
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

  private resetWizard(): void {
    this.step = 'couple-detail';
    this.isSubmitting = false;
    this.errorMessage = '';
    this.showPassword = false;
    this.coupleNameTouched = false;
    this.domainTouched = false;
    this.activeCategory = 'ruby';
    this.coupleDetailForm.reset();
    this.accountForm.reset({ terms: false });
    this.selectedTheme = this.themesByCategory[this.activeCategory][0] || null;

    // Payment step state
    this.paymentMethods = [];
    this.selectedPaymentMethod = null;
    this.paymentDetails = [];
    this.isLoadingPaymentDetails = false;
    this.isConfirmingPayment = false;
    this.paymentError = '';
    this.oneStepUserId = null;
    this.oneStepKodePemesanan = '';
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
      },
      error: () => {
        console.warn('[BuatUndangan] paket-undangan API unavailable.');
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

  /** Best-effort: enrich dummy themes with real ids from the popular API. */
  private loadThemes(): void {
    this.themeService.getPublicPopularThemes({ type: 'website', limit: 18 }).subscribe({
      next: (res: any) => {
        const list: any[] = this.extractThemeList(res);
        if (!list.length) return;

        // Assign real ids to existing grid slots (keeps Figma names/order).
        const flat: ThemeOption[] = [
          ...this.themesByCategory.trial,
          ...this.themesByCategory.ruby,
          ...this.themesByCategory.sapphire,
          ...this.themesByCategory.diamond,
        ];
        list.forEach((item, i) => {
          const slot = flat[i];
          if (!slot) return;
          if (item?.id != null) {
            slot.id = Number(item.id);
          }
          if (item?.name || item?.title) {
            slot.name = item.name || item.title;
          }
          const apiImage =
            item?.thumbnail_image ||
            item?.thumbnail ||
            item?.preview_image ||
            item?.image ||
            item?.preview_url ||
            item?.preview ||
            '';
          if (apiImage) {
            slot.image = apiImage;
          }
        });

        // Refresh selection reference if needed.
        if (this.selectedTheme) {
          const refreshed = this.themesByCategory[this.selectedTheme.tier].find(
            (t) => t.slug === this.selectedTheme?.slug
          );
          this.selectedTheme = refreshed || this.selectedTheme;
        }
      },
      error: () => {
        console.warn('[BuatUndangan] popular themes API unavailable, using static themes.');
      },
    });
  }

  private extractThemeList(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data?.themes)) return res.data.themes;
    return [];
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

    this.isSubmitting = true;

    const account = this.accountForm.value;
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
        this.isSubmitting = false;
        // Persist token exactly like the legacy flow (res.token), with a
        // defensive fallback in case the response nests it differently.
        const token = res?.token || res?.access_token || res?.data?.token;
        if (token) {
          localStorage.setItem('access_token', token);
        }
        if (res?.token_type) {
          localStorage.setItem('token_type', res.token_type);
        }

        // Capture identifiers needed by the legacy confirm-payment payload.
        this.oneStepUserId = res?.user?.id ?? res?.data?.user?.id ?? null;
        this.oneStepKodePemesanan =
          res?.user?.kode_pemesanan ?? res?.data?.user?.kode_pemesanan ?? '';

        this.persistLegacyFormState(res, account, paket);

        // Legacy flow requires a payment step before the account is usable.
        this.step = 'payment';
        this.loadPaymentMethods();
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

  /* -------------------------------- payment --------------------------------- */
  /** Load payment methods (legacy MD_RGS_PAYMENT / master-tagihan). */
  private loadPaymentMethods(): void {
    this.paymentError = '';
    this.dashboardSvc.getParam(DashboardServiceType.MD_RGS_PAYMENT, '').subscribe({
      next: (res: any) => {
        this.paymentMethods = Array.isArray(res?.data) ? res.data : [];
      },
      error: () => {
        this.paymentError =
          'Gagal memuat metode pembayaran. Coba lagi atau buka pembayaran dari dashboard.';
      },
    });
  }

  /** Load details for the chosen method (legacy MNL_MD_METHOD_DETAIL). */
  onPaymentMethodSelect(methodId: number): void {
    this.selectedPaymentMethod = methodId;
    this.paymentDetails = [];
    if (methodId == null) {
      return;
    }
    // Trial method (id 4) shows static instruction, no detail call needed.
    if (Number(methodId) === 4) {
      return;
    }
    this.isLoadingPaymentDetails = true;
    const query = `?id_methode_pembayaran=${methodId}`;
    this.dashboardSvc.getParam(DashboardServiceType.MNL_MD_METHOD_DETAIL, query).subscribe({
      next: (res: any) => {
        this.paymentDetails = Array.isArray(res?.data) ? res.data : [];
        this.isLoadingPaymentDetails = false;
      },
      error: () => {
        this.isLoadingPaymentDetails = false;
        this.paymentError = 'Gagal memuat detail pembayaran.';
      },
    });
  }

  /** Confirm payment (legacy RDM_CONFIRM_PAYMENT, same payload). */
  confirmPayment(): void {
    this.paymentError = '';
    if (this.selectedPaymentMethod == null || this.isConfirmingPayment) {
      return;
    }

    this.isConfirmingPayment = true;
    const payload = {
      user_id: this.oneStepUserId,
      kode_pemesanan: this.oneStepKodePemesanan || '',
    };

    this.dashboardSvc.update(DashboardServiceType.RDM_CONFIRM_PAYMENT, '', payload).subscribe({
      next: () => {
        this.isConfirmingPayment = false;
        this.step = 'success';
      },
      error: (err: any) => {
        this.isConfirmingPayment = false;
        this.paymentError =
          err?.error?.message ||
          err?.message ||
          'Konfirmasi pembayaran gagal. Silakan coba lagi.';
      },
    });
  }

  /** "Nanti saja": account already created; finish onboarding, pay later. */
  payLater(): void {
    this.step = 'success';
  }

  copyToClipboard(text: string): void {
    if (!text) {
      return;
    }
    navigator.clipboard?.writeText(text).catch(() => {
      /* clipboard failures are non-critical */
    });
  }

  goToDashboard(): void {
    this.closeModal();
    this.router.navigate(['/dashboard']);
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
    const registrasiValues = {
      paket_undangan_id: paket.id,
      price: paket.price,
      domain,
      email: account.email,
      phone: account.phone,
      kode_pemesanan: res?.user?.kode_pemesanan ?? null,
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
        nama_wanita: this.coupleDetailForm.value.brideName,
        nama_pria: this.coupleDetailForm.value.groomName,
        tanggal: this.coupleDetailForm.value.weddingDate,
        couple_name: account.coupleName,
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
}
