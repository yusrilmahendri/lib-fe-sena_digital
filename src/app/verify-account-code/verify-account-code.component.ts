import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, VerificationChannel } from '../auth.service';
import { finalize } from 'rxjs/operators';

@Component({ selector: 'wc-verify-account-code', templateUrl: './verify-account-code.component.html', styleUrls: ['./verify-account-code.component.scss'] })
export class VerifyAccountCodeComponent implements OnInit, OnDestroy {
  @ViewChildren('digitInput') inputs!: QueryList<ElementRef<HTMLInputElement>>;
  digits = ['', '', '', '', '', ''];
  channel: VerificationChannel = 'email';
  destination = 'akun Anda';
  submitting = false; resending = false; seconds = 0; errorMessage = '';
  private readonly RESEND_COOLDOWN_MS = 120000;
  private verificationSendInProgress = false;
  private timer?: ReturnType<typeof setInterval>;
  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {}
  ngOnInit(): void {
    const queryChannel = this.route.snapshot.queryParamMap.get('channel');
    const stored = sessionStorage.getItem('verification_channel');
    this.channel = this.normalizeChannel(queryChannel) || this.normalizeChannel(stored) || 'email';
    sessionStorage.setItem('verification_channel', 'email');
    this.destination = 'email Anda';
    this.startCountdown();
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  get otpCode(): string { return this.digits.join(''); }
  get isOtpComplete(): boolean { return /^\d{6}$/.test(this.otpCode); }
  trackByIndex(index: number): number { return index; }
  onInputFallback(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    if (value.length > 1) {
      this.applyOtp(value);
      return;
    }
    if (!value) {
      this.digits[index] = '';
      this.syncInputValues();
      return;
    }
    this.digits[index] = value.slice(-1);
    this.syncInputValues();
    if (index < 5) this.focus(index + 1);
  }
  onKeydown(index: number, event: KeyboardEvent): void {
    const key = event.key;
    if (event.ctrlKey || event.metaKey) return;
    if (/^\d$/.test(key)) {
      event.preventDefault();
      this.digits[index] = key;
      this.syncInputValues();
      if (index < 5) this.focus(index + 1);
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      if (this.digits[index]) {
        this.digits[index] = '';
      } else if (index > 0) {
        this.digits[index - 1] = '';
        this.focus(index - 1);
      }
      this.syncInputValues();
      return;
    }
    if (key === 'Delete') {
      event.preventDefault();
      this.digits[index] = '';
      this.syncInputValues();
      return;
    }
    if (key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focus(index - 1);
      return;
    }
    if (key === 'ArrowRight' && index < 5) {
      event.preventDefault();
      this.focus(index + 1);
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      this.verify();
      return;
    }
    if (!['Tab', 'Shift'].includes(key)) event.preventDefault();
  }
  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    this.applyOtp(event.clipboardData?.getData('text') || '');
  }
  verifyAccount(): void {
    this.verify();
  }
  verify(): void {
    console.log('[OTP STATE]', this.digits, this.otpCode, this.isOtpComplete);
    console.log('[VERIFY CLICK]', {
      digits: this.digits,
      otpCode: this.otpCode,
      isOtpComplete: this.isOtpComplete,
      submitting: this.submitting,
      channel: 'email'
    });
    if (this.submitting) return;
    if (!this.isOtpComplete) { this.errorMessage = 'Masukkan kode verifikasi 6 digit.'; return; }
    this.submitting = true; this.errorMessage = '';
    this.channel = 'email';
    sessionStorage.setItem('verification_channel', 'email');
    this.auth.verifyAccountCode('email', this.otpCode).subscribe({
      next: () => {
        this.submitting = false;
        this.digits = ['', '', '', '', '', ''];
        this.syncInputValues();
        sessionStorage.removeItem('verification_channel');
        sessionStorage.removeItem('verification_resend_at');
        sessionStorage.removeItem('verification_email_sent_at');
        this.router.navigate(['/verify-account/success']);
      },
      error: (error) => {
        console.error('[Verify Account] failed', error);
        this.submitting = false;
        this.errorMessage = this.apiError(error);
        if (this.isExpiredOtpError(error)) {
          this.digits = ['', '', '', '', '', ''];
          this.syncInputValues();
        }
        setTimeout(() => this.focus(0));
      }
    });
  }
  resend(): void {
    if (this.seconds || this.resending || this.verificationSendInProgress) return;
    this.resending = true; this.errorMessage = '';
    this.verificationSendInProgress = true;
    this.channel = 'email';
    sessionStorage.setItem('verification_channel', 'email');
    this.auth.resendAccountVerification('email').pipe(
      finalize(() => {
        this.resending = false;
        this.verificationSendInProgress = false;
      })
    ).subscribe({
      next: () => {
        sessionStorage.setItem('verification_email_sent_at', String(Date.now()));
        sessionStorage.setItem('verification_resend_at', String(Date.now() + this.RESEND_COOLDOWN_MS));
        this.startCountdown();
      },
      error: (error) => { this.errorMessage = error.status === 429 ? 'Batas pengiriman tercapai. Silakan coba beberapa saat lagi.' : 'Kode gagal dikirim ulang. Silakan coba lagi.'; }
    });
  }
  changeMethod(): void { this.digits.fill(''); this.syncInputValues(); sessionStorage.setItem('verification_channel', 'email'); this.router.navigate(['/verify-account']); }
  private applyOtp(rawCode: string): void {
    const code = rawCode.replace(/\D/g, '').slice(0, 6);
    this.digits = ['', '', '', '', '', ''];
    code.split('').forEach((digit, index) => this.digits[index] = digit);
    this.syncInputValues();
    setTimeout(() => this.focus(Math.min(code.length, 5)));
  }
  private syncInputValues(): void {
    setTimeout(() => {
      this.inputs?.forEach((ref, index) => {
        ref.nativeElement.value = this.digits[index] || '';
      });
      console.log('[OTP STATE]', this.digits, this.otpCode, this.isOtpComplete);
    });
  }
  private normalizeChannel(channel: string | null): VerificationChannel | null {
    if (channel === 'whatsapp') {
      sessionStorage.setItem('verification_channel', 'email');
      return 'email';
    }
    return channel === 'email' ? channel : null;
  }
  private startCountdown(): void {
    if (this.timer) clearInterval(this.timer);
    const tick = () => this.seconds = Math.max(0, Math.ceil((Number(sessionStorage.getItem('verification_resend_at') || 0) - Date.now()) / 1000));
    tick(); this.timer = setInterval(tick, 1000);
  }
  private focus(index: number): void { this.inputs?.get(index)?.nativeElement.focus(); }
  private apiError(error: any): string {
    if (error.status === 429) return 'Terlalu banyak percobaan. Silakan tunggu dan coba lagi.';
    const code = error.error?.code;
    if (code === 'VERIFICATION_CODE_EXPIRED' || code === 'OTP_EXPIRED') return 'Kode sudah kedaluwarsa. Kirim ulang kode baru.';
    return error.error?.message || 'Kode verifikasi salah. Periksa kembali kode Anda.';
  }
  private isExpiredOtpError(error: any): boolean {
    const code = error.error?.code;
    return code === 'VERIFICATION_CODE_EXPIRED' || code === 'OTP_EXPIRED';
  }
}
