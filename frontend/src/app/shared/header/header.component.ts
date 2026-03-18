import { Component, inject, signal, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  router = inject(Router);
  private auth = inject(AuthService);
  private cart = inject(CartService);

  searchQuery = '';
  showAccountDropdown = signal(false);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly isAdmin = this.auth.isAdmin;
  readonly cartCount = this.cart.itemCount;
  readonly adminPortalUrl = environment.adminPortalBase;

  @HostListener('document:click', ['$event'])
  onDoc(e: Event) {
    const t = e.target as HTMLElement;
    if (!t.closest('.account-menu')) this.showAccountDropdown.set(false);
  }

  openCart(): void {
    this.router.navigate(['/cart']);
  }
  toggleAccountDropdown(): void {
    this.showAccountDropdown.update((v) => !v);
  }
  goSearch(): void {
    if (!this.searchQuery.trim()) return;
    this.router.navigate(['/products'], { queryParams: { q: this.searchQuery.trim() } });
    this.searchQuery = '';
  }
  logout(): void {
    this.showAccountDropdown.set(false);
    this.auth.logout();
  }
}
