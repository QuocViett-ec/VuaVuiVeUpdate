import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { CheckoutPageComponent } from './checkout-page/checkout-page.component';
import { VnpayReturnPageComponent } from './vnpay-return-page/vnpay-return-page.component';

export const checkoutRoutes: Routes = [
  { path: '', component: CheckoutPageComponent, canActivate: [authGuard] },
  { path: 'return', component: VnpayReturnPageComponent },
  {
    path: 'momo-return',
    loadComponent: () =>
      import('./momo-return-page/momo-return-page.component').then(
        (m) => m.MomoReturnPageComponent,
      ),
  },
];
