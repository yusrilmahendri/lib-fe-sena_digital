import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, VerificationChannel, VerificationProfile } from '../auth.service';
import { DashboardService } from '../dashboard.service';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { resolvePaymentRedirect } from '../shared/payment-status.util';

@Component({ selector: 'wc-verify-account', templateUrl: './verify-account.component.html', styleUrls: ['./verify-account.component.scss'] })
export class VerifyAccountComponent implements OnInit {
  channel: VerificationChannel = 'email';
  profile: VerificationProfile = { email: '', phone: '' };
  loading = true;
  submitting = false;
  errorMessage = '';
  private readonly RESEND_COOLDOWN_MS = 120000;
  private verificationSendInProgress = false;

  constructor(private auth: AuthService, private dashboard: DashboardService, private router: Router) {}
  ngOnInit(): void {
    this.forceEmailVerificationChannel();
    forkJoin({ status: this.auth.getVerificationStatus(), profile: this.dashboard.getProfile() }).subscribe({
      next: ({ status, profile }) => {
        this.profile = { ...status.data, email: profile.data.email, phone: profile.data.phone };
        this.loading = false;
        if (status.data.is_verified) this.router.navigateByUrl(this.resolveNextRoute(profile));
      },
      error: () => { this.loading = false; this.errorMessage = 'Status akun tidak dapat dimuat. Silakan coba lagi.'; }
    });
  }
  select(channel: VerificationChannel): void {
    if (this.submitting) return;
    this.channel = channel === 'whatsapp' ? 'email' : channel;
    sessionStorage.setItem('verification_channel', 'email');
  }
  get maskedEmail(): string { return this.profile.email_masked || this.maskEmail(this.profile.email); }
  get maskedPhone(): string { return this.profile.phone_masked || this.maskPhone(this.profile.phone); }
  send(): void {
    if (this.submitting || this.verificationSendInProgress) return;

    const sentAt = Number(sessionStorage.getItem('verification_email_sent_at') || 0);
    const elapsed = Date.now() - sentAt;
    if (sentAt && elapsed < this.RESEND_COOLDOWN_MS) {
      const remainingMs = this.RESEND_COOLDOWN_MS - elapsed;
      sessionStorage.setItem('verification_channel', 'email');
      sessionStorage.setItem('verification_resend_at', String(Date.now() + remainingMs));
      this.router.navigate(['/verify-account/code'], { queryParams: { channel: 'email' } });
      return;
    }

    this.submitting = true; this.errorMessage = '';
    this.verificationSendInProgress = true;
    this.channel = 'email';
    sessionStorage.setItem('verification_channel', 'email');
    this.auth.sendAccountVerification('email').pipe(
      finalize(() => {
        this.submitting = false;
        this.verificationSendInProgress = false;
      })
    ).subscribe({
      next: () => {
        sessionStorage.setItem('verification_email_sent_at', String(Date.now()));
        sessionStorage.setItem('verification_channel', 'email');
        sessionStorage.setItem('verification_resend_at', String(Date.now() + this.RESEND_COOLDOWN_MS));
        this.router.navigate(['/verify-account/code'], { queryParams: { channel: 'email' } });
      },
      error: (error) => { this.errorMessage = error.status === 429 ? 'Terlalu banyak permintaan. Silakan tunggu sebelum mencoba lagi.' : (error.error?.message || 'Kode verifikasi gagal dikirim.'); }
    });
  }
  private forceEmailVerificationChannel(): void {
    const stored = sessionStorage.getItem('verification_channel');
    if (!stored || stored === 'whatsapp') {
      sessionStorage.setItem('verification_channel', 'email');
    }
    this.channel = 'email';
  }
  private maskEmail(value: string): string { const [name = '', domain = ''] = (value || '').split('@'); return domain ? `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}` : 'Email akun Anda'; }
  private maskPhone(value: string): string { const clean = value || ''; return clean.length > 7 ? `${clean.slice(0, 4)}****${clean.slice(-3)}` : 'Nomor akun Anda'; }

  private resolveNextRoute(profile: any): string {
    return resolvePaymentRedirect(profile, '/pilih-paket');
  }
}
