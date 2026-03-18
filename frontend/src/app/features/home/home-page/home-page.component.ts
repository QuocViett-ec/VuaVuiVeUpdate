import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
  AfterViewInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { RecommenderService } from '../../../core/services/recommender.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Recommendation } from '../../../core/models/product.model';

const CATEGORIES = [
  { key: 'veg', label: 'Rau Củ', icon: 'eco' },
  { key: 'fruit', label: 'Trái Cây', icon: 'nutrition' },
  { key: 'meat', label: 'Thịt & Cá', icon: 'set_meal' },
  { key: 'drink', label: 'Đồ Uống', icon: 'local_drink' },
  { key: 'dry', label: 'Hàng Khô', icon: 'grain' },
  { key: 'spice', label: 'Gia Vị', icon: 'soup_kitchen' },
  { key: 'household', label: 'Gia Dụng', icon: 'cleaning_services' },
  { key: 'sweet', label: 'Bánh Kẹo', icon: 'cookie' },
];

const SLIDES = [
  { img: 'images-home/BANNER_MUANGAY.png', alt: 'Mua ngay ưu đãi' },
  { img: 'images-home/banner.png', alt: 'Banner 2' },
  { img: 'images-home/tuinhua.png', alt: 'Túi nhựa' },
  { img: 'images-home/banner2.png', alt: 'Banner 4' },
  { img: 'images-home/banner1.png', alt: 'Banner 5' },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {
  private productSvc = inject(ProductService);
  private recommenderSvc = inject(RecommenderService);
  private auth = inject(AuthService);
  private cart = inject(CartService);
  private platformId = inject(PLATFORM_ID);

  readonly categories = CATEGORIES;
  readonly slides = SLIDES;

  showPopup = signal(true);
  slideIdx = signal(0);
  flashSlot = signal<'morning' | 'afternoon'>('morning');
  countdown = signal('--:--:--');
  flashProducts = signal<Product[]>([]);
  featured = signal<Product[]>([]);
  deals = signal<Product[]>([]);
  recommended = signal<Recommendation[]>([]);
  loading = signal(true);

  private sliderTimer: any;
  private cdTimer: any;
  private allProducts: Product[] = [];
  private shopRafId: number | null = null;
  private shopDir = 1;
  private shopSpeed = 40;
  private shopPaused = false;
  private shopLastTs = 0;

  ngOnInit(): void {
    this.startSlider();
    this.startCountdown();

    this.productSvc.getProducts({ _limit: 24 }).subscribe((ps) => {
      this.allProducts = ps;
      this.cart.hydrateFromProducts(ps);
      this.featured.set(ps.slice(0, 8));
      this.deals.set(ps.filter((p) => p.oldPrice && p.oldPrice > p.price).slice(0, 4));
      this.updateFlash();
      this.loading.set(false);
    });

    const user = this.auth.currentUser();
    if (user?.id) {
      this.recommenderSvc
        .getTimeAwareRecommendations({
          user_id: user.id,
          user_email: user.email || undefined,
          user_name: user.name || undefined,
          user_phone: user.phone || undefined,
          n: 4,
          filter_purchased: true,
        })
        .subscribe((r) => this.recommended.set(r));
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.sliderTimer);
    clearInterval(this.cdTimer);
    if (this.shopRafId !== null) cancelAnimationFrame(this.shopRafId);
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.initShopScroller();
    this.initHoverPill();
  }

  // ── Shop scroller auto-scroll (RAF, y hệt script.js gốc) ─────────────
  private initShopScroller(): void {
    const scroller = document.getElementById('scroll') as HTMLElement | null;
    const bar = document.getElementById('bar') as HTMLElement | null;
    if (!scroller) return;

    const getMax = () => Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const setBar = () => {
      if (!bar) return;
      const max = getMax();
      const pct = max ? scroller.scrollLeft / max : 0;
      bar.style.width = 10 + pct * 90 + '%';
    };

    const tick = (ts: number) => {
      if (!this.shopPaused) {
        if (!this.shopLastTs) this.shopLastTs = ts;
        const dt = (ts - this.shopLastTs) / 1000;
        this.shopLastTs = ts;
        const max = getMax();
        if (max > 0) {
          scroller.scrollLeft += this.shopDir * this.shopSpeed * dt;
          if (scroller.scrollLeft >= max - 1) {
            scroller.scrollLeft = max;
            this.shopDir = -1;
          }
          if (scroller.scrollLeft <= 0) {
            scroller.scrollLeft = 0;
            this.shopDir = 1;
          }
        }
      } else {
        this.shopLastTs = ts;
      }

      // ALWAYS sync the progress bar based on the true scroll position,
      // even when auto-scrolling is paused or when smoothly scrolling via nav buttons.
      setBar();

      this.shopRafId = requestAnimationFrame(tick);
    };
    this.shopRafId = requestAnimationFrame(tick);

    scroller.addEventListener('mouseenter', () => {
      this.shopPaused = true;
    });
    scroller.addEventListener('mouseleave', () => {
      this.shopPaused = false;
    });
    scroller.addEventListener('scroll', setBar, { passive: true });
    window.addEventListener('resize', setBar, { passive: true });
    setBar();
  }

  // ── Hover pill khi di chuột qua .pcard ───────────────────────────────
  private initHoverPill(): void {
    const pill = document.getElementById('hover-pill');
    const pillName = document.getElementById('pill-name');
    const pillLine = document.getElementById('pill-line');
    if (!pill) return;

    document.querySelectorAll<HTMLElement>('.pcard').forEach((card) => {
      card.addEventListener('mouseenter', () => {
        if (pillName) pillName.textContent = card.dataset['name'] || 'Sản phẩm';
        if (pillLine) pillLine.textContent = card.dataset['line'] || '';
        pill.classList.add('show');
      });
      card.addEventListener('mouseleave', () => pill.classList.remove('show'));
      card.addEventListener(
        'touchstart',
        () => {
          if (pillName) pillName.textContent = card.dataset['name'] || 'Sản phẩm';
          if (pillLine) pillLine.textContent = card.dataset['line'] || '';
          pill.classList.add('show');
          setTimeout(() => pill.classList.remove('show'), 1200);
        },
        { passive: true },
      );
    });
  }

  // ── RSS tabs click ────────────────────────────────────────────────────
  private initRssTabs(): void {
    const tabs = document.querySelectorAll<HTMLElement>('.rss-section .tab');
    const sections = document.querySelectorAll<HTMLElement>('.rss-section [data-section]');
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        tabs.forEach((t) => t.classList.remove('is-active'));
        tab.classList.add('is-active');
        const target = tab.getAttribute('href')?.replace('#', '');
        sections.forEach((sec) => {
          sec.style.display = sec.id === target ? '' : 'none';
        });
      });
    });

    // Ẩn tất cả trừ section đầu tiên
    sections.forEach((sec, i) => {
      sec.style.display = i === 0 ? '' : 'none';
    });
  }

  closePopup(): void {
    this.showPopup.set(false);
  }

  // Shop slider scroll
  shopScroll(px: number): void {
    const el = document.getElementById('scroll');
    if (!el) return;

    // Temporarily pause auto-scrolling so it doesn't interrupt the smooth scroll animation
    this.shopPaused = true;
    el.scrollBy({ left: px, behavior: 'smooth' });

    // Resume auto-scrolling after smooth scroll completes (approx ~800ms)
    setTimeout(() => {
      this.shopPaused = false;
    }, 800);
  }

  // Slider
  private startSlider(): void {
    this.sliderTimer = setInterval(() => this.nextSlide(), 4500);
  }
  prevSlide(): void {
    this.slideIdx.update((i) => (i - 1 + SLIDES.length) % SLIDES.length);
  }
  nextSlide(): void {
    this.slideIdx.update((i) => (i + 1) % SLIDES.length);
  }
  goSlide(i: number): void {
    this.slideIdx.set(i);
  }

  // Flash Sale
  setSlot(s: 'morning' | 'afternoon'): void {
    this.flashSlot.set(s);
    this.updateFlash();
  }
  private updateFlash(): void {
    const idx = this.flashSlot() === 'morning' ? 0 : 4;
    this.flashProducts.set(this.allProducts.slice(idx, idx + 4));
  }
  private startCountdown(): void {
    this.tick();
    this.cdTimer = setInterval(() => this.tick(), 1000);
  }
  private tick(): void {
    const now = new Date();
    const endH = this.flashSlot() === 'morning' ? 8 : 18;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, 0, 0);
    if (end <= now) end.setDate(end.getDate() + 1);
    const diff = end.getTime() - now.getTime();
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    this.countdown.set(
      `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`,
    );
  }
}
