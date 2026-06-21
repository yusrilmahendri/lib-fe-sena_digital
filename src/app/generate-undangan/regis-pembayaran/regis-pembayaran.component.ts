import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import { PaymentConfirmComponent } from 'src/app/shared/payment-confirm/payment-confirm.component';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'wc-regis-pembayaran',
  templateUrl: './regis-pembayaran.component.html',
  styleUrls: ['./regis-pembayaran.component.scss']
})
export class RegisPembayaranComponent implements OnInit {

  @Input() formData: any;

  @Output() prev = new EventEmitter<void>();


  events: any = [];
  selectedMethod: any;
  bill: any;
  manualBill: any;
  private notyf: Notyf


  selectOptions: any = {
    payment: {
      items: [],
      defaultValue: [],
      FormControl: new FormControl(),
    }
  };
  userId: any;
  invitationId: number | null = null;
  isTrialPackage = false;
  paymentError = '';
  isStartingPayment = false;

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
    // Validate and cleanup expired redirect URLs
    this.cleanupExpiredRedirectUrls();
    this.getMasterPayment();
  }

  getMasterPayment() {
    this.paymentError = '';

    // Trial packages only show Trial method
    if (this.isTrialPackage) {
      this.dashboardSvc.getParam(DashboardServiceType.MNL_ACTIVE_PAYMENT_METHOD, '').subscribe({
        next: (response: any) => {
          const expectedMethodId = 4;
          const activeMethods = this.mapActivePaymentMethods(response);
          const expectedMethod = activeMethods.find(
            (method: any) => Number(method.id) === expectedMethodId
          );

          if (expectedMethod) {
            this.selectOptions.payment.items = [expectedMethod];
            this.selectedMethod = expectedMethod.id;
            return;
          }

          this.loadPackagePaymentMethod(4);
        },
        error: (err: any) => {
          this.paymentError = this.getApiErrorMessage(err);
          this.loadPackagePaymentMethod(4);
        },
      });
      return;
    }

    // Paid packages: Load all methods from master list, show Manual (1) + Midtrans (3)
    this.dashboardSvc.getParam(DashboardServiceType.MD_RGS_PAYMENT, '').subscribe({
      next: (response: any) => {
        const methods = Array.isArray(response?.data) ? response.data : [];
        // Filter to show only Manual (1) and Midtrans (3), exclude Tripay (2)
        const allowedMethods = methods.filter(
          (method: any) => [1, 3].includes(Number(method.id))
        );
        this.selectOptions.payment.items = allowedMethods.length > 0 ? allowedMethods : [];
        // Auto-select first available method
        if (allowedMethods.length > 0) {
          this.selectedMethod = allowedMethods[0].id;
        }
      },
      error: (err: any) => {
        this.paymentError = this.getApiErrorMessage(err);
        this.selectOptions.payment.items = [];
      },
    });
  }

  private mapActivePaymentMethods(response: any): any[] {
    const rawData = Array.isArray(response?.data)
      ? response.data
      : response?.data
        ? [response.data]
        : [];

    return rawData
      .filter((item: any) => item?.is_active !== false)
      .map((item: any) =>
        item?.metode_transaction || item?.metodeTransaction || item
      )
      .filter((item: any) => item?.id != null && item?.name);
  }

  private loadPackagePaymentMethod(expectedMethodId: number): void {
    this.dashboardSvc.getParam(DashboardServiceType.MD_RGS_PAYMENT, '').subscribe({
      next: (response: any) => {
        const methods = Array.isArray(response?.data) ? response.data : [];
        const expectedMethod = methods.find(
          (method: any) => Number(method.id) === expectedMethodId
        );
        this.selectOptions.payment.items = expectedMethod ? [expectedMethod] : [];
        if (expectedMethod) {
          this.selectedMethod = expectedMethod.id;
        }
      },
      error: (err: any) => {
        this.selectOptions.payment.items = [];
        this.paymentError = this.getApiErrorMessage(err);
      },
    });
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

  getMasterMethod() {
    this.dashboardSvc.getParam(DashboardServiceType.MNL_MD_METHOD, '').subscribe(res => {
      this.events = res?.data;
    })
  }

  getDetailMethod() {
    if ([3, 4].includes(Number(this.selectedMethod))) {
      this.bill = [];
      return;
    }
    const query = `?id_methode_pembayaran=${this.selectedMethod}`
    this.dashboardSvc.getParam(DashboardServiceType.MNL_MD_METHOD_DETAIL, query).subscribe(res => {
      this.bill = res?.data;
    })
  }

  onMetodeSelect(event: any) {
    this.paymentError = '';
    this.selectedMethod = Number(event);
    this.getDetailMethod();
  }

  onBack() {
    this.prev.emit()
  }

  onNextClicked() {
    if (Number(this.selectedMethod) === 3) {
      this.startMidtransPayment();
      return;
    }

    if (Number(this.selectedMethod) === 4 && this.isTrialPackage) {
      this.modalService.show(PaymentConfirmComponent, {
        initialState: {
          userId: this.userId
        }
      });
      return;
    }

    if (Number(this.selectedMethod) === 1) {
      this.handleManualPayment();
    }
  }

  private handleManualPayment(): void {
    this.modalService.show(PaymentConfirmComponent, {
      initialState: {
        userId: this.userId
      }
    });
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
      window.location.assign(savedRedirectUrl);
      return;
    }

    // Create new snap token
    this.dashboardSvc.create(DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN, {
      invitation_id: this.invitationId,
      amount: this.manualBill,
    }).subscribe({
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
        window.location.assign(finalUrl);
      },
      error: (err: any) => {
        this.isStartingPayment = false;

        // Handle 422 "Payment already initiated" error
        if (err?.status === 422) {
          const errorMessage = err?.error?.message || '';
          if (errorMessage.includes('already initiated') || errorMessage.includes('Payment already')) {
            // Try to fetch active transaction from API
            this.fetchActiveTransaction();
            return;
          }
        }

        this.paymentError = this.getApiErrorMessage(err);
      },
    });
  }

  private fetchActiveTransaction(): void {
    if (!this.invitationId) return;

    this.dashboardSvc.getParam(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      `?invitation_id=${this.invitationId}`
    ).subscribe({
      next: (res: any) => {
        const redirectUrl = res?.data?.redirect_url;
        if (redirectUrl) {
          this.saveRedirectUrl(this.invitationId, redirectUrl);
          window.location.assign(redirectUrl);
          return;
        }

        const snapToken = res?.data?.snap_token;
        if (snapToken) {
          const finalUrl = this.buildSnapUrl(snapToken);
          this.saveRedirectUrl(this.invitationId, finalUrl);
          window.location.assign(finalUrl);
          return;
        }

        this.isStartingPayment = false;
        this.paymentError = 'Tidak dapat menemukan transaksi yang aktif. Silakan coba membuat pembayaran baru.';
      },
      error: () => {
        this.isStartingPayment = false;
        this.paymentError = 'Transaksi Anda masih dalam proses. Silakan coba lagi beberapa saat.';
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

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.notyf.success('Nomor rekening disalin!');
    }).catch(() => {
      this.notyf.error('Gagal menyalin.');
    });
  }

}
