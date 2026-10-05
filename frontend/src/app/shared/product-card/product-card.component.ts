import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Product } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-product-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="product-card" [class.product-card--flash]="flashMode()">
      <a [routerLink]="['/products', product().id]" class="card-img-wrap" (click)="onProductClick()">
        <img
          [src]="product().img || fallbackImg"
          (error)="onImageError($event)"
          [alt]="product().name"
          class="card-img"
          loading="lazy"
        />
        @if ((product().oldPrice ?? 0) > product().price) {
          <span class="badge-sale">-{{ discountPct() }}%</span>
        }
      </a>
      <div class="card-body">
        @if (flashMode()) {
          <p class="card-brand">ƯU ĐÃI</p>
        }
        <a [routerLink]="['/products', product().id]" class="card-name" (click)="onProductClick()">{{
          product().name
        }}</a>
        <div class="card-price">
          <span class="price-current">{{ product().price | number }}đ</span>
          @if ((product().oldPrice ?? 0) > product().price) {
            <span class="price-old">{{ product().oldPrice | number }}đ</span>
          }
        </div>
        @if (product().unit) {
          <p class="card-unit">/ {{ product().unit }}</p>
        }
        <div class="card-rating" aria-label="Đánh giá trung bình">
          <span class="card-rating__star">★</span>
          <span class="card-rating__value">{{ averageRating() }}</span>
          <span class="card-rating__count">({{ reviewCount() }})</span>
          <span class="card-sold">Đã bán {{ soldCount() }}</span>
        </div>
        @if (flashMode()) {
          <div class="card-sale-row" aria-label="Tiến độ bán hàng">
            <div class="card-sale-progress">
              <span class="card-sale-progress__bar" [style.width.%]="saleProgressPct()"></span>
            </div>
            <span class="card-sale-progress__pct">{{ saleProgressPct() }}%</span>
          </div>
        }
        <div class="card-actions">
          <button class="btn-add" (click)="add()" [disabled]="product().stock === 0">
            @if (product().stock === 0) {
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
  product = input.required<Product>();
  flashMode = input(false);
  externalCartHandling = input(false);
  productClick = output<Product>();
  addToCartClick = output<Product>();
  private cart = inject(CartService);
  private toast = inject(ToastService);
  readonly fallbackImg = '/images/brand/LogoVVV.png';
  discountPct() {
    const product = this.product();
    if (!product.oldPrice) return 0;
    return Math.round((1 - product.price / product.oldPrice) * 100);
  }

  soldCount() {
    const sold = Number(this.product().soldCount ?? 0);
    if (Number.isFinite(sold) && sold > 0) return Math.round(sold);
    return 0;
  }

  saleProgressPct() {
    const sold = this.soldCount();
    const stock = Math.max(0, Number(this.product().stock ?? 0));
    return sold + stock > 0 ? Math.round((sold / (sold + stock)) * 100) : 0;
  }

  reviewCount() {
    const count = Number(this.product().reviewCount ?? 0);
    if (Number.isFinite(count) && count > 0) return Math.round(count);
    return 0;
  }

  averageRating() {
    const rating = Number(this.product().rating ?? 0);
    if (!Number.isFinite(rating) || rating < 1) return 'Chưa có đánh giá';
    return rating.toFixed(1);
  }

  add() {
    const hasExternalHandler = this.externalCartHandling();
    this.addToCartClick.emit(this.product());
    if (!hasExternalHandler) {
      this.cart.addToCart(this.product());
      this.toast.success('Đã thêm vào giỏ hàng');
    }
  }

  onProductClick() {
    this.productClick.emit(this.product());
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img || img.src.includes(this.fallbackImg)) return;
    img.src = this.fallbackImg;
  }
}
