import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { finalize, take } from 'rxjs/operators';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType, ProfileData, ProfileResponse, UserPaymentConfig } from 'src/app/dashboard.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { PaymentConfirmComponent } from 'src/app/shared/payment-confirm/payment-confirm.component';
import { environment } from 'src/environments/environment';

type ActivePaymentMethod = 'manual' | 'midtrans' | null;

@Component({
  selector: 'wc-regis-pembayaran',
  templateUrl: './regis-pembayaran.component.html',
  styleUrls: ['./regis-pembayaran.component.scss']
})
export class RegisPembayaranComponent implements OnInit {

  @Input() formData: any;
  @Input() paymentStatusMessage: string = '';

  @Output() prev = new EventEmitter<void>();

  bill: any;
  manualBill: any;
  private notyf: Notyf

  userId: any;
  invitationId: number | null = null;
  isTrialPackage = false;
  paymentError = '';
  isStartingPayment = false;
  activePaymentMethod: ActivePaymentMethod = null;
  paymentConfig: UserPaymentConfig | null = null;
  isLoadingPaymentConfig = false;
  paymentConfigError = '';
  isProfileLoading = false;
  hasLoadedProfile = false;
  profileLoadError = '';
  userProfile: ProfileData | null = null;
  profileCompletionWarning = '';

  constructor(
    private dashboardSvc: DashboardService,
    private modalService: BsModalService,
  ) {
    this.notyf = new Notyf({
      duration: 1000,
      position: {
        x: 'right',
        y: 'top'
      }
    });
  }

  ngOnInit(): void {
    const allDataFromStepsStr = localStorage.getItem('formData');
    if (allDataFromStepsStr) {
      const allDataFromSteps = JSON.parse(allDataFromStepsStr);
      const invitation =
        allDataFromSteps?.registrasi?.response?.invitation ??
        allDataFromSteps?.response?.invitation;
      if (allDataFromSteps?.registrasi?.formData) {
        this.manualBill = allDataFromSteps.registrasi.formData.price;
      }
      const userId = allDataFromSteps?.registrasi?.response?.user?.id;
      this.userId = userId;
      this.invitationId = invitation?.id ?? null;
      this.manualBill =
        invitation?.package_price_snapshot ??
        this.manualBill;
      this.isTrialPackage = this.resolveIsTrialPackage(invitation);
    }
    // Show payment status message if it comes from Midtrans callback
    if (this.paymentStatusMessage) {
      this.paymentError = this.paymentStatusMessage;
    }
    // Validate and cleanup expired redirect URLs
    this.cleanupExpiredRedirectUrls();
    this.loadFreshProfile();
    this.loadPaymentConfig();
  }

  loadPaymentConfig(): void {
    this.paymentError = '';
    this.paymentConfigError = '';

    if (this.isTrialPackage) {
      this.activePaymentMethod = null;
      this.paymentConfig = null;
      this.bill = [];
      return;
    }

    this.isLoadingPaymentConfig = true;
    this.dashboardSvc.getUserPaymentConfig().pipe(
      take(1),
      finalize(() => {
        this.isLoadingPaymentConfig = false;
      })
    ).subscribe({
      next: (response: UserPaymentConfig) => {
        const config = this.normalizePaymentConfig(response);

        if (!config || !['manual', 'midtrans'].includes(config.payment_method)) {
          this.activePaymentMethod = null;
          this.paymentConfig = null;
          this.bill = [];
          this.paymentConfigError = 'Metode pembayaran belum diaktifkan oleh admin. Silakan hubungi admin.';
          return;
        }

        this.activePaymentMethod = config.payment_method;
        this.paymentConfig = config;
        this.initializeActivePaymentFlow();
      },
      error: (err: any) => {
        this.activePaymentMethod = null;
        this.paymentConfig = null;
        this.bill = [];
        this.paymentConfigError = err?.error?.message || 'Metode pembayaran belum dapat dimuat.';
      },
    });
  }

  private initializeActivePaymentFlow(): void {
    if (this.activePaymentMethod === 'manual') {
      this.initializeManualPayment();
      return;
    }

    if (this.activePaymentMethod === 'midtrans') {
      this.initializeMidtransPayment();
    }
  }

