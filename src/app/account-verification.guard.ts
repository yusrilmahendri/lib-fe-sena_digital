import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { DashboardService } from './dashboard.service';
import { isAccountVerified, resolvePaymentState } from './shared/payment-status.util';

@Injectable({ providedIn: 'root' })
export class AccountVerificationGuard implements CanActivate {
  private readonly onboardingRoute = '/buat-undangan';
  private readonly onboardingPaymentRoute = '/buat-undangan/payment';

  constructor(
    private auth: AuthService,
    private dashboardService: DashboardService,
    private router: Router
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.auth.getVerificationStatus().pipe(
      switchMap((response) => {
        if (!isAccountVerified(response.data)) {
          sessionStorage.setItem('verification_intended_url', state.url);
          return of(this.router.createUrlTree(['/verify-account']));
        }

        return this.dashboardService.getProfile().pipe(
          map((profileResponse) => {
            sessionStorage.setItem('payment_intended_url', state.url);
            const backendRedirectUrl = this.getBackendRedirectUrl(profileResponse);
            if (backendRedirectUrl) {
              return this.router.parseUrl(backendRedirectUrl);
            }

            const paymentState = resolvePaymentState(profileResponse);

            if (paymentState.accountStatus === 'active') return true;
            if (paymentState.accountStatus === 'onboarding') {
              return this.isOnboardingUrl(state.url)
                ? true
                : this.router.createUrlTree([this.onboardingPaymentRoute]);
            }
            if (paymentState.accountStatus === 'expired') {
              return this.router.createUrlTree(['/dashboard/account-expired']);
            }
            if (paymentState.accountStatus === 'pending_payment') {
              if (!paymentState.hasInvoice) {
                return this.router.createUrlTree([this.onboardingPaymentRoute]);
              }
              return this.isDashboardPaymentStatusUrl(state.url)
                ? true
                : this.router.createUrlTree(['/dashboard/payment-pending']);
            }

            return this.router.createUrlTree([this.onboardingPaymentRoute]);
          }),
          catchError(() => {
            sessionStorage.setItem('payment_intended_url', state.url);
            return of(this.router.createUrlTree([this.onboardingPaymentRoute]));
          })
        );
      }),
      catchError((error) => {
        if (error.status === 401) {
          return of(this.router.createUrlTree(['/'], { queryParams: { auth: 'login' } }));
        }

        sessionStorage.setItem('verification_intended_url', state.url);
        return of(this.router.createUrlTree(['/verify-account']));
      })
    );
  }

  private isDashboardPaymentStatusUrl(url: string): boolean {
    const path = (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
    return path === '/dashboard' || path === '/dashboard/overview' || path === '/dashboard/payment-pending' || path === '/dashboard/bill';
  }

  private isOnboardingUrl(url: string): boolean {
    const path = (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
    return path === this.onboardingRoute || path === this.onboardingPaymentRoute;
  }

  private getBackendRedirectUrl(response: any): string {
    return String(
      response?.data?.redirect_url ||
      response?.redirect_url ||
      ''
    ).trim();
  }
}
