import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Product } from '../../core/models/product.model';
import { CartService } from '../../core/services/cart.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="product-card">
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
        <div class="card-actions">
          @if (cartQty() > 0) {
            <span class="cart-badge">&#x1F6D2; ×{{ cartQty() }} trong giỏ</span>
          }
          <button
            class="btn-add"
            [class.btn-add--incart]="cartQty() > 0"
            (click)="add()"
            [disabled]="product.stock === 0"
          >
            @if (product.stock === 0) {
              Hết hàng
            } @else if (cartQty() > 0) {
              + Thêm nữa
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
  @Output() productClick = new EventEmitter<Product>();
  @Output() addToCartClick = new EventEmitter<Product>();
  private cart = inject(CartService);
  readonly fallbackImg = '/images/brand/LogoVVV.png';

  cartQty() {
    return this.cart.getQuantity(this.product.id);
  }
  discountPct() {
    if (!this.product.oldPrice) return 0;
    return Math.round((1 - this.product.price / this.product.oldPrice) * 100);
  }
  add() {
    const hasExternalHandler = this.addToCartClick.observers.length > 0;
    this.addToCartClick.emit(this.product);
    if (!hasExternalHandler) {
      this.cart.addToCart(this.product);
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
