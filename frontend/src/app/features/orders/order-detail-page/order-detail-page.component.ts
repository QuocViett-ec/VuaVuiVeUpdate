import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../core/models/product.model';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { Subscription } from 'rxjs';
import { PaymentService } from '../../../core/services/payment.service';
import { firstValueFrom } from 'rxjs';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="container page">
      <a routerLink="/orders" class="back">← Quay lại đơn hàng</a>

      @if (loading()) {
        <div class="skeleton"></div>
      } @else if (!order()) {
        <p class="not-found">Không tìm thấy đơn hàng.</p>
      } @else {
        <div class="order-detail">
          <div class="od-head">
            <div>
              <h1>{{ order()!.id }}</h1>
              <p class="date">{{ order()!.createdAt | date: 'dd/MM/yyyy HH:mm' }}</p>
            </div>
            <span class="status-badge" [attr.data-status]="order()!.status">
              @switch (order()!.status) {
                @case ('pending') {
                  <span class="material-symbols-outlined g-icon">schedule</span> Chờ xác nhận
                }
                @case ('confirmed') {
                  <span class="material-symbols-outlined g-icon">check_circle</span> Đã xác nhận
                }
                @case ('shipping') {
                  <span class="material-symbols-outlined g-icon">local_shipping</span> Đang giao
                  hàng
                }
                @case ('delivered') {
                  <span class="material-symbols-outlined g-icon">inventory_2</span> Đã giao
                }
                @case ('cancelled') {
                  <span class="material-symbols-outlined g-icon">cancel</span> Đã hủy
                }
                @default {
                  {{ order()!.status }}
                }
              }
            </span>
          </div>

          <div class="od-grid">
            <section class="card">
              <h3>Thông tin giao hàng</h3>
              <p><strong>Người nhận:</strong> {{ order()!.customerName }}</p>
              <p><strong>SĐT:</strong> {{ order()!.phone }}</p>
              <p><strong>Email:</strong> {{ order()!.email }}</p>
              <p><strong>Địa chỉ:</strong> {{ order()!.address }}</p>
              @if (order()!.deliverySlot) {
                <p><strong>Khung giờ:</strong> {{ order()!.deliverySlot }}</p>
              }
            </section>

            <section class="card">
              <h3>Thanh toán</h3>
              <p>
                <strong>Phương thức:</strong>
                @switch (order()!.paymentMethod) {
                  @case ('vnpay') {
                    <span class="material-symbols-outlined g-icon">account_balance</span> VNPay
                  }
                  @case ('momo') {
                    <span class="material-symbols-outlined g-icon">smartphone</span> MoMo
                  }
                  @default {
                    <span class="material-symbols-outlined g-icon">payments</span> COD
                  }
                }
              </p>
              <p>
                <strong>Trạng thái:</strong>
                @if (order()!.paymentStatus === 'paid') {
                  <span class="material-symbols-outlined g-icon">check_circle</span> Đã thanh toán
                } @else {
                  <span class="material-symbols-outlined g-icon">hourglass_top</span> Chờ thanh toán
                }
              </p>
              @if (order()!.paidAt) {
                <p><strong>Thanh toán lúc:</strong> {{ order()!.paidAt | date: 'dd/MM HH:mm' }}</p>
              }
              @if (canRetryPayment(order()!)) {
                <p class="pay-note">Nếu thanh toán trước đó lỗi callback, bạn có thể thử lại.</p>
              }
            </section>
          </div>

          <section class="card timeline-card">
            <h3>Tiến trình đơn hàng</h3>
            <div class="timeline">
              @for (step of timelineSteps; track step.key) {
                <div class="timeline-step" [class.done]="isStepDone(step.key)">
                  <span class="dot"></span>
                  <span class="label">{{ step.label }}</span>
                </div>
              }
            </div>
          </section>

          <section class="card items-section">
            <h3>Sản phẩm</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Đơn giá</th>
                  <th>SL</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                @for (item of order()!.items; track item.productId) {
                  <tr>
                    <td>{{ item.productName }}</td>
                    <td>{{ item.price | number }}đ</td>
                    <td>{{ item.quantity }}</td>
                    <td>
                      <strong>{{ item.subtotal | number }}đ</strong>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            <div class="totals">
              <div class="row">
                <span>Tạm tính</span><span>{{ order()!.subtotal | number }}đ</span>
              </div>
              <div class="row">
                <span>Phí giao</span><span>{{ order()!.shippingFee | number }}đ</span>
              </div>
              @if (order()!.discount > 0) {
                <div class="row disc">
                  <span>Giảm giá</span><span>-{{ order()!.discount | number }}đ</span>
                </div>
              }
              <div class="row total">
                <span>Tổng cộng</span><strong>{{ order()!.totalAmount | number }}đ</strong>
              </div>
            </div>
          </section>

          <!-- Action buttons -->
          <div class="od-actions">
            @if (canRetryPayment(order()!)) {
              <button
                class="btn btn--primary"
                [disabled]="retryingPayment()"
                (click)="retryPayment()"
              >
                @if (retryingPayment()) {
                  Đang tạo link...
                } @else {
                  <span class="material-symbols-outlined g-icon">credit_card</span>
                  Thanh toán lại
                }
              </button>
            }
            @if (order()!.status === 'pending' || order()!.status === 'confirmed') {
              <button class="btn btn--danger" (click)="cancelOrder()" [disabled]="cancelling()">
                @if (cancelling()) {
                  Đang hủy...
                } @else {
                  <span class="material-symbols-outlined g-icon">cancel</span>
                  Hủy đơn hàng
                }
              </button>
            }
            <button class="btn btn--outline" (click)="reorder()">
              <span class="material-symbols-outlined g-icon">replay</span>
              Mua lại
            </button>
            <a routerLink="/orders" class="btn btn--ghost">
              <span class="material-symbols-outlined g-icon">arrow_back</span>
              Quay lại
            </a>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './order-detail-page.component.scss',
})
export class OrderDetailPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderSvc = inject(OrderService);
  private cartSvc = inject(CartService);
  private toast = inject(ToastService);
  private realtime = inject(RealtimeSyncService);
  private paymentSvc = inject(PaymentService);
  private realtimeSub?: Subscription;

  order = signal<Order | null>(null);
  loading = signal(true);
  cancelling = signal(false);
  retryingPayment = signal(false);

  readonly timelineSteps = [
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'shipping', label: 'Đang giao' },
    { key: 'delivered', label: 'Đã giao' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loadOrder(id);

    this.realtimeSub = this.realtime.ofType('order.status_updated').subscribe((evt: any) => {
      const payload = evt?.payload || {};
      const incomingOrderId = String(payload.orderId || '');
      const incomingDbId = String(payload.dbId || '');
      if (!incomingOrderId && !incomingDbId) return;
      if (incomingOrderId !== id && incomingDbId !== id) return;
      this.order.update((current) => {
        if (!current) return current;
        return {
          ...current,
          status: (payload.status || current.status) as Order['status'],
          paymentStatus: (payload.paymentStatus || current.paymentStatus) as Order['paymentStatus'],
          updatedAt: payload.updatedAt || current.updatedAt,
        };
      });
    });
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  private loadOrder(id: string): void {
    this.orderSvc.getOrderById(id).subscribe((o) => {
      this.order.set(o);
      this.loading.set(false);
    });
  }

  cancelOrder(): void {
    const o = this.order();
    if (!o) return;
    if (!confirm('Bạn có chắc muốn hủy đơn hàng này?')) return;
    this.cancelling.set(true);
    this.orderSvc.cancelOrder(o.id).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.cancelling.set(false);
        this.toast.success('Đơn hàng đã được hủy.');
      },
      error: () => {
        this.cancelling.set(false);
        this.toast.error('Không thể hủy đơn hàng. Vui lòng thử lại.');
      },
    });
  }

  canRetryPayment(order: Order): boolean {
    const isPendingPayment = String(order.paymentStatus || '') === 'pending';
    const method = String(order.paymentMethod || '');
    return isPendingPayment && (method === 'vnpay' || method === 'momo');
  }

  async retryPayment(): Promise<void> {
    const o = this.order();
    if (!o || !this.canRetryPayment(o)) return;

    this.retryingPayment.set(true);
    try {
      const result = await firstValueFrom(
        this.paymentSvc.createGatewayUrl(o.paymentMethod as 'vnpay' | 'momo', {
          orderId: o.id,
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
      this.retryingPayment.set(false);
    }
  }

  isStepDone(step: string): boolean {
    const status = this.order()?.status || 'pending';
    if (status === 'cancelled') return step === 'pending';
    const rank: Record<string, number> = {
      pending: 0,
      confirmed: 1,
      shipping: 2,
      delivered: 3,
    };
    return rank[step] <= (rank[status] ?? 0);
  }

  reorder(): void {
    const o = this.order();
    if (!o) return;
    o.items.forEach((item) => {
      this.cartSvc.addToCart(
        {
          id: item.productId,
          name: item.productName,
          price: item.price,
          cat: '',
          stock: 99,
        } as any,
        item.quantity,
      );
    });
    this.toast.success(`Đã thêm ${o.items.length} sản phẩm vào giỏ!`);
    this.router.navigate(['/cart']);
  }
}
