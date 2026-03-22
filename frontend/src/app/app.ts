import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { CartSidebarComponent } from './shared/cart-sidebar/cart-sidebar.component';
import { ToastContainerComponent } from './shared/toast-container/toast-container.component';
import { LoadingBarComponent } from './shared/loading-bar/loading-bar.component';
import { ChatShellComponent } from './shared/chat-widget/chat-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    CartSidebarComponent,
    ToastContainerComponent,
    LoadingBarComponent,
    ChatShellComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  isAdminRoute = signal(false);
  private router = inject(Router);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.isAdminRoute.set(event.urlAfterRedirects.startsWith('/admin'));
      }
    });
  }
}
