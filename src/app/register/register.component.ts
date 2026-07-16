import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DashboardService, DashboardServiceType } from '../dashboard.service';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'wc-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  loginForm: FormGroup;
  errorMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private dashboardService: DashboardService
  ) {
    this.loginForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmation: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10,15}$')]],
    });
  }

  ngOnInit(): void {
    const saved = localStorage.getItem('registerForm');
    if (saved) {
      this.loginForm.patchValue(JSON.parse(saved));
    }

    this.loginForm.valueChanges.subscribe((value) => {
      const persisted = { ...value };
      delete persisted.password;
      delete persisted.password_confirmation;
      localStorage.setItem('registerForm', JSON.stringify(persisted));
    });
  }

  onRegister() {
    if (this.loginForm.valid) {
      const formData = this.loginForm.value;

      this.dashboardService.create(DashboardServiceType.USER_REGISTER, formData).subscribe(
        (response) => {
          this.errorMessage = '';
          localStorage.removeItem('registerForm');
          const token = response?.token || response?.access_token || response?.data?.token;
          if (token) {
            localStorage.setItem('access_token', token);
          }
          this.router.navigate(['/verify-account']);
        },
        (error) => {
          this.errorMessage = this.getBackendErrorMessage(error);
        }
      );
    } else {
      this.loginForm.markAllAsTouched();
    }
  }

  getNameErrorMessage(): string {
    const control = this.loginForm.get('name');
    if (!control?.touched || !control.errors) return '';
    if (control.errors['required']) return 'Nama pengguna wajib diisi.';
    if (control.errors['minlength']) return 'Nama pengguna minimal 3 karakter.';
    if (control.errors['maxlength']) return 'Nama pengguna maksimal 100 karakter.';
    return '';
  }

  private getBackendErrorMessage(error: any): string {
    const errors = error?.error?.errors;
    if (errors && typeof errors === 'object') {
      const firstKey = Object.keys(errors)[0];
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
    if (lower.includes('password') && lower.includes('confirmation')) return 'Konfirmasi kata sandi tidak cocok.';
    return message || 'Registrasi gagal. Silakan coba lagi.';
  }

}
