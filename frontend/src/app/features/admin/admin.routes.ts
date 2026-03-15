import { Routes } from '@angular/router';
import { adminGuard } from '../../core/guards/auth.guard';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { AdminDashboardV2Component } from './admin-dashboard-v2/admin-dashboard-v2.component';
import { AdminProductsComponent } from './admin-products/admin-products.component';
import { AdminOrdersComponent } from './admin-orders/admin-orders.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminReportsV2Component } from './admin-reports-v2/admin-reports-v2.component';
import { AdminAuditComponent } from './admin-audit/admin-audit.component';

export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardV2Component },
      { path: 'products', component: AdminProductsComponent },
      { path: 'orders', component: AdminOrdersComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'reports', component: AdminReportsV2Component },
      { path: 'audit', component: AdminAuditComponent },
    ],
  },
];
