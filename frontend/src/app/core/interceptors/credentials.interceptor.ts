import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

function resolvePortalScope(): 'admin' | 'customer' | '' {
  if (typeof window === 'undefined') return '';

  try {
    const currentOrigin = window.location.origin;
    const adminOrigin = new URL(environment.adminPortalBase).origin;
    if (currentOrigin === adminOrigin) return 'admin';

    const customerOrigin = new URL(environment.customerPortalBase).origin;
    if (currentOrigin === customerOrigin) return 'customer';
  } catch {
    return '';
  }

  return '';
}

/**
 * Tự động thêm `withCredentials: true` cho mọi request gửi đến API backend.
 * Điều này giúp trình duyệt gửi kèm session cookie (vvv.sid) trong mỗi request.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const apiBase = String(environment.apiBase || '').trim();
  const isApiCall =
    (apiBase.length > 0 && req.url.startsWith(apiBase)) || req.url.startsWith('/api/');

  if (isApiCall) {
    const portalScope = resolvePortalScope();
    const cloned = req.clone({
      withCredentials: true,
      headers: req.headers
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('X-Portal-Scope', portalScope || ''),
    });
    return next(cloned);
  }
  return next(req);
};
