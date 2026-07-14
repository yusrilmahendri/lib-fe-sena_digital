import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from 'src/app/dashboard.service';
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
          this.router.navigate(['/account-expired']);
          return;
        }

        if (
          this.statusPage === 'pending_payment' &&
          (!this.paymentState.hasInvoice || this.paymentState.accountStatus !== 'pending_payment')
        ) {
          this.router.navigateByUrl(this.onboardingRoute);
          return;
        }

        if (this.paymentState.accountStatus === 'pending_payment' && this.statusPage !== 'pending_payment') {
          this.router.navigate(['/payment-pending']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error?.error?.message || 'Gagal memuat status pembayaran.';
      }
    });
  }

  openPaymentInstruction(): void {
    this.router.navigate(['/dashboard/bill']);
  }

  contactAdmin(): void {
    this.router.navigate(['/dashboard/hubungi-kami']);
  }

  renewPackage(): void {
    this.contactAdmin();
  }

  upgradePackage(): void {
    this.contactAdmin();
  }

}
