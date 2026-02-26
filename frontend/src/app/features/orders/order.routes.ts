import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { OrdersPageComponent } from './orders-page/orders-page.component';
import { OrderDetailPageComponent } from './order-detail-page/order-detail-page.component';

export const orderRoutes: Routes = [
  { path: '', component: OrdersPageComponent, canActivate: [authGuard] },
  { path: ':id', component: OrderDetailPageComponent, canActivate: [authGuard] },
];
