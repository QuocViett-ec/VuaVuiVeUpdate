import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { CartSidebarComponent } from './shared/cart-sidebar/cart-sidebar.component';
import { ToastContainerComponent } from './shared/toast-container/toast-container.component';
import { LoadingBarComponent } from './shared/loading-bar/loading-bar.component';

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
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
