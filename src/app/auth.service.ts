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
  account_status?: string | null;
  email_verified_at?: string | null;
  whatsapp_verified_at?: string | null;
  status_bayar?: string | null;
  payment_status?: string | null;
  is_paid?: boolean;
  paket_status?: string | null;
  is_payment_confirmed?: boolean;
  status_tagihan?: string | null;
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
  channel?: VerificationChannel;
}

export interface ResetPasswordPayload {
  email?: string;
  token?: string;
  password: string;
  password_confirmation: string;
}

/**
 * AuthService centralises the landing-page authentication calls used by the
 * auth modal (login / forgot password) and the reset-password page.
 *
 * Login reuses the existing, working DashboardService.login() endpoint
 * (`/api/v1/login`) so token storage and role handling stay consistent with
 * the rest of the app. Forgot/reset password use the `/api/v1/auth/*`
 * endpoints on the configured API base URL.
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
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/auth/verification/send`, {
      channel: this.accountVerificationChannel(channel),
    });
  }

  verifyAccountCode(channel: VerificationChannel, code: string): Observable<ApiMessageResponse> {
    const url = `${this.apiBaseUrl}/v1/auth/verification/verify`;
    if (!environment.production) console.log('[AuthService] verify endpoint', url);
    return this.http.post<ApiMessageResponse>(url, {
      channel: this.accountVerificationChannel(channel),
      code,
    });
  }

  resendAccountVerification(channel: VerificationChannel): Observable<ApiMessageResponse> {
    return this.sendAccountVerification(channel);
  }

  getVerificationStatus(): Observable<VerificationStatusResponse> {
    return this.http.get<VerificationStatusResponse>(`${this.apiBaseUrl}/v1/auth/verification/status`);
  }

  forgotPassword(identifier: string, channel: VerificationChannel = 'email'): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/auth/forgot-password`, {
      email: identifier,
      channel: this.accountVerificationChannel(channel),
    });
  }

  resetPassword(payload: ResetPasswordPayload): Observable<ApiMessageResponse> {
    return this.http.post<ApiMessageResponse>(`${this.apiBaseUrl}/v1/auth/reset-password`, {
      email: payload.email,
      token: payload.token,
      password: payload.password,
      password_confirmation: payload.password_confirmation,
    });
  }

  private accountVerificationChannel(_channel: VerificationChannel): VerificationChannel {
    return 'email';
  }
}
