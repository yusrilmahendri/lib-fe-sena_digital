import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, VerificationChannel, VerificationProfile } from '../auth.service';
import { DashboardService } from '../dashboard.service';
import { forkJoin } from 'rxjs';

@Component({ selector: 'wc-verify-account', templateUrl: './verify-account.component.html', styleUrls: ['./verify-account.component.scss'] })
export class VerifyAccountComponent implements OnInit {
  channel: VerificationChannel = 'email';
  profile: VerificationProfile = { email: '', phone: '' };
  loading = true;
  submitting = false;
  errorMessage = '';
  private readonly RESEND_COOLDOWN_MS = 120000;

  constructor(private auth: AuthService, private dashboard: DashboardService, private router: Router) {}
  ngOnInit(): void {
    forkJoin({ status: this.auth.getVerificationStatus(), profile: this.dashboard.getProfile() }).subscribe({
      next: ({ status, profile }) => {
        this.profile = { ...status.data, email: profile.data.email, phone: profile.data.phone };
        this.loading = false;
        if (status.data.is_verified) this.router.navigate(['/verify-account/success']);
      },
      error: () => { this.loading = false; this.errorMessage = 'Status akun tidak dapat dimuat. Silakan coba lagi.'; }
    });
  }
  select(channel: VerificationChannel): void { if (!this.submitting) this.channel = channel; }
  get maskedEmail(): string { return this.profile.email_masked || this.maskEmail(this.profile.email); }
  get maskedPhone(): string { return this.profile.phone_masked || this.maskPhone(this.profile.phone); }
  send(): void {
    if (this.submitting) return;
    this.submitting = true; this.errorMessage = '';
    this.auth.sendAccountVerification(this.channel).subscribe({
      next: () => {
        sessionStorage.setItem('verification_channel', this.channel);
        sessionStorage.setItem('verification_resend_at', String(Date.now() + this.RESEND_COOLDOWN_MS));
        this.router.navigate(['/verify-account/code'], { queryParams: { channel: this.channel } });
      },
      error: (error) => { this.submitting = false; this.errorMessage = error.status === 429 ? 'Terlalu banyak permintaan. Silakan tunggu sebelum mencoba lagi.' : (error.error?.message || 'Kode verifikasi gagal dikirim.'); }
    });
  }
  private maskEmail(value: string): string { const [name = '', domain = ''] = (value || '').split('@'); return domain ? `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}` : 'Email akun Anda'; }
  private maskPhone(value: string): string { const clean = value || ''; return clean.length > 7 ? `${clean.slice(0, 4)}****${clean.slice(-3)}` : 'Nomor WhatsApp akun Anda'; }
}
