import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { adminAppRoutes } from './admin-app.routes';
import { credentialsInterceptor } from '../app/core/interceptors/credentials.interceptor';
import { loadingInterceptor } from '../app/core/interceptors/loading.interceptor';
import { adminAuthErrorInterceptor } from '../app/core/interceptors/admin-auth-error.interceptor';

export const adminAppConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      adminAppRoutes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
    ),
    provideHttpClient(
      withFetch(),
      withInterceptors([credentialsInterceptor, loadingInterceptor, adminAuthErrorInterceptor]),
    ),
  ],
};
