import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Tự động thêm `withCredentials: true` cho mọi request gửi đến API backend.
 * Điều này giúp trình duyệt gửi kèm session cookie (vvv.sid) trong mỗi request.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  const isApiCall = req.url.startsWith(environment.apiBase) || req.url.startsWith('/api/');

  if (isApiCall) {
    const cloned = req.clone({
      withCredentials: true,
      headers: req.headers.set('X-Requested-With', 'XMLHttpRequest'),
    });
    return next(cloned);
  }
  return next(req);
};
