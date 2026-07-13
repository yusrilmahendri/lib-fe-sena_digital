import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, VerificationChannel } from '../auth.service';
@Component({ selector: 'wc-reset-password', templateUrl: './reset-password.component.html', styleUrls: ['./reset-password.component.scss'] })
export class ResetPasswordComponent implements OnInit {
  form: FormGroup; channel: VerificationChannel = 'email'; token = ''; identifier = ''; submitting = false; success = false; showPassword = false; showConfirmation = false; errorMessage = '';
  constructor(private fb: FormBuilder, private route: ActivatedRoute, private router: Router, private auth: AuthService) {
    this.form = fb.group({ code: [''], password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]], password_confirmation: ['', Validators.required] }, { validators: (group) => group.get('password')?.value === group.get('password_confirmation')?.value ? null : { mismatch: true } });
  }
  ngOnInit(): void { const params = this.route.snapshot.queryParamMap; this.token = params.get('token') || ''; this.identifier = params.get('email') || params.get('identifier') || ''; this.channel = params.get('channel') === 'whatsapp' ? 'whatsapp' : 'email'; if (this.channel === 'whatsapp') this.form.get('code')?.setValidators([Validators.required, Validators.pattern(/^\d{6}$/)]); }
  get password(): string { return this.form.get('password')?.value || ''; }
  submit(): void {
    if (this.form.invalid || this.submitting || (this.channel === 'email' && !this.token)) { this.form.markAllAsTouched(); if (this.channel === 'email' && !this.token) this.errorMessage = 'Tautan reset password tidak valid.'; return; }
    this.submitting = true; this.errorMessage = '';
    this.auth.resetPassword({ token: this.token || undefined, code: this.channel === 'whatsapp' ? this.form.value.code : undefined, identifier: this.identifier, channel: this.channel, password: this.form.value.password, password_confirmation: this.form.value.password_confirmation }).subscribe({ next: () => { this.submitting = false; this.form.reset(); this.token = ''; this.success = true; }, error: (error) => { this.submitting = false; this.errorMessage = error.error?.message || 'Kode atau tautan reset tidak valid atau sudah kedaluwarsa.'; } });
  }
  login(): void { this.router.navigate(['/login']); }
}
