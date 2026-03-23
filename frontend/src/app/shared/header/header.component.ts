import { Component, inject, signal, HostListener, OnInit, PLATFORM_ID } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { ProductService } from '../../core/services/product.service';
import { environment } from '../../../environments/environment';

const LS_RECENT_PRODUCT_SEARCH = 'vvv_recent_product_search';

function vn(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit {
  router = inject(Router);
  private auth = inject(AuthService);
  private cart = inject(CartService);
  private productSvc = inject(ProductService);
  private platformId = inject(PLATFORM_ID);

  searchQuery = '';
  private productNames = signal<string[]>([]);
  searchHints = signal<string[]>([]);
  private recentSearches = signal<string[]>([]);
  showSearchHints = signal(false);
  showAccountDropdown = signal(false);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly isAdmin = this.auth.isAdmin;
  readonly cartCount = this.cart.itemCount;
  readonly adminPortalUrl = environment.adminPortalBase;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadRecentSearches();
    }

    this.productSvc.getProducts({ _limit: 100 }).subscribe({
      next: (products) => {
        const names = products
          .map((p) => String(p.name || '').trim())
          .filter(Boolean)
          .filter((name, idx, arr) => arr.indexOf(name) === idx);
        this.productNames.set(names);
        this.searchHints.set(names.slice(0, 6));
      },
    });
  }

  @HostListener('document:click', ['$event'])
  onDoc(e: Event) {
    const t = e.target as HTMLElement;
    if (!t.closest('.account-menu')) this.showAccountDropdown.set(false);
    if (!t.closest('.header__search')) this.showSearchHints.set(false);
  }

  openCart(): void {
    this.router.navigate(['/cart']);
  }
  toggleAccountDropdown(): void {
    this.showAccountDropdown.update((v) => !v);
  }
  onSearchInput(raw: string): void {
    this.searchQuery = raw;
    const query = raw.trim();

    if (!query) {
      this.searchHints.set(this.recentSearches().slice(0, 6));
      this.showSearchHints.set(this.searchHints().length > 0);
      return;
    }

    const q = vn(query);
    const hints = this.productNames()
      .filter((name) => vn(name).includes(q))
      .slice(0, 6);

    this.searchHints.set(hints);
    this.showSearchHints.set(hints.length > 0);
  }

  goSearch(): void {
    const q = this.searchQuery.trim();
    if (!q) {
      this.router.navigate(['/products'], { queryParams: { q: null } });
      this.showSearchHints.set(false);
      return;
    }
    this.router.navigate(['/products'], { queryParams: { q } });
    this.addRecentSearch(q);
    this.showSearchHints.set(false);
  }

  pickHint(hint: string): void {
    this.searchQuery = hint;
    this.goSearch();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchHints.set(this.recentSearches().slice(0, 6));
    this.showSearchHints.set(this.searchHints().length > 0);
  }

  openHints(): void {
    if (this.searchQuery.trim()) {
      this.onSearchInput(this.searchQuery);
      return;
    }
    this.searchHints.set(this.recentSearches().slice(0, 6));
    this.showSearchHints.set(this.searchHints().length > 0);
  }

  private loadRecentSearches(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_RECENT_PRODUCT_SEARCH) || '[]');
      if (!Array.isArray(raw)) return;
      this.recentSearches.set(
        raw
          .map((item) => String(item || '').trim())
          .filter(Boolean)
          .slice(0, 6),
      );
    } catch {
      this.recentSearches.set([]);
    }
  }

  private addRecentSearch(value: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const normalized = value.trim();
    if (!normalized) return;

    const next = [
      normalized,
      ...this.recentSearches().filter((v) => vn(v) !== vn(normalized)),
    ].slice(0, 6);
    this.recentSearches.set(next);
    try {
      localStorage.setItem(LS_RECENT_PRODUCT_SEARCH, JSON.stringify(next));
    } catch {
      // noop: localStorage unavailable/blocked
    }
  }

  logout(): void {
    this.showAccountDropdown.set(false);
    this.auth.logout();
  }
}
