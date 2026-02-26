import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { CartItem } from '../../../core/models/product.model';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="section">
      <div class="container" style="max-width:1100px">
        <div class="title" style="display:flex;align-items:center;gap:12px">
          <h2 style="margin:0">Gio hang</h2>
          <label style="display:flex;align-items:center;gap:8px;font-weight:600;cursor:pointer">
            <input type="checkbox" [checked]="allSelected()" (change)="toggleAll($event)" />
            <span>Chon tat ca</span>
          </label>
        </div>

        <div class="cart-body">
          @if (!items().length) {
            <div class="empty-cart">
              <p>Gio hang trong.</p>
              <a routerLink="/products" class="btn btn--primary">Mua sam ngay</a>
            </div>
          } @else {
            @for (item of items(); track item.product.id) {
              <div class="cart-row">
                <input
                  type="checkbox"
                  [checked]="selected().has(item.product.id)"
                  (change)="toggle(item.product.id, $event)"
                />
                <img
                  [src]="item.product.img || (item.product.images?.[0] ?? '')"
                  [alt]="item.product.name"
                  class="cart-img"
                  onerror="this.src='images/icon/placeholder.png'"
                />
                <div class="cart-info">
                  <p class="cart-name">{{ item.product.name }}</p>
                  <p class="cart-price">{{ item.product.price | number }}d</p>
                </div>
                <div class="cart-qty">
                  <button (click)="dec(item)">−</button>
                  <span>{{ item.quantity }}</span>
                  <button (click)="inc(item)">+</button>
                </div>
                <p class="cart-subtotal">{{ item.product.price * item.quantity | number }}d</p>
                <button class="cart-remove" (click)="remove(item.product.id)" aria-label="Xoa">
                  ×
                </button>
              </div>
            }
          }
        </div>

        <div class="cart-footer">
          <div>
            <label class="muted">Tam tinh:</label>
            <strong class="subtotal">{{ subtotal() | number }}d</strong>
          </div>
          <div style="display:flex;gap:12px">
            <button class="btn btn--primary" [disabled]="!items().length" (click)="checkout()">
              Thanh toan
            </button>
            <button class="btn btn--outline" (click)="clearCart()">Lam sach gio</button>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: `
    .title {
      margin-bottom: 1.5rem;
    }
    .cart-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cart-row {
      display: flex;
      align-items: center;
      gap: 16px;
      background: #fff;
      border: 1px solid #e8e0c8;
      border-radius: 12px;
      padding: 12px 16px;
    }
    .cart-img {
      width: 72px;
      height: 72px;
      object-fit: contain;
      border-radius: 8px;
      background: #f5fdf5;
      flex-shrink: 0;
    }
    .cart-info {
      flex: 1;
      min-width: 0;
    }
    .cart-name {
      font-weight: 700;
      color: #1b2a1e;
      margin-bottom: 4px;
    }
    .cart-price {
      color: #2e7d32;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .cart-qty {
      display: flex;
      align-items: center;
      gap: 10px;
      button {
        width: 30px;
        height: 30px;
        border: 1.5px solid #b5cbb5;
        border-radius: 6px;
        background: #fff;
        cursor: pointer;
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      button:hover {
        background: #e8f5e9;
      }
      span {
        min-width: 24px;
        text-align: center;
        font-weight: 700;
      }
    }
    .cart-subtotal {
      font-weight: 700;
      color: #1b2a1e;
      min-width: 90px;
      text-align: right;
    }
    .cart-remove {
      background: none;
      border: none;
      font-size: 1.4rem;
      color: #999;
      cursor: pointer;
      padding: 4px 8px;
      &:hover {
        color: #c62828;
      }
    }
    .cart-footer {
      margin-top: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .subtotal {
      font-size: 1.3rem;
      color: #d32f2f;
      margin-left: 8px;
    }
    .empty-cart {
      text-align: center;
      padding: 4rem 0;
    }
    .muted {
      color: #888;
      font-size: 0.9rem;
    }
  `,
})
export class CartPageComponent implements OnInit {
  private cartSvc = inject(CartService);
  private router = inject(Router);

  readonly items = this.cartSvc.items;

  selected = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.selected.set(new Set(this.items().map((i) => i.product.id)));
  }

  allSelected = () => this.selected().size === this.items().length && this.items().length > 0;

  toggle(id: string, e: Event): void {
    const s = new Set(this.selected());
    if ((e.target as HTMLInputElement).checked) s.add(id);
    else s.delete(id);
    this.selected.set(s);
  }

  toggleAll(e: Event): void {
    if ((e.target as HTMLInputElement).checked) {
      this.selected.set(new Set(this.items().map((i) => i.product.id)));
    } else {
      this.selected.set(new Set());
    }
  }

  subtotal(): number {
    return this.items()
      .filter((i) => this.selected().has(i.product.id))
      .reduce((s, i) => s + i.product.price * i.quantity, 0);
  }

  inc(item: CartItem): void {
    this.cartSvc.addToCart(item.product, 1);
  }
  dec(item: CartItem): void {
    this.cartSvc.updateQuantity(item.product.id, item.quantity - 1);
  }
  remove(id: string): void {
    this.cartSvc.removeFromCart(id);
  }
  clearCart(): void {
    this.cartSvc.clearCart();
  }
  checkout(): void {
    this.router.navigate(['/checkout']);
  }
}
