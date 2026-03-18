import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadChildren: () => import('./features/home/home.routes').then((m) => m.homeRoutes) },
  {
    path: 'products',
    loadChildren: () => import('./features/products/product.routes').then((m) => m.productRoutes),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: 'checkout',
    loadChildren: () => import('./features/checkout/checkout.routes').then((m) => m.checkoutRoutes),
  },
  {
    path: 'orders',
    loadChildren: () => import('./features/orders/order.routes').then((m) => m.orderRoutes),
  },
  {
    path: 'account',
    loadChildren: () => import('./features/account/account.routes').then((m) => m.accountRoutes),
  },
  {
    path: 'recommended',
    loadChildren: () =>
      import('./features/recommended/recommended.routes').then((m) => m.recommendedRoutes),
  },
  {
    path: 'recipes',
    loadChildren: () => import('./features/recipes/recipes.routes').then((m) => m.recipesRoutes),
  },
  {
    path: 'about',
    loadChildren: () => import('./features/about/about.routes').then((m) => m.aboutRoutes),
  },
  {
    path: 'cart',
    loadChildren: () => import('./features/cart/cart.routes').then((m) => m.cartRoutes),
  },
  {
    path: 'about2',
    loadChildren: () => import('./features/about2/about2.routes').then((m) => m.about2Routes),
  },
  { path: 'job', loadChildren: () => import('./features/job/job.routes').then((m) => m.jobRoutes) },
  {
    path: 'news',
    loadChildren: () => import('./features/news/news.routes').then((m) => m.newsRoutes),
  },
  { path: '**', redirectTo: '' },
];
