import { Injectable, signal, computed, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Product, CartItem, Cart } from '../models/product.model';

const LS_CART = 'vvv_cart';
const LS_SAVE_LATER = 'vvv_save_later';

@Injectable({ providedIn: 'root' })
export class CartService {
  private platformId = inject(PLATFORM_ID);
  private _items = signal<CartItem[]>(this._load());
  private _savedForLater = signal<CartItem[]>(this._loadSavedForLater());

  private resolveProductId(product: Product | (Product & { _id?: string; slug?: string })): string {
    const raw = (product as any)?.id ?? (product as any)?._id ?? (product as any)?.slug;
    return raw ? String(raw) : '';
  }

  readonly items = this._items.asReadonly();
  readonly savedForLater = this._savedForLater.asReadonly();
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
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        // Lưu toàn bộ CartItem[] (bao gồm product đầy đủ) vào localStorage
        localStorage.setItem(LS_CART, JSON.stringify(this._items()));
        localStorage.setItem(LS_SAVE_LATER, JSON.stringify(this._savedForLater()));
      });
    }
  }

  private _load(): CartItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = JSON.parse(localStorage.getItem(LS_CART) || 'null');
      if (!raw) return [];
      // Định dạng mới: mảng CartItem[]
      if (Array.isArray(raw)) {
        return (raw as CartItem[]).filter((i) => i?.product?.id && i.quantity > 0);
      }
      // Tương thích định dạng cũ: {productId: quantity}
      if (typeof raw === 'object') {
        return Object.entries(raw as Record<string, number>)
          .filter(([, q]) => q > 0)
          .map(([id, quantity]) => ({ product: { id } as Product, quantity }));
      }
      return [];
    } catch {
      return [];
    }
  }

  private _loadSavedForLater(): CartItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = JSON.parse(localStorage.getItem(LS_SAVE_LATER) || 'null');
      if (!Array.isArray(raw)) return [];
      return (raw as CartItem[]).filter((i) => i?.product?.id && i.quantity > 0);
    } catch {
      return [];
    }
  }

  // ─── Cập nhật giá/tên sản phẩm từ danh sách mới nhất ────────────────────────
  hydrateFromProducts(products: Product[]): void {
    this._items.update((items) =>
      items.map((item) => {
        const itemId = this.resolveProductId(item.product);
        const fresh = products.find((p) => this.resolveProductId(p) === itemId);
        return fresh ? { ...item, product: fresh } : item;
      }),
    );

    this._savedForLater.update((items) =>
      items.map((item) => {
        const itemId = this.resolveProductId(item.product);
        const fresh = products.find((p) => this.resolveProductId(p) === itemId);
        return fresh ? { ...item, product: fresh } : item;
      }),
    );
  }

  // ─── Mutations ───────────────────────────────────────────────────────────────
  addToCart(product: Product, qty = 1): void {
    const productId = this.resolveProductId(product);
    if (!productId || qty <= 0) return;

    this._items.update((items) => {
      const idx = items.findIndex((i) => this.resolveProductId(i.product) === productId);
      if (idx >= 0) {
        const copy = [...items];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...items, { product: { ...product, id: productId }, quantity: qty }];
    });
  }

  removeFromCart(productId: string): void {
    const normalizedId = String(productId || '');
    this._items.update((items) =>
      items.filter((i) => this.resolveProductId(i.product) !== normalizedId),
    );
  }

  updateQuantity(productId: string, quantity: number): void {
    const normalizedId = String(productId || '');
    if (!normalizedId) return;
    if (quantity <= 0) {
      this.removeFromCart(normalizedId);
      return;
    }
    this._items.update((items) => {
      const idx = items.findIndex((i) => this.resolveProductId(i.product) === normalizedId);
      if (idx < 0) return items;
      const copy = [...items];
      copy[idx] = { ...copy[idx], quantity };
      return copy;
    });
  }

  clearCart(): void {
    this._items.set([]);
  }

  saveForLater(productId: string): void {
    const normalizedId = String(productId || '');
    if (!normalizedId) return;

    const item = this._items().find((i) => this.resolveProductId(i.product) === normalizedId);
    if (!item) return;

    this._items.update((items) =>
      items.filter((i) => this.resolveProductId(i.product) !== normalizedId),
    );

    this._savedForLater.update((items) => {
      const idx = items.findIndex((i) => this.resolveProductId(i.product) === normalizedId);
      if (idx >= 0) {
        const copy = [...items];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + item.quantity };
        return copy;
      }
      return [...items, item];
    });
  }

  moveSavedToCart(productId: string): void {
    const normalizedId = String(productId || '');
    if (!normalizedId) return;

    const item = this._savedForLater().find(
      (i) => this.resolveProductId(i.product) === normalizedId,
    );
    if (!item) return;

    this._savedForLater.update((items) =>
      items.filter((i) => this.resolveProductId(i.product) !== normalizedId),
    );
    this.addToCart(item.product, item.quantity);
  }

  removeSavedForLater(productId: string): void {
    const normalizedId = String(productId || '');
    this._savedForLater.update((items) =>
      items.filter((i) => this.resolveProductId(i.product) !== normalizedId),
    );
  }

  clearSavedForLater(): void {
    this._savedForLater.set([]);
  }

  getQuantity(productId: string): number {
    const normalizedId = String(productId || '');
    if (!normalizedId) return 0;
    return (
      this._items().find((i) => this.resolveProductId(i.product) === normalizedId)?.quantity ?? 0
    );
  }
}
