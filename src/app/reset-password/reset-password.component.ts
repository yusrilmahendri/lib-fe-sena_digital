import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Entry point for the password-reset email link
 * (`/reset-password?token=xxx&email=xxx`).
 *
 * It does NOT render a standalone form page — it renders the shared soft
 * background and opens the reusable auth modal in `reset-password` mode,
 * passing the token/email from the query params.
 */
@Component({
  selector: 'wc-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  email = '';
  isOpen = false;

  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      this.email = params['email'] || '';
      this.isOpen = true;
    });
  }

  onModalClosed(): void {
    this.isOpen = false;
    this.router.navigate(['/']);
  }
}
