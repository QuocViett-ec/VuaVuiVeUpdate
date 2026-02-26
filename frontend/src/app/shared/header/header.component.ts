import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <header class="header">
      <div class="container header__row">
        <!-- Logo -->
        <a routerLink="/" class="logo" aria-label="Trang chu Vua Vui Ve">
          <img src="images/brand/LogoVVV.png" alt="Vua Vui Ve" class="logo__img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='inline'" />
          <span class="logo__text" style="display:none">Vua Vui Ve</span>
        </a>

        <!-- Main nav -->
        <nav class="nav" aria-label="Dieu huong chinh">
          <!-- San pham dropdown -->
          <div class="nav-item nav-item--dropdown" (mouseenter)="megaOpen.set(true)" (mouseleave)="megaOpen.set(false)">
            <a routerLink="/products" class="nav-link nav-link--dropdown" routerLinkActive="nav-link--active">
              San pham
              <svg class="nav-arrow" width="12" height="8" viewBox="0 0 12 8" fill="none">
                <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
            @if (megaOpen()) {
              <div class="mega-menu">
                <div class="mega-menu__content">
                  <div class="mega-menu__column">
                    <h3 class="mega-menu__title">Rau Cu</h3>
                    <ul class="mega-menu__list">
                      <li><a routerLink="/products" [queryParams]="{cat:'veg',sub:'leaf'}" class="mega-menu__link">Rau la</a></li>
                      <li><a routerLink="/products" [queryParams]="{cat:'veg',sub:'root'}" class="mega-menu__link">Cu & re</a></li>
                      <li><a routerLink="/products" [queryParams]="{cat:'veg',sub:'mushroom'}" class="mega-menu__link">Nam cac loai</a></li>
                      <li><a routerLink="/products" [queryParams]="{cat:'veg',sub:'herb'}" class="mega-menu__link">Rau thom</a></li>
                    </ul>
                  </div>
                  <div class="mega-menu__column">
                    <h3 class="mega-menu__title">Trai Cay</h3>
                    <ul class="mega-menu__list">
                      <li><a routerLink="/products" [queryParams]="{cat:'fruit'}" class="mega-menu__link">Trai cay tuoi</a></li>
                      <li><a routerLink="/products" [queryParams]="{cat:'fruit',sub:'imported'}" class="mega-menu__link">Trai cay nhap khau</a></li>
                    </ul>
                  </div>
                  <div class="mega-menu__column">
                    <h3 class="mega-menu__title">Thit Ca</h3>
                    <ul class="mega-menu__list">
                      <li><a routerLink="/products" [queryParams]="{cat:'meat'}" class="mega-menu__link">Thit tuoi</a></li>
                      <li><a routerLink="/products" [queryParams]="{cat:'meat',sub:'seafood'}" class="mega-menu__link">Hai san</a></li>
                    </ul>
                  </div>
                  <div class="mega-menu__column">
                    <h3 class="mega-menu__title">Do Uong</h3>
                    <ul class="mega-menu__list">
                      <li><a routerLink="/products" [queryParams]="{cat:'drink'}" class="mega-menu__link">Nuoc giai khat</a></li>
                      <li><a routerLink="/products" [queryParams]="{cat:'drink',sub:'coffee'}" class="mega-menu__link">Ca phe</a></li>
                    </ul>
                  </div>
                  <div class="mega-menu__column">
                    <h3 class="mega-menu__title">Gia Vi & Kho</h3>
                    <ul class="mega-menu__list">
                      <li><a routerLink="/products" [queryParams]="{cat:'spice'}" class="mega-menu__link">Gia vi</a></li>
                      <li><a routerLink="/products" [queryParams]="{cat:'dry'}" class="mega-menu__link">Do kho</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            }
          </div>

          <a routerLink="/recipes" class="nav-link" routerLinkActive="nav-link--active">Cong thuc</a>
          <a routerLink="/recommended" class="nav-link" routerLinkActive="nav-link--active">Goi y ca nhan</a>
          <a routerLink="/about" class="nav-link" routerLinkActive="nav-link--active">Gioi thieu</a>
        </nav>

        <!-- Search -->
        <div class="header__search">
          <input type="search" placeholder="Search" class="search-input"
            [(ngModel)]="searchQuery" (keyup.enter)="goSearch()" />
          <button class="search-btn" (click)="goSearch()" aria-label="Tim kiem">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </button>
        </div>

        <!-- Right actions -->
        <div class="header__right">
          <!-- Account -->
          @if (isLoggedIn()) {
            <div class="account-menu">
              <button class="btn--account" (click)="toggleAccountDropdown()">
                Tai khoan
              </button>
              @if (showAccountDropdown()) {
                <div class="dropdown">
                  <a routerLink="/account" class="dropdown-item" (click)="showAccountDropdown.set(false)">Tai khoan</a>
                  <a routerLink="/orders" class="dropdown-item" (click)="showAccountDropdown.set(false)">Don hang</a>
                  @if (isAdmin()) {
                    <a routerLink="/admin" class="dropdown-item" (click)="showAccountDropdown.set(false)">Quan tri</a>
                  }
                  <hr />
                  <button class="dropdown-item text-danger" (click)="logout()">Dang xuat</button>
                </div>
              }
            </div>
          } @else {
            <button class="btn--account" (click)="router.navigate(['/auth/login'])">Tai khoan</button>
          }

          <!-- Cart button -->
          <button class="btn--cart" (click)="openCart()" aria-label="Gio hang">
            Gio hang
            @if (cartCount() > 0) {
              <span class="cart-badge">{{ cartCount() }}</span>
            }
          </button>
        </div>
      </div>
    </header>
  `,
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  router = inject(Router);
  private auth = inject(AuthService);
  private cart = inject(CartService);

  searchQuery = '';
  megaOpen = signal(false);
  showAccountDropdown = signal(false);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly isAdmin    = this.auth.isAdmin;
  readonly cartCount  = this.cart.itemCount;

  @HostListener('document:click', ['$event'])
  onDoc(e: Event) {
    const t = e.target as HTMLElement;
    if (!t.closest('.account-menu')) this.showAccountDropdown.set(false);
  }

  openCart(): void { document.dispatchEvent(new CustomEvent('cart:toggle')); }
  toggleAccountDropdown(): void { this.showAccountDropdown.update(v => !v); }
  goSearch(): void {
    if (!this.searchQuery.trim()) return;
    this.router.navigate(['/products'], { queryParams: { q: this.searchQuery.trim() } });
  }
  logout(): void { this.showAccountDropdown.set(false); this.auth.logout(); }
}
