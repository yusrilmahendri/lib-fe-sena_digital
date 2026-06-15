import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): boolean {
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.warn('Access denied. Redirecting to landing login modal...');
      // Protected routes: go to landing and open the auth modal, not /login.
      this.router.navigate(['/'], { queryParams: { auth: 'login' } });
      return false;
    }
    return true;
  }
}
