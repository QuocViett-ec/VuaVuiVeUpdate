import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product } from '../../../core/models/product.model';
<<<<<<< Updated upstream
=======
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { AuthService } from '../../../core/services/auth.service';
>>>>>>> Stashed changes

const CAT_LABELS: Record<string, string> = {
  veg: '🥦 Rau củ', fruit: '🍎 Trái cây', meat: '🥩 Thịt & Cá',
  drink: '🥤 Đồ uống', dry: '🌾 Hàng khô', sweet: '🍬 Bánh kẹo',
  spice: '🧂 Gia vị', household: '🧴 Gia dụng', frozen: '🧊 Đông lạnh' };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss' })
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private prodSvc = inject(ProductService);
  private cartSvc = inject(CartService);
  private toast = inject(ToastService);
<<<<<<< Updated upstream
=======
  private realtime = inject(RealtimeSyncService);
  private auth = inject(AuthService);
  private realtimeSub?: Subscription;
>>>>>>> Stashed changes

  product = signal<Product | null>(null);
  related = signal<Product[]>([]);
  loading = signal(true);
  qty = signal(1);
  reviewOrderId = signal('');
  reviewRating = signal(5);
  reviewComment = signal('');
  reviewSubmitting = signal(false);
  readonly currentUser = this.auth.currentUser;

  catLabel = computed(() => {
    const p = this.product();
    if (!p) return '';
    return CAT_LABELS[p.cat] ?? ('🛒 ' + p.cat);
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
<<<<<<< Updated upstream
=======
    this.reviewOrderId.set(this.route.snapshot.queryParamMap.get('reviewOrderId') || '');
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
>>>>>>> Stashed changes
    this.prodSvc.getProductById(id).subscribe((p) => {
      this.product.set(p);
      this.loading.set(false);
      if (p) this.loadRelated(p.cat, p.id);
    });
  }

  private loadRelated(cat: string, excludeId: string): void {
    this.prodSvc.getProducts({ cat }).subscribe((all) => {
      this.related.set(
        all.filter((p) => p.id !== excludeId).slice(0, 6)
      );
    });
  }

  discountPct(): number {
    const p = this.product();
    if (!p?.oldPrice) return 0;
    return Math.round((1 - p.price / p.oldPrice) * 100);
  }

  ratingLabel(): string {
    return (this.product()?.rating ?? 0).toFixed(1);
  }

  hasReviewEntryPoint(): boolean {
    return !!this.reviewOrderId();
  }

  canReview(): boolean {
    return !!this.product()?.viewerReviewPermission?.canReview && this.hasReviewEntryPoint();
  }

  reviewHint(): string {
    const product = this.product();
    if (!this.currentUser()) return 'Đăng nhập để gửi nhận xét.';
    if (product?.viewerReviewPermission?.alreadyReviewed) {
      return 'Bạn đã gửi nhận xét cho sản phẩm này.';
    }
    if (product?.viewerReviewPermission?.hasPurchased && !this.hasReviewEntryPoint()) {
      return 'Hãy vào đơn hàng đã giao và bấm "Đánh giá" để gửi nhận xét.';
    }
    if (product?.viewerReviewPermission?.hasPurchased === false) {
      return 'Bạn cần mua và nhận hàng trước khi đánh giá.';
    }
    return '';
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
    this.toast.success(`Đã thêm ${this.qty()} x ${p.name} vào giỏ!`);
  }

  submitReview(): void {
    const product = this.product();
    const comment = this.reviewComment().trim();

    if (!product) return;
    if (!this.canReview()) {
      this.toast.warning(this.reviewHint() || 'Bạn chưa thể gửi nhận xét lúc này.');
      return;
    }
    if (comment.length < 10) {
      this.toast.warning('Nhận xét cần ít nhất 10 ký tự.');
      return;
    }

    this.reviewSubmitting.set(true);
    this.prodSvc
      .addReview(product.id, {
        orderId: this.reviewOrderId(),
        rating: this.reviewRating(),
        comment,
      })
      .subscribe({
        next: (updated) => {
          this.reviewSubmitting.set(false);
          if (!updated) {
            this.toast.error('Không thể gửi nhận xét lúc này.');
            return;
          }
          this.product.set(updated);
          this.reviewComment.set('');
          this.reviewRating.set(5);
          this.toast.success('Cảm ơn bạn đã gửi nhận xét!');
        },
        error: () => {
          this.reviewSubmitting.set(false);
          this.toast.error('Không thể gửi nhận xét lúc này.');
        },
      });
  }
}
