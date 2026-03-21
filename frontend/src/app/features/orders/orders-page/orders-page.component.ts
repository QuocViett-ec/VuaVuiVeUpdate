import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { Order } from '../../../core/models/product.model';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { Subscription } from 'rxjs';
import { PaymentService } from '../../../core/services/payment.service';
import { ToastService } from '../../../core/services/toast.service';
import { firstValueFrom } from 'rxjs';

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
                <span class="status-badge" [attr.data-status]="order.status">
                  {{ statusLabel(order.status) }}
                </span>
              </div>

              <div class="order-items">
                @for (item of order.items; track item.productId; let last = $last) {
                  <span class="item-chip">{{ item.productName }} ×{{ item.quantity }}</span>
                  @if (!last) {
                    <span>·</span>
                  }
                }
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
                <a [routerLink]="['/orders', order.id]" class="btn btn--outline btn--sm"
                  >Chi tiết</a
                >
                @if (canRetryPayment(order)) {
                  <button
                    type="button"
                    class="btn btn--primary btn--sm"
                    [disabled]="retryingOrderId() === order.id"
                    (click)="retryPayment(order)"
                  >
                    @if (retryingOrderId() === order.id) {
                      Đang tạo link...
                    } @else {
                      Thanh toán lại
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './orders-page.component.scss',
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  private orderSvc = inject(OrderService);
  private auth = inject(AuthService);
  private realtime = inject(RealtimeSyncService);
  private paymentSvc = inject(PaymentService);
  private toast = inject(ToastService);
  private realtimeSub?: Subscription;

  orders = signal<Order[]>([]);
  loading = signal(true);
  retryingOrderId = signal('');
  selectedStatus = 'all';
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

  private loadOrders(): void {
    this.loading.set(true);
    const userId = this.auth.currentUser()?.id;
    this.orderSvc.getOrders({ userId, status: this.selectedStatus }).subscribe({
      next: (orders) => {
        // Filter by current user phone/email as fallback
        const user = this.auth.currentUser();
        this.orders.set(
          orders.filter(
            (o) =>
              !userId || o.userId === userId || o.phone === user?.phone || o.email === user?.email,
          ),
        );
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
}
