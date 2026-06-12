import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { DashboardService } from './dashboard.service';

export interface LoginPayload {
  email: string;
  password: string;
  remember?: boolean;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

/**
 * AuthService centralises the landing-page authentication calls used by the
 * auth modal (login / forgot password) and the reset-password page.
 *
 * Login reuses the existing, working DashboardService.login() endpoint
 * (`/api/v1/login`) so token storage and role handling stay consistent with
 * the rest of the app. Forgot/reset password hit `/api/forgot-password` and
 * `/api/reset-password` on the configured API base URL.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient, private dashboardService: DashboardService) {}

  login(payload: LoginPayload): Observable<any> {
    if (payload.remember) {
      localStorage.setItem('remember_me', '1');
    } else {
      localStorage.removeItem('remember_me');
    }
    return this.dashboardService.login(payload.email, payload.password);
  }

  forgotPassword(payload: ForgotPasswordPayload): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/v1/forgot-password`, payload);
  }

  resetPassword(payload: ResetPasswordPayload): Observable<any> {
    return this.http.post(`${this.apiBaseUrl}/v1/reset-password`, payload);
  }
}
