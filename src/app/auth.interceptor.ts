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

@Injectable({
  providedIn: 'root',
})
export class AuthInterceptor implements HttpInterceptor {
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private landingModal: LandingModalService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('access_token');

    const shouldAttachAuthHeader = !!token && this.shouldAttachAuthHeader(req.url);

    const authReq = shouldAttachAuthHeader
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // 401 = not authenticated / session expired. Prompt the landing login
        // modal (never /login). We skip auth endpoints themselves (login /
        // forgot / reset / register) so a wrong-password attempt shows its own
        // inline error instead of re-triggering the modal (avoids a loop).
        if (error.status === 401 && !this.isAuthEndpoint(req.url)) {
          this.landingModal.requestLogin(
            'Sesi Anda telah berakhir. Silakan masuk kembali untuk melanjutkan.'
          );
        }
        // 403 = forbidden / wrong role/status — the user IS logged in. Do NOT
        // open the login modal, redirect, logout, or clear the token. Forward
        // the error so the calling component can show a clear message.
        return throwError(() => error);
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
