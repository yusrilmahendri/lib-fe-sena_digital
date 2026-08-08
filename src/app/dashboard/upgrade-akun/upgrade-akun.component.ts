import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, of, Subject, take, takeUntil } from 'rxjs';
import {
  DashboardService,
  DashboardServiceType,
  ProfileData,
  ProfileResponse,
} from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { environment } from 'src/environments/environment';

type PaymentMethod = 'manual' | 'midtrans' | null;
type SelectablePaymentMethod = 'manual' | 'midtrans';
type PackageAction = 'current' | 'downgrade' | 'upgrade' | 'renew' | 'subscribe' | 'select' | 'unavailable';
type CheckoutState =
  | 'confirmation'
  | 'method'
  | 'creating'
  | 'creation_error'
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed'
  | 'expired';

interface UpgradePackage {
  id: number | string | null;
  code: string;
  name: string;
  price: number | string | null;
  priceLabel: string;
  originalPrice: number | string | null;
  originalPriceLabel: string;
  discountPercentage: number | string | null;
  discountAmount: number | string | null;
  discountAmountLabel: string;
  upgradePrice: number | string | null;
  upgradePriceLabel: string;
  description: string;
  thumbnail: string;
  badge: string;
  statusLabel: string;
  features: string[];
  isCurrent: boolean;
  isLastPackage: boolean;
  subscriptionStatus: string;
  canSelect: boolean;
  canUpgrade: boolean;
  canDowngrade: boolean;
  action: PackageAction | null;
  disabledReason: string;
  pendingMessage: string;
  raw: any;
}

interface PaymentMethodOption {
  type: SelectablePaymentMethod;
  label: string;
  details: any;
}

@Component({
  selector: 'wc-upgrade-akun',
  templateUrl: './upgrade-akun.component.html',
  styleUrls: ['./upgrade-akun.component.scss']
})
export class UpgradeAkunComponent implements OnInit, OnDestroy {
  @ViewChildren('packageCard') packageCardElements!: QueryList<ElementRef<HTMLElement>>;

  packages: UpgradePackage[] = [];
  currentPackage: UpgradePackage | null = null;
  lastPackage: UpgradePackage | null = null;
  userProfile: ProfileData | null = null;
  activeSubscription: any = null;
  latestTransaction: any = null;
  isLoading = true;
  isRefreshingProfile = false;
  errorMessage = '';

  selectedPackage: UpgradePackage | null = null;
  activePaymentMethod: PaymentMethod = null;
  paymentMethods: PaymentMethodOption[] = [];
  isLoadingPaymentMethods = false;
  paymentMethodsError = '';
  isModalOpen = false;
  isCreatingInvoice = false;
  paymentError = '';
  paymentInfoMessage = '';
  invoiceData: any = null;
  checkoutState: CheckoutState = 'confirmation';
  requestedPackage = '';
  requestedTheme = '';
  requestedThemeSlug = '';
  returnUrl = '';
  requiredPackageMessage = '';

  private readonly destroy$ = new Subject<void>();
  private hasOpenedRequestedPackageModal = false;

