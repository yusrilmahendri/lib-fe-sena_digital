import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
@Component({ selector: 'wc-verify-account-success', templateUrl: './verify-account-success.component.html', styleUrls: ['./verify-account-success.component.scss'] })
export class VerifyAccountSuccessComponent implements OnInit {
  checking = true;
  constructor(private auth: AuthService, private router: Router) {}
  ngOnInit(): void { this.auth.getVerificationStatus().subscribe({ next: () => this.checking = false, error: () => this.checking = false }); }
  continue(): void { const target = sessionStorage.getItem('verification_intended_url') || '/dashboard/website/tampilan'; sessionStorage.removeItem('verification_intended_url'); sessionStorage.removeItem('verification_channel'); sessionStorage.removeItem('verification_resend_at'); this.router.navigateByUrl(target); }
}
