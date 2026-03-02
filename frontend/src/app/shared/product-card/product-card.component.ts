import { Component, Input } from '@angular/core';
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
      <a [routerLink]="['/products', product.id]" class="card-img-wrap">
        <img
          [src]="product.img || 'images/brand/LogoVVV.png'"
          [alt]="product.name"
          class="card-img"
          loading="lazy"
        />
        @if (product.oldPrice && product.oldPrice > product.price) {
          <span class="badge-sale">-{{ discountPct() }}%</span>
        }
      </a>
      <div class="card-body">
        <a [routerLink]="['/products', product.id]" class="card-name">{{ product.name }}</a>
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
            <div class="qty-ctrl">
              <button (click)="dec()" class="qty-btn">−</button>
              <span>{{ cartQty() }}</span>
              <button (click)="inc()" class="qty-btn">+</button>
            </div>
          } @else {
            <button class="btn-add" (click)="add()" [disabled]="product.stock === 0">
              {{ product.stock === 0 ? 'Hết hàng' : 'Thêm vào giỏ' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  private cart = inject(CartService);

  cartQty() {
    return this.cart.getQuantity(this.product.id);
  }
  discountPct() {
    if (!this.product.oldPrice) return 0;
    return Math.round((1 - this.product.price / this.product.oldPrice) * 100);
  }
  add() {
    this.cart.addToCart(this.product);
  }
  inc() {
    this.cart.updateQuantity(this.product.id, this.cartQty() + 1);
  }
  dec() {
    this.cart.updateQuantity(this.product.id, this.cartQty() - 1);
  }
}
