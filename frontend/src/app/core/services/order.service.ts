import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, DeliverySlot, VoucherResult } from '../models/product.model';

const VOUCHERS: Record<string, (subtotal: number, shippingFee: number) => VoucherResult> = {
  FREESHIP: (_, ship) => ({ ok: true, type: 'ship', value: ship, message: 'Đã áp dụng freeship.' }),
  GIAM10: () => ({ ok: true, type: 'percent', value: 10, message: 'Giảm 10% đơn hàng.' }),
};

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = environment.apiBase;

  constructor(private http: HttpClient) {}

  // ─── Delivery slots ───────────────────────────────────────────────────────────
  getDeliverySlots(): DeliverySlot[] {
    const slots: DeliverySlot[] = [];
    const today = new Date();
    for (let d = 0; d < 2; d++) {
      const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
      const dateStr = dt.toISOString().slice(0, 10);
      for (const win of ['09:00-11:00', '13:00-15:00', '18:00-20:00']) {
        slots.push({ id: `${dateStr}_${win}`, date: dateStr, window: win, capacity: 50, used: 0 });
      }
    }
    return slots;
  }

  // ─── Voucher ─────────────────────────────────────────────────────────────────
  applyVoucher(code: string, subtotal: number, shippingFee: number): VoucherResult {
    const c = (code || '').trim().toUpperCase();
    if (!c) return { ok: false, message: 'Bạn chưa nhập mã.' };
    const fn = VOUCHERS[c];
    if (fn) return fn(subtotal, shippingFee);
    return { ok: false, message: 'Mã không hợp lệ.' };
  }

  // ─── Shipping fee ─────────────────────────────────────────────────────────────
  calcShippingFee(address: string, subtotal: number): number {
    const txt = (address || '').toLowerCase();
    if (!txt) return 20000;
    if (subtotal >= 300000) return 0;
    if (/q\.\s*\d+|quận|tp\./.test(txt)) return 15000;
    if (/h\.\s*|huyện/.test(txt)) return 25000;
    return 20000;
  }

  // ─── Create order ─────────────────────────────────────────────────────────────
  createOrder(payload: Partial<Order>): Observable<Order> {
    return this.http.post<Order>(`${this.api}/orders`, payload);
  }

  markOrderPaid(orderId: string): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/api/orders/${orderId}/paid`, {});
  }

  // ─── List / get ───────────────────────────────────────────────────────────────
  getOrders(params?: { userId?: string; status?: string }): Observable<Order[]> {
    let url = `${this.api}/orders?_sort=createdAt&_order=desc`;
    if (params?.userId) url += `&userId=${params.userId}`;
    if (params?.status && params.status !== 'all') url += `&status=${params.status}`;
    return this.http.get<Order[]>(url).pipe(catchError(() => of([])));
  }

  getOrderById(id: string): Observable<Order | null> {
    return this.http.get<Order>(`${this.api}/orders/${id}`).pipe(catchError(() => of(null)));
  }

  updateOrderStatus(id: string, status: string): Observable<Order> {
    return this.http.patch<Order>(`${this.api}/orders/${id}`, { status });
  }

  // ─── Order ID generator ───────────────────────────────────────────────────────
  generateOrderId(): string {
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
    const hms = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ORD-${ymd}-${hms}-${rand}`;
  }
}
