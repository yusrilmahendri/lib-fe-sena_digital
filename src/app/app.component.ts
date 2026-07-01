import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { IdleTimeoutService } from './core/services/idle-timeout.service';

@Component({
  selector: 'wc-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'Horuzt';
  private routerSub?: Subscription;

  constructor(
    private router: Router,
    private idleTimeoutService: IdleTimeoutService
  ) {}

  ngOnInit(): void {
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects || event.url;

        if (this.isDashboardRoute(url)) {
          this.idleTimeoutService.start();
        } else {
          this.idleTimeoutService.stop();
        }
      });

    if (this.isDashboardRoute(this.router.url)) {
      this.idleTimeoutService.start();
    }
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
    this.idleTimeoutService.stop();
  }

  private isDashboardRoute(url: string): boolean {
    const path = String(url || '').split('?')[0].split('#')[0];
    return path === '/dashboard'
      || path.startsWith('/dashboard/')
      || path === '/admin'
      || path.startsWith('/admin/')
      || path === '/dashboard-admin'
      || path.startsWith('/dashboard-admin/');
  }
}
