import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ProductService,
  ProductReview,
  ProductReviewResponse,
} from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product } from '../../../core/models/product.model';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { RecommenderService } from '../../../core/services/recommender.service';
import { Subscription } from 'rxjs';
import { Location } from '@angular/common';

const CAT_LABELS: Record<string, string> = {
  veg: 'Rau củ',
  fruit: 'Trái cây',
  meat: 'Thịt & Cá',
  drink: 'Đồ uống',
  dry: 'Hàng khô',
  sweet: 'Bánh kẹo',
  spice: 'Gia vị',
  household: 'Gia dụng',
  frozen: 'Đông lạnh',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private prodSvc = inject(ProductService);
  private router = inject(Router);
  private cartSvc = inject(CartService);
  private toast = inject(ToastService);
  private realtime = inject(RealtimeSyncService);
  private recommender = inject(RecommenderService);
  private location = inject(Location);
  private realtimeSub?: Subscription;

  product = signal<Product | null>(null);
  related = signal<Product[]>([]);
  mlRelated = signal<Product[]>([]);
  mlLoading = signal(false);
  loading = signal(true);
  qty = signal(1);
  reviews = signal<ProductReview[]>([]);
  reviewStats = signal<ProductReviewResponse | null>(null);

  catLabel = computed(() => {
    const p = this.product();
    if (!p) return '';
    return CAT_LABELS[p.cat] ?? p.cat;
  });

  private routeSub?: Subscription;

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || '';
      this.loading.set(true);
      this.qty.set(1);
      this.product.set(null);
      this.reviews.set([]);
      this.reviewStats.set(null);
      this.loadProduct(id);
    });

    this.realtimeSub = this.realtime.ofType('product.changed').subscribe((evt: any) => {
      const payload = evt?.payload || {};
      const changedId = String(payload.productId || '');
      const currentId = this.product()?.id || '';
      if (!changedId || changedId !== currentId) return;
      this.loadProduct(currentId);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.realtimeSub?.unsubscribe();
  }

  private loadProduct(id: string): void {
    this.prodSvc.getProductById(id).subscribe((p) => {
      this.product.set(p);
      this.loading.set(false);
      if (p) {
        this.loadRelated(p.cat, p.id);
        this.loadMlRelated(p.id);
        this.loadReviews(p.id);
      } else {
        this.reviews.set([]);
        this.reviewStats.set(null);
        this.mlRelated.set([]);
      }
    });
  }

  private loadMlRelated(productId: string): void {
    this.mlLoading.set(true);
    this.recommender.getSimilarProducts(productId, 6).subscribe((rows) => {
      const mapped = rows
        .map((row) => this.recommender.toProduct(row))
        .filter((p) => p.id !== productId)
        .slice(0, 6);
      this.mlRelated.set(mapped);
      this.mlLoading.set(false);
    });
  }

  private loadReviews(productId: string): void {
    this.prodSvc.getProductReviews(productId).subscribe((data) => {
      this.reviewStats.set(data);
      this.reviews.set(data.reviews);
    });
  }

  private loadRelated(cat: string, excludeId: string): void {
    this.prodSvc.getProducts({ cat }).subscribe((all) => {
      this.related.set(all.filter((p) => p.id !== excludeId).slice(0, 6));
    });
  }

  discountPct(): number {
    const p = this.product();
    if (!p?.oldPrice) return 0;
    return Math.round((1 - p.price / p.oldPrice) * 100);
  }

  incQty(): void {
    const maxStock = this.product()?.stock ?? 999;
    this.qty.update((q) => Math.min(q + 1, maxStock));
  }
  decQty(): void {
    this.qty.update((q) => Math.max(1, q - 1));
  }

  addToCart(): void {
    const p = this.product();
    if (!p) return;
    this.cartSvc.addToCart(p, this.qty());
    this.toast.success(`Đã thêm ${this.qty()} × ${p.name} vào giỏ!`);
  }

  goBack(): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigate(['/products']);
  }

  ratingStars(rating: number): string {
    const rounded = Math.max(1, Math.min(5, Math.round(Number(rating || 0))));
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  }
}
