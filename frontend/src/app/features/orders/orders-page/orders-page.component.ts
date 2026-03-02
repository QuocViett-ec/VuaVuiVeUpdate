import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { Order } from '../../../core/models/product.model';

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
      <h1 class="page-title">📦 Đơn hàng của tôi</h1>

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

              <div class="order-foot">
                <span class="total">{{ order.totalAmount | number }}đ</span>
                <span class="pay-badge" [class.paid]="order.paymentStatus === 'paid'">
                  {{ order.paymentStatus === 'paid' ? '💳 Đã thanh toán' : '💵 COD' }}
                </span>
                <a [routerLink]="['/orders', order.id]" class="btn btn--outline btn--sm"
                  >Chi tiết</a
                >
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './orders-page.component.scss',
})
export class OrdersPageComponent implements OnInit {
  private orderSvc = inject(OrderService);
  private auth = inject(AuthService);

  orders = signal<Order[]>([]);
  loading = signal(true);
  selectedStatus = 'all';

  readonly statusList = Object.entries(STATUS_LABELS).map(([key, label]) => ({ key, label }));
  statusLabel(s: string): string {
    return STATUS_LABELS[s] ?? s;
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  onStatusChange(status: string): void {
    this.selectedStatus = status;
    this.loadOrders();
  }

  private loadOrders(): void {
    this.loading.set(true);
    const userId = this.auth.currentUser()?.id;
    this.orderSvc.getOrders({ userId, status: this.selectedStatus }).subscribe((orders) => {
      // Filter by current user phone/email as fallback
      const user = this.auth.currentUser();
      this.orders.set(
        orders.filter(
          (o) =>
            !userId || o.userId === userId || o.phone === user?.phone || o.email === user?.email,
        ),
      );
      this.loading.set(false);
    });
  }
}
