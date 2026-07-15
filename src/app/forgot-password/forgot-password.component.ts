import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../auth.service';
@Component({ selector: 'wc-forgot-password', templateUrl: './forgot-password.component.html', styleUrls: ['./forgot-password.component.scss'] })
export class ForgotPasswordComponent {
  form: FormGroup; submitting = false; sent = false; errorMessage = '';
  constructor(private fb: FormBuilder, private auth: AuthService) { this.form = fb.group({ identifier: ['', [Validators.required, Validators.email]] }); }
  submit(): void {
    if (this.form.invalid || this.submitting) { this.form.markAllAsTouched(); return; }
    this.submitting = true; this.errorMessage = '';
    this.auth.forgotPassword(this.form.value.identifier, 'email').subscribe({
      next: () => { this.submitting = false; this.sent = true; },
      error: () => { this.submitting = false; this.sent = true; }
    });
  }
}
