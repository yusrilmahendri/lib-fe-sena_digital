import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { LandingModalService } from '../landing-modal.service';

@Component({
  selector: 'wc-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  private queryParamsSub?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modal: LandingModalService
  ) { }

  ngOnInit(): void {
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      if (params['auth'] !== 'login') {
        return;
      }

      console.log('[LandingLoginModalOpen]', {
        reason: params['reason']
      });

      if (params['reason'] === 'session_expired') {
        this.modal.requestLogin(
          'Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit. Silakan login kembali.'
        );
      } else {
        this.modal.openLogin();
      }

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true
      });
    });
  }

  ngOnDestroy(): void {
    this.queryParamsSub?.unsubscribe();
  }

}
