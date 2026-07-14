import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from 'src/app/dashboard.service';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';
import { AccountAccessStatus, PaymentState, resolvePaymentState } from 'src/app/shared/payment-status.util';

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
  private readonly onboardingRoute = '/buat-undangan';

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

    this.dashboardService.getProfile().subscribe({
      next: (response) => {
        this.paymentState = resolvePaymentState(response);
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

  openPaymentInstruction(): void {
    this.refreshStatus();
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
    this.contactAdmin();
  }

  upgradePackage(): void {
    this.contactAdmin();
  }

}
