import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class IdleTimeoutService implements OnDestroy {
  private readonly IDLE_LIMIT = 30 * 60 * 1000;
  private readonly activityEvents = [
    'mousemove',
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click'
  ] as const;
  private readonly activityListenerOptions: AddEventListenerOptions = {
    passive: true,
    capture: false
  };
  private readonly activityHandler = (): void => {
    this.resetTimer();
  };
  private timer: any;
  private isRunning = false;

  constructor(private router: Router) {}

  start(): void {
    if (this.isRunning) {
      this.resetTimer();
      return;
    }

    this.stop();
    this.isRunning = true;

    this.activityEvents.forEach((eventName) => {
      document.addEventListener(eventName, this.activityHandler, this.activityListenerOptions);
    });

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
    this.activityEvents.forEach((eventName) => {
      document.removeEventListener(eventName, this.activityHandler, this.activityListenerOptions);
    });
    this.isRunning = false;
  }

  private logoutByIdle(): void {
    console.log('[IdleTimeout]', 'logout after 30 minutes idle');
    this.stop();
    this.clearAuthStorage();

    console.log('[SessionExpiredRedirect]', {
      target: '/',
      auth: 'login',
      reason: 'session_expired',
    });

    this.router.navigate(['/'], {
      queryParams: {
        auth: 'login',
        reason: 'session_expired',
      },
      replaceUrl: true,
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
