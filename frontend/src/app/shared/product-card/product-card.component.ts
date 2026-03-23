import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Product } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="product-card" [class.product-card--flash]="flashMode">
      <a [routerLink]="['/products', product.id]" class="card-img-wrap" (click)="onProductClick()">
        <img
          [src]="product.img || fallbackImg"
          (error)="onImageError($event)"
          [alt]="product.name"
          class="card-img"
          loading="lazy"
        />
        @if (product.oldPrice && product.oldPrice > product.price) {
          <span class="badge-sale">-{{ discountPct() }}%</span>
        }
      </a>
      <div class="card-body">
        @if (flashMode) {
          <p class="card-brand">FLASH DEAL</p>
        }
        <a [routerLink]="['/products', product.id]" class="card-name" (click)="onProductClick()">{{
          product.name
        }}</a>
        <div class="card-price">
          <span class="price-current">{{ product.price | number }}đ</span>
          @if (product.oldPrice && product.oldPrice > product.price) {
            <span class="price-old">{{ product.oldPrice | number }}đ</span>
          }
        </div>
        @if (product.unit) {
          <p class="card-unit">/ {{ product.unit }}</p>
        }
        <div class="card-rating" aria-label="Đánh giá trung bình">
          <span class="card-rating__star">★</span>
          <span class="card-rating__value">{{ averageRating() }}</span>
          <span class="card-rating__count">({{ reviewCount() }})</span>
          <span class="card-sold">Đã bán {{ soldCount() }}</span>
        </div>
        @if (flashMode) {
          <div class="card-sale-row" aria-label="Tiến độ bán hàng">
            <div class="card-sale-progress">
              <span class="card-sale-progress__bar" [style.width.%]="saleProgressPct()"></span>
            </div>
            <span class="card-sale-progress__pct">{{ saleProgressPct() }}%</span>
          </div>
        }
        <div class="card-actions">
          <button class="btn-add" (click)="add()" [disabled]="product.stock === 0">
            @if (product.stock === 0) {
              Hết hàng
            } @else {
              Thêm vào giỏ
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input() flashMode = false;
  @Output() productClick = new EventEmitter<Product>();
  @Output() addToCartClick = new EventEmitter<Product>();
  private cart = inject(CartService);
  private toast = inject(ToastService);
  readonly fallbackImg = '/images/brand/LogoVVV.png';
  discountPct() {
    if (!this.product.oldPrice) return 0;
    return Math.round((1 - this.product.price / this.product.oldPrice) * 100);
  }

  soldCount() {
    const sold = Number(this.product.soldCount ?? 0);
    if (Number.isFinite(sold) && sold > 0) return Math.round(sold);
    const seed = String(this.product.id || '')
      .split('')
      .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    return 80 + (seed % 300);
  }

  saleProgressPct() {
    const sold = this.soldCount();
    const stock = Math.max(0, Number(this.product.stock ?? 0));
    if (!stock) return Math.min(95, Math.max(22, Math.round((sold % 100) + 20)));
    const pct = Math.round((sold / (sold + stock)) * 100);
    return Math.min(95, Math.max(12, pct));
  }

  reviewCount() {
    const count = Number(this.product.reviewCount ?? 0);
    if (Number.isFinite(count) && count > 0) return Math.round(count);
    return 40 + (this.soldCount() % 220);
  }

  averageRating() {
    const rating = Number(this.product.rating ?? 0);
    if (!Number.isFinite(rating) || rating <= 0 || rating < 1) return '4.5';
    return rating.toFixed(1);
  }

  add() {
    const hasExternalHandler = this.addToCartClick.observers.length > 0;
    this.addToCartClick.emit(this.product);
    if (!hasExternalHandler) {
      this.cart.addToCart(this.product);
      this.toast.success('Đã thêm vào giỏ hàng');
    }
  }

  onProductClick() {
    this.productClick.emit(this.product);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img || img.src.includes(this.fallbackImg)) return;
    img.src = this.fallbackImg;
  }
}
