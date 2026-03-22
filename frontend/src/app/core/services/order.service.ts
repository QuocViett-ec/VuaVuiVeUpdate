import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Order, DeliverySlot, VoucherResult } from '../models/product.model';

export interface AdminOrdersResult {
  data: Order[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BulkOrderUpdateResult {
  updatedCount: number;
  requested: number;
}

export interface ProductReviewInput {
  productId: string;
  rating: number;
  comment?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly api = environment.apiBase;
  private readonly writeOptions = {
    withCredentials: true,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  };

  constructor(private http: HttpClient) {}

  private normalizeOrder(raw: any): Order {
    const delivery = raw?.delivery ?? {};
    const payment = raw?.payment ?? {};
    const dbId = String(raw?._id ?? raw?.id ?? '');
    const orderId = String(raw?.orderId ?? dbId);
    const normalizedItems = Array.isArray(raw?.items)
      ? raw.items.map((item: any) => ({
          productId: String(item?.productId ?? ''),
          productName: item?.productName ?? '',
          quantity: Number(item?.quantity ?? 0),
          price: Number(item?.price ?? 0),
          subtotal: Number(item?.subtotal ?? 0),
          imageUrl:
            item?.imageUrl ??
            item?.image ??
            item?.productImage ??
            item?.product?.imageUrl ??
            item?.product?.img ??
            '',
          productImage: item?.productImage ?? item?.product?.imageUrl ?? item?.product?.img ?? '',
        }))
      : [];

    return {
      ...raw,
      id: orderId,
      orderId,
      dbId,
      userId: raw?.userId?._id ? String(raw.userId._id) : String(raw?.userId ?? ''),
      customerName: delivery?.name ?? raw?.customerName ?? '',
      email: raw?.email ?? delivery?.email ?? '',
      phone: delivery?.phone ?? raw?.phone ?? '',
      address: delivery?.address ?? raw?.address ?? '',
      deliverySlot: delivery?.slot ?? raw?.deliverySlot ?? '',
      items: normalizedItems,
      subtotal: Number(raw?.subtotal ?? 0),
      shippingFee: Number(raw?.shippingFee ?? 0),
      discount: Number(raw?.discount ?? 0),
      totalAmount: Number(raw?.totalAmount ?? 0),
      voucherCode: raw?.voucherCode ?? '',
      note: raw?.note ?? '',
      paymentMethod: payment?.method ?? raw?.paymentMethod ?? 'cod',
      paymentStatus: payment?.status ?? raw?.paymentStatus ?? 'pending',
      status: raw?.status ?? 'pending',
      createdAt: raw?.createdAt ?? new Date().toISOString(),
      updatedAt: raw?.updatedAt,
      paidAt: raw?.paidAt,
    } as Order;
  }

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
  applyVoucher(code: string, subtotal: number, shippingFee: number): Observable<VoucherResult> {
    const c = (code || '').trim().toUpperCase();
    if (!c) return of({ ok: false, message: 'Bạn chưa nhập mã.' });

    return this.http
      .post<any>(
        `${this.api}/api/orders/voucher/validate`,
        { code: c, subtotal: Number(subtotal || 0), shippingFee: Number(shippingFee || 0) },
        this.writeOptions,
      )
      .pipe(
        map((res: any) => {
          const data = res?.data ?? res;
          return {
            ok: !!data?.ok,
            type: data?.type,
            value: Number(data?.value ?? 0),
            cap: Number(data?.cap ?? 0),
            message: String(data?.message || res?.message || 'Áp mã thành công.'),
            warning: String(data?.warning || ''),
            expiresAt: data?.expiresAt ?? null,
            daysLeft:
              data?.daysLeft === null || data?.daysLeft === undefined
                ? null
                : Number(data.daysLeft),
          } as VoucherResult;
        }),
        catchError((err) =>
          of({
            ok: false,
            message: String(err?.error?.message || 'Mã không hợp lệ.'),
          } as VoucherResult),
        ),
      );
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
  createOrder(payload: Partial<Order>): Observable<any> {
    return this.http.post<any>(`${this.api}/api/orders`, payload, this.writeOptions).pipe(
      map((res: any) => res?.data ?? res),
      catchError((err) => throwError(() => err)),
    );
  }

  markOrderPaid(
    orderId: string,
    payload?: { gateway?: 'vnpay' | 'momo'; transactionId?: string },
  ): Observable<Order> {
    return this.http
      .patch<any>(`${this.api}/api/orders/${orderId}/paid`, payload ?? {}, this.writeOptions)
      .pipe(map((res: any) => this.normalizeOrder(res?.data ?? res)));
  }

  // ─── List / get ───────────────────────────────────────────────────────────────
  getOrders(params?: { userId?: string; status?: string }): Observable<Order[]> {
    // Thử /api/orders/me trước (backend mới với session)
    const meUrl = `${this.api}/api/orders/me`;
    return this.http.get<any>(meUrl, { withCredentials: true }).pipe(
      map((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        const normalized = list.map((o: any) => this.normalizeOrder(o));
        if (params?.status && params.status !== 'all') {
          return normalized.filter((o: Order) => o.status === params.status);
        }
        return normalized;
      }),
    );
  }

  getMyOrders(): Observable<Order[]> {
    return this.http.get<any>(`${this.api}/api/orders/me`, { withCredentials: true }).pipe(
      map((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        return list.map((o: any) => this.normalizeOrder(o));
      }),
    );
  }

  getAdminOrders(params?: {
    status?: string;
    page?: number;
    limit?: number;
    q?: string;
  }): Observable<Order[]> {
    return this.getAdminOrdersPaged(params).pipe(map((res) => res.data));
  }

  getAdminOrdersPaged(params?: {
    status?: string;
    page?: number;
    limit?: number;
    q?: string;
  }): Observable<AdminOrdersResult> {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.q?.trim()) qs.set('q', params.q.trim());

    const url = `${this.api}/api/admin/orders${qs.toString() ? `?${qs.toString()}` : ''}`;
    return this.http.get<any>(url, { withCredentials: true }).pipe(
      map((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        const page = Number(res?.pagination?.page ?? params?.page ?? 1);
        const limit = Number((res?.pagination?.limit ?? params?.limit ?? list.length) || 0);
        const total = Number(res?.pagination?.total ?? list.length);
        const totalPages = Number(
          res?.pagination?.totalPages ?? (limit > 0 ? Math.ceil(total / limit) : 1),
        );
        return {
          data: list.map((o: any) => this.normalizeOrder(o)),
          pagination: {
            total,
            page,
            limit,
            totalPages,
          },
        };
      }),
      catchError(() =>
        of({
          data: [],
          pagination: {
            total: 0,
            page: Number(params?.page ?? 1),
            limit: Number(params?.limit ?? 20),
            totalPages: 0,
          },
        }),
      ),
    );
  }

  getOrderById(id: string): Observable<Order | null> {
    return this.http.get<any>(`${this.api}/api/orders/${id}`).pipe(
      map((res: any) => {
        const order = res?.data ?? res;
        return order ? this.normalizeOrder(order) : null;
      }),
      catchError(() => of(null)),
    );
  }

  updateOrderStatus(id: string, status: string): Observable<Order> {
    return this.http
      .put<any>(`${this.api}/api/orders/${id}/status`, { status }, this.writeOptions)
      .pipe(map((res: any) => this.normalizeOrder(res?.data ?? res)));
  }

  cancelOrder(id: string): Observable<Order> {
    return this.http
      .patch<any>(`${this.api}/api/orders/${id}/cancel`, {}, this.writeOptions)
      .pipe(map((res: any) => this.normalizeOrder(res?.data ?? res)));
  }

  getMyOrderReviews(orderId: string): Observable<any[]> {
    return this.http
      .get<any>(`${this.api}/api/orders/${orderId}/reviews/me`, {
        withCredentials: true,
      })
      .pipe(
        map((res: any) => {
          const list = Array.isArray(res) ? res : (res?.data ?? []);
          return Array.isArray(list) ? list : [];
        }),
        catchError(() => of([])),
      );
  }

  submitOrderReviews(orderId: string, reviews: ProductReviewInput[]): Observable<any[]> {
    return this.http
      .post<any>(
        `${this.api}/api/orders/${orderId}/reviews`,
        { reviews },
        this.writeOptions,
      )
      .pipe(
        map((res: any) => {
          const list = Array.isArray(res) ? res : (res?.data ?? []);
          return Array.isArray(list) ? list : [];
        }),
      );
  }

  bulkUpdateOrderStatus(orderIds: string[], status: string): Observable<BulkOrderUpdateResult> {
    return this.http
      .patch<any>(
        `${this.api}/api/admin/orders/bulk-status`,
        { orderIds, status },
        this.writeOptions,
      )
      .pipe(
        map((res: any) => ({
          updatedCount: Number(res?.data?.updatedCount ?? 0),
          requested: Number(res?.data?.requested ?? 0),
        })),
      );
  }

  exportAdminOrdersCsv(params?: { status?: string; q?: string }): Observable<Blob> {
    const qs = new URLSearchParams();
    if (params?.status && params.status !== 'all') qs.set('status', params.status);
    if (params?.q?.trim()) qs.set('q', params.q.trim());

    const url = `${this.api}/api/admin/orders/export${qs.toString() ? `?${qs.toString()}` : ''}`;
    return this.http.get(url, { withCredentials: true, responseType: 'blob' });
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
