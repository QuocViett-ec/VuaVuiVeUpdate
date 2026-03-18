import { Routes } from '@angular/router';
import { guestGuard } from '../app/core/guards/auth.guard';
import { AdminLoginComponent } from './admin-login/admin-login.component';

export const adminAppRoutes: Routes = [
  {
    path: 'auth/login',
    component: AdminLoginComponent,
    canActivate: [guestGuard],
  },
  {
    path: '',
    loadChildren: () => import('../app/features/admin/admin.routes').then((m) => m.adminRoutes),
  },
  { path: '**', redirectTo: '' },
];
