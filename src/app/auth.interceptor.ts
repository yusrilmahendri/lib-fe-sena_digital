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

@Injectable({
  providedIn: 'root',
})
export class AuthInterceptor implements HttpInterceptor {
  constructor(private landingModal: LandingModalService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('access_token');

    const authReq = token
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

  private isAuthEndpoint(url: string): boolean {
    return /\/(login|forgot-password|reset-password|register)\b/.test(url);
  }
}
