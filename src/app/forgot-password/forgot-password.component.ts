import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService, VerificationChannel } from '../auth.service';
import { Router } from '@angular/router';
@Component({ selector: 'wc-forgot-password', templateUrl: './forgot-password.component.html', styleUrls: ['./forgot-password.component.scss'] })
export class ForgotPasswordComponent {
  form: FormGroup; channel: VerificationChannel = 'email'; submitting = false; sent = false; errorMessage = '';
  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) { this.form = fb.group({ identifier: ['', Validators.required] }); }
  choose(channel: VerificationChannel): void { this.channel = channel; }
  submit(): void {
    if (this.form.invalid || this.submitting) { this.form.markAllAsTouched(); return; }
    this.submitting = true; this.errorMessage = '';
    this.auth.forgotPassword(this.form.value.identifier, this.channel).subscribe({
      next: () => { this.submitting = false; this.sent = true; if (this.channel === 'whatsapp') this.router.navigate(['/reset-password'], { queryParams: { channel: 'whatsapp', identifier: this.form.value.identifier } }); },
      error: () => { this.submitting = false; this.sent = true; }
    });
  }
}
