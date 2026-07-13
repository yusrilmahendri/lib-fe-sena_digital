import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, VerificationChannel } from '../auth.service';

@Component({ selector: 'wc-verify-account-code', templateUrl: './verify-account-code.component.html', styleUrls: ['./verify-account-code.component.scss'] })
export class VerifyAccountCodeComponent implements OnInit, OnDestroy {
  @ViewChildren('digitInput') inputs!: QueryList<ElementRef<HTMLInputElement>>;
  digits = ['', '', '', '', '', ''];
  channel: VerificationChannel = 'email';
  destination = 'akun Anda';
  submitting = false; resending = false; seconds = 0; errorMessage = '';
  private timer?: ReturnType<typeof setInterval>;
  constructor(private auth: AuthService, private router: Router) {}
  ngOnInit(): void {
    const stored = sessionStorage.getItem('verification_channel');
    if (stored !== 'email' && stored !== 'whatsapp') { this.router.navigate(['/verify-account']); return; }
    this.channel = stored;
    this.destination = this.channel === 'email' ? 'email Anda' : 'nomor WhatsApp Anda';
    this.startCountdown();
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.digits[index] = input.value.replace(/\D/g, '').slice(-1); input.value = this.digits[index];
    if (this.digits[index] && index < 5) this.focus(index + 1);
  }
  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) this.focus(index - 1);
    if (event.key === 'Enter') this.verify();
    if (!/^\d$/.test(event.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Enter'].includes(event.key)) event.preventDefault();
  }
  onPaste(event: ClipboardEvent): void {
    event.preventDefault(); const code = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) || '';
    code.split('').forEach((digit, i) => this.digits[i] = digit); this.focus(Math.min(code.length, 5));
  }
  verify(): void {
    const code = this.digits.join('');
    if (code.length !== 6 || this.submitting) { this.errorMessage = 'Masukkan kode verifikasi 6 digit.'; return; }
    this.submitting = true; this.errorMessage = '';
    this.auth.verifyAccountCode(this.channel, code).subscribe({
      next: () => { this.digits.fill(''); this.router.navigate(['/verify-account/success']); },
      error: (error) => { this.submitting = false; this.errorMessage = this.apiError(error); this.digits.fill(''); setTimeout(() => this.focus(0)); }
    });
  }
  resend(): void {
    if (this.seconds || this.resending) return;
    this.resending = true; this.errorMessage = '';
    this.auth.resendAccountVerification(this.channel).subscribe({
      next: () => { this.resending = false; sessionStorage.setItem('verification_resend_at', String(Date.now() + 60000)); this.startCountdown(); },
      error: (error) => { this.resending = false; this.errorMessage = error.status === 429 ? 'Batas pengiriman tercapai. Silakan coba beberapa saat lagi.' : 'Kode gagal dikirim ulang. Silakan coba lagi.'; }
    });
  }
  changeMethod(): void { this.digits.fill(''); sessionStorage.removeItem('verification_channel'); this.router.navigate(['/verify-account']); }
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
}
