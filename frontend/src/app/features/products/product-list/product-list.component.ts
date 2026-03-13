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
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { Product } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/product-card/product-card.component';

const CATS = [
  { key: 'veg', label: 'Rau Củ', icon: '🥬' },
  { key: 'fruit', label: 'Trái Cây', icon: '🍎' },
  { key: 'meat', label: 'Thịt & Cá', icon: '🥩' },
  { key: 'drink', label: 'Đồ Uống', icon: '🧃' },
  { key: 'dry', label: 'Hàng Khô', icon: '🌾' },
  { key: 'spice', label: 'Gia Vị', icon: '🧂' },
  { key: 'household', label: 'Gia Dụng', icon: '🏠' },
  { key: 'sweet', label: 'Bánh Kẹo', icon: '🍰' },
];
const SORTS = [
  { key: 'default', label: 'Mặc định' },
  { key: 'price-asc', label: 'Giá tăng dần' },
  { key: 'price-desc', label: 'Giá giảm dần' },
  { key: 'name-asc', label: 'Tên A-Z' },
];

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
  private platformId = inject(PLATFORM_ID);

  readonly catList = CATS;
  readonly sortList = SORTS;

  allProducts = signal<Product[]>([]);
  loading = signal(true);
  searchQuery = signal('');
  selectedCat = signal('all');
  sortKey = signal('default');
  maxPrice = signal(1000000);

  // Flash sale
  flashSlot = signal<'morning' | 'afternoon'>('morning');
  flashProducts = signal<Product[]>([]);
  countdown = signal('--:--:--');
  private _cd: ReturnType<typeof setInterval> | null = null;

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

  ngOnInit(): void {
    this.route.queryParams.subscribe((p) => {
      if (p['cat']) this.selectedCat.set(p['cat']);
      if (p['q']) this.searchQuery.set(p['q']);
    });
    // Tải toàn bộ sản phẩm (không giới hạn)
    this.productSvc.getAllProducts().subscribe((ps) => {
      this.allProducts.set(ps);
      this.cartSvc.hydrateFromProducts(ps);
      this.updateFlash(ps);
      this.loading.set(false);
    });
    this.tickCd();
    this._cd = setInterval(() => this.tickCd(), 1000);
    if (isPlatformBrowser(this.platformId)) this.injectChatbot();
  }

  ngOnDestroy(): void {
    if (this._cd) clearInterval(this._cd);
  }

  setSearch(q: string): void {
    this.searchQuery.set(q);
    this.router.navigate([], {
      queryParams: { q: q.trim() || null },
      queryParamsHandling: 'merge',
    });
  }

  setCat(cat: string): void {
    this.selectedCat.set(cat);
    this.router.navigate([], {
      queryParams: { cat: cat === 'all' ? null : cat },
      queryParamsHandling: 'merge',
    });
  }

  resetFilters(): void {
    this.selectedCat.set('all');
    this.searchQuery.set('');
    this.sortKey.set('default');
    this.maxPrice.set(1000000);
    this.router.navigate([], { queryParams: {} });
  }

  onSlotChange(slot: 'morning' | 'afternoon'): void {
    this.flashSlot.set(slot);
    this.updateFlash(this.allProducts());
  }

  private updateFlash(ps: Product[]): void {
    const withDiscount = ps.filter((p) => p.oldPrice && p.oldPrice > p.price);
    const base = withDiscount.length >= 4 ? withDiscount : ps;
    const i = this.flashSlot() === 'morning' ? 0 : 4;
    this.flashProducts.set(base.slice(i, i + 4));
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

  private injectChatbot(): void {
    if (document.getElementById('n8n-chat-css')) return;
    const link = document.createElement('link');
    link.id = 'n8n-chat-css';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.textContent = `:root{--chat--color--primary:#16a34a;--chat--color--primary-shade-50:#86efac;--chat--color--white:#fff;--chat--color--dark:#0f172a;--chat--window--width:400px;--chat--window--height:440px;--chat--border-radius:14px;--chat--header--background:var(--chat--color--primary);--chat--header--color:#fff;--chat--message--font-size:.98rem;--chat--message--border-radius:12px;--chat--message--bot--background:#fff;--chat--message--user--background:var(--chat--color--primary);--chat--message--user--color:#fff;--chat--textarea--height:44px;--chat--message--bot--border:none;}.n8n-chat__message--bot{border:none!important;box-shadow:none!important;}.n8n-chat__window{border:none!important;}`;
    document.head.appendChild(style);

    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `
      import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';
      createChat({
        webhookUrl: 'https://n8n.n2nai.io/webhook/428e55e8-5b47-4c16-916d-253660a31366/chat',
        defaultLanguage: 'vi',
        showWelcomeScreen: false,
        initialMessages: ['Xin chao, minh la VUIVE Bot. Minh giup gi cho ban?'],
        i18n: { vi: { title: 'Xin chao', subtitle: '', inputPlaceholder: 'Nhap cau hoi cua ban...' } }
      });
    `;
    document.head.appendChild(script);
  }
}
