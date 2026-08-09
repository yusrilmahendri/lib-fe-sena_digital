import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, take } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { AccountAccessStatus, PaymentState, resolvePaymentState } from 'src/app/shared/payment-status.util';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'wc-bill-user',
  templateUrl: './bill-user.component.html',
  styleUrls: ['./bill-user.component.scss']
})
export class BillUserComponent implements OnInit {

  paymentStatusMessage = '';
  paymentState: PaymentState | null = null;
  isLoading = false;
  errorMessage = '';
  statusPage: Extract<AccountAccessStatus, 'pending_payment' | 'expired'> = 'pending_payment';
  isContinuingPayment = false;
  manualPaymentModalOpen = false;
  manualPaymentInvoice: any | null = null;
  paymentUnavailableTitle = '';
  paymentUnavailableMessage = '';
  private readonly onboardingRoute = '/buat-undangan';
  private readonly onboardingPaymentRoute = '/pilih-paket';

  constructor(
    private dashboardService: DashboardService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit() {
    this.statusPage = this.route.snapshot.data?.['accountStatusPage'] === 'expired' ? 'expired' : 'pending_payment';
    this.paymentStatusMessage = history.state?.paymentStatusMessage || '';
    this.refreshStatus();
  }

  refreshStatus(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      profile: this.dashboardService.getProfile(),
      paymentConfig: this.dashboardService.getUserPaymentConfig().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ profile, paymentConfig }) => {
        this.paymentState = resolvePaymentState(this.mergePaymentConfig(profile, paymentConfig));
        this.isLoading = false;

        if (this.paymentState.accountStatus === 'unverified') {
          this.router.navigate(['/verify-account']);
          return;
        }

        if (this.paymentState.accountStatus === 'onboarding') {
          this.router.navigateByUrl(this.onboardingRoute);
          return;
        }

        if (this.paymentState.accountStatus === 'active') {
          const intendedUrl = sessionStorage.getItem('payment_intended_url') || '/dashboard/overview';
          sessionStorage.removeItem('payment_intended_url');
          this.router.navigateByUrl(intendedUrl);
          return;
        }

        if (this.paymentState.accountStatus === 'expired' && this.statusPage !== 'expired') {
          this.router.navigate(['/dashboard/account-expired']);
          return;
        }

        if (
          this.statusPage === 'pending_payment' &&
          this.paymentState.accountStatus !== 'pending_payment'
        ) {
          this.router.navigateByUrl(this.onboardingRoute);
          return;
        }

        if (this.paymentState.accountStatus === 'pending_payment' && this.statusPage !== 'pending_payment') {
          this.router.navigate(['/dashboard/payment-pending']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = getFriendlyErrorMessage(error);
      }
    });
  }

  continuePayment(): void {
    if (this.isContinuingPayment) return;

    const invoice = this.paymentState?.pendingInvoice;
    this.errorMessage = '';
    this.paymentStatusMessage = '';
    this.paymentUnavailableTitle = '';
    this.paymentUnavailableMessage = '';

    if (!invoice) {
      this.createPayment();
      return;
    }

    if (invoice.is_payable === false) {
      this.handleNonPayableInvoice(invoice);
      return;
    }

    const resume = invoice.resume || {};
    if (resume.available === false) {
      if (!this.continueWithConfiguredPaymentMethod(invoice)) {
        this.showUnavailablePayment();
      }
      return;
    }

    switch (resume.type) {
      case 'midtrans_snap':
        this.resumeMidtrans(invoice);
        break;
      case 'manual_payment':
        this.showManualPayment(invoice);
        break;
      default:
        if (!this.continueWithConfiguredPaymentMethod(invoice)) {
          this.showUnavailablePayment();
        }
    }
  }

  contactAdmin(): void {
    this.router.navigate(['/dashboard/hubungi-kami']);
  }

  copyInvoiceCode(): void {
    const invoiceCode = this.paymentState?.invoiceCode || '';
    if (!invoiceCode) {
      this.errorMessage = 'Kode pemesanan belum tersedia.';
      return;
    }

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(invoiceCode)
        .then(() => this.paymentStatusMessage = 'Kode pemesanan berhasil disalin.')
        .catch(() => this.copyInvoiceCodeFallback(invoiceCode));
      return;
    }

    this.copyInvoiceCodeFallback(invoiceCode);
  }

  copyManualAccountNumber(): void {
    const accountNumber = this.manualPaymentAccountNumber;
    if (!accountNumber) {
      this.errorMessage = 'Nomor rekening belum tersedia.';
      return;
    }

    this.copyText(accountNumber, 'Nomor rekening berhasil disalin.');
  }

  copyManualAmount(): void {
    const amount = this.manualPaymentAmountRaw || this.manualPaymentAmountLabel;
    if (!amount) {
      this.errorMessage = 'Nominal pembayaran belum tersedia.';
      return;
    }

    this.copyText(amount, 'Nominal pembayaran berhasil disalin.');
  }

  closeManualPaymentModal(): void {
    this.manualPaymentModalOpen = false;
    this.manualPaymentInvoice = null;
  }

  private copyInvoiceCodeFallback(invoiceCode: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = invoiceCode;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.paymentStatusMessage = 'Kode pemesanan berhasil disalin.';
  }

  renewPackage(): void {
    const packageTarget = this.paymentState?.packageCode || this.paymentState?.packageName || '';
    this.router.navigate(['/user/upgrade-account'], {
      queryParams: {
        mode: 'renew',
        package: packageTarget,
        returnUrl: '/dashboard/account-expired',
      },
    });
  }

  upgradePackage(): void {
    this.router.navigate(['/user/upgrade-account'], {
      queryParams: {
        mode: 'upgrade',
        returnUrl: '/dashboard/account-expired',
      },
    });
  }

  get pendingPaymentTitle(): string {
    return 'Selesaikan Pembayaran';
  }

  get pendingPaymentLead(): string {
    const packageName = this.paymentState?.packageName || this.paymentState?.packageCode || 'paket pilihan';
    return `Anda telah memilih Paket ${this.normalizePackageLabel(packageName)}. Selesaikan pembayaran untuk mengaktifkan akun dan mulai membuat undangan.`;
  }

  get pendingPaymentCtaLabel(): string {
    if (this.isContinuingPayment) return 'Menyiapkan pembayaran...';
    const action = this.paymentState?.paymentAction;
    if (action === 'continue_payment') return 'Lanjutkan Pembayaran';
    if (action === 'create_new_payment') return 'Buat Pembayaran Baru';
    if (action === 'retry_payment') return 'Coba Lagi';
    return 'Buat Pembayaran';
  }

  get activePaymentMethodLabels(): string[] {
    return (this.paymentState?.activePaymentMethods || []).map((method) => method.label);
  }

  get manualPaymentData(): any {
    return this.manualPaymentInvoice?.manual_payment || {};
  }

  get manualPaymentBankName(): string {
    return this.manualPaymentData?.bank_name || this.manualPaymentData?.nama_bank || '-';
  }

  get manualPaymentAccountNumber(): string {
    return String(this.manualPaymentData?.account_number || this.manualPaymentData?.nomor_rekening || '').trim();
  }

  get manualPaymentAccountHolder(): string {
    return this.manualPaymentData?.account_holder || this.manualPaymentData?.account_name || this.manualPaymentData?.nama_pemilik || '-';
  }

  get manualPaymentAmountLabel(): string {
    return this.formatCurrency(this.manualPaymentInvoice?.amount) || this.paymentState?.amountLabel || '-';
  }

  get manualPaymentAmountRaw(): string {
    return String(this.manualPaymentInvoice?.amount || '').trim();
  }

  get manualPaymentInstructions(): string[] {
    const instructions = this.manualPaymentData?.instructions;
    if (Array.isArray(instructions)) {
      return instructions.map((item) => String(item || '').trim()).filter(Boolean);
    }

    const text = String(instructions || '').trim();
    return text ? [text] : ['Transfer sesuai nominal tagihan, lalu tunggu konfirmasi admin.'];
  }

  get paymentUnavailablePrimaryLabel(): string {
    if (this.paymentUnavailableTitle === 'Waktu Pembayaran Habis') return 'Buat Pembayaran Baru';
    if (this.paymentUnavailableTitle === 'Pembayaran Gagal') return 'Coba Bayar Lagi';
    return 'Coba Lagi';
  }

  retryUnavailablePayment(): void {
    if (
      this.paymentUnavailableTitle === 'Waktu Pembayaran Habis' ||
      this.paymentUnavailableTitle === 'Pembayaran Gagal'
    ) {
      this.createPayment();
      return;
    }

    this.refreshStatus();
  }

  private normalizePackageLabel(value: string): string {
    const label = String(value || '').trim();
    if (!label) return 'pilihan';
    return label.replace(/^paket\s+/i, '');
  }

  private createPayment(): void {
    this.router.navigateByUrl(this.onboardingPaymentRoute);
  }

  private continueWithConfiguredPaymentMethod(invoice: any): boolean {
    const midtransMethod = this.findActivePaymentMethod('midtrans');
    if (midtransMethod) {
      this.refreshMidtransToken(this.mergePaymentMethodDetails(invoice, midtransMethod.details, 'midtrans'));
      return true;
    }

    const manualMethod = this.findActivePaymentMethod('manual');
    if (manualMethod) {
      this.showManualPayment(this.mergePaymentMethodDetails(invoice, manualMethod.details, 'manual'));
      return true;
    }

    return false;
  }

  private findActivePaymentMethod(type: 'midtrans' | 'manual'): any | null {
    return (this.paymentState?.activePaymentMethods || []).find((method) => method.type === type) || null;
  }

  private mergePaymentMethodDetails(invoice: any, details: any, fallbackType: 'midtrans' | 'manual'): any {
    const methodType = this.resolveConfiguredPaymentMethodType(details) || fallbackType;
    const merged = {
      ...invoice,
      payment_method: invoice?.payment_method || methodType,
      provider: invoice?.provider || methodType,
    };

    if (methodType === 'midtrans') {
      return {
        ...merged,
        midtrans: {
          ...(details || {}),
          ...(invoice?.midtrans || {}),
        },
      };
    }

    if (methodType === 'manual') {
      return {
        ...merged,
        manual_payment: invoice?.manual_payment || details,
      };
    }

    return merged;
  }

  private resolveConfiguredPaymentMethodType(details: any): 'midtrans' | 'manual' | '' {
    const type = String(details?.payment_method || details?.method || details?.type || details?.code || '').toLowerCase();
    if (type.includes('midtrans') || type.includes('snap') || type.includes('online')) return 'midtrans';
    if (type.includes('manual') || type.includes('transfer') || type.includes('bank')) return 'manual';
    return '';
  }

  private mergePaymentConfig(profile: any, paymentConfig: any): any {
    const data = profile?.data || profile || {};
    const config = paymentConfig?.data || paymentConfig || null;
    if (!config) return profile;

    return {
      ...profile,
      data: {
        ...data,
        payment_config: config,
      },
    };
  }

  private handleNonPayableInvoice(invoice: any): void {
    const status = String(invoice?.payment_status || '').trim().toLowerCase();
    if (['paid', 'settlement', 'capture', 'success', 'sukses', 'lunas', 'confirmed'].includes(status)) {
      this.paymentStatusMessage = 'Pembayaran sudah berhasil. Kami sedang memperbarui status akun Anda.';
      this.refreshStatus();
      return;
    }

    if (['expired', 'expire', 'kedaluwarsa', 'kadaluarsa', 'failed', 'failure', 'gagal', 'deny', 'denied', 'cancel', 'cancelled'].includes(status)) {
      this.paymentUnavailableTitle = status.includes('expir') || status.includes('kedaluwarsa') || status.includes('kadaluarsa')
        ? 'Waktu Pembayaran Habis'
        : 'Pembayaran Gagal';
      this.paymentUnavailableMessage = this.paymentUnavailableTitle === 'Waktu Pembayaran Habis'
        ? 'Batas waktu pembayaran telah berakhir. Buat pembayaran baru untuk melanjutkan.'
        : 'Pembayaran belum berhasil dan paket Anda belum berubah.';
      return;
    }

    this.showUnavailablePayment();
  }

  private resumeMidtrans(invoice: any): void {
    const existingToken = this.resolveSnapToken(invoice);
    if (existingToken && this.isSnapTokenUsable(invoice)) {
      this.openSnap(existingToken, invoice);
      return;
    }

    this.refreshMidtransToken(invoice);
  }

  private refreshMidtransToken(invoice: any): void {
    this.isContinuingPayment = true;
    const payload = this.buildResumePayload(invoice);

    this.dashboardService.create(DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN, payload)
      .pipe(
        take(1),
        finalize(() => {
          if (!(window as any).snap) {
            this.isContinuingPayment = false;
          }
        })
      )
      .subscribe({
        next: (response) => {
          const data = response?.data || response || {};
          const token = this.resolveSnapToken(data) || this.resolveSnapToken({ midtrans: data });
          const mergedInvoice = {
            ...invoice,
            ...data,
            midtrans: {
              ...(invoice?.midtrans || {}),
              ...(data?.midtrans || data || {}),
            },
          };

          if (!token) {
            this.isContinuingPayment = false;
            this.showUnavailablePayment('Halaman pembayaran belum dapat dibuka. Silakan coba lagi.');
            return;
          }

          this.updatePendingInvoice(mergedInvoice);
          this.openSnap(token, mergedInvoice);
        },
        error: (error) => {
          this.isContinuingPayment = false;
          this.errorMessage = getFriendlyErrorMessage(error) || 'Pembayaran belum dapat dilanjutkan. Silakan coba lagi.';
        },
      });
  }

  private showManualPayment(invoice: any): void {
    if (!invoice?.manual_payment) {
      this.showUnavailablePayment();
      return;
    }

    this.manualPaymentInvoice = invoice;
    this.manualPaymentModalOpen = true;
  }

  private showUnavailablePayment(message?: string): void {
    this.paymentUnavailableTitle = 'Metode Pembayaran Belum Tersedia';
    this.paymentUnavailableMessage = message || 'Metode pembayaran untuk tagihan ini belum tersedia. Silakan coba kembali atau hubungi admin.';
  }

  private openSnap(token: string, invoice: any): void {
    this.isContinuingPayment = true;
    const pay = () => {
      const snap = (window as any).snap;
      if (!snap?.pay) {
        this.isContinuingPayment = false;
        this.showUnavailablePayment('Halaman pembayaran belum dapat dibuka. Silakan coba lagi.');
        return;
      }

      try {
        snap.pay(token, {
          onSuccess: () => {
            this.isContinuingPayment = false;
            this.paymentStatusMessage = 'Pembayaran sedang diverifikasi. Kami akan memperbarui status dari server.';
            this.refreshStatus();
          },
          onPending: () => {
            this.isContinuingPayment = false;
            this.paymentStatusMessage = 'Pembayaran Anda sedang diproses.';
            this.refreshStatus();
          },
          onError: () => {
            this.isContinuingPayment = false;
            this.errorMessage = 'Pembayaran belum dapat dibuka atau diproses. Silakan coba lagi.';
          },
          onClose: () => {
            this.isContinuingPayment = false;
            this.paymentStatusMessage = 'Jendela pembayaran ditutup. Anda dapat melanjutkan pembayaran kapan saja.';
          },
        });
      } catch (_error) {
        this.isContinuingPayment = false;
        this.errorMessage = 'Pembayaran belum dapat dibuka. Silakan coba lagi.';
      }
    };

    if ((window as any).snap?.pay) {
      pay();
      return;
    }

    const clientKey = this.resolveMidtransClientKey(invoice);
    if (!clientKey) {
      this.isContinuingPayment = false;
      this.showUnavailablePayment('Halaman pembayaran belum dapat dibuka. Silakan coba lagi.');
      return;
    }

    this.loadSnapScript(clientKey)
      .then(pay)
      .catch(() => {
        this.isContinuingPayment = false;
        this.showUnavailablePayment('Halaman pembayaran belum dapat dibuka. Silakan coba lagi.');
      });
  }

  private resolveSnapToken(source: any): string {
    return String(
      source?.midtrans?.snap_token ||
      source?.snap_token ||
      source?.token ||
      source?.midtrans_snap_token ||
      ''
    ).trim();
  }

  private isSnapTokenUsable(invoice: any): boolean {
    const expiresAt = invoice?.midtrans?.expires_at || invoice?.expires_at;
    if (!expiresAt) return true;

    const expiresAtTime = new Date(expiresAt).getTime();
    if (Number.isNaN(expiresAtTime)) return true;

    return expiresAtTime > Date.now();
  }

  private buildResumePayload(invoice: any): any {
    const payload = { ...(invoice?.resume?.payload || {}) };
    if (Object.keys(payload).length) return payload;

    if (invoice?.order_id) payload.order_id = invoice.order_id;
    if (invoice?.id) payload.invoice_id = invoice.id;
    if (invoice?.invoice_code) payload.invoice_code = invoice.invoice_code;
    return payload;
  }

  private updatePendingInvoice(invoice: any): void {
    if (!this.paymentState) return;
    this.paymentState = {
      ...this.paymentState,
      pendingInvoice: invoice,
      resume: invoice?.resume || this.paymentState.resume,
      paymentUrl: invoice?.midtrans?.redirect_url || invoice?.redirect_url || this.paymentState.paymentUrl,
    };
  }

  private resolveMidtransClientKey(invoice: any): string {
    return String(
      invoice?.midtrans?.client_key ||
      invoice?.midtrans?.clientKey ||
      invoice?.client_key ||
      invoice?.clientKey ||
      ''
    ).trim();
  }

  private loadSnapScript(clientKey: string): Promise<void> {
    if ((window as any).snap?.pay) return Promise.resolve();

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

  private copyText(text: string, successMessage: string): void {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => this.paymentStatusMessage = successMessage)
        .catch(() => this.copyTextFallback(text, successMessage));
      return;
    }

    this.copyTextFallback(text, successMessage);
  }

  private copyTextFallback(text: string, successMessage: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    this.paymentStatusMessage = successMessage;
  }

  private formatCurrency(value: any): string {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);

    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(numeric);
  }

}
