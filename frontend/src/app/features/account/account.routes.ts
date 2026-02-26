import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { AccountPageComponent } from './account-page/account-page.component';

export const accountRoutes: Routes = [
  { path: '', component: AccountPageComponent, canActivate: [authGuard] },
];
