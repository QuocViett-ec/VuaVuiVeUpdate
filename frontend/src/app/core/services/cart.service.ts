import { Injectable, signal, computed, effect } from '@angular/core';
import { Product, CartItem, Cart } from '../models/product.model';

const LS_CART = 'vvv_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>(this._load());

  readonly items = this._items.asReadonly();
  readonly itemCount = computed(() => this._items().reduce((s, i) => s + i.quantity, 0));
  readonly subtotal = computed(() =>
    this._items().reduce((s, i) => s + i.product.price * i.quantity, 0),
  );
  readonly cart = computed<Cart>(() => ({
    items: this._items(),
    subtotal: this.subtotal(),
    itemCount: this.itemCount(),
  }));

  constructor() {
    effect(() => {
      const raw: Record<string, number> = {};
      this._items().forEach((i) => (raw[i.product.id] = i.quantity));
      localStorage.setItem(LS_CART, JSON.stringify(raw));
    });
  }

  private _load(): CartItem[] {
    try {
      const raw: Record<string, number> = JSON.parse(localStorage.getItem(LS_CART) || '{}');
      // Items loaded without product details (resolved lazily when product data is available)
      return Object.entries(raw)
        .filter(([, q]) => q > 0)
        .map(([id, quantity]) => ({ product: { id } as Product, quantity }));
    } catch {
      return [];
    }
  }

  // ─── Load stored IDs + merge real product data ────────────────────────────
  hydrateFromProducts(products: Product[]): void {
    const raw: Record<string, number> = {};
    try {
      Object.assign(raw, JSON.parse(localStorage.getItem(LS_CART) || '{}'));
    } catch {}
    const hydrated: CartItem[] = Object.entries(raw)
      .filter(([, q]) => q > 0)
      .map(([id, quantity]) => {
        const product = products.find((p) => p.id === id) ?? ({ id } as Product);
        return { product, quantity };
      });
    this._items.set(hydrated);
  }

  // ─── Mutations ───────────────────────────────────────────────────────────────
  addToCart(product: Product, qty = 1): void {
    this._items.update((items) => {
      const idx = items.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const copy = [...items];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...items, { product, quantity: qty }];
    });
  }

  removeFromCart(productId: string): void {
    this._items.update((items) => items.filter((i) => i.product.id !== productId));
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }
    this._items.update((items) => {
      const idx = items.findIndex((i) => i.product.id === productId);
      if (idx < 0) return items;
      const copy = [...items];
      copy[idx] = { ...copy[idx], quantity };
      return copy;
    });
  }

  clearCart(): void {
    this._items.set([]);
  }

  getQuantity(productId: string): number {
    return this._items().find((i) => i.product.id === productId)?.quantity ?? 0;
  }
}
