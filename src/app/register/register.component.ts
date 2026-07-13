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
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      password_confirmation: ['', [Validators.required]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10,15}$')]],
    });
  }

  ngOnInit(): void {}

  onRegister() {
    if (this.loginForm.valid) {
      const formData = this.loginForm.value;

      this.dashboardService.create(DashboardServiceType.USER_REGISTER, formData).subscribe(
        (response) => {
          this.errorMessage = '';
          this.router.navigate(['/verify-account']);
        },
        (error) => {
          this.errorMessage = 'Registration failed. Please try again.';
        }
      );
    }
  }

}
