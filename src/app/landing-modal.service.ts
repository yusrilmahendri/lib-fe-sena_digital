import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * LandingModalService coordinates the two landing-page popups (login auth modal
 * and the multi-step "Buat Undangan" modal) so that any component — navbar,
 * hero CTA, or the login modal's "Daftar di sini" link — can open/close them
 * without tight coupling. Opening one closes the other.
 *
 * Also exposes `requestLogin()` for global 401 handling (AuthInterceptor) so
 * the app can prompt login via modal instead of redirecting to /login.
 */
@Injectable({
  providedIn: 'root',
})
export class LandingModalService {
  private readonly loginOpen = new BehaviorSubject<boolean>(false);
  private readonly createOpen = new BehaviorSubject<boolean>(false);

  readonly loginOpen$ = this.loginOpen.asObservable();
  readonly createOpen$ = this.createOpen.asObservable();

  /** One-shot message shown inside the login modal when opened via requestLogin(). */
  pendingAuthMessage = '';

  openLogin(): void {
    this.createOpen.next(false);
    this.loginOpen.next(true);
  }

  /** Open login modal with an optional prompt (used by AuthInterceptor on 401). */
  requestLogin(message?: string): void {
    this.pendingAuthMessage =
      message || 'Silakan masuk atau daftar terlebih dahulu untuk melanjutkan.';
    this.openLogin();
  }

  consumeAuthMessage(): string {
    const msg = this.pendingAuthMessage;
    this.pendingAuthMessage = '';
    return msg;
  }

  closeLogin(): void {
    this.loginOpen.next(false);
  }

  openCreateInvitation(): void {
    this.loginOpen.next(false);
    this.createOpen.next(true);
  }

  closeCreateInvitation(): void {
    this.createOpen.next(false);
  }
}
