import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import { DecimalPipe, Location, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/product-card/product-card.component';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { Subscription } from 'rxjs';

const CATS = [
  { key: 'veg', label: 'Rau Củ', icon: 'eco' },
  { key: 'fruit', label: 'Trái Cây', icon: 'nutrition' },
  { key: 'meat', label: 'Thịt & Cá', icon: 'set_meal' },
  { key: 'drink', label: 'Đồ Uống', icon: 'local_drink' },
  { key: 'dry', label: 'Hàng Khô', icon: 'grain' },
  { key: 'spice', label: 'Gia Vị', icon: 'soup_kitchen' },
  { key: 'household', label: 'Gia Dụng', icon: 'cleaning_services' },
  { key: 'sweet', label: 'Bánh Kẹo', icon: 'cookie' },
];
const SORTS = [
  { key: 'default', label: 'Mặc định' },
  { key: 'price-asc', label: 'Giá tăng dần' },
  { key: 'price-desc', label: 'Giá giảm dần' },
  { key: 'name-asc', label: 'Tên A-Z' },
];

type PromoBanner = {
  image: string;
  alt: string;
};

const FLASH_SALE_COUNT = 10;
const LS_RECENT_PRODUCT_SEARCH = 'vvv_recent_product_search';

function hashSeed(value: string): number {
  return String(value || '')
    .split('')
    .reduce((sum, ch, idx) => sum + ch.charCodeAt(0) * (idx + 1), 0);
}

/** Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, lowercase, trim */
function vn(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-product-list',
  imports: [FormsModule, ProductCardComponent, DecimalPipe],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit, OnDestroy {
  private productSvc = inject(ProductService);
  private cartSvc = inject(CartService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private platformId = inject(PLATFORM_ID);
  private realtime = inject(RealtimeSyncService);

  readonly catList = CATS;
  readonly sortList = SORTS;
  readonly promoBanners: PromoBanner[] = [
    { image: '/images/brand/Banner.png', alt: 'Uu dai tuan nay' },
    { image: '/images/brand/newuser.png', alt: 'Uu dai nguoi dung moi' },
    { image: '/images/brand/haloweenvvv.png', alt: 'Uu dai mua le hoi' },
    { image: '/images/brand/xmasbanner.png', alt: 'Uu dai cuoi nam' },
  ];

  allProducts = signal<Product[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  selectedCat = signal('all');
  sortKey = signal('default');
  maxPrice = signal(1000000);
  recentSearches = signal<string[]>([]);

  // Flash sale
  flashSlot = signal<'morning' | 'afternoon'>('morning');
  flashProducts = signal<Product[]>([]);
  countdown = signal('--:--:--');
  private _cd: ReturnType<typeof setInterval> | null = null;
  activePromo = signal(0);
  private promoTimer: ReturnType<typeof setInterval> | null = null;
  private preloadedBannerIndexes = new Set<number>();
  private realtimeSub?: Subscription;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingProducts = false;
  private queuedRefresh = false;
  private pendingVisibilityRefresh = false;
  private hasHandledInitialQueryParams = false;
  private readonly onVisibilityChange = () => {
    if (!isPlatformBrowser(this.platformId)) return;
    if (document.hidden) return;
    if (!this.pendingVisibilityRefresh) return;
    this.pendingVisibilityRefresh = false;
    this.scheduleRealtimeRefresh();
  };

  filtered = computed(() => {
    let list = this.allProducts();
    const q = vn(this.searchQuery());
    const cat = this.selectedCat();
    const max = this.maxPrice();
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const name = vn(p.name);
        // tất cả token đều xuất hiện trong tên (hỗ trợ tìm nhiều từ)
        return tokens.every((t) => name.includes(t));
      });
    }
    if (cat && cat !== 'all') list = list.filter((p) => p.cat === cat);
    list = list.filter((p) => p.price <= max);
    switch (this.sortKey()) {
      case 'price-asc':
        return [...list].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...list].sort((a, b) => b.price - a.price);
      case 'name-asc':
        return [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      default:
        return list;
    }
  });

  searchHints = computed(() => {
    const query = this.searchQuery().trim();
    if (!query) return this.recentSearches().slice(0, 6);

    const q = vn(query);
    const hints = this.allProducts()
      .filter((p) => vn(p.name).includes(q))
      .map((p) => p.name)
      .filter((name, idx, arr) => arr.indexOf(name) === idx)
      .slice(0, 6);

    return hints;
  });

  ngOnInit(): void {
    this.route.queryParams.subscribe((p) => {
      if (p['cat']) this.selectedCat.set(p['cat']);

      const qParam = typeof p['q'] === 'string' ? p['q'] : '';
      if (qParam !== this.searchQuery()) {
        this.searchQuery.set(qParam);
      }

      // Only auto-scroll once when opening the page with an existing q param.
      if (!this.hasHandledInitialQueryParams && qParam && isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          document
            .getElementById('catalog')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 350);
      }

      this.hasHandledInitialQueryParams = true;
    });
    this.loadProducts();

    this.realtimeSub = this.realtime.ofType('product.changed').subscribe(() => {
      this.scheduleRealtimeRefresh();
    });

    if (this.promoBanners.length > 1) {
      this.promoTimer = setInterval(() => this.nextPromo(), 5500);
    }
    this.preloadBannerWindow(0);

    this.tickCd();
    this._cd = setInterval(() => this.tickCd(), 1000);
    if (isPlatformBrowser(this.platformId)) {
      this.loadRecentSearches();
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  ngOnDestroy(): void {
    if (this._cd) clearInterval(this._cd);
    if (this.promoTimer) clearInterval(this.promoTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.realtimeSub?.unsubscribe();
  }

  prevPromo(): void {
    const size = this.promoBanners.length;
    if (size <= 1) return;
    this.activePromo.update((v) => {
      const next = (v - 1 + size) % size;
      this.preloadBannerWindow(next);
      return next;
    });
    this.restartPromoTimer();
  }

  nextPromo(): void {
    const size = this.promoBanners.length;
    if (size <= 1) return;
    this.activePromo.update((v) => {
      const next = (v + 1) % size;
      this.preloadBannerWindow(next);
      return next;
    });
  }

  goPromo(index: number): void {
    if (index < 0 || index >= this.promoBanners.length) return;
    this.activePromo.set(index);
    this.preloadBannerWindow(index);
    this.restartPromoTimer();
  }

  private restartPromoTimer(): void {
    if (!this.promoTimer || this.promoBanners.length <= 1) return;
    clearInterval(this.promoTimer);
    this.promoTimer = setInterval(() => this.nextPromo(), 5500);
  }

  private preloadBannerWindow(centerIndex: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const size = this.promoBanners.length;
    if (!size) return;

    const targets = [centerIndex, (centerIndex + 1) % size, (centerIndex + 2) % size];
    for (const index of targets) {
      this.preloadBannerByIndex(index);
    }
  }

  private preloadBannerByIndex(index: number): void {
    if (this.preloadedBannerIndexes.has(index)) return;
    const banner = this.promoBanners[index];
    if (!banner?.image) return;

    const img = new Image();
    img.decoding = 'async';
    img.src = banner.image;
    this.preloadedBannerIndexes.add(index);
  }

  private loadProducts(showLoading = true): void {
    if (this.loadingProducts) {
      this.queuedRefresh = true;
      return;
    }

    this.loadingProducts = true;
    if (showLoading) this.loading.set(true);
    this.productSvc
      .getProducts({ _limit: 100 })
      .subscribe({
        next: (ps) => {
          this.allProducts.set(ps);
          this.cartSvc.hydrateFromProducts(ps);
          this.updateFlash(ps);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      })
      .add(() => {
        this.loadingProducts = false;
        if (this.queuedRefresh) {
          this.queuedRefresh = false;
          this.loadProducts(false);
        }
      });
  }

  private scheduleRealtimeRefresh(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loadProducts(false);
      return;
    }

    if (document.hidden) {
      this.pendingVisibilityRefresh = true;
      return;
    }

    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.loadProducts(false);
    }, 350);
  }

  setSearch(q: string): void {
    this.searchQuery.set(q);
    this.replaceQueryParams({ q: q.trim() || null });
  }

  commitSearch(raw?: string): void {
    const value = String(raw ?? this.searchQuery()).trim();
    if (!value) {
      this.setSearch('');
      return;
    }
    this.setSearch(value);
    this.addRecentSearch(value);
  }

  pickHint(hint: string): void {
    this.commitSearch(hint);
  }

  setCat(cat: string): void {
    this.selectedCat.set(cat);
    this.replaceQueryParams({ cat: cat === 'all' ? null : cat });
  }

  resetFilters(): void {
    this.selectedCat.set('all');
    this.searchQuery.set('');
    this.sortKey.set('default');
    this.maxPrice.set(1000000);
    this.replaceQueryParams({ q: null, cat: null });
  }

  private replaceQueryParams(next: Record<string, string | null>): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const params = new URLSearchParams(window.location.search);
    Object.entries(next).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    this.location.replaceState(url);
  }

  private loadRecentSearches(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_RECENT_PRODUCT_SEARCH) || '[]');
      if (Array.isArray(raw)) {
        this.recentSearches.set(
          raw
            .map((v) => String(v).trim())
            .filter(Boolean)
            .slice(0, 6),
        );
      }
    } catch {
      this.recentSearches.set([]);
    }
  }

  private addRecentSearch(value: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const normalized = value.trim();
    if (!normalized) return;

    const next = [normalized, ...this.recentSearches().filter((x) => x !== normalized)].slice(0, 6);
    this.recentSearches.set(next);
    localStorage.setItem(LS_RECENT_PRODUCT_SEARCH, JSON.stringify(next));
  }

  onSlotChange(slot: 'morning' | 'afternoon'): void {
    this.flashSlot.set(slot);
    this.updateFlash(this.allProducts());
  }

  private updateFlash(ps: Product[]): void {
    const withDiscount = ps.filter((p) => p.oldPrice && p.oldPrice > p.price);
    const base = withDiscount.length >= FLASH_SALE_COUNT ? withDiscount : ps;
    const startIndex = this.flashSlot() === 'morning' ? 0 : FLASH_SALE_COUNT;
    const selected = base.slice(startIndex, startIndex + FLASH_SALE_COUNT).map((p, index) => {
      const seed = hashSeed(`${p.id}-${startIndex + index}`);
      const oldPrice =
        p.oldPrice && p.oldPrice > p.price
          ? p.oldPrice
          : Math.round((p.price * (1.25 + (seed % 3) * 0.08)) / 1000) * 1000;
      const soldCount = Number(p.soldCount && p.soldCount > 0 ? p.soldCount : 80 + (seed % 320));
      return {
        ...p,
        oldPrice,
        soldCount,
      };
    });
    this.flashProducts.set(selected);
  }

  private tickCd(): void {
    const now = new Date();
    const endH = this.flashSlot() === 'morning' ? 8 : 18;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, 0, 0);
    if (end <= now) end.setDate(end.getDate() + 1);
    const diff = end.getTime() - now.getTime();
    const hh = String(Math.floor(diff / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    this.countdown.set(`${hh}:${mm}:${ss}`);
  }

  onImgErr(event: Event, fallback: string): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    const span = img.parentElement;
    if (span) span.textContent = fallback;
  }
}
