import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LandingModalService } from './landing-modal.service';
import { environment } from '../environments/environment';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class AuthInterceptor implements HttpInterceptor {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private landingModal: LandingModalService, private router: Router, private toast: ToastService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('access_token');
    const isApiRequest = this.isApiRequest(req.url);

    const shouldAttachAuthHeader = !!token && this.shouldAttachAuthHeader(req.url);

    const headers: Record<string, string> = {};
    if (isApiRequest) {
      headers['Accept'] = 'application/json';
    }
    if (shouldAttachAuthHeader) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const authReq = Object.keys(headers).length
      ? req.clone({
          setHeaders: headers,
        })
      : req;

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        const currentUrl = this.router.url;

        // Backend tidak dapat dihubungi.
        // Jangan anggap akun belum diverifikasi.
        if (err.status === 0) {
          console.error('[Auth Interceptor] API tidak dapat dihubungi', {
            url: err.url,
            message: err.message,
          });

          return throwError(() => err);
        }

        // Token tidak valid atau sudah kedaluwarsa.
        if (err.status === 401) {
          localStorage.removeItem('access_token');

          if (
            currentUrl !== '/login' &&
            !currentUrl.startsWith('/register')
          ) {
            this.router.navigate(['/login']);
          }

          return throwError(() => err);
        }

        // Redirect verifikasi hanya jika backend secara tegas
        // menyatakan akun belum diverifikasi.
        const errorCode = String(
          err.error?.code ??
          err.error?.error_code ??
          ''
        ).toUpperCase();

        const requiresVerification =
          err.status === 403 &&
          (
            errorCode === 'ACCOUNT_NOT_VERIFIED' ||
            errorCode === 'EMAIL_NOT_VERIFIED' ||
            err.error?.account_verified === false ||
            err.error?.is_verified === false
          );

        if (requiresVerification) {
          if (
            currentUrl !== '/verify-account' &&
            currentUrl !== '/verify-account-code'
          ) {
            this.router.navigate(['/verify-account']);
          }

          return throwError(() => err);
        }

        return throwError(() => err);
      })
    );
  }

  private shouldAttachAuthHeader(url: string): boolean {
    if (!this.isApiRequest(url)) {
      return false;
    }

    // Prevent unnecessary preflight on endpoints that should remain anonymous.
    if (this.isAuthEndpoint(url) || this.isPublicApiEndpoint(url)) {
      return false;
    }

    return true;
  }

  private isApiRequest(url: string): boolean {
    if (url.startsWith('/api/') || url.startsWith('api/')) {
      return true;
    }

    if (url.startsWith(this.apiBaseUrl)) {
      return true;
    }

    try {
      const parsed = new URL(url, window.location.origin);
      return parsed.pathname.startsWith('/api/');
    } catch {
      return false;
    }
  }

  private isAuthEndpoint(url: string): boolean {
    return /\/(login|forgot-password|reset-password|register)\b/.test(url);
  }

  private isPublicApiEndpoint(url: string): boolean {
    return (
      /\/v1\/testimoni\/public\b/.test(url) ||
      /\/v1\/wedding-profile\/public\b/.test(url) ||
      /\/v1\/paket-undangan\b/.test(url) ||
      /\/themes\/(categories|theme|popular)\b/.test(url)
    );
  }
}
