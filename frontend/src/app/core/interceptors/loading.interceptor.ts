import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoadingService } from '../services/loading.service';
import { finalize } from 'rxjs';

export const SKIP_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);
export const TRACK_GLOBAL_LOADING = new HttpContextToken<boolean>(() => false);

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const skipLoading = req.context.get(SKIP_GLOBAL_LOADING);
  const trackLoading = req.context.get(TRACK_GLOBAL_LOADING);
  const isBackgroundGet = req.method === 'GET' && !trackLoading;

  if (skipLoading || isBackgroundGet) {
    return next(req);
  }

  const loading = inject(LoadingService);
  loading.start();
  return next(req).pipe(finalize(() => loading.stop()));
};
