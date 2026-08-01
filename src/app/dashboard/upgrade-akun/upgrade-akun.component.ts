import { Component, OnDestroy, OnInit } from '@angular/core';
import { finalize, forkJoin, Subject, take, takeUntil } from 'rxjs';
import {
  DashboardService,
  DashboardServiceType,
  ProfileData,
  ProfileResponse,
} from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { environment } from 'src/environments/environment';

type PaymentMethod = 'manual' | 'midtrans' | null;
type PackageAction = 'current' | 'downgrade' | 'upgrade' | 'unavailable';

interface UpgradePackage {
  id: number | string | null;
  code: string;
  name: string;
  price: number | string | null;
  priceLabel: string;
  description: string;
  thumbnail: string;
  badge: string;
  statusLabel: string;
  features: string[];
  isCurrent: boolean;
  canUpgrade: boolean;
  canDowngrade: boolean;
  pendingMessage: string;
  raw: any;
}

@Component({
  selector: 'wc-upgrade-akun',
  templateUrl: './upgrade-akun.component.html',
  styleUrls: ['./upgrade-akun.component.scss']
})
export class UpgradeAkunComponent implements OnInit, OnDestroy {
  packages: UpgradePackage[] = [];
  currentPackage: UpgradePackage | null = null;
  userProfile: ProfileData | null = null;
  isLoading = true;
  isRefreshingProfile = false;
  errorMessage = '';

  selectedPackage: UpgradePackage | null = null;
  activePaymentMethod: PaymentMethod = null;
  isModalOpen = false;
  isCreatingInvoice = false;
  paymentError = '';
  paymentInfoMessage = '';
  invoiceData: any = null;

