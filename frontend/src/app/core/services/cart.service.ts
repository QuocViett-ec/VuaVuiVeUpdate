import {
  Injectable,
  signal,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Product, CartItem, Cart } from '../models/product.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const LS_CART = 'vvv_cart';
const LS_SAVE_LATER = 'vvv_save_later';
const API_BASE = environment.apiBase;

@Injectable({ providedIn: 'root' })
export class CartService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private _items = signal<CartItem[]>(this._load());
  private _savedForLater = signal<CartItem[]>(this._loadSavedForLater());
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private skipNextServerSync = false;
  private hasMergedAfterLogin = false;

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

        if (!this.auth.isLoggedIn()) return;
        if (this.skipNextServerSync) {
          this.skipNextServerSync = false;
          return;
        }

        if (this.auth.isLoggedIn()) {
          this.scheduleServerSync();
        }
      });

      effect(() => {
        if (!this.auth.isLoggedIn()) {
          this.hasMergedAfterLogin = false;
          return;
        }

        if (!this.hasMergedAfterLogin) {
          this.hasMergedAfterLogin = true;
          // Avoid tracking cart signals here to prevent effect re-trigger loops.
          untracked(() => {
            void this.mergeLocalIntoServer();
          });
        }
      });
    }
  }

  private mapServerItems(raw: any[]): CartItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        const product = row?.product;
        const productId = String(row?.productId || product?.id || product?._id || '').trim();
        const quantity = Math.max(1, Number(row?.quantity || 1));
        if (!productId) return null;

        return {
          quantity,
          product: {
            id: productId,
            name: String(product?.name || 'Sản phẩm'),
            price: Number(product?.price || 0),
            stock: Number(product?.stock || 0),
            cat: String(product?.cat || product?.category || 'all'),
            sub: String(product?.sub || product?.subCategory || 'all'),
            img: String(product?.img || product?.imageUrl || ''),
          },
        } as CartItem;
      })
      .filter(Boolean) as CartItem[];
  }

  private applyServerCart(data: any): void {
    this.skipNextServerSync = true;
    this._items.set(this.mapServerItems(data?.items || []));
    this._savedForLater.set(this.mapServerItems(data?.savedForLater || []));
  }

  private toSyncPayload(items: CartItem[]): Array<{ productId: string; quantity: number }> {
    return items
      .map((item) => ({
        productId: this.resolveProductId(item.product),
        quantity: Math.max(0, Number(item.quantity || 0)),
      }))
      .filter((item) => !!item.productId && item.quantity > 0);
  }

  private scheduleServerSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.auth.isLoggedIn()) return;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      void this.syncServerState();
    }, 400);
  }

  private async syncServerState(): Promise<void> {
    if (!this.auth.isLoggedIn()) return;
    try {
      const res = await firstValueFrom(
        this.http.put<any>(
          `${API_BASE}/api/cart/me`,
          {
            items: this.toSyncPayload(this._items()),
            savedForLater: this.toSyncPayload(this._savedForLater()),
          },
          { withCredentials: true },
        ),
      );
      if (res?.success && res?.data) {
        this.applyServerCart(res.data);
      }
    } catch {
      // Ignore transient sync errors; local cart remains available.
    }
  }

  async mergeLocalIntoServer(): Promise<void> {
    if (!this.auth.isLoggedIn()) return;
    try {
      const res = await firstValueFrom(
        this.http.post<any>(
          `${API_BASE}/api/cart/me/merge`,
          {
            items: this.toSyncPayload(this._items()),
            savedForLater: this.toSyncPayload(this._savedForLater()),
          },
          { withCredentials: true },
        ),
      );
      if (res?.success && res?.data) {
        this.applyServerCart(res.data);
      }
    } catch {
      // Keep local cart if merge fails.
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