  private initializeManualPayment(): void {
    const manualPayment = this.paymentConfig?.manual_payment;
    this.bill = manualPayment
      ? [{
        nama_bank: manualPayment.bank_name || '-',
        nomor_rekening: manualPayment.account_number || '-',
        nama_pemilik: manualPayment.account_name || '-',
        account_photo_url: manualPayment.account_photo_url || null,
      }]
      : [];
  }

  private initializeMidtransPayment(): void {
    this.bill = [];
  }

  private resolveIsTrialPackage(invitation: any): boolean {
    if (typeof invitation?.is_trial === 'boolean') {
      return invitation.is_trial;
    }
    if (invitation?.is_trial === 1 || invitation?.is_trial === '1') {
      return true;
    }

    const snapshot = invitation?.package_features_snapshot || {};
    const packageName = `${snapshot?.jenis_paket || ''} ${snapshot?.name_paket || ''}`;
    return /trial/i.test(packageName);
  }

  goToPreviousStep(): void {
    this.prev.emit();
  }

  onNextClicked() {
    // Guard: prevent double execution
    if (this.isStartingPayment) {
      return;
    }

    if (this.shouldBlockPaymentForProfileCompletion()) {
      this.paymentError = this.profileCompletionWarning;
      return;
    }

    if (this.isTrialPackage) {
      this.modalService.show(PaymentConfirmComponent, {
        initialState: {
          userId: this.userId,
          isTrialPackage: true
        }
      });
      return;
    }

    if (!this.activePaymentMethod) {
      this.paymentConfigError = 'Metode pembayaran belum diaktifkan oleh admin. Silakan hubungi admin.';
      return;
    }

    if (this.activePaymentMethod === 'midtrans') {
      this.validateActivePaymentMethod('midtrans', () => this.startMidtransPayment());
      return;
    }

    if (this.activePaymentMethod === 'manual') {
      this.validateActivePaymentMethod('manual', () => this.handleManualPayment());
    }
  }

  private handleManualPayment(): void {
    this.modalService.show(PaymentConfirmComponent, {
      initialState: {
        userId: this.userId,
        isTrialPackage: false
      }
    });
  }

  private loadFreshProfile(): void {
    this.isProfileLoading = true;
    this.hasLoadedProfile = false;
    this.profileLoadError = '';
    this.profileCompletionWarning = '';

    this.dashboardSvc.getProfile().pipe(
      take(1),
      finalize(() => {
        this.isProfileLoading = false;
      })
    ).subscribe({
      next: (response: ProfileResponse) => {
        this.hasLoadedProfile = true;
        this.userProfile = response?.data || null;
        this.syncProfileCompletionWarning(this.userProfile);

        if (this.userProfile?.id != null) {
          this.userId = this.userProfile.id;
        }
      },
      error: () => {
        this.hasLoadedProfile = false;
        this.userProfile = null;
        this.profileCompletionWarning = '';
        this.profileLoadError = 'Profil terbaru tidak dapat dimuat. Silakan muat ulang halaman.';
      },
    });
  }

  private syncProfileCompletionWarning(profile: ProfileData | null): void {
    const profileCompletionRequired =
      (profile as any)?.profile_completion_required === true ||
      (profile as any)?.is_profile_complete === false;
    const nameIsEmpty = !String(profile?.name || '').trim();

    this.profileCompletionWarning = profileCompletionRequired && nameIsEmpty
      ? 'Profil belum lengkap. Nama pengguna wajib diisi sebelum melanjutkan pembayaran.'
      : '';
  }

  shouldBlockPaymentForProfileCompletion(): boolean {
    return this.hasLoadedProfile && !!this.profileCompletionWarning;
  }

  get isNextDisabled(): boolean {
    return (
      this.isStartingPayment ||
      this.isProfileLoading ||
      this.isLoadingPaymentConfig ||
      this.shouldBlockPaymentForProfileCompletion() ||
      (!this.isTrialPackage && !this.activePaymentMethod)
    );
  }

