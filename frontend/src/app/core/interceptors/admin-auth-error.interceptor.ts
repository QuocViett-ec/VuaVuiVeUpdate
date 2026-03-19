import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

function isAdminPortalRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return new URL(environment.adminPortalBase).origin === window.location.origin;
  } catch {
    return false;
  }
}

function isProtectedAdminApi(url: string): boolean {
  const target = url || '';
  return (
    target.includes('/api/admin/') ||
    target.includes('/api/users/') ||
    target.includes('/api/recommend/telemetry/')
  );
}

export const adminAuthErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((err) => {
      const httpErr = err as HttpErrorResponse;
      const status = httpErr?.status;

      if (
        isAdminPortalRuntime() &&
        (status === 401 || status === 403) &&
        isProtectedAdminApi(req.url)
      ) {
        auth.forceClearClientSession();
        const returnUrl =
          typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : '/dashboard';
        void router.navigateByUrl(`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      }

      return throwError(() => err);
    }),
  );
};
