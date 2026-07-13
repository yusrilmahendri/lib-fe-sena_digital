import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DashboardService } from '../dashboard.service';

@Component({
  selector: 'wc-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.scss']
})
export class LoginPageComponent implements OnInit {
  email: string = '';
  password: string = '';
  errorMessage: string = '';

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['reason'] === 'session_expired') {
        this.errorMessage = 'Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit. Silakan login kembali.';
      } else if (params['error']) {
        this.errorMessage = params['error'];
      }
    });
  }

  onLogin() {
    this.dashboardService.login(this.email, this.password).subscribe(
      (response: any) => {
        this.errorMessage = '';
        if (response.role.includes('user')) {
          this.router.navigate(['/verify-account']);
        } else if (response.role.includes('admin')) {
          this.router.navigate(['/admin']);
        } else {
          this.errorMessage = 'Unauthorized role. Please contact support.';
        }
      },
      error => {
        this.errorMessage = 'Login failed. Please check your credentials.';
      }
    );
  }
  
}
