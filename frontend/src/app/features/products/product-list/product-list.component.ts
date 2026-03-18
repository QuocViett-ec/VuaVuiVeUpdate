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
  private realtime = inject(RealtimeSyncService);

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
  private realtimeSub?: Subscription;

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
    this.loadProducts();

    this.realtimeSub = this.realtime.ofType('product.changed').subscribe(() => {
      this.loadProducts(false);
    });
    this.tickCd();
    this._cd = setInterval(() => this.tickCd(), 1000);
    if (isPlatformBrowser(this.platformId)) this.injectChatbot();
  }

  ngOnDestroy(): void {
    if (this._cd) clearInterval(this._cd);
    this.realtimeSub?.unsubscribe();
  }

  private loadProducts(showLoading = true): void {
    if (showLoading) this.loading.set(true);
    this.productSvc.getAllProducts().subscribe((ps) => {
      this.allProducts.set(ps);
      this.cartSvc.hydrateFromProducts(ps);
      this.updateFlash(ps);
      this.loading.set(false);
    });
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
    style.textContent = `
      :root{
        --chat--color--primary:#2f7d4a;
        --chat--color--primary-shade-50:#dcefdc;
        --chat--color--white:#fffdf8;
        --chat--color--dark:#17301f;
        --chat--window--width:392px;
        --chat--window--height:560px;
        --chat--border-radius:28px;
        --chat--header--background:linear-gradient(135deg, #2f7d4a 0%, #5da85d 55%, #9ccd5d 100%);
        --chat--header--color:#ffffff;
        --chat--message--font-size:0.98rem;
        --chat--message--line-height:1.6;
        --chat--message--border-radius:22px;
        --chat--message--bot--background:rgba(255,255,255,0.92);
        --chat--message--bot--color:#203524;
        --chat--message--user--background:linear-gradient(135deg, #2f7d4a 0%, #3f9c59 100%);
        --chat--message--user--color:#ffffff;
        --chat--textarea--height:54px;
        --chat--toggle--background:#5aa653;
        --chat--toggle--hover--background:#3c8a45;
      }

      .n8n-chat__window{
        overflow:hidden!important;
        border:1px solid rgba(122, 156, 98, 0.18)!important;
        box-shadow:0 28px 70px rgba(28, 52, 34, 0.18)!important;
        backdrop-filter:blur(16px);
        background:
          radial-gradient(circle at top right, rgba(175, 214, 145, 0.18), transparent 34%),
          linear-gradient(180deg, #f6f8ef 0%, #eef4ea 100%)!important;
      }

      .n8n-chat__header{
        min-height:124px;
        padding:26px 28px 22px!important;
        position:relative;
        overflow:hidden;
        box-shadow:inset 0 -1px 0 rgba(255,255,255,0.18);
      }

      .n8n-chat__header::before{
        content:'';
        position:absolute;
        inset:auto -36px -42px auto;
        width:140px;
        height:140px;
        border-radius:50%;
        background:rgba(255,255,255,0.14);
      }

      .n8n-chat__header::after{
        content:'Tu van nhanh';
        position:absolute;
        left:28px;
        top:22px;
        padding:6px 12px;
        border-radius:999px;
        background:rgba(255,255,255,0.18);
        color:#f4ffef;
        font-size:0.72rem;
        font-weight:700;
        letter-spacing:0.08em;
        text-transform:uppercase;
      }

      .n8n-chat__header h1,
      .n8n-chat__header-title{
        margin-top:34px!important;
        font-size:2rem!important;
        font-weight:800!important;
        letter-spacing:-0.03em;
      }

      .n8n-chat__header p,
      .n8n-chat__header-subtitle{
        margin-top:6px!important;
        opacity:0.92;
        font-size:0.95rem!important;
      }

      .n8n-chat__body,
      .n8n-chat__messages{
        background:transparent!important;
      }

      .n8n-chat__messages{
        padding:22px 18px 14px!important;
      }

      .n8n-chat__message{
        margin-bottom:14px!important;
      }

      .n8n-chat__message--bot,
      .n8n-chat__message--user{
        max-width:86%!important;
        padding:15px 18px!important;
        border:none!important;
        box-shadow:0 10px 28px rgba(39, 61, 42, 0.08)!important;
      }

      .n8n-chat__message--bot{
        border-top-left-radius:10px!important;
      }

      .n8n-chat__message--user{
        border-bottom-right-radius:10px!important;
      }

      .n8n-chat__footer,
      .n8n-chat__input-container{
        background:rgba(255,253,248,0.86)!important;
        border-top:1px solid rgba(122, 156, 98, 0.14)!important;
        padding:14px 16px 16px!important;
        backdrop-filter:blur(10px);
      }

      .n8n-chat__textarea,
      .n8n-chat__input{
        border:1px solid rgba(101, 141, 94, 0.18)!important;
        border-radius:18px!important;
        background:#ffffff!important;
        box-shadow:inset 0 1px 2px rgba(24, 38, 28, 0.04);
        padding:0 56px 0 18px!important;
        font-size:1rem!important;
      }

      .n8n-chat__textarea::placeholder,
      .n8n-chat__input::placeholder{
        color:#829180!important;
      }

      .n8n-chat__send-button{
        right:24px!important;
        width:38px!important;
        height:38px!important;
        border-radius:50%!important;
        background:linear-gradient(135deg, #5aa653 0%, #2f7d4a 100%)!important;
        color:#ffffff!important;
        box-shadow:0 10px 22px rgba(47, 125, 74, 0.28)!important;
      }

      .n8n-chat__toggle,
      .n8n-chat__button{
        width:72px!important;
        height:72px!important;
        border:none!important;
        box-shadow:0 20px 40px rgba(47, 125, 74, 0.28)!important;
        background:linear-gradient(135deg, #67b15d 0%, #2f7d4a 100%)!important;
      }

      .n8n-chat__toggle:hover,
      .n8n-chat__button:hover{
        transform:translateY(-2px);
      }

      @media (max-width: 640px){
        :root{
          --chat--window--width:calc(100vw - 20px);
          --chat--window--height:min(76vh, 620px);
          --chat--border-radius:24px;
        }

        .n8n-chat__window{
          right:10px!important;
          left:10px!important;
          bottom:94px!important;
          width:auto!important;
        }

        .n8n-chat__header{
          min-height:108px;
          padding:22px 22px 18px!important;
        }

        .n8n-chat__header h1,
        .n8n-chat__header-title{
          font-size:1.7rem!important;
        }

        .n8n-chat__toggle,
        .n8n-chat__button{
          width:64px!important;
          height:64px!important;
        }
      }
    `;
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
        i18n: {
          vi: {
            title: 'VUIVE Bot',
            subtitle: '',
            inputPlaceholder: 'Hoi VUIVE Bot ve san pham, danh muc, gia...'
          }
        }
      });
    `;
    document.head.appendChild(script);
  }
}
