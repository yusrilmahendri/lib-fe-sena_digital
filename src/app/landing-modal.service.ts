import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * LandingModalService coordinates the two landing-page popups (login auth modal
 * and the multi-step "Buat Undangan" modal) so that any component — navbar,
 * hero CTA, or the login modal's "Daftar di sini" link — can open/close them
 * without tight coupling. Opening one closes the other.
 *
 * This is UI-coordination only; it does NOT touch any auth/register business
 * logic, endpoints, payloads, or token handling.
 */
@Injectable({
  providedIn: 'root',
})
export class LandingModalService {
  private readonly loginOpen = new BehaviorSubject<boolean>(false);
  private readonly createOpen = new BehaviorSubject<boolean>(false);

  readonly loginOpen$ = this.loginOpen.asObservable();
  readonly createOpen$ = this.createOpen.asObservable();

  openLogin(): void {
    this.createOpen.next(false);
    this.loginOpen.next(true);
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
