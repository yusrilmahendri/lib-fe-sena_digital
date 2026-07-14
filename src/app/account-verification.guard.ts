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
            const paymentState = resolvePaymentState(profileResponse);

            if (paymentState.accountStatus === 'active') return true;
            if (paymentState.accountStatus === 'onboarding') {
              return state.url === this.onboardingRoute ? true : this.router.createUrlTree([this.onboardingRoute]);
            }
            if (paymentState.accountStatus === 'expired') {
              return this.router.createUrlTree(['/account-expired']);
            }
            if (paymentState.accountStatus === 'pending_payment') {
              return this.router.createUrlTree(['/payment-pending']);
            }

            return this.router.createUrlTree([this.onboardingRoute]);
          }),
          catchError(() => {
            sessionStorage.setItem('payment_intended_url', state.url);
            return of(this.router.createUrlTree([this.onboardingRoute]));
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
}
