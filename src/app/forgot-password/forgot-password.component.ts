import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../auth.service';
@Component({ selector: 'wc-forgot-password', templateUrl: './forgot-password.component.html', styleUrls: ['./forgot-password.component.scss'] })
export class ForgotPasswordComponent {
  form: FormGroup; submitting = false; isSendingResetLink = false; sent = false; errorMessage = ''; forgotPasswordError = '';
  constructor(private fb: FormBuilder, private auth: AuthService) { this.form = fb.group({ identifier: ['', [Validators.required, Validators.email]] }); }
  clearForgotPasswordError(): void { this.forgotPasswordError = ''; this.errorMessage = ''; }
  submit(): void {
    if (this.form.invalid || this.submitting || this.isSendingResetLink) { this.form.markAllAsTouched(); return; }
    this.submitting = true; this.isSendingResetLink = true; this.errorMessage = ''; this.forgotPasswordError = ''; this.sent = false;
    this.auth.forgotPassword(this.form.value.identifier, 'email').pipe(
      finalize(() => {
        this.submitting = false;
        this.isSendingResetLink = false;
      })
    ).subscribe({
      next: (response) => {
        if (response?.status === false || response?.success === false) {
          this.forgotPasswordError = response?.message || 'Email tidak terdaftar.';
          return;
        }
        this.forgotPasswordError = '';
        this.sent = true;
      },
      error: (error) => {
        this.sent = false;
        this.forgotPasswordError = this.resolveForgotPasswordError(error);
      }
    });
  }

  private resolveForgotPasswordError(error: any): string {
    return error?.error?.errors?.email?.[0] || error?.error?.message || 'Email tidak terdaftar.';
  }
}
