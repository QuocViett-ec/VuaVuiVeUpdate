import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { RecommenderService } from '../../../core/services/recommender.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { Product, Recommendation } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/product-card/product-card.component';

const CATEGORIES = [
  { key: 'veg',       label: 'Rau cu',       icon: '🥬' },
  { key: 'fruit',     label: 'Trai cay',      icon: '🍎' },
  { key: 'meat',      label: 'Thit ca',       icon: '🥩' },
  { key: 'drink',     label: 'Do uong',       icon: '🧃' },
  { key: 'dry',       label: 'Do kho',        icon: '🌾' },
  { key: 'spice',     label: 'Gia vi',        icon: '🧂' },
  { key: 'household', label: 'Gia dung',      icon: '🏠' },
  { key: 'sweet',     label: 'Do ngot',       icon: '🍰' },
];

const SLIDES = [
  { img: 'images/brand/Banner.png',      alt: 'Uu dai tuan nay' },
  { img: 'images/brand/newuser.png',     alt: 'Uu dai nguoi moi' },
  { img: 'images/brand/haloweenvvv.png', alt: 'Uu dai Halloween' },
  { img: 'images/brand/xmasbanner.png',  alt: 'Uu dai Giang sinh' },
];

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent implements OnInit, OnDestroy {
  private productSvc     = inject(ProductService);
  private recommenderSvc = inject(RecommenderService);
  private auth           = inject(AuthService);
  private cart           = inject(CartService);

  readonly categories  = CATEGORIES;
  readonly slides      = SLIDES;

  showPopup  = signal(true);
  slideIdx   = signal(0);
  flashSlot  = signal<'morning' | 'afternoon'>('morning');
  countdown  = signal('--:--:--');
  flashProducts = signal<Product[]>([]);
  featured   = signal<Product[]>([]);
  deals      = signal<Product[]>([]);
  recommended = signal<Recommendation[]>([]);
  loading    = signal(true);

  private sliderTimer: any;
  private cdTimer: any;
  private allProducts: Product[] = [];

  ngOnInit(): void {
    this.startSlider();
    this.startCountdown();

    this.productSvc.getProducts({ _limit: 24 }).subscribe(ps => {
      this.allProducts = ps;
      this.cart.hydrateFromProducts(ps);
      this.featured.set(ps.slice(0, 8));
      this.deals.set(ps.filter(p => p.oldPrice && p.oldPrice > p.price).slice(0, 4));
      this.updateFlash();
      this.loading.set(false);
    });

    const user = this.auth.currentUser();
    if (user?.id) {
      this.recommenderSvc.getTimeAwareRecommendations(user.id, 4).subscribe(r => this.recommended.set(r));
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.sliderTimer);
    clearInterval(this.cdTimer);
  }

  closePopup(): void { this.showPopup.set(false); }

  // Slider
  private startSlider(): void { this.sliderTimer = setInterval(() => this.nextSlide(), 4500); }
  prevSlide(): void { this.slideIdx.update(i => (i - 1 + SLIDES.length) % SLIDES.length); }
  nextSlide(): void { this.slideIdx.update(i => (i + 1) % SLIDES.length); }
  goSlide(i: number): void { this.slideIdx.set(i); }

  // Flash Sale
  setSlot(s: 'morning' | 'afternoon'): void { this.flashSlot.set(s); this.updateFlash(); }
  private updateFlash(): void {
    const idx = this.flashSlot() === 'morning' ? 0 : 4;
    this.flashProducts.set(this.allProducts.slice(idx, idx + 4));
  }
  private startCountdown(): void { this.tick(); this.cdTimer = setInterval(() => this.tick(), 1000); }
  private tick(): void {
    const now = new Date();
    const endH = this.flashSlot() === 'morning' ? 8 : 18;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, 0, 0);
    if (end <= now) end.setDate(end.getDate() + 1);
    const diff = end.getTime() - now.getTime();
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    this.countdown.set(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`);
  }
}
