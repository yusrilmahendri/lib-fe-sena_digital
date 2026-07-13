import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, VerificationChannel } from '../auth.service';
import { environment } from '../../environments/environment';

@Component({ selector: 'wc-verify-account-code', templateUrl: './verify-account-code.component.html', styleUrls: ['./verify-account-code.component.scss'] })
export class VerifyAccountCodeComponent implements OnInit, OnDestroy {
  @ViewChildren('digitInput') inputs!: QueryList<ElementRef<HTMLInputElement>>;
  digits = ['', '', '', '', '', ''];
  channel: VerificationChannel = 'email';
  destination = 'akun Anda';
  submitting = false; resending = false; seconds = 0; errorMessage = '';
  private readonly RESEND_COOLDOWN_MS = 120000;
  private timer?: ReturnType<typeof setInterval>;
  constructor(private auth: AuthService, private router: Router, private route: ActivatedRoute) {}
  ngOnInit(): void {
    const queryChannel = this.route.snapshot.queryParamMap.get('channel');
    const stored = sessionStorage.getItem('verification_channel');
    const channel = this.normalizeChannel(queryChannel) || this.normalizeChannel(stored);
    if (!channel) { this.router.navigate(['/verify-account']); return; }
    this.channel = channel;
    sessionStorage.setItem('verification_channel', this.channel);
    this.destination = this.channel === 'email' ? 'email Anda' : 'nomor WhatsApp Anda';
    this.startCountdown();
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  get otpCode(): string { return this.digits.join(''); }
  get isOtpComplete(): boolean { return /^\d{6}$/.test(this.otpCode); }
  trackByIndex(index: number): number { return index; }
  onInputFallback(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    if (!value) {
      this.digits[index] = '';
      input.value = '';
      return;
    }
    if (value.length > 1) {
      this.applyOtp(value);
      return;
    }
    this.digits[index] = value.slice(-1); input.value = this.digits[index];
    if (this.digits[index] && index < 5) this.focus(index + 1);
  }
  onKeydown(index: number, event: KeyboardEvent): void {
    const key = event.key;
    if (/^\d$/.test(key)) {
      event.preventDefault();
      this.digits[index] = key;
      if (index < 5) this.focus(index + 1);
      return;
    }
    if (key === 'Backspace') {
      event.preventDefault();
      if (this.digits[index]) { this.digits[index] = ''; return; }
      if (index > 0) { this.digits[index - 1] = ''; this.focus(index - 1); }
      return;
    }
    if (key === 'Delete') {
      event.preventDefault();
      this.digits[index] = '';
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
      this.verifyAccount();
      return;
    }
    if (!['Tab', 'Shift'].includes(key)) event.preventDefault();
  }
  onPaste(event: ClipboardEvent): void {
    event.preventDefault(); const code = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    this.applyOtp(code);
  }
  verifyAccount(): void {
    const code = this.otpCode;
    this.debug('[Verify Account] button clicked', { channel: this.channel, otpCode: code, isOtpComplete: this.isOtpComplete, submitting: this.submitting });
    if (this.submitting) return;
    if (!this.isOtpComplete) { this.errorMessage = 'Masukkan kode verifikasi 6 digit.'; return; }
    this.submitting = true; this.errorMessage = '';
    this.debug('[Verify Account] request payload', { channel: this.channel, code });
    this.auth.verifyAccountCode(this.channel, code).subscribe({
      next: (response) => {
        this.debug('[Verify Account] success', response);
        this.submitting = false;
        this.digits = ['', '', '', '', '', ''];
        sessionStorage.removeItem('verification_channel');
        sessionStorage.removeItem('verification_resend_at');
        this.router.navigate(['/verify-account/success']);
      },
      error: (error) => {
        console.error('[Verify Account] failed', error);
        this.submitting = false;
        this.errorMessage = this.apiError(error);
        if (this.isExpiredOtpError(error)) this.digits = ['', '', '', '', '', ''];
        setTimeout(() => this.focus(0));
      }
    });
  }
  verify(): void { this.verifyAccount(); }
  resend(): void {
    if (this.seconds || this.resending) return;
    this.resending = true; this.errorMessage = '';
    this.auth.resendAccountVerification(this.channel).subscribe({
      next: () => { this.resending = false; sessionStorage.setItem('verification_resend_at', String(Date.now() + this.RESEND_COOLDOWN_MS)); this.startCountdown(); },
      error: (error) => { this.resending = false; this.errorMessage = error.status === 429 ? 'Batas pengiriman tercapai. Silakan coba beberapa saat lagi.' : 'Kode gagal dikirim ulang. Silakan coba lagi.'; }
    });
  }
  changeMethod(): void { this.digits.fill(''); sessionStorage.removeItem('verification_channel'); this.router.navigate(['/verify-account']); }
  private applyOtp(rawCode: string): void {
    const code = rawCode.replace(/\D/g, '').slice(0, 6);
    this.digits = ['', '', '', '', '', ''];
    code.split('').forEach((digit, index) => this.digits[index] = digit);
    const nextIndex = Math.min(code.length, 5);
    setTimeout(() => this.focus(nextIndex));
  }
  private normalizeChannel(channel: string | null): VerificationChannel | null {
    return channel === 'email' || channel === 'whatsapp' ? channel : null;
  }
  private debug(message: string, data?: unknown): void {
    if (!environment.production) console.log(message, data);
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
