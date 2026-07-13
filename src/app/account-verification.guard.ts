import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AccountVerificationGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    return this.auth.getVerificationStatus().pipe(
      map((response) => {
        const profile = response.data;
        const verified = !!(profile.is_verified || profile.account_verified || profile.email_verified_at);
        if (verified) return true;
        sessionStorage.setItem('verification_intended_url', state.url);
        return this.router.createUrlTree(['/verify-account']);
      }),
      catchError((error) => error.status === 401
        ? of(this.router.createUrlTree(['/'], { queryParams: { auth: 'login' } }))
        : of(this.router.createUrlTree(['/verify-account'])))
    );
  }
}
