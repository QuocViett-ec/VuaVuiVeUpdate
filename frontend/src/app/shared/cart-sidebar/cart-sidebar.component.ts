import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { CartItem } from '../../core/models/product.model';

@Component({
  selector: 'app-cart-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="cart-overlay" [class.open]="isOpen()" (click)="close()"></div>

    <aside class="cart-sidebar" [class.open]="isOpen()">
      <div class="cart-sidebar__head">
        <h3>Giỏ hàng ({{ cartService.itemCount() }})</h3>
        <button class="close-btn" (click)="close()" aria-label="Đóng giỏ hàng">
          <span class="material-symbols-outlined g-icon">close</span>
        </button>
      </div>

      <div class="cart-sidebar__body">
        @if (cart().items.length === 0) {
          <div class="empty-cart">
            <div class="empty-icon">
              <span class="material-symbols-outlined g-icon">shopping_cart</span>
            </div>
            <p>Giỏ hàng trống</p>
            <a routerLink="/products" class="btn btn--primary" (click)="close()">Mua sắm ngay</a>
          </div>
        } @else {
          @for (item of cart().items; track item.product.id) {
            <div class="cart-item">
              <img
                [src]="item.product.img || 'images/brand/LogoVVV.png'"
                [alt]="item.product.name"
                class="item-img"
              />
              <div class="item-info">
                <p class="item-name">{{ item.product.name }}</p>
                <p class="item-price">{{ item.product.price | number }} đ</p>
              </div>
              <div class="item-qty">
                <button (click)="dec(item)" class="qty-btn">−</button>
                <span>{{ item.quantity }}</span>
                <button (click)="inc(item)" class="qty-btn">+</button>
              </div>
              <button class="remove-btn" (click)="remove(item.product.id)">
                <span class="material-symbols-outlined g-icon">delete</span>
              </button>
            </div>
          }
        }
      </div>

      @if (cart().items.length > 0) {
        <div class="cart-sidebar__foot">
          <div class="subtotal-row">
            <span>Tạm tính</span>
            <strong>{{ cart().subtotal | number }} đ</strong>
          </div>
          <a routerLink="/checkout" class="btn btn--primary w-full" (click)="close()">
            Thanh toán
          </a>
          <button class="btn btn--ghost w-full" (click)="cartService.clearCart()">
            Xóa giỏ hàng
          </button>
        </div>
      }
    </aside>
  `,
  styleUrl: './cart-sidebar.component.scss',
})
export class CartSidebarComponent {
  readonly cartService = inject(CartService);
  readonly isOpen = signal(false);
  readonly cart = this.cartService.cart;

  @HostListener('document:cart:toggle')
  toggle(): void {
    this.isOpen.update((v) => !v);
  }
  close(): void {
    this.isOpen.set(false);
  }

  inc(item: CartItem): void {
    this.cartService.updateQuantity(item.product.id, item.quantity + 1);
  }
  dec(item: CartItem): void {
    this.cartService.updateQuantity(item.product.id, item.quantity - 1);
  }
  remove(id: string): void {
    this.cartService.removeFromCart(id);
  }
}
