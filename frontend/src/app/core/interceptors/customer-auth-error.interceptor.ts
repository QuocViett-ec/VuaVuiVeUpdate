import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

function isCustomerPortalRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(environment.customerPortalBase).origin === window.location.origin;
  } catch {
    return false;
  }
}

function isAuthPublicEndpoint(url: string): boolean {
  const target = url || '';
  return (
    target.includes('/api/auth/login') ||
    target.includes('/api/auth/register') ||
    target.includes('/api/auth/google') ||
    target.includes('/api/auth/forgot-password')
  );
}

function isProtectedCustomerApi(url: string): boolean {
  const target = url || '';
  if (isAuthPublicEndpoint(target)) return false;

  // Các endpoint này không trigger redirect về login khi 401:
  // - /api/auth/me : gọi khi startup để restore session, thất bại là bình thường
  // - /api/realtime/stream : SSE best-effort, không cần redirect
  const silentEndpoints = ['/api/auth/me', '/api/realtime/stream', '/api/realtime/'];
  if (silentEndpoints.some((p) => target.includes(p))) return false;

  return (
    target.includes('/api/auth/profile') ||
    target.includes('/api/auth/password') ||
    target.includes('/api/orders') ||
    target.includes('/api/payment/') ||
    target.includes('/api/users/me')
  );
}

export const customerAuthErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err) => {
      const httpErr = err as HttpErrorResponse;
      const status = httpErr?.status;

      if (
        isCustomerPortalRuntime() &&
        (status === 401 || status === 403) &&
        isProtectedCustomerApi(req.url)
      ) {
        auth.forceClearClientSession();

        const isOnLoginPage =
          typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/login');

        if (!isOnLoginPage) {
          const returnUrl =
            typeof window !== 'undefined'
              ? `${window.location.pathname}${window.location.search}`
              : '/';
          void router.navigateByUrl(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
        }
      }

      return throwError(() => err);
    }),
  );
};
