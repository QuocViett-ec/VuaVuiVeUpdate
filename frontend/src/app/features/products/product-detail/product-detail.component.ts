import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container pd-page">
      <nav class="breadcrumb">
        <a routerLink="/">Trang chủ</a> / <a routerLink="/products">Sản phẩm</a> /
        {{ product()?.name }}
      </nav>

      @if (loading()) {
        <div class="skeleton-detail"></div>
      } @else if (!product()) {
        <div class="not-found">
          <h2>Không tìm thấy sản phẩm</h2>
          <a routerLink="/products" class="btn btn--primary">Quay lại</a>
        </div>
      } @else {
        <div class="pd-grid">
          <!-- Image -->
          <div class="pd-img-wrap">
            <img
              [src]="product()!.img || 'assets/no-image.png'"
              [alt]="product()!.name"
              class="pd-img"
            />
            @if (product()!.oldPrice && product()!.oldPrice! > product()!.price) {
              <span class="badge-sale">Giảm {{ discountPct() }}%</span>
            }
          </div>

          <!-- Info -->
          <div class="pd-info">
            <span class="pd-cat">{{ product()!.cat }}</span>
            <h1 class="pd-name">{{ product()!.name }}</h1>

            <div class="pd-price">
              <span class="price-main">{{ product()!.price | number }}đ</span>
              @if (product()!.unit) {
                <span class="price-unit">/ {{ product()!.unit }}</span>
              }
              @if (product()!.oldPrice && product()!.oldPrice! > product()!.price) {
                <del class="price-old">{{ product()!.oldPrice | number }}đ</del>
              }
            </div>

            <p class="pd-stock" [class.out]="product()!.stock === 0">
              {{ product()!.stock === 0 ? '⚠ Hết hàng' : '✓ Còn hàng (' + product()!.stock + ')' }}
            </p>

            @if (product()!.description) {
              <p class="pd-desc">{{ product()!.description }}</p>
            }

            <!-- Quantity + Add to cart -->
            <div class="pd-actions">
              <div class="qty-wrap">
                <button class="qty-btn" (click)="decQty()">−</button>
                <span class="qty-val">{{ qty() }}</span>
                <button class="qty-btn" (click)="incQty()">+</button>
              </div>
              <button
                class="btn btn--primary btn--lg"
                (click)="addToCart()"
                [disabled]="product()!.stock === 0"
              >
                🛒 Thêm vào giỏ
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private prodSvc = inject(ProductService);
  private cartSvc = inject(CartService);
  private toast = inject(ToastService);

  product = signal<Product | null>(null);
  loading = signal(true);
  qty = signal(1);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.prodSvc.getProductById(id).subscribe((p) => {
      this.product.set(p);
      this.loading.set(false);
    });
  }

  discountPct(): number {
    const p = this.product();
    if (!p?.oldPrice) return 0;
    return Math.round((1 - p.price / p.oldPrice) * 100);
  }

  incQty(): void {
    this.qty.update((q) => q + 1);
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
}