  private startMidtransPayment(): void {
    if (this.isStartingPayment || this.invitationId == null) {
      this.paymentError = 'Data undangan untuk pembayaran tidak ditemukan.';
      return;
    }

    this.paymentError = '';
    this.isStartingPayment = true;

    // Check if we have a saved redirect URL for this invitation
    const savedRedirectUrl = this.getSavedRedirectUrl(this.invitationId);
    if (savedRedirectUrl) {
      // Use timeout to auto-reset isStartingPayment if redirect fails
      setTimeout(() => {
        if (this.isStartingPayment) {
          this.isStartingPayment = false;
          this.paymentError = 'Pembayaran Midtrans tidak dapat dibuka. Periksa pengaturan popup blocker Anda.';
        }
      }, 3000);
      window.location.assign(savedRedirectUrl);
      return;
    }

    // Create new snap token
    this.dashboardSvc.create(DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN, {
      invitation_id: this.invitationId,
      amount: this.manualBill,
    }).pipe(take(1)).subscribe({
      next: (res: any) => {
        const snapToken = res?.data?.snap_token;
        const redirectUrl = res?.data?.redirect_url;

        if (!snapToken && !redirectUrl) {
          this.isStartingPayment = false;
          this.paymentError = res?.message || 'Token pembayaran Midtrans tidak ditemukan.';
          return;
        }

        // Save redirect URL for future use
        if (redirectUrl) {
          this.saveRedirectUrl(this.invitationId, redirectUrl);
        }

        const finalUrl = redirectUrl || this.buildSnapUrl(snapToken);
        // Use timeout to auto-reset isStartingPayment if redirect fails
        setTimeout(() => {
          if (this.isStartingPayment) {
            this.isStartingPayment = false;
            this.paymentError = 'Pembayaran Midtrans tidak dapat dibuka. Periksa pengaturan popup blocker Anda.';
          }
        }, 3000);
        window.location.assign(finalUrl);
      },
      error: (err: any) => {
        this.isStartingPayment = false;

        // Handle connection error (status 0) or CORS error
        if (err?.status === 0) {
          this.paymentError = 'Koneksi ke server gagal. Periksa koneksi internet Anda dan coba lagi.';
          return;
        }

        // Handle 422 "Payment already initiated" error
        if (err?.status === 422) {
          const errorMessage = err?.error?.message || '';
          if (errorMessage.includes('already initiated') || errorMessage.includes('Payment already')) {
            // Try to fetch active transaction from API
            this.fetchActiveTransaction();
            return;
          }
        }

        this.paymentError = this.getPaymentActionErrorMessage(err);
        this.loadPaymentConfig();
      },
    });
  }

  private fetchActiveTransaction(): void {
    if (!this.invitationId) return;

    this.dashboardSvc.getParam(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      `?invitation_id=${this.invitationId}`
    ).pipe(take(1)).subscribe({
      next: (res: any) => {
        const redirectUrl = res?.data?.redirect_url;
        if (redirectUrl) {
          this.saveRedirectUrl(this.invitationId, redirectUrl);
          // Use timeout to auto-reset isStartingPayment if redirect fails
          setTimeout(() => {
            if (this.isStartingPayment) {
              this.isStartingPayment = false;
              this.paymentError = 'Pembayaran Midtrans tidak dapat dibuka. Periksa pengaturan popup blocker Anda.';
            }
          }, 3000);
          window.location.assign(redirectUrl);
          return;
        }

        const snapToken = res?.data?.snap_token;
        if (snapToken) {
          const finalUrl = this.buildSnapUrl(snapToken);
          this.saveRedirectUrl(this.invitationId, finalUrl);
          // Use timeout to auto-reset isStartingPayment if redirect fails
          setTimeout(() => {
            if (this.isStartingPayment) {
              this.isStartingPayment = false;
              this.paymentError = 'Pembayaran Midtrans tidak dapat dibuka. Periksa pengaturan popup blocker Anda.';
            }
          }, 3000);
          window.location.assign(finalUrl);
          return;
        }

        this.isStartingPayment = false;
        this.paymentError = 'Tidak dapat menemukan transaksi yang aktif. Silakan coba membuat pembayaran baru.';
      },
      error: () => {
        this.isStartingPayment = false;
        this.paymentError = 'Koneksi ke server gagal. Periksa koneksi internet Anda dan coba lagi.';
      },
    });
  }