  constructor(
    private dashboardService: DashboardService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.requestedPackage = String(params?.['package'] || '').trim().toLowerCase();
        this.requestedTheme = String(params?.['theme'] || '').trim();
        this.requestedThemeSlug = String(params?.['themeSlug'] || '').trim();
        this.returnUrl = String(params?.['returnUrl'] || '').trim();
        this.requiredPackageMessage = this.buildRequiredPackageMessage();
        this.scrollToRequestedPackage();
      });

    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      profile: this.dashboardService.getProfile(),
      packages: this.dashboardService.list(DashboardServiceType.USER_PACKAGES),
      paymentConfig: this.dashboardService.getUserPaymentConfig().pipe(catchError(() => of(null))),
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: ({ profile, packages, paymentConfig }) => {
          this.applyDashboardState(profile, packages, paymentConfig);
          this.scrollToRequestedPackage();
          this.openRequestedPackageModal();
        },
        error: (error) => {
          this.errorMessage = getFriendlyErrorMessage(error);
        },
      });
  }

  refreshProfileAndPackage(): void {
    this.isRefreshingProfile = true;
    forkJoin({
      profile: this.dashboardService.getProfile(),
      packages: this.dashboardService.list(DashboardServiceType.USER_PACKAGES),
      paymentConfig: this.dashboardService.getUserPaymentConfig().pipe(catchError(() => of(null))),
    })
      .pipe(
        take(1),
        finalize(() => this.isRefreshingProfile = false)
      )
      .subscribe({
        next: ({ profile, packages, paymentConfig }: { profile: ProfileResponse; packages: any; paymentConfig: any }) => {
          this.applyDashboardState(profile, packages, paymentConfig);
          this.scrollToRequestedPackage();
          this.redirectBackWhenUpgradeIsActive();
          window.dispatchEvent(new CustomEvent('profileUpdated', {
            detail: { profileData: this.userProfile }
          }));
          this.broadcastProfileRefresh();
        },
        error: (error) => {
          this.paymentError = getFriendlyErrorMessage(error);
        },
      });
  }

  openUpgradeModal(pkg: UpgradePackage): void {
    if (this.isPackageDisabled(pkg)) return;

    this.selectedPackage = pkg;
    this.isModalOpen = true;
    this.activePaymentMethod = null;
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.invoiceData = this.resolveExistingTransactionForPackage(pkg);
    this.checkoutState = this.invoiceData
      ? this.resolveCheckoutState(this.invoiceData)
      : 'confirmation';
    this.activePaymentMethod = this.invoiceData
      ? this.resolveResponsePaymentMethod(this.invoiceData)
      : null;
    this.refreshPaymentMethodsForCheckout();
  }

  closeUpgradeModal(): void {
    if (this.isCreatingInvoice) return;
    this.isModalOpen = false;
    this.selectedPackage = null;
    this.activePaymentMethod = null;
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.invoiceData = null;
    this.checkoutState = 'confirmation';
  }

  continueToPaymentMethod(): void {
    if (this.isCreatingInvoice || this.isLoadingPaymentMethods) return;
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.checkoutState = 'method';
  }

  startPayment(method: SelectablePaymentMethod): void {
    if (!this.selectedPackage || this.isCreatingInvoice || !this.hasPaymentMethod(method)) return;

    this.isCreatingInvoice = true;
    this.activePaymentMethod = method;
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.checkoutState = 'creating';

    const payload = this.buildUpgradePayload(this.selectedPackage, method);
    this.dashboardService.create(DashboardServiceType.USER_PACKAGE_UPGRADE, payload)
      .pipe(
        take(1),
        finalize(() => this.isCreatingInvoice = false)
      )
      .subscribe({
        next: (response) => {
          this.invoiceData = response?.data || response || {};
          this.activePaymentMethod = this.resolveResponsePaymentMethod(this.invoiceData) || method;
          this.checkoutState = this.resolveCheckoutState(this.invoiceData);

          if (this.activePaymentMethod === 'manual') {
            this.paymentInfoMessage = response?.message || `${this.modalPackageName} menunggu pembayaran.`;
            this.refreshProfileAndPackage();
            return;
          }

          if (this.activePaymentMethod === 'midtrans') {
            this.openMidtransPayment(this.invoiceData, response?.message);
            return;
          }

          this.paymentError = 'Metode pembayaran dari transaksi upgrade tidak ditemukan.';
          this.checkoutState = 'creation_error';
        },
        error: (error) => {
          this.invoiceData = null;
          this.checkoutState = 'creation_error';
          this.paymentError = this.resolvePaymentCreationError(error);
        },
      });
  }

  retryPaymentCreation(): void {
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.invoiceData = null;
    this.checkoutState = 'method';
  }

  restartPayment(): void {
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.invoiceData = null;
    this.checkoutState = 'method';
  }

  continueExistingPayment(): void {
    if (!this.invoiceData || this.isCreatingInvoice) return;

    const method = this.resolveResponsePaymentMethod(this.invoiceData) || this.activePaymentMethod || 'midtrans';
    this.activePaymentMethod = method;

    if (method === 'midtrans') {
      this.openMidtransPayment(this.invoiceData);
      return;
    }

    this.checkoutState = 'pending';
  }

  useActivePackage(): void {
    this.refreshProfileAndPackage();
    this.closeUpgradeModal();
  }

  get hasCreatedTransaction(): boolean {
    return !!this.invoiceData;
  }

  get modalPackageName(): string {
    return this.selectedPackage?.name || 'paket pilihan';
  }

  get modalPackageDisplayName(): string {
    const name = this.modalPackageName.trim();
    if (!name) return 'paket pilihan';
    return /^paket\s+/i.test(name) ? name : `Paket ${name}`;
  }

  get modalPackagePrice(): string {
    return this.selectedPackage && this.canShowPackageUpgradePricing(this.selectedPackage)
      ? this.selectedPackage.upgradePriceLabel
      : this.invoiceAmount || this.selectedPackage?.priceLabel || '-';
  }

  get primaryPaymentMethod(): SelectablePaymentMethod | null {
    if (this.hasPaymentMethod('midtrans')) return 'midtrans';
    if (this.hasPaymentMethod('manual')) return 'manual';
    return null;
  }

  get primaryPaymentCtaLabel(): string {
    const amount = this.modalPackagePrice;
    return amount && amount !== '-' ? `Bayar ${amount}` : 'Bayar Sekarang';
  }

  get highestPackageMessage(): string {
    return this.currentPackage && !this.packages.some((pkg) => this.getPackageAction(pkg) === 'upgrade')
      ? 'Anda sudah menggunakan paket tertinggi.'
      : '';
  }

  get selectedPackageHasUpgradePricing(): boolean {
    return !!(
      this.selectedPackage &&
      (
        this.selectedPackage.originalPriceLabel ||
        this.selectedPackage.discountAmountLabel ||
        this.selectedPackage.upgradePriceLabel
      )
    );
  }

  get selectedPackageDiscountLabel(): string {
    const percent = this.selectedPackage?.discountPercentage;
    if (percent === null || percent === undefined || percent === '') return 'Diskon Upgrade';
    return `Diskon Upgrade ${this.formatPercent(percent)}`;
  }

  get checkoutStatusTitle(): string {
    switch (this.checkoutState) {
      case 'creation_error':
        return 'Pembayaran Belum Dapat Diproses';
      case 'pending':
        return 'Menunggu Pembayaran';
      case 'processing':
        return 'Pembayaran Sedang Diproses';
      case 'success':
        return 'Pembayaran Berhasil';
      case 'failed':
        return 'Pembayaran Gagal';
      case 'expired':
        return 'Waktu Pembayaran Habis';
      default:
        return '';
    }
  }

  get checkoutStatusMessage(): string {
    switch (this.checkoutState) {
      case 'creation_error':
        return 'Kami belum berhasil membuat transaksi pembayaran. Tidak ada pembayaran yang terpotong. Silakan coba kembali.';
      case 'pending':
        return `Pembayaran ${this.modalPackageDisplayName} belum selesai. Selesaikan pembayaran agar paket dapat diaktifkan.`;
      case 'processing':
        return 'Pembayaran Anda sedang diverifikasi. Paket akan aktif otomatis setelah pembayaran berhasil.';
      case 'success':
        return `${this.modalPackageDisplayName} Anda sudah aktif. Semua fitur ${this.modalPackageDisplayName} sekarang dapat digunakan.`;
      case 'failed':
        return 'Pembayaran belum berhasil dan paket Anda belum berubah.';
      case 'expired':
        return 'Batas waktu pembayaran telah berakhir. Buat pembayaran baru untuk melanjutkan upgrade.';
      default:
        return '';
    }
  }

  get checkoutStatusIcon(): string {
    if (this.checkoutState === 'success') return 'fas fa-check-circle';
    if (this.checkoutState === 'pending') return 'fas fa-clock';
    if (this.checkoutState === 'processing') return 'fas fa-spinner fa-spin';
    if (this.checkoutState === 'expired') return 'fas fa-hourglass-end';
    return 'fas fa-exclamation-circle';
  }

  get isStatusState(): boolean {
    return ['creation_error', 'pending', 'processing', 'success', 'failed', 'expired'].includes(this.checkoutState);
  }

  getPackageAction(pkg: UpgradePackage): PackageAction {
    const action = pkg.action;

    if (this.isSubscriptionExpired()) {
      if (this.isTrialPackage(pkg)) return 'unavailable';
      if (!pkg.canSelect) return 'unavailable';
      if (action === 'downgrade' || pkg.canDowngrade || this.isLowerTierPackage(pkg)) return 'unavailable';
      if (action === 'renew' || pkg.isLastPackage) return 'renew';
      if ((action === 'upgrade' || pkg.canUpgrade) && !this.hasValidUpgradePricing(pkg)) return 'unavailable';
      if (action === 'upgrade' || action === 'subscribe' || action === 'select') return action;
      return 'subscribe';
    }

    if (pkg.isCurrent) return 'current';
    if (this.isTrialPackage(pkg)) return 'unavailable';
    if (!pkg.canSelect) return 'unavailable';

    if (action === 'downgrade' || pkg.canDowngrade || this.isLowerTierPackage(pkg)) return 'unavailable';
    if ((action === 'upgrade' || pkg.canUpgrade) && !this.hasValidUpgradePricing(pkg)) return 'unavailable';
    if (action === 'upgrade' || action === 'renew' || action === 'subscribe' || action === 'select') return action;
    if (pkg.canUpgrade) return 'upgrade';
    return 'unavailable';
  }

  getActionLabel(pkg: UpgradePackage): string {
    const action = this.getPackageAction(pkg);
    if (action === 'current') return 'Paket Saat Ini';
    if (action === 'renew') return 'Perpanjang';
    if (action === 'subscribe' || action === 'select') return 'Pilih Paket';
    if (action === 'unavailable') {
      if (this.isLowerTierPackage(pkg)) return 'Downgrade tidak tersedia';
      if ((pkg.action === 'upgrade' || pkg.canUpgrade) && !this.hasValidUpgradePricing(pkg)) return 'Harga upgrade belum tersedia';
      return pkg.disabledReason || pkg.pendingMessage || 'Tidak tersedia';
    }
    return `Upgrade ke ${pkg.name}`;
  }

  isPackageDisabled(pkg: UpgradePackage): boolean {
    const action = this.getPackageAction(pkg);
    return action === 'current' || action === 'unavailable';
  }

  isCurrentPackage(pkg: UpgradePackage): boolean {
    return pkg.isCurrent && !this.isSubscriptionExpired();
  }

  isLastExpiredPackage(pkg: UpgradePackage): boolean {
    return pkg.isLastPackage && this.isSubscriptionExpired();
  }

  getPackageBadge(pkg: UpgradePackage): string {
    if (this.isCurrentPackage(pkg)) return 'Paket Saat Ini';
    if (this.isLastExpiredPackage(pkg)) return 'Paket Terakhir - Kedaluwarsa';
    return pkg.badge;
  }

  trackByPackage(index: number, pkg: UpgradePackage): string {
    return String(pkg.id ?? pkg.code ?? index);
  }

  isRequestedPackage(pkg: UpgradePackage): boolean {
    if (!this.requestedPackage) return false;
    const candidates = [
      pkg.code,
      pkg.name,
      pkg.raw?.package_code,
      pkg.raw?.code,
      pkg.raw?.kode_paket,
      pkg.raw?.package_tier,
      pkg.raw?.name_paket,
      pkg.raw?.jenis_paket,
    ];

    return candidates
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(this.requestedPackage));
  }

  copyToClipboard(value: string | number | null | undefined): void {
    const text = String(value || '').trim();
    if (!text) return;
    navigator.clipboard?.writeText(text);
  }

  get manualPayment(): any {
    return this.invoiceData?.manual_payment || this.invoiceData?.rekening || this.invoiceData?.bank_account || {};
  }

  get manualAccounts(): any[] {
    const invoiceAccounts = this.normalizeManualAccounts(this.manualPayment);
    if (invoiceAccounts.length) return invoiceAccounts;

    const manualMethod = this.paymentMethods.find((method) => method.type === 'manual');
    return this.normalizeManualAccounts(manualMethod?.details);
  }

  get primaryManualAccount(): any {
    return this.manualAccounts[0] || {};
  }

  get manualInstructions(): string[] {
    const candidates = [
      this.invoiceData?.instructions,
      this.invoiceData?.instruction,
      this.invoiceData?.manual_payment?.instructions,
      this.invoiceData?.manual_payment?.instruction,
      this.paymentMethods.find((method) => method.type === 'manual')?.details?.instructions,
      this.paymentMethods.find((method) => method.type === 'manual')?.details?.instruction,
    ];
    const value = candidates.find((candidate) => !!candidate);
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === 'string') return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return [];
  }

  get invoiceNumber(): string {
    const value = this.invoiceData?.invoice_number || this.invoiceData?.order_number || this.invoiceData?.order_id || this.invoiceData?.transaction_code;
    return String(value || '').trim();
  }

  get invoiceAmount(): string {
    const value = this.invoiceData?.amount || this.invoiceData?.total || this.invoiceData?.gross_amount || this.selectedPackage?.price;
    return this.formatPrice(value, this.invoiceData?.amount_label || this.invoiceData?.total_label);
  }

  get latestTransactionStatus(): string {
    const status = this.latestTransaction?.status || this.latestTransaction?.payment_status || this.invoiceData?.status || this.invoiceData?.payment_status;
    return String(status || '').trim();
  }

  get latestTransactionStatusLabel(): string {
    return this.humanizePaymentStatus(this.latestTransactionStatus);
  }

  get modalTitle(): string {
    if (!this.selectedPackage) return 'Upgrade Akun';
    const action = this.getPackageAction(this.selectedPackage);
    if (action === 'renew') return `Perpanjang ${this.modalPackageDisplayName}`;
    if (action === 'downgrade') return `Downgrade ke ${this.modalPackageDisplayName}`;
    if (action === 'subscribe' || action === 'select') return `Pilih ${this.modalPackageDisplayName}`;
    return `Upgrade ke ${this.modalPackageDisplayName}`;
  }

  get isDowngradeSelection(): boolean {
    return false;
  }

  get downgradeConfirmationMessage(): string {
    if (!this.selectedPackage) return '';
    const packageInfo: any = this.userProfile?.package_info || {};
    const currentName = this.currentPackage?.name || packageInfo.name || packageInfo.name_paket || 'paket saat ini';
    return `Anda akan berpindah dari ${currentName} ke ${this.selectedPackage.name}. Beberapa fitur dan tema mungkin tidak lagi dapat digunakan setelah paket baru aktif.`;
  }

  hasPaymentMethod(method: SelectablePaymentMethod): boolean {
    return this.paymentMethods.some((item) => item.type === method);
  }

  canShowPackageUpgradePricing(pkg: UpgradePackage): boolean {
    return this.getPackageAction(pkg) === 'upgrade' && this.hasValidUpgradePricing(pkg);
  }

  private buildRequiredPackageMessage(): string {
    if (!this.requestedPackage || (!this.requestedTheme && !this.requestedThemeSlug)) return '';
    return `Paket ${this.humanizePackage(this.requestedPackage)} diperlukan untuk menggunakan tema ${this.humanizeThemeSlug(this.requestedThemeSlug || this.requestedTheme)}.`;
  }

  private scrollToRequestedPackage(): void {
    if (!this.requestedPackage || !this.packages.length) return;

    setTimeout(() => {
      const index = this.packages.findIndex((pkg) => this.isRequestedPackage(pkg));
      const element = this.packageCardElements?.toArray()?.[index]?.nativeElement;
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  }

  private openRequestedPackageModal(): void {
    if (this.hasOpenedRequestedPackageModal || this.isModalOpen || !this.requestedPackage || !this.packages.length) return;

    const requested = this.packages.find((pkg) => this.isRequestedPackage(pkg));
    if (!requested || this.isPackageDisabled(requested)) return;

    this.hasOpenedRequestedPackageModal = true;
    this.openUpgradeModal(requested);
  }

  private redirectBackWhenUpgradeIsActive(): void {
    if (!this.returnUrl || !this.requestedPackage || !this.isRequestedPackageActive()) return;

    this.router.navigateByUrl(this.buildReturnUrlWithSuccess());
  }

  private isRequestedPackageActive(): boolean {
    const paidStatuses = ['paid', 'settlement', 'settled', 'success', 'sukses', 'confirmed', 'active', 'aktif'];
    const latestStatus = String(this.latestTransaction?.status || this.latestTransaction?.payment_status || '').toLowerCase().trim();
    const backendSaysPaid = paidStatuses.includes(latestStatus);
    const currentMatches = !!this.currentPackage && this.isRequestedPackage(this.currentPackage);
    return currentMatches || backendSaysPaid;
  }

  private buildReturnUrlWithSuccess(): string {
    const separator = this.returnUrl.includes('?') ? '&' : '?';
    const query = [
      'upgradeSuccess=1',
      `package=${encodeURIComponent(this.requestedPackage)}`,
      this.requestedTheme ? `theme=${encodeURIComponent(this.requestedTheme)}` : '',
      this.requestedThemeSlug ? `themeSlug=${encodeURIComponent(this.requestedThemeSlug)}` : '',
    ].filter(Boolean).join('&');

    return `${this.returnUrl}${separator}${query}`;
  }

  private humanizePackage(value: string): string {
    const normalized = String(value || '').trim();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'paket tujuan';
  }

  private humanizeThemeSlug(value: string): string {
    return String(value || 'tema')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private isLowerTierPackage(pkg: UpgradePackage): boolean {
    const currentRank = this.resolvePackageRank(this.currentPackage || this.lastPackage);
    const packageRank = this.resolvePackageRank(pkg);
    return currentRank > 0 && packageRank > 0 && packageRank < currentRank;
  }

  private isTrialPackage(pkg: UpgradePackage): boolean {
    const value = [
      pkg.code,
      pkg.name,
      pkg.raw?.package_code,
      pkg.raw?.package_tier,
      pkg.raw?.kode_paket,
      pkg.raw?.name_paket,
      pkg.raw?.jenis_paket,
    ].filter(Boolean).join(' ').toLowerCase();
    return value.includes('trial') || value.includes('gratis') || value.includes('free');
  }

  private hasValidUpgradePricing(pkg: UpgradePackage): boolean {
    const upgradePrice = this.toNumber(pkg.upgradePrice);
    if (Number.isFinite(upgradePrice) && upgradePrice > 0) return true;
    return !!pkg.upgradePriceLabel && pkg.upgradePriceLabel !== '-';
  }

  private resolvePackageRank(pkg: UpgradePackage | null | undefined): number {
    if (!pkg) return 0;
    const value = [
      pkg.code,
      pkg.name,
      pkg.raw?.package_code,
      pkg.raw?.package_tier,
      pkg.raw?.kode_paket,
      pkg.raw?.name_paket,
      pkg.raw?.jenis_paket,
    ].filter(Boolean).join(' ').toLowerCase();

    if (value.includes('diamond')) return 3;
    if (value.includes('sapphire')) return 2;
    if (value.includes('ruby')) return 1;
    const explicitRank = this.toNumber(pkg.raw?.rank ?? pkg.raw?.level ?? pkg.raw?.tier_level ?? pkg.raw?.sort_order);
    return Number.isFinite(explicitRank) ? explicitRank : 0;
  }

  private refreshPaymentMethodsForCheckout(): void {
    this.isLoadingPaymentMethods = true;
    this.paymentMethodsError = '';

    this.dashboardService.getUserPaymentConfig()
      .pipe(
        take(1),
        finalize(() => this.isLoadingPaymentMethods = false)
      )
      .subscribe({
        next: (response) => {
          this.paymentMethods = this.normalizePaymentMethods(response);
        },
        error: (error) => {
          this.paymentMethods = [];
          this.paymentMethodsError = getFriendlyErrorMessage(error);
        },
      });
  }

  private applyDashboardState(profile: ProfileResponse, packages: any, paymentConfig: any): void {
    this.userProfile = profile?.data || null;
    this.activeSubscription = this.extractActiveSubscription(packages, profile);
    this.latestTransaction = this.extractLatestTransaction(packages, profile);
    this.packages = this.extractArray(packages).map((item, index) => this.mapPackage(item, index));
    this.currentPackage = this.resolveCurrentPackage();
    this.lastPackage = this.resolveLastPackage();
    this.paymentMethods = this.normalizePaymentMethods(paymentConfig);

    if (this.isModalOpen && this.selectedPackage && this.invoiceData) {
      const refreshedTransaction = this.resolveExistingTransactionForPackage(this.selectedPackage);
      this.invoiceData = refreshedTransaction || this.invoiceData;
      this.checkoutState = this.resolveCheckoutState(this.invoiceData);
    }
  }

  private extractArray(response: any): any[] {
    const candidates = [
      response?.data?.data,
      response?.data?.items,
      response?.data?.packages,
      response?.data,
      response?.items,
      response,
    ];

    const list = candidates.find((candidate) => Array.isArray(candidate));
    return Array.isArray(list) ? list : [];
  }

  private extractActiveSubscription(packages: any, profile: ProfileResponse): any {
    const data = this.unwrapData(packages);
    const profileData: any = profile?.data || {};
    return data?.active_subscription ||
      data?.subscription ||
      data?.current_subscription ||
      packages?.active_subscription ||
      packages?.subscription ||
      profileData?.active_subscription ||
      profileData?.subscription ||
      profileData?.package_info ||
      null;
  }

  private extractLatestTransaction(packages: any, profile: ProfileResponse): any {
    const data = this.unwrapData(packages);
    const profileData: any = profile?.data || {};
    return data?.latest_transaction ||
      data?.pending_transaction ||
      data?.upgrade_transaction ||
      packages?.latest_transaction ||
      packages?.pending_transaction ||
      profileData?.latest_transaction ||
      profileData?.pending_transaction ||
      null;
  }

  private mapPackage(raw: any, index: number): UpgradePackage {
    const id = raw?.id ?? raw?.paket_undangan_id ?? raw?.package_id ?? null;
    const code = String(raw?.package_code ?? raw?.kode_paket ?? raw?.code ?? raw?.package_tier ?? id ?? '').trim();
    const name = String(
      raw?.name_paket_display ??
      raw?.name ??
      raw?.nama_paket ??
      raw?.name_paket ??
      raw?.jenis_paket ??
      'Paket'
    ).trim();
    const price = raw?.price ?? raw?.harga ?? raw?.amount ?? raw?.nominal ?? null;
    const originalPrice = this.firstDefined([
      raw?.original_price,
      raw?.normal_price,
      raw?.regular_price,
      raw?.package_price,
      raw?.price,
      raw?.harga,
      raw?.amount,
    ]);
    const discountPercentage = this.firstDefined([
      raw?.discount_percentage,
      raw?.upgrade_discount_percentage,
      raw?.discount_percent,
      raw?.diskon_persen,
    ]);
    const discountAmount = this.firstDefined([
      raw?.discount_amount,
      raw?.upgrade_discount_amount,
      raw?.diskon_nominal,
      raw?.discount_value,
    ]);
    const upgradePrice = this.firstDefined([
      raw?.upgrade_price,
      raw?.upgrade_amount,
      raw?.payment_amount,
      raw?.amount_due,
      raw?.total_payment,
      raw?.total_bayar,
      raw?.final_price,
      raw?.payable_amount,
    ]);

    return {
      id,
      code,
      name,
      price,
      priceLabel: this.formatPrice(price, raw?.price_label ?? raw?.harga_label),
      originalPrice,
      originalPriceLabel: this.formatPrice(originalPrice, raw?.original_price_label ?? raw?.normal_price_label ?? raw?.regular_price_label),
      discountPercentage,
      discountAmount,
      discountAmountLabel: this.formatPrice(discountAmount, raw?.discount_amount_label ?? raw?.upgrade_discount_amount_label ?? raw?.diskon_nominal_label),
      upgradePrice,
      upgradePriceLabel: this.formatPrice(upgradePrice, raw?.upgrade_price_label ?? raw?.upgrade_amount_label ?? raw?.payment_amount_label ?? raw?.amount_due_label ?? raw?.total_payment_label ?? raw?.total_bayar_label ?? raw?.final_price_label ?? raw?.payable_amount_label),
      description: String(raw?.description ?? raw?.deskripsi ?? raw?.short_description ?? '').trim(),
      thumbnail: this.resolveThumbnail(raw),
      badge: String(raw?.badge ?? raw?.label ?? raw?.status_label ?? raw?.package_tier ?? '').trim(),
      statusLabel: String(raw?.status_label ?? raw?.status ?? raw?.is_active_label ?? '').trim(),
      features: this.resolveFeatures(raw),
      isCurrent: this.toBoolean(raw?.is_current),
      isLastPackage: this.toBoolean(raw?.is_last_package),
      subscriptionStatus: String(raw?.subscription_status ?? raw?.subscription?.status ?? '').trim(),
      canSelect: raw?.can_select === undefined ? this.toBoolean(raw?.can_upgrade) : this.toBoolean(raw?.can_select),
      canUpgrade: this.toBoolean(raw?.can_upgrade),
      canDowngrade: this.toBoolean(raw?.can_downgrade),
      action: this.normalizePackageAction(raw?.action ?? raw?.button_action ?? raw?.selection_action),
      disabledReason: String(raw?.disabled_reason ?? raw?.disable_reason ?? '').trim(),
      pendingMessage: String(raw?.pending_message ?? raw?.upgrade_message ?? raw?.message ?? '').trim(),
      raw,
    };
  }

  private resolveCurrentPackage(): UpgradePackage | null {
    if (this.isSubscriptionExpired()) return null;

    const matched = this.packages.find((pkg) => pkg.isCurrent);
    if (matched) return matched;

    const profile: any = this.userProfile || {};
    const currentRaw = profile.package_info || profile.invitation_package || profile.paket_undangan || null;
    return currentRaw ? this.mapPackage({ ...currentRaw, is_current: true }, 0) : null;
  }

  private resolveLastPackage(): UpgradePackage | null {
    const matched = this.packages.find((pkg) => pkg.isLastPackage);
    if (matched) return matched;

    const profile: any = this.userProfile || {};
    const lastRaw = profile.last_package || profile.package_info || profile.invitation_package || null;
    return lastRaw ? this.mapPackage({ ...lastRaw, is_last_package: true }, 0) : null;
  }

  isSubscriptionExpired(): boolean {
    const status = String(
      this.activeSubscription?.subscription_status ||
      this.activeSubscription?.status ||
      this.userProfile?.package_info?.payment_status ||
      ''
    ).trim().toLowerCase();

    return ['expired', 'kedaluwarsa', 'kadaluarsa', 'inactive', 'non_active', 'nonaktif', 'ended', 'lapsed'].includes(status);
  }

  private resolveFeatures(raw: any): string[] {
    const direct = raw?.features ?? raw?.fitur ?? raw?.package_features;
    if (Array.isArray(direct)) {
      return direct
        .map((feature) => typeof feature === 'string' ? feature : feature?.label ?? feature?.name ?? feature?.title)
        .filter((feature) => typeof feature === 'string' && feature.trim())
        .map((feature) => feature.trim());
    }

    if (direct && typeof direct === 'object') {
      return Object.keys(direct)
        .filter((key) => this.isEnabledFeature(direct[key]))
        .map((key) => this.humanizeKey(key));
    }

    const ignored = new Set([
      'id', 'code', 'package_code', 'kode_paket', 'package_tier', 'name', 'nama_paket',
      'name_paket', 'name_paket_display', 'jenis_paket', 'price', 'harga', 'amount',
      'description', 'deskripsi', 'short_description', 'thumbnail', 'image', 'image_url',
      'photo', 'photo_url', 'badge', 'label', 'status', 'status_label', 'is_active',
      'created_at', 'updated_at', 'deleted_at', 'sort_order', 'order', 'urutan', 'level',
      'rank', 'priority', 'accessible_categories', 'is_current', 'is_last_package',
      'subscription_status', 'can_select', 'can_upgrade', 'can_downgrade', 'action',
      'disabled_reason', 'pending_message', 'upgrade_message', 'original_price',
      'normal_price', 'regular_price', 'package_price', 'discount_percentage',
      'upgrade_discount_percentage', 'discount_percent', 'diskon_persen',
      'discount_amount', 'upgrade_discount_amount', 'diskon_nominal',
      'discount_value', 'upgrade_price', 'upgrade_amount', 'payment_amount',
      'amount_due', 'total_payment', 'total_bayar', 'final_price',
      'payable_amount'
    ]);

    return Object.keys(raw || {})
      .filter((key) => !ignored.has(key) && this.isEnabledFeature(raw[key]))
      .map((key) => this.humanizeKey(key))
      .slice(0, 8);
  }

  private isEnabledFeature(value: any): boolean {
    if (value === true || value === 1 || value === '1') return true;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return !!normalized && !['0', 'false', 'no', 'null', 'undefined', '-'].includes(normalized);
    }
    return typeof value === 'number' && value > 0;
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private resolveThumbnail(raw: any): string {
    const candidates = [
      raw?.thumbnail_url,
      raw?.thumbnail,
      raw?.image_url,
      raw?.image,
      raw?.photo_url,
      raw?.photo,
    ];

    const image = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    return String(image || '').trim();
  }

  private formatPrice(value: any, fallback?: any): string {
    if (fallback) return String(fallback);
    if (value === null || value === undefined || value === '') return '';
    const numeric = this.toNumber(value);
    if (!Number.isFinite(numeric)) return String(value || '-');

    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(numeric);
  }

  private toNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const cleaned = value.replace(/[^\d.-]/g, '');
      return cleaned ? Number(cleaned) : NaN;
    }
    return NaN;
  }

  private firstDefined(values: any[]): any {
    return values.find((value) => value !== undefined && value !== null && value !== '');
  }

  formatPercent(value: any): string {
    const text = String(value ?? '').trim();
    if (!text) return '';
    if (text.includes('%')) return text;
    const numeric = Number(text);
    return Number.isFinite(numeric) ? `${numeric}%` : text;
  }

  private buildUpgradePayload(pkg: UpgradePackage, method: SelectablePaymentMethod): any {
    const payload: any = {
      package_id: pkg.id,
    };
    payload.payment_method = method;
    return payload;
  }

  private resolvePaymentCreationError(error: any): string {
    const code = String(error?.error?.code || error?.code || '').trim();
    if (code === 'PACKAGE_DOWNGRADE_NOT_ALLOWED') {
      return 'Downgrade paket tidak tersedia.';
    }

    const message = String(error?.error?.message || error?.message || '').trim();
    if (message.includes('PACKAGE_DOWNGRADE_NOT_ALLOWED')) {
      return 'Downgrade paket tidak tersedia.';
    }

    return getFriendlyErrorMessage(error);
  }

  private openMidtransPayment(data: any, fallbackMessage?: string): void {
    const snapToken = data?.snap_token || data?.token || data?.midtrans_snap_token;
    const redirectUrl = this.resolvePaymentUrl(data);

    if ((window as any).snap && snapToken) {
      this.payWithSnap(String(snapToken), fallbackMessage);
      return;
    }

    const clientKey = this.resolveMidtransClientKey();
    if (snapToken && clientKey) {
      this.loadSnapScript(clientKey)
        .then(() => this.payWithSnap(String(snapToken), fallbackMessage))
        .catch(() => {
          if (redirectUrl) {
            this.openMidtransRedirect(redirectUrl, fallbackMessage);
            return;
          }

            this.paymentError = 'Halaman pembayaran belum dapat dibuka. Silakan coba lagi.';
          this.checkoutState = this.hasCreatedTransaction ? 'pending' : 'creation_error';
        });
      return;
    }

    if (redirectUrl) {
      this.openMidtransRedirect(redirectUrl, fallbackMessage);
      return;
    }

    this.paymentError = 'Halaman pembayaran belum dapat dibuka. Silakan coba lagi.';
    this.checkoutState = this.hasCreatedTransaction ? 'pending' : 'creation_error';
  }

  private payWithSnap(snapToken: string, fallbackMessage?: string): void {
    (window as any).snap.pay(snapToken, {
      onSuccess: () => this.handlePaymentSuccess(fallbackMessage),
      onPending: () => this.handlePaymentPending(fallbackMessage || 'Pembayaran Anda sedang diproses.'),
      onError: () => {
        this.paymentError = 'Pembayaran belum berhasil. Silakan coba lagi.';
        this.checkoutState = 'failed';
        this.refreshProfileAndPackage();
      },
      onClose: () => {
        this.paymentInfoMessage = 'Jendela pembayaran ditutup. Anda dapat melanjutkan pembayaran kapan saja.';
        this.checkoutState = 'pending';
        this.refreshProfileAndPackage();
      },
    });
  }

  private openMidtransRedirect(redirectUrl: string, fallbackMessage?: string): void {
    window.open(redirectUrl, '_blank', 'noopener,noreferrer');
    this.paymentInfoMessage = fallbackMessage || 'Halaman pembayaran dibuka di tab baru. Selesaikan pembayaran agar paket dapat diaktifkan.';
    this.checkoutState = 'pending';
    this.refreshProfileAndPackage();
  }

  private resolveMidtransClientKey(): string {
    const midtrans: any = this.invoiceData?.midtrans || {};
    const candidates = [
      midtrans.client_key,
      midtrans.clientKey,
      this.invoiceData?.client_key,
      this.invoiceData?.clientKey,
    ];

    return String(candidates.find((candidate) => typeof candidate === 'string' && candidate.trim()) || '').trim();
  }

  private loadSnapScript(clientKey: string): Promise<void> {
    if ((window as any).snap) return Promise.resolve();

    const existing = document.querySelector<HTMLScriptElement>('script[data-midtrans-snap="true"]');
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = environment.production
        ? 'https://app.midtrans.com/snap/snap.js'
        : 'https://app.sandbox.midtrans.com/snap/snap.js';
      script.setAttribute('data-client-key', clientKey);
      script.setAttribute('data-midtrans-snap', 'true');
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }

  private resolvePaymentUrl(data: any): string {
    const candidates = [
      data?.payment_url,
      data?.invoice_url,
      data?.redirect_url,
      data?.checkout_url,
      data?.snap_redirect_url,
      data?.invoice?.payment_url,
      data?.invoice?.invoice_url,
      data?.invoice?.redirect_url,
      data?.tagihan?.payment_url,
      data?.tagihan?.invoice_url,
    ];

    const url = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (url) return String(url).trim();

    const snapToken = data?.snap_token || data?.token || data?.midtrans_snap_token;
    if (!snapToken) return '';

    const host = environment.production
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';
    return `${host}/snap/v2/vtweb/${encodeURIComponent(String(snapToken))}`;
  }

  private handlePaymentSuccess(message?: string): void {
    this.paymentInfoMessage = message || 'Pembayaran berhasil diterima.';
    this.checkoutState = 'processing';
    this.refreshPaymentStatus();
  }

  private handlePaymentPending(message: string): void {
    this.paymentInfoMessage = message;
    this.checkoutState = 'processing';
    this.refreshPaymentStatus();
  }

  private refreshPaymentStatus(): void {
    const orderId = this.resolveOrderId(this.invoiceData);
    if (!orderId) {
      this.refreshProfileAndPackage();
      return;
    }

    this.dashboardService.create(DashboardServiceType.MIDTRANS_CHECK_STATUS, { order_id: orderId })
      .pipe(take(1))
      .subscribe({
        next: () => this.refreshProfileAndPackage(),
        error: () => this.refreshProfileAndPackage(),
      });
  }

  private resolveOrderId(data: any): string {
    const candidates = [
      data?.order_id,
      data?.order_number,
      data?.transaction_id,
      data?.invoice?.order_id,
      data?.payment?.order_id,
      data?.midtrans?.order_id,
    ];
    return String(candidates.find((candidate) => typeof candidate === 'string' || typeof candidate === 'number') || '').trim();
  }

  private resolveResponsePaymentMethod(data: any): PaymentMethod {
    const method = data?.payment_method || data?.payment?.payment_method || data?.invoice?.payment_method;
    return method === 'manual' || method === 'midtrans' ? method : null;
  }

  private resolveExistingTransactionForPackage(pkg: UpgradePackage): any | null {
    const transaction = this.latestTransaction;
    if (!transaction || !pkg) return null;
    if (this.resolveCheckoutState(transaction) === 'failed') return null;

    const packageCandidates = [
      transaction.package_id,
      transaction.paket_undangan_id,
      transaction.target_package_id,
      transaction.package?.id,
      transaction.paket?.id,
      transaction.package_code,
      transaction.target_package,
      transaction.package?.code,
      transaction.package?.package_code,
      transaction.package?.name,
      transaction.package?.name_paket,
    ].filter((value) => value !== undefined && value !== null && String(value).trim());

    const selectedCandidates = [
      pkg.id,
      pkg.code,
      pkg.name,
      pkg.raw?.package_code,
      pkg.raw?.code,
      pkg.raw?.kode_paket,
      pkg.raw?.package_tier,
      pkg.raw?.name_paket,
      pkg.raw?.jenis_paket,
    ].filter((value) => value !== undefined && value !== null && String(value).trim());

    if (!packageCandidates.length || !selectedCandidates.length) {
      return transaction;
    }

    const matches = packageCandidates.some((candidate) => {
      const normalizedCandidate = String(candidate).toLowerCase().trim();
      return selectedCandidates.some((selected) => String(selected).toLowerCase().trim() === normalizedCandidate);
    });

    return matches ? transaction : null;
  }

  private resolveCheckoutState(data: any): CheckoutState {
    const status = String(
      data?.payment_status ||
      data?.status_pembayaran ||
      data?.status ||
      data?.invoice?.payment_status ||
      data?.invoice?.status ||
      data?.transaction?.payment_status ||
      ''
    ).trim().toLowerCase();

    const packageActive = this.userProfile?.package_info?.is_active === true && this.isSelectedPackageActive();
    if (packageActive || ['paid', 'settlement', 'settled', 'success', 'sukses', 'confirmed', 'active', 'aktif'].includes(status)) {
      return 'success';
    }

    if (['expire', 'expired', 'kedaluwarsa', 'kadaluarsa'].includes(status)) {
      return 'expired';
    }

    if (['deny', 'denied', 'cancel', 'cancelled', 'failed', 'failure', 'gagal'].includes(status)) {
      return 'failed';
    }

    if (['process', 'processing', 'challenge', 'review', 'verifying', 'verifikasi', 'diproses'].includes(status)) {
      return 'processing';
    }

    return data ? 'pending' : 'confirmation';
  }

  private isSelectedPackageActive(): boolean {
    if (!this.selectedPackage || !this.currentPackage) return false;

    const selectedCandidates = [
      this.selectedPackage.id,
      this.selectedPackage.code,
      this.selectedPackage.name,
      this.selectedPackage.raw?.package_code,
      this.selectedPackage.raw?.code,
      this.selectedPackage.raw?.kode_paket,
      this.selectedPackage.raw?.package_tier,
      this.selectedPackage.raw?.name_paket,
      this.selectedPackage.raw?.jenis_paket,
    ].filter((value) => value !== undefined && value !== null && String(value).trim());

    const currentCandidates = [
      this.currentPackage.id,
      this.currentPackage.code,
      this.currentPackage.name,
      this.currentPackage.raw?.package_code,
      this.currentPackage.raw?.code,
      this.currentPackage.raw?.kode_paket,
      this.currentPackage.raw?.package_tier,
      this.currentPackage.raw?.name_paket,
      this.currentPackage.raw?.jenis_paket,
    ].filter((value) => value !== undefined && value !== null && String(value).trim());

    return selectedCandidates.some((selected) => {
      const normalizedSelected = String(selected).toLowerCase().trim();
      return currentCandidates.some((current) => String(current).toLowerCase().trim() === normalizedSelected);
    });
  }

  private humanizePaymentStatus(status: string): string {
    const normalized = String(status || '').trim().toLowerCase();
    if (['paid', 'settlement', 'settled', 'success', 'sukses', 'confirmed', 'active', 'aktif'].includes(normalized)) return 'Berhasil';
    if (['expire', 'expired', 'kedaluwarsa', 'kadaluarsa'].includes(normalized)) return 'Waktu habis';
    if (['deny', 'denied', 'cancel', 'cancelled', 'failed', 'failure', 'gagal'].includes(normalized)) return 'Gagal';
    if (['process', 'processing', 'challenge', 'review', 'verifying', 'verifikasi', 'diproses'].includes(normalized)) return 'Sedang diproses';
    if (normalized) return 'Menunggu pembayaran';
    return '';
  }

  private normalizePaymentMethods(response: any): PaymentMethodOption[] {
    const data = this.unwrapData(response);
    const methods: PaymentMethodOption[] = [];
    const arraySource = data?.payment_methods || data?.methods || data?.available_methods || [];

    if (Array.isArray(arraySource)) {
      arraySource.forEach((item) => {
        const type = this.normalizePaymentMethodType(item?.payment_method || item?.method || item?.code || item?.type || item?.name);
        if (!type || !this.isPaymentEnabled(item)) return;
        methods.push({
          type,
          label: type === 'manual' ? 'Transfer Manual' : 'Bayar Online',
          details: item,
        });
      });
    }

    const manual = data?.manual_payment || data?.manual || data?.rekening || data?.bank_account;
    if (manual && this.isPaymentEnabled(manual) && !methods.some((item) => item.type === 'manual')) {
      methods.push({ type: 'manual', label: 'Transfer Manual', details: manual });
    }

    const midtrans = data?.midtrans || data?.midtrans_payment || data?.snap;
    if (midtrans && this.isPaymentEnabled(midtrans) && !methods.some((item) => item.type === 'midtrans')) {
      methods.push({ type: 'midtrans', label: 'Bayar Online', details: midtrans });
    }

    const configuredMethod = this.normalizePaymentMethodType(data?.payment_method);
    if (configuredMethod && !methods.some((item) => item.type === configuredMethod)) {
      methods.push({
        type: configuredMethod,
        label: configuredMethod === 'manual' ? 'Transfer Manual' : 'Bayar Online',
        details: configuredMethod === 'manual' ? (manual || data) : (midtrans || data),
      });
    }

    return methods;
  }

  private normalizeManualAccounts(source: any): any[] {
    const candidates = [
      source?.accounts,
      source?.bank_accounts,
      source?.rekenings,
      source?.rekening,
      source?.manual_payment_accounts,
    ];
    const list = candidates.find((candidate) => Array.isArray(candidate));
    if (Array.isArray(list)) return list;

    const hasDirectAccount = source?.bank_name || source?.nama_bank || source?.account_number || source?.nomor_rekening;
    return hasDirectAccount ? [source] : [];
  }

  private normalizePaymentMethodType(value: any): SelectablePaymentMethod | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized.includes('manual') || normalized.includes('transfer')) return 'manual';
    if (normalized.includes('midtrans') || normalized.includes('snap')) return 'midtrans';
    return null;
  }

  private isPaymentEnabled(value: any): boolean {
    const enabled = value?.enabled ?? value?.is_active ?? value?.active ?? value?.status;
    if (enabled === undefined || enabled === null) return true;
    if (enabled === true || enabled === 1 || enabled === '1') return true;
    const normalized = String(enabled).trim().toLowerCase();
    return ['true', 'active', 'aktif', 'enabled'].includes(normalized);
  }

  private normalizePackageAction(value: any): PackageAction | null {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (['current', 'downgrade', 'upgrade', 'renew', 'subscribe', 'select', 'unavailable'].includes(normalized)) {
      return normalized as PackageAction;
    }
    if (normalized.includes('perpanjang')) return 'renew';
    if (normalized.includes('subscribe')) return 'subscribe';
    if (normalized.includes('pilih')) return 'select';
    if (normalized.includes('downgrade')) return 'downgrade';
    if (normalized.includes('upgrade')) return 'upgrade';
    return null;
  }

  private unwrapData(response: any): any {
    return response?.data?.data || response?.data || response || {};
  }

  private toBoolean(value: any): boolean {
    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
  }

  private broadcastProfileRefresh(): void {
    try {
      localStorage.setItem('profileUpdated', Date.now().toString());
      setTimeout(() => localStorage.removeItem('profileUpdated'), 100);
    } catch {
      // Ignore cross-tab refresh failures.
    }
  }
}
