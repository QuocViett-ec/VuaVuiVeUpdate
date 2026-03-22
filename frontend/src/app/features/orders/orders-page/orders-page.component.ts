import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService, ProductReviewInput } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { Order } from '../../../core/models/product.model';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { Subscription, firstValueFrom, forkJoin, of } from 'rxjs';
import { PaymentService } from '../../../core/services/payment.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'orange',
  confirmed: 'blue',
  shipping: 'purple',
  delivered: 'green',
  cancelled: 'red',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="container orders-page">
      <h1 class="page-title">
        <span class="material-symbols-outlined g-icon">package_2</span>
        Đơn hàng của tôi
      </h1>

      <div class="filter-row">
        <select
          [(ngModel)]="selectedStatus"
          (ngModelChange)="onStatusChange($event)"
          class="select-input"
        >
          <option value="all">Tất cả trạng thái</option>
          @for (s of statusList; track s.key) {
            <option [value]="s.key">{{ s.label }}</option>
          }
        </select>
      </div>

      @if (loading()) {
        <p class="loading-text">Đang tải...</p>
      } @else if (orders().length === 0) {
        <div class="empty">
          <p>Không có đơn hàng nào.</p>
          <a routerLink="/products" class="btn btn--primary">Mua sắm ngay</a>
        </div>
      } @else {
        <div class="orders-list">
          @for (order of orders(); track order.id) {
            <div class="order-card">
              <div class="order-head">
                <div>
                  <strong>{{ order.id }}</strong>
                  <small>{{ order.createdAt | date: 'dd/MM/yyyy HH:mm' }}</small>
                </div>
                <div class="order-head-right">
                  <a [routerLink]="['/orders', order.id]" class="order-detail-link">Xem chi tiết ></a>
                  <span class="status-badge" [attr.data-status]="order.status">
                    {{ statusLabel(order.status) }}
                  </span>
                </div>
              </div>

              <div class="order-items">
                <div class="order-thumbs">
                  @for (thumb of getOrderItemThumbs(order, 4); track thumb + $index) {
                    <img [src]="thumb" alt="Sản phẩm trong đơn" class="order-thumb" loading="lazy" />
                  }
                </div>
                <span class="order-item-count">{{ order.items.length }} sản phẩm</span>
              </div>

              <div class="order-progress" [attr.data-status]="order.status">
                @for (step of progressSteps; track step.key) {
                  <span class="step" [class.done]="isProgressDone(order.status, step.key)">
                    {{ step.label }}
                  </span>
                }
              </div>

              <div class="order-foot">
                <span class="total">{{ order.totalAmount | number }}đ</span>
                <span class="pay-badge" [class.paid]="order.paymentStatus === 'paid'">
                  @if (order.paymentStatus === 'paid') {
                    <span class="material-symbols-outlined g-icon">credit_card</span> Đã thanh toán
                  } @else {
                    <span class="material-symbols-outlined g-icon">hourglass_top</span> Chờ thanh
                    toán
                  }
                </span>
                <div class="order-actions">
                  <button
                    type="button"
                    class="btn btn--review btn--sm"
                    [disabled]="!canReviewOrder(order)"
                    (click)="onReviewOrder(order)"
                  >
                    {{ hasReviewed(order) ? 'Xem đánh giá' : 'Đánh giá' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    (click)="reorderOrder(order)"
                  >
                    Mua lại đơn
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger btn--sm"
                    [disabled]="!canReturnOrder(order)"
                    (click)="onReturnOrder(order)"
                  >
                    Trả hàng
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }

      @if (reviewModalOpen() && reviewOrder()) {
        <div class="review-modal-backdrop" (click)="closeReviewModal()"></div>
        <section class="review-modal" role="dialog" aria-modal="true" aria-label="Đánh giá sản phẩm">
          <header class="review-modal__head">
            <h3>Đánh giá đơn {{ reviewOrder()!.id }}</h3>
            <button type="button" class="review-close" (click)="closeReviewModal()">Đóng</button>
          </header>

          <div class="review-modal__body">
            @for (item of reviewItems(); track item.productId) {
              <article class="review-item">
                <img [src]="getOrderItemImage(item)" [alt]="item.productName" class="review-item__thumb" />
                <div class="review-item__content">
                  <div class="review-item__top">
                    <div>
                      <div class="review-item__title">{{ item.productName }}</div>
                      <div class="review-item__qty">Số lượng: {{ item.quantity }}</div>
                      <div class="review-item__status">{{ reviewStatusText(item.productId) }}</div>
                    </div>

                    <button
                      type="button"
                      class="btn btn--review btn--sm review-item__submit"
                      [disabled]="!canSubmitProduct(item.productId) || isSubmittingProduct(item.productId)"
                      (click)="submitSingleReview(item)"
                    >
                      @if (isSubmittingProduct(item.productId)) {
                        Đang gửi...
                      } @else if (isReviewedProduct(item.productId)) {
                        Đã đánh giá
                      } @else {
                        Đánh giá
                      }
                    </button>
                  </div>

                  <div class="review-stars" role="group" aria-label="Chọn số sao">
                    @for (star of reviewStars; track star) {
                      <button
                        type="button"
                        class="star-btn"
                        [class.active]="ratingOf(item.productId) >= star"
                        (click)="setRating(item.productId, star)"
                        [attr.aria-label]="'Chọn ' + star + ' sao'"
                      >
                        ★
                      </button>
                    }
                  </div>

                  <textarea
                    class="review-textarea"
                    [value]="commentOf(item.productId)"
                    (input)="setComment(item.productId, $any($event.target).value)"
                    maxlength="500"
                    placeholder="Hãy chia sẻ cảm nhận của bạn về sản phẩm này"
                  ></textarea>
                </div>
              </article>
            }
          </div>

          <footer class="review-modal__foot">
            <button type="button" class="btn btn--outline" (click)="closeReviewModal()">Hủy</button>
          </footer>
        </section>
      }
    </div>
  `,
  styleUrl: './orders-page.component.scss',
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  private orderSvc = inject(OrderService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private cartSvc = inject(CartService);
  private realtime = inject(RealtimeSyncService);
  private paymentSvc = inject(PaymentService);
  private toast = inject(ToastService);
  private productSvc = inject(ProductService);
  private realtimeSub?: Subscription;

  orders = signal<Order[]>([]);
  productImageMap = signal<Record<string, string>>({});
  reviewedOrderIds = signal<Set<string>>(new Set());
  reviewModalOpen = signal(false);
  reviewOrder = signal<Order | null>(null);
  reviewItems = signal<any[]>([]);
  reviewDraft = signal<Record<string, { rating: number; comment: string }>>({});
  reviewedProductIds = signal<Set<string>>(new Set());
  submittingByProduct = signal<Record<string, boolean>>({});
  loading = signal(true);
  retryingOrderId = signal('');
  selectedStatus = 'all';
  readonly fallbackProductImage = '/images/brand/LogoVVV.png';
  readonly reviewStars = [1, 2, 3, 4, 5];
  readonly progressSteps = [
    { key: 'pending', label: 'Cho xac nhan' },
    { key: 'confirmed', label: 'Da xac nhan' },
    { key: 'shipping', label: 'Dang giao' },
    { key: 'delivered', label: 'Da giao' },
  ];

  readonly statusList = Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label }));
  statusLabel(s: string): string {
    return STATUS_LABELS[s] ?? s;
  }

  ngOnInit(): void {
    this.loadOrders();
    this.realtimeSub = this.realtime.ofType('order.status_updated').subscribe((evt: any) => {
      this.applyRealtimeOrderUpdate(evt?.payload || {});
    });
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  onStatusChange(status: string): void {
    this.selectedStatus = status;
    this.loadOrders();
  }

  canRetryPayment(order: Order): boolean {
    const isPendingPayment = String(order.paymentStatus || '') === 'pending';
    const method = String(order.paymentMethod || '');
    return isPendingPayment && (method === 'vnpay' || method === 'momo');
  }

  canReviewOrder(order: Order): boolean {
    return String(order.status || '') === 'delivered';
  }

  hasReviewed(order: Order): boolean {
    return this.reviewedOrderIds().has(String(order.id));
  }

  canReturnOrder(_order: Order): boolean {
    return false;
  }

  onReviewOrder(order: Order): void {
    if (!this.canReviewOrder(order)) return;
    this.openReviewModal(order);
  }

  onReturnOrder(order: Order): void {
    this.toast.info(`Đơn ${order.id} hiện chưa đủ điều kiện trả hàng.`);
  }

  reorderOrder(order: Order): void {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      this.toast.warning('Đơn hàng không có sản phẩm để mua lại.');
      return;
    }

    for (const item of items) {
      this.cartSvc.addToCart(
        {
          id: String(item.productId || ''),
          name: item.productName || 'Sản phẩm',
          price: Number(item.price || 0),
          cat: 'all',
          sub: 'all',
          stock: 99,
          img: this.getOrderItemImage(item),
        },
        Math.max(1, Number(item.quantity || 1)),
      );
    }

    this.toast.success(`Đã thêm lại ${items.length} sản phẩm vào giỏ.`);
    this.router.navigate(['/cart']);
  }

  openReviewModal(order: Order): void {
    this.reviewOrder.set(order);
    this.reviewModalOpen.set(true);
    const reviewItems = this.getUniqueReviewItems(order);
    this.reviewItems.set(reviewItems);
    this.submittingByProduct.set({});
    this.reviewedProductIds.set(new Set());
    const baseDraft: Record<string, { rating: number; comment: string }> = {};
    for (const item of reviewItems) {
      const pid = String(item.productId || '');
      if (!pid) continue;
      baseDraft[pid] = { rating: 0, comment: '' };
    }
    this.reviewDraft.set(baseDraft);

    this.orderSvc.getMyOrderReviews(order.id).subscribe((rows) => {
      const reviewedIds = new Set<string>();
      this.reviewDraft.update((current) => {
        const next = { ...current };
        for (const row of rows || []) {
          const pid = String(row?.productId || '');
          if (!pid || !next[pid]) continue;
          reviewedIds.add(pid);
          next[pid] = {
            rating: Number(row?.rating || 0),
            comment: String(row?.comment || ''),
          };
        }
        return next;
      });
      this.reviewedProductIds.set(reviewedIds);
    });
  }

  closeReviewModal(): void {
    this.reviewModalOpen.set(false);
    this.reviewOrder.set(null);
    this.reviewItems.set([]);
    this.reviewDraft.set({});
    this.reviewedProductIds.set(new Set());
    this.submittingByProduct.set({});
  }

  setRating(productId: string, rating: number): void {
    const pid = String(productId || '');
    if (!pid) return;
    this.reviewDraft.update((draft) => ({
      ...draft,
      [pid]: {
        rating,
        comment: String(draft[pid]?.comment || ''),
      },
    }));
  }

  setComment(productId: string, comment: string): void {
    const pid = String(productId || '');
    if (!pid) return;
    const safe = String(comment || '').slice(0, 500);
    this.reviewDraft.update((draft) => ({
      ...draft,
      [pid]: {
        rating: Number(draft[pid]?.rating || 0),
        comment: safe,
      },
    }));
  }

  ratingOf(productId: string): number {
    return Number(this.reviewDraft()[String(productId || '')]?.rating || 0);
  }

  commentOf(productId: string): string {
    return String(this.reviewDraft()[String(productId || '')]?.comment || '');
  }

  reviewStatusText(productId: string): string {
    if (this.isReviewedProduct(productId)) return 'Đã đánh giá';
    const rating = this.ratingOf(productId);
    if (rating < 1) return 'Chưa có đánh giá';
    return `Đã chọn ${rating} sao`;
  }

  isReviewedProduct(productId: string): boolean {
    return this.reviewedProductIds().has(String(productId || ''));
  }

  canSubmitProduct(productId: string): boolean {
    return !this.isReviewedProduct(productId) && this.ratingOf(productId) >= 1;
  }

  isSubmittingProduct(productId: string): boolean {
    return !!this.submittingByProduct()[String(productId || '')];
  }

  async submitSingleReview(item: any): Promise<void> {
    const order = this.reviewOrder();
    if (!order) return;
    const productId = String(item?.productId || '');
    if (!productId) return;

    if (!this.canSubmitProduct(productId)) {
      this.toast.warning('Vui lòng chọn số sao trước khi gửi đánh giá.');
      return;
    }

    const payload: ProductReviewInput[] = [
      {
        productId,
        rating: this.ratingOf(productId),
        comment: this.commentOf(productId),
      },
    ];

    this.submittingByProduct.update((state) => ({ ...state, [productId]: true }));
    try {
      await firstValueFrom(this.orderSvc.submitOrderReviews(order.id, payload));
      this.reviewedProductIds.update((set) => {
        const next = new Set(set);
        next.add(productId);
        return next;
      });
      this.reviewedOrderIds.update((set) => {
        const next = new Set(set);
        next.add(String(order.id));
        return next;
      });
      this.toast.success('Gửi đánh giá sản phẩm thành công!');
    } catch {
      this.toast.error('Không gửi được đánh giá. Vui lòng thử lại.');
    } finally {
      this.submittingByProduct.update((state) => ({ ...state, [productId]: false }));
    }
  }

  isProgressDone(status: string, step: string): boolean {
    if (status === 'cancelled') return step === 'pending';
    const rank: Record<string, number> = {
      pending: 0,
      confirmed: 1,
      shipping: 2,
      delivered: 3,
    };
    return (rank[step] ?? 0) <= (rank[status] ?? 0);
  }

  async retryPayment(order: Order): Promise<void> {
    if (!this.canRetryPayment(order)) return;
    this.retryingOrderId.set(order.id);

    try {
      const result = await firstValueFrom(
        this.paymentSvc.createGatewayUrl(order.paymentMethod as 'vnpay' | 'momo', {
          orderId: order.id,
        }),
      );

      if (result.paymentUrl) {
        window.location.href = result.paymentUrl;
        return;
      }

      this.toast.warning(result.message || 'Không tạo được link thanh toán. Vui lòng thử lại.');
    } catch {
      this.toast.error('Không thể kết nối cổng thanh toán. Vui lòng thử lại.');
    } finally {
      this.retryingOrderId.set('');
    }
  }

  getOrderItemThumbs(order: Order, limit = 4): string[] {
    const items = Array.isArray(order.items) ? order.items.slice(0, limit) : [];
    return items.map((item) => this.getOrderItemImage(item));
  }

  getOrderItemImage(item: any): string {
    const direct = this.normalizeImage(
      item?.imageUrl || item?.productImage || item?.image || item?.product?.imageUrl || '',
    );
    if (direct) return direct;

    const productId = String(item?.productId || '');
    return this.productImageMap()[productId] || this.fallbackProductImage;
  }

  private getUniqueReviewItems(order: Order): any[] {
    const source = Array.isArray(order.items) ? order.items : [];
    const map = new Map<string, any>();

    for (const item of source) {
      const productId = String(item?.productId || '');
      if (!productId) continue;

      if (!map.has(productId)) {
        map.set(productId, { ...item, quantity: Math.max(1, Number(item?.quantity || 1)) });
        continue;
      }

      const prev = map.get(productId);
      map.set(productId, {
        ...prev,
        quantity: Number(prev?.quantity || 0) + Math.max(1, Number(item?.quantity || 1)),
      });
    }

    return [...map.values()];
  }

  private normalizeImage(raw: string): string {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
      return value;
    }
    return `${environment.apiBase}/${value}`;
  }

  private resolveMissingOrderImages(orders: Order[]): void {
    const currentMap = { ...this.productImageMap() };
    const missingIds = new Set<string>();

    for (const order of orders) {
      for (const item of order.items || []) {
        const id = String(item.productId || '');
        if (!id) continue;

        const direct = this.normalizeImage(
          item.imageUrl || item.productImage || (item as any)?.image || '',
        );
        if (direct) {
          currentMap[id] = direct;
          continue;
        }

        if (!currentMap[id]) {
          missingIds.add(id);
        }
      }
    }

    this.productImageMap.set(currentMap);
    if (!missingIds.size) return;

    const idList = [...missingIds];
    const requests = idList.map((id) =>
      this.productSvc
        .getProductById(id)
        .pipe(catchError(() => of(null))),
    );

    forkJoin(requests).subscribe((products) => {
      this.productImageMap.update((map) => {
        const next = { ...map };
        products.forEach((product, idx) => {
          const id = idList[idx];
          const resolved = this.normalizeImage(product?.img || '');
          if (id && resolved) {
            next[id] = resolved;
          }
        });
        return next;
      });
    });
  }

  private loadOrders(): void {
    this.loading.set(true);
    const userId = this.auth.currentUser()?.id;
    this.orderSvc.getOrders({ userId, status: this.selectedStatus }).subscribe({
      next: (orders) => {
        // Filter by current user phone/email as fallback
        const user = this.auth.currentUser();
        const filtered = orders.filter(
            (o) =>
              !userId || o.userId === userId || o.phone === user?.phone || o.email === user?.email,
          );
        this.orders.set(filtered);
        this.resolveMissingOrderImages(filtered);
        this.prefetchReviewedStatus(filtered);
        this.loading.set(false);
      },
      error: () => {
        // Keep current list to avoid visual data loss on transient auth/network issues.
        this.loading.set(false);
      },
    });
  }

  private applyRealtimeOrderUpdate(payload: any): void {
    const orderId = String(payload?.orderId || '');
    const dbId = String(payload?.dbId || '');
    const status = String(payload?.status || '');
    const paymentStatus = String(payload?.paymentStatus || '');

    if (!orderId && !dbId) return;

    this.orders.update((list) => {
      const next = list
        .map((o) => {
          const isMatch = o.id === orderId || (o.dbId ? o.dbId === dbId : false);
          if (!isMatch) return o;
          return {
            ...o,
            status: (status || o.status) as Order['status'],
            paymentStatus: (paymentStatus || o.paymentStatus) as Order['paymentStatus'],
            updatedAt: payload?.updatedAt || o.updatedAt,
          };
        })
        .filter((o) => this.selectedStatus === 'all' || o.status === this.selectedStatus);

      return next;
    });
  }

  private prefetchReviewedStatus(orders: Order[]): void {
    const delivered = orders.filter((o) => this.canReviewOrder(o));
    if (!delivered.length) {
      this.reviewedOrderIds.set(new Set());
      return;
    }

    const tasks = delivered.map((o) =>
      this.orderSvc.getMyOrderReviews(o.id).pipe(catchError(() => of([]))),
    );

    forkJoin(tasks).subscribe((all) => {
      const set = new Set<string>();
      all.forEach((rows, idx) => {
        if (Array.isArray(rows) && rows.length > 0) {
          set.add(String(delivered[idx].id));
        }
      });
      this.reviewedOrderIds.set(set);
    });
  }
}