  private readonly destroy$ = new Subject<void>();

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
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
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: ({ profile, packages }) => {
          this.userProfile = profile?.data || null;
          this.packages = this.extractArray(packages)
            .map((item, index) => this.mapPackage(item, index));
          this.currentPackage = this.resolveCurrentPackage();
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
    })
      .pipe(
        take(1),
        finalize(() => this.isRefreshingProfile = false)
      )
      .subscribe({
        next: ({ profile, packages }: { profile: ProfileResponse; packages: any }) => {
          this.userProfile = profile?.data || null;
          this.packages = this.extractArray(packages).map((item, index) => this.mapPackage(item, index));
          this.currentPackage = this.resolveCurrentPackage();
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
    if (this.getPackageAction(pkg) !== 'upgrade') return;

    this.selectedPackage = pkg;
    this.isModalOpen = true;
    this.activePaymentMethod = null;
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.invoiceData = null;
  }

  closeUpgradeModal(): void {
    if (this.isCreatingInvoice) return;
    this.isModalOpen = false;
    this.selectedPackage = null;
    this.activePaymentMethod = null;
    this.paymentError = '';
    this.paymentInfoMessage = '';
    this.invoiceData = null;
  }

  confirmUpgrade(): void {
    if (!this.selectedPackage || this.isCreatingInvoice) return;

    this.isCreatingInvoice = true;
    this.paymentError = '';
    this.paymentInfoMessage = '';

    const payload = this.buildUpgradePayload(this.selectedPackage);
    this.dashboardService.create(DashboardServiceType.USER_PACKAGE_UPGRADE, payload)
      .pipe(
        take(1),
        finalize(() => this.isCreatingInvoice = false)
      )
      .subscribe({
        next: (response) => {
          this.invoiceData = response?.data || response || {};
          this.activePaymentMethod = this.resolveResponsePaymentMethod(this.invoiceData);

          if (this.activePaymentMethod === 'manual') {
            this.paymentInfoMessage = response?.message || 'Invoice upgrade berhasil dibuat. Silakan lakukan transfer manual sesuai instruksi.';
            this.refreshProfileAndPackage();
            return;
          }

          if (this.activePaymentMethod === 'midtrans') {
            this.openMidtransPayment(this.invoiceData, response?.message);
            return;
          }

          this.paymentError = 'Metode pembayaran dari transaksi upgrade tidak ditemukan.';
        },
        error: (error) => {
          this.paymentError = getFriendlyErrorMessage(error);
        },
      });
  }

  getPackageAction(pkg: UpgradePackage): PackageAction {
    if (pkg.isCurrent) return 'current';
    if (pkg.canUpgrade) return 'upgrade';
    if (pkg.canDowngrade) return 'downgrade';
    return 'unavailable';
  }

  getActionLabel(pkg: UpgradePackage): string {
    const action = this.getPackageAction(pkg);
    if (action === 'current') return 'Paket Saat Ini';
    if (action === 'downgrade') return 'Tidak dapat downgrade';
    if (action === 'unavailable') return pkg.pendingMessage || 'Tidak tersedia';
    return 'Upgrade';
  }

  isCurrentPackage(pkg: UpgradePackage): boolean {
    return pkg.isCurrent;
  }

  trackByPackage(index: number, pkg: UpgradePackage): string {
    return String(pkg.id ?? pkg.code ?? index);
  }

  copyToClipboard(value: string | number | null | undefined): void {
    const text = String(value || '').trim();
    if (!text) return;
    navigator.clipboard?.writeText(text);
  }

  get manualPayment(): any {
    return this.invoiceData?.manual_payment || this.invoiceData?.rekening || this.invoiceData?.bank_account || {};
  }

  get modalTitle(): string {
    return this.selectedPackage ? `Upgrade ke ${this.selectedPackage.name}` : 'Upgrade Akun';
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

    return {
      id,
      code,
      name,
      price,
      priceLabel: this.formatPrice(price, raw?.price_label ?? raw?.harga_label),
      description: String(raw?.description ?? raw?.deskripsi ?? raw?.short_description ?? '').trim(),
      thumbnail: this.resolveThumbnail(raw),
      badge: String(raw?.badge ?? raw?.label ?? raw?.status_label ?? raw?.package_tier ?? '').trim(),
      statusLabel: String(raw?.status_label ?? raw?.status ?? raw?.is_active_label ?? '').trim(),
      features: this.resolveFeatures(raw),
      isCurrent: this.toBoolean(raw?.is_current),
      canUpgrade: this.toBoolean(raw?.can_upgrade),
      canDowngrade: this.toBoolean(raw?.can_downgrade),
      pendingMessage: String(raw?.pending_message ?? raw?.upgrade_message ?? raw?.message ?? '').trim(),
      raw,
    };
  }

  private resolveCurrentPackage(): UpgradePackage | null {
    const matched = this.packages.find((pkg) => pkg.isCurrent);
    if (matched) return matched;

    const profile: any = this.userProfile || {};
    const currentRaw = profile.package_info || profile.invitation_package || profile.paket_undangan || null;
    return currentRaw ? this.mapPackage({ ...currentRaw, is_current: true }, 0) : null;
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
      'rank', 'priority', 'accessible_categories'
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

  private buildUpgradePayload(pkg: UpgradePackage): any {
    return {
      package_id: pkg.id,
    };
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

          this.paymentError = 'Snap Midtrans belum dapat dimuat.';
        });
      return;
    }

    if (redirectUrl) {
      this.openMidtransRedirect(redirectUrl, fallbackMessage);
      return;
    }

    this.paymentError = 'Token atau URL pembayaran Midtrans tidak ditemukan.';
  }

  private payWithSnap(snapToken: string, fallbackMessage?: string): void {
    (window as any).snap.pay(snapToken, {
      onSuccess: () => this.handlePaymentSuccess(fallbackMessage),
      onPending: () => this.handlePaymentSuccess(fallbackMessage || 'Pembayaran sedang diproses.'),
      onError: () => {
        this.paymentError = 'Pembayaran Midtrans belum berhasil. Silakan coba lagi.';
      },
      onClose: () => {
        this.paymentInfoMessage = 'Jendela pembayaran ditutup. Anda dapat melanjutkan pembayaran kapan saja.';
      },
    });
  }

  private openMidtransRedirect(redirectUrl: string, fallbackMessage?: string): void {
    window.open(redirectUrl, '_blank', 'noopener,noreferrer');
    this.paymentInfoMessage = fallbackMessage || 'Snap Midtrans dibuka di tab baru. Setelah pembayaran selesai, gunakan refresh status untuk memperbarui badge tanpa reload halaman.';
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
    this.paymentInfoMessage = message || 'Pembayaran diterima oleh Snap. Status paket akan mengikuti verifikasi backend.';
    this.refreshProfileAndPackage();
  }

  private resolveResponsePaymentMethod(data: any): PaymentMethod {
    const method = data?.payment_method || data?.payment?.payment_method || data?.invoice?.payment_method;
    return method === 'manual' || method === 'midtrans' ? method : null;
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
