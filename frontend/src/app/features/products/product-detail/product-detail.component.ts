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
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ProductService,
  ProductReview,
  ProductReviewResponse,
} from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product } from '../../../core/models/product.model';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { Subscription } from 'rxjs';

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
  private cartSvc = inject(CartService);
  private toast = inject(ToastService);
  private realtime = inject(RealtimeSyncService);
  private realtimeSub?: Subscription;

  product = signal<Product | null>(null);
  related = signal<Product[]>([]);
  loading = signal(true);
  qty = signal(1);
  reviews = signal<ProductReview[]>([]);
  reviewStats = signal<ProductReviewResponse | null>(null);

  catLabel = computed(() => {
    const p = this.product();
    if (!p) return '';
    return CAT_LABELS[p.cat] ?? p.cat;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loadProduct(id);

    this.realtimeSub = this.realtime.ofType('product.changed').subscribe((evt: any) => {
      const payload = evt?.payload || {};
      const changedId = String(payload.productId || '');
      const currentId = this.product()?.id || id;
      if (!changedId || changedId !== currentId) return;
      this.loadProduct(currentId);
    });
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  private loadProduct(id: string): void {
    this.prodSvc.getProductById(id).subscribe((p) => {
      this.product.set(p);
      this.loading.set(false);
      if (p) {
        this.loadRelated(p.cat, p.id);
        this.loadReviews(p.id);
      } else {
        this.reviews.set([]);
        this.reviewStats.set(null);
      }
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

  ratingStars(rating: number): string {
    const rounded = Math.max(1, Math.min(5, Math.round(Number(rating || 0))));
    return '★'.repeat(rounded) + '☆'.repeat(5 - rounded);
  }
}
