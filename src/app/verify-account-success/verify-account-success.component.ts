import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { DashboardService } from '../dashboard.service';
import { resolvePaymentState } from '../shared/payment-status.util';
@Component({ selector: 'wc-verify-account-success', templateUrl: './verify-account-success.component.html', styleUrls: ['./verify-account-success.component.scss'] })
export class VerifyAccountSuccessComponent implements OnInit {
  checking = true;
  constructor(private auth: AuthService, private dashboard: DashboardService, private router: Router) {}
  ngOnInit(): void { this.auth.getVerificationStatus().subscribe({ next: () => this.checking = false, error: () => this.checking = false }); }
  continue(): void {
    this.clearVerificationState();
    this.checking = true;
    this.dashboard.getProfile().subscribe({
      next: (profile) => {
        this.checking = false;
        this.router.navigateByUrl(this.resolveNextRoute(profile));
      },
      error: () => {
        this.checking = false;
        this.router.navigateByUrl('/buat-undangan/payment');
      },
    });
  }

  private clearVerificationState(): void {
    sessionStorage.removeItem('verification_intended_url');
    sessionStorage.removeItem('verification_channel');
    sessionStorage.removeItem('verification_resend_at');
    sessionStorage.removeItem('verification_email_sent_at');
  }

  private resolveNextRoute(profile: any): string {
    const redirectUrl = String(profile?.data?.redirect_url || profile?.redirect_url || '').trim();
    if (redirectUrl) return redirectUrl;

    const state = resolvePaymentState(profile);
    if (state.accountStatus === 'active') return '/dashboard/overview';
    if (state.accountStatus === 'pending_payment' && state.hasInvoice) return '/dashboard/payment-pending';
    if (state.accountStatus === 'expired') return '/dashboard/account-expired';
    return '/buat-undangan/payment';
  }
}
