import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { fromEvent, merge, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService implements OnDestroy {
  private readonly IDLE_LIMIT = 30 * 60 * 1000;
  private timer: any;
  private eventsSub?: Subscription;
  private isRunning = false;

  constructor(private router: Router) {}

  start(): void {
    if (this.isRunning) {
      this.resetTimer();
      return;
    }

    this.stop();
    this.isRunning = true;

    this.eventsSub = merge(
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'mousedown'),
      fromEvent(document, 'keydown'),
      fromEvent(document, 'scroll'),
      fromEvent(document, 'touchstart'),
      fromEvent(document, 'click')
    )
      .pipe(throttleTime(1000))
      .subscribe(() => this.resetTimer());

    console.log('[IdleTimeout]', 'started');
    this.resetTimer();
  }

  resetTimer(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.logoutByIdle(), this.IDLE_LIMIT);
    console.log('[IdleTimeout]', 'reset');
  }

  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.eventsSub?.unsubscribe();
    this.eventsSub = undefined;
    this.isRunning = false;
  }

  private logoutByIdle(): void {
    console.log('[IdleTimeout]', 'logout after 30 minutes idle');
    this.stop();
    this.clearAuthStorage();

    this.router.navigate(['/login'], {
      queryParams: { reason: 'session_expired' }
    });
  }

  private clearAuthStorage(): void {
    const authKeys = [
      'access_token',
      'auth_token',
      'token',
      'token_type',
      'user',
      'remember_me'
    ];

    authKeys.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
