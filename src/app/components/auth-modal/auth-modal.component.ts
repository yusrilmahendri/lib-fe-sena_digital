import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth.service';

export type AuthModalMode =
  | 'login'
  | 'forgot-password'
  | 'email-confirmation'
  | 'reset-password'
  | 'reset-success';

@Component({
  selector: 'wc-auth-modal',
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.scss'],
})
export class AuthModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: AuthModalMode = 'login';
  /* When opened from the /reset-password route (email link). */
  @Input() standalone = false;
  @Input() resetToken = '';
  @Input() resetEmail = '';

  @Output() closed = new EventEmitter<void>();

  currentMode: AuthModalMode = 'login';
  showPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  isSubmitting = false;
  errorMessage = '';
  infoMessage = '';

  lastForgotPasswordEmail = '';
  isResetPasswordDemo = false;

  loginForm: FormGroup;
  forgotForm: FormGroup;
  resetForm: FormGroup;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      remember: [false],
    });

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });

    this.resetForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        password_confirmation: ['', [Validators.required]],
      },
      { validators: AuthModalComponent.passwordsMatch }
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Each time the modal opens, start from the requested mode (default login).
    if ((changes['isOpen'] || changes['mode']) && this.isOpen) {
      this.currentMode = this.mode || 'login';
      this.resetTransientState();
    }
  }

  static passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirm = group.get('password_confirmation')?.value;
    return password && confirm && password !== confirm ? { mismatch: true } : null;
  }

  /** Reset link is broken when on the standalone route without token/email. */
  get resetLinkInvalid(): boolean {
    return this.standalone && !this.isResetPasswordDemo && (!this.resetToken || !this.resetEmail);
  }

  private resetTransientState(): void {
    this.errorMessage = '';
    this.infoMessage = '';
    this.isSubmitting = false;
    this.showPassword = false;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
  }

  /* ---------- mode transitions ---------- */
  openLoginModal(): void {
    this.currentMode = 'login';
    this.resetTransientState();
  }

  openForgotPasswordModal(): void {
    this.currentMode = 'forgot-password';
    this.resetTransientState();
  }

  openEmailConfirmationModal(): void {
    this.currentMode = 'email-confirmation';
  }

  openResetPasswordModal(): void {
    this.isResetPasswordDemo = false;
    this.currentMode = 'reset-password';
    this.resetForm.reset({ password: '', password_confirmation: '' });
    this.resetTransientState();
  }

  /** Demo preview from the forgot-password modal: no token/email, no API call. */
  openResetPasswordDemoModal(): void {
    this.isResetPasswordDemo = true;
    this.currentMode = 'reset-password';
    this.resetForm.reset({ password: '', password_confirmation: '' });
    this.resetTransientState();
    this.infoMessage = 'Mode demo — hanya untuk pratinjau tampilan, tidak dikirim ke server.';
  }

  /* aliases used by template back-links */
  showLogin(): void {
    this.openLoginModal();
  }

  showForgotPassword(): void {
    this.openForgotPasswordModal();
  }

  /* ---------- modal controls ---------- */
  closeAuthModal(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.closeAuthModal();
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleNewPassword(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  /** "Daftar di sini" mirrors the landing "Buat Undangan Sekarang" CTA. */
  goToBuatUndangan(): void {
    this.closeAuthModal();
    this.router.navigate(['/buat-undangan']);
  }

  /** "Kembali masuk": on the reset route, go home + open login; else show login. */
  backToLogin(): void {
    // Clear any reset-flow state before returning to login.
    this.resetToken = '';
    this.resetEmail = '';
    this.isResetPasswordDemo = false;
    this.resetForm.reset({ password: '', password_confirmation: '' });

    if (this.standalone) {
      this.router.navigate(['/'], { queryParams: { auth: 'login' } });
    } else {
      this.openLoginModal();
    }
  }

  /* ---------- submit handlers ---------- */
  submitLogin(): void {
    this.errorMessage = '';
    if (this.loginForm.invalid || this.isSubmitting) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const { email, password, remember } = this.loginForm.value;

    this.auth.login({ email, password, remember }).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.closeAuthModal();

        const roles: string[] = Array.isArray(res?.role)
          ? res.role
          : res?.role
          ? [res.role]
          : [];

        if (roles.includes('admin')) {
          this.router.navigate(['/admin']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: () => {
        this.isSubmitting = false;
        this.errorMessage = 'Login gagal. Periksa email dan kata sandi Anda.';
      },
    });
  }

  submitForgotPassword(): void {
    this.errorMessage = '';
    this.infoMessage = '';
    if (this.forgotForm.invalid || this.isSubmitting) {
      this.forgotForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const email = this.forgotForm.value.email;
    this.lastForgotPasswordEmail = email;

    this.auth.forgotPassword({ email }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.openEmailConfirmationModal();
      },
      error: (err: any) => {
        // Security: never reveal whether the email exists. Prefer the backend's
        // (already-generic) message; otherwise fall back to a safe default.
        this.isSubmitting = false;
        this.errorMessage =
          err?.error?.message || 'Jika email terdaftar, tautan reset kata sandi akan dikirim.';
      },
    });
  }

  resendForgotPasswordEmail(): void {
    if (!this.lastForgotPasswordEmail || this.isSubmitting) {
      return;
    }

    this.isSubmitting = true;
    this.infoMessage = '';

    this.auth.forgotPassword({ email: this.lastForgotPasswordEmail }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.infoMessage = 'Tautan reset telah dikirim ulang.';
      },
      error: () => {
        this.isSubmitting = false;
        this.infoMessage = 'Tautan reset telah dikirim ulang.';
      },
    });
  }

  submitResetPassword(): void {
    this.errorMessage = '';
    if (this.resetForm.invalid || this.isSubmitting || this.resetLinkInvalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    // Demo mode: preview only, never hit the backend.
    if (this.isResetPasswordDemo) {
      this.infoMessage = 'Mode demo hanya untuk melihat tampilan reset password.';
      return;
    }

    this.isSubmitting = true;

    this.auth
      .resetPassword({
        email: this.resetEmail,
        token: this.resetToken,
        password: this.resetForm.value.password,
        password_confirmation: this.resetForm.value.password_confirmation,
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.currentMode = 'reset-success';
        },
        error: (err: any) => {
          // Surface a backend validation message (422) when present, else a
          // safe default. Never expose internal/broker status fields.
          this.isSubmitting = false;
          const validationMsg = this.firstValidationError(err);
          this.errorMessage =
            validationMsg ||
            err?.error?.message ||
            'Tautan reset kata sandi tidak valid atau sudah kedaluwarsa.';
        },
      });
  }

  /** Extract the first Laravel-style validation error message, if any. */
  private firstValidationError(err: any): string | null {
    const errors = err?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
      const firstVal = firstKey ? errors[firstKey] : null;
      if (Array.isArray(firstVal) && firstVal.length) {
        return firstVal[0];
      }
      if (typeof firstVal === 'string') {
        return firstVal;
      }
    }
    return null;
  }
}
