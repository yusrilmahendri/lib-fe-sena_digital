import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService, DashboardServiceType } from '../dashboard.service';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'wc-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  errorMessage: string = '';
  isRegistering = false;
  showPassword = false;
  showPasswordConfirmation = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private dashboardService: DashboardService
  ) {
    this.loginForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        password_confirmation: ['', [Validators.required]],
        phone: ['', [Validators.required, Validators.pattern('^[0-9]{10,15}$')]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  ngOnInit(): void {
    const saved = localStorage.getItem('registerForm');
    if (saved) {
      this.loginForm.patchValue(JSON.parse(saved));
    }

    this.subscriptions.add(
      this.loginForm.valueChanges.subscribe((value) => {
        const persisted = { ...value };
        delete persisted.password;
        delete persisted.password_confirmation;
        localStorage.setItem('registerForm', JSON.stringify(persisted));
      })
    );

    const passwordChanges = this.loginForm.get('password')?.valueChanges.subscribe(() => {
      this.loginForm.get('password_confirmation')?.updateValueAndValidity({
        onlySelf: true,
        emitEvent: false,
      });
    });
    if (passwordChanges) {
      this.subscriptions.add(passwordChanges);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onRegister() {
    if (this.loginForm.valid && !this.isRegistering) {
      const formData = this.loginForm.getRawValue();
      this.isRegistering = true;

      this.dashboardService.create(DashboardServiceType.USER_REGISTER, formData).subscribe({
        next: (response) => {
          this.errorMessage = '';
          localStorage.removeItem('registerForm');
          const token = response?.token || response?.access_token || response?.data?.token;
          if (token) {
            localStorage.setItem('access_token', token);
          }
          this.loginForm.reset();
          this.showPassword = false;
          this.showPasswordConfirmation = false;
          this.router.navigate(['/verify-account']);
        },
        error: (error) => {
          this.errorMessage = this.getBackendErrorMessage(error);
        },
        complete: () => {
          this.isRegistering = false;
        }
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  togglePasswordConfirmationVisibility(): void {
    this.showPasswordConfirmation = !this.showPasswordConfirmation;
  }

  getNameErrorMessage(): string {
    const control = this.loginForm.get('name');
    if (!control?.touched || !control.errors) return '';
    if (control.errors['required']) return 'Nama pengguna wajib diisi.';
    if (control.errors['minlength']) return 'Nama pengguna minimal 3 karakter.';
    if (control.errors['maxlength']) return 'Nama pengguna maksimal 100 karakter.';
    return '';
  }

  getPasswordConfirmationErrorMessage(): string {
    const control = this.loginForm.get('password_confirmation');
    if (!control?.touched) return '';
    if (control.errors?.['required']) return 'Ulangi password wajib diisi.';
    if (this.loginForm.errors?.['passwordMismatch']) return 'Ulangi password tidak sama dengan password.';
    return '';
  }

  private getBackendErrorMessage(error: any): string {
    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = errors.password_confirmation
        ? 'password_confirmation'
        : errors.password
          ? 'password'
          : Object.keys(errors)[0];
      const firstValue = firstKey ? errors[firstKey] : null;
      const message = Array.isArray(firstValue) ? firstValue[0] : firstValue;
      if (message) return this.translateBackendMessage(String(message), firstKey);
    }

    return this.translateBackendMessage(error?.error?.message || error?.message || 'Registrasi gagal. Silakan coba lagi.');
  }

  private translateBackendMessage(message: string, field?: string): string {
    const lower = message.toLowerCase();
    if (field === 'name' || lower.includes('name')) {
      if (lower.includes('required') || lower.includes('wajib')) return 'Nama pengguna wajib diisi.';
      if (lower.includes('at least') || lower.includes('min') || lower.includes('minimal')) return 'Nama pengguna minimal 3 karakter.';
      if (lower.includes('greater than') || lower.includes('max') || lower.includes('maksimal')) return 'Nama pengguna maksimal 100 karakter.';
    }
    if (lower.includes('email') && (lower.includes('taken') || lower.includes('already'))) return 'Email sudah terdaftar.';
    if (field === 'password_confirmation' || (lower.includes('password') && lower.includes('confirmation'))) {
      return 'Ulangi password tidak sama dengan password.';
    }
    if (field === 'password' && (lower.includes('at least') || lower.includes('min') || lower.includes('minimal'))) {
      return 'Password minimal 8 karakter.';
    }
    return message || 'Registrasi gagal. Silakan coba lagi.';
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmation = control.get('password_confirmation')?.value;
    if (!password || !confirmation) return null;
    return password === confirmation ? null : { passwordMismatch: true };
  }

}