  private getSavedRedirectUrl(invitationId: number | null): string | null {
    if (!invitationId) return null;
    try {
      const saved = localStorage.getItem(`midtrans_redirect_${invitationId}`);
      if (saved) {
        const { url, timestamp } = JSON.parse(saved);
        // Check if saved URL is still valid (within 24 hours)
        const oneDay = 24 * 60 * 60 * 1000;
        if (Date.now() - timestamp < oneDay) {
          return url;
        }
        // Remove expired URL
        this.clearSavedRedirectUrl(invitationId);
      }
    } catch {
      // Ignore localStorage errors
    }
    return null;
  }

  private cleanupExpiredRedirectUrls(): void {
    try {
      const keys = Object.keys(localStorage);
      const oneDay = 24 * 60 * 60 * 1000;

      keys.forEach((key) => {
        if (key.startsWith('midtrans_redirect_')) {
          const saved = localStorage.getItem(key);
          if (saved) {
            try {
              const { timestamp } = JSON.parse(saved);
              // Remove if older than 24 hours
              if (Date.now() - timestamp >= oneDay) {
                localStorage.removeItem(key);
              }
            } catch {
              // Remove invalid entries
              localStorage.removeItem(key);
            }
          }
        }
      });
    } catch {
      // Ignore localStorage errors
    }
  }

  private saveRedirectUrl(invitationId: number | null, redirectUrl: string): void {
    if (!invitationId) return;
    try {
      localStorage.setItem(
        `midtrans_redirect_${invitationId}`,
        JSON.stringify({ url: redirectUrl, timestamp: Date.now() })
      );
    } catch {
      // Ignore localStorage errors
    }
  }

  private clearSavedRedirectUrl(invitationId: number | null): void {
    if (!invitationId) return;
    try {
      localStorage.removeItem(`midtrans_redirect_${invitationId}`);
    } catch {
      // Ignore localStorage errors
    }
  }

  // Public method to clear redirect URL after successful payment
  clearMidtransRedirectUrl(invitationId?: number | null): void {
    const id = invitationId || this.invitationId;
    this.clearSavedRedirectUrl(id);
  }

  private buildSnapUrl(snapToken: string): string {
    const host = environment.production
      ? 'https://app.midtrans.com'
      : 'https://app.sandbox.midtrans.com';
    return `${host}/snap/v2/vtweb/${encodeURIComponent(snapToken)}`;
  }

  private getApiErrorMessage(err: any): string {
    return err?.error?.message || err?.message || String(err);
  }

  private getPaymentActionErrorMessage(err: any): string {
    return err?.error?.message || 'Metode pembayaran telah berubah. Silakan muat ulang halaman.';
  }

  private normalizePaymentConfig(response: any): UserPaymentConfig | null {
    const raw = response?.data || response;
    const method = raw?.payment_method;
    if (method !== 'manual' && method !== 'midtrans') {
      return null;
    }

    return {
      payment_method: method,
      manual_payment: raw?.manual_payment,
      midtrans: raw?.midtrans,
    };
  }

  private validateActivePaymentMethod(expectedMethod: Exclude<ActivePaymentMethod, null>, onValid: () => void): void {
    if (this.isLoadingPaymentConfig || this.isStartingPayment) {
      return;
    }

    this.paymentError = '';
    this.paymentConfigError = '';
    this.isLoadingPaymentConfig = true;

    this.dashboardSvc.getUserPaymentConfig().pipe(
      take(1),
      finalize(() => {
        this.isLoadingPaymentConfig = false;
      })
    ).subscribe({
      next: (response: UserPaymentConfig) => {
        const config = this.normalizePaymentConfig(response);
        this.paymentConfig = config;
        this.activePaymentMethod = config?.payment_method || null;
        this.initializeActivePaymentFlow();

        if (this.activePaymentMethod !== expectedMethod) {
          this.paymentConfigError = 'Metode pembayaran telah berubah. Silakan muat ulang halaman.';
          return;
        }

        onValid();
      },
      error: (err: any) => {
        this.paymentConfigError = err?.error?.message || 'Metode pembayaran belum dapat dimuat.';
      },
    });
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.notyf.success('Nomor rekening disalin!');
    }).catch(() => {
      this.notyf.error('Gagal menyalin.');
    });
  }

}
