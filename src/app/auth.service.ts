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

export type VerificationChannel = 'email' | 'whatsapp';

export interface ApiMessageResponse { success?: boolean; message: string; }
export interface VerificationProfile {
  email: string;
  phone: string;
  email_masked?: string;
  phone_masked?: string;
  is_verified?: boolean;
  account_verified?: boolean;
  email_verified_at?: string | null;
  verification_channel?: VerificationChannel;
  masked_destination?: string;
  can_resend?: boolean;
  resend_available_in?: number;
}
export interface VerificationStatusResponse extends ApiMessageResponse {
  data: VerificationProfile;
}
export interface ForgotPasswordPayload {
  identifier: string;
  channel: VerificationChannel;
}

export interface ResetPasswordPayload {
  token?: string;
  code?: string;
  identifier: string;
  channel: VerificationChannel;
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

  sendAccountVerification(channel: VerificationChannel): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/auth/verification/send`, { channel });
  }

  verifyAccountCode(channel: VerificationChannel, code: string): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/auth/verification/verify`, { channel, code });
  }

  resendAccountVerification(channel: VerificationChannel): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/auth/verification/resend`, { channel });
  }

  getVerificationStatus(): Observable<VerificationStatusResponse> {
    return this.http.get<VerificationStatusResponse>(`${this.apiBaseUrl}/v1/auth/verification/status`);
  }

  forgotPassword(identifier: string, channel: VerificationChannel = 'email'): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/forgot-password`, { identifier, channel });
  }

  resetPassword(payload: ResetPasswordPayload): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/reset-password`, payload);
  }
}
