import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'wc-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  resetToken = '';
  resetEmail = '';
  resetModalOpen = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.resetToken = String(params.get('token') || '').trim();
      this.resetEmail = String(params.get('email') || params.get('identifier') || '').trim();
      this.resetModalOpen = true;
    });
  }

  onModalClosed(): void {
    this.resetModalOpen = false;
    this.router.navigate(['/'], { queryParams: { auth: 'login' } });
  }
}
