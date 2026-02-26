import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../core/models/product.model';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-section">
      <h1>📦 Quản lý đơn hàng</h1>

      <div class="filters">
        <select [(ngModel)]="statusFilter" (ngModelChange)="onFilter($event)" class="input">
          <option value="all">Tất cả trạng thái</option>
          @for (s of statuses; track s.key) {
            <option [value]="s.key">{{ s.label }}</option>
          }
        </select>
        <input
          [(ngModel)]="search"
          [ngModelOptions]="{ standalone: true }"
          type="search"
          placeholder="Tìm mã đơn / tên KH..."
          class="input"
        />
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>SĐT</th>
              <th>Tổng tiền</th>
              <th>TT đơn</th>
              <th>TT thanh toán</th>
              <th>Ngày</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            @for (o of visibleOrders(); track o.id) {
              <tr>
                <td class="mono">{{ o.id }}</td>
                <td>{{ o.customerName }}</td>
                <td>{{ o.phone }}</td>
                <td>{{ o.totalAmount | number }}đ</td>
                <td>
                  <span class="badge" [attr.data-status]="o.status">{{ o.status }}</span>
                </td>
                <td>
                  <span class="pay-badge" [class.paid]="o.paymentStatus === 'paid'">{{
                    o.paymentStatus
                  }}</span>
                </td>
                <td>{{ o.createdAt | date: 'dd/MM HH:mm' }}</td>
                <td>
                  <select
                    [ngModel]="o.status"
                    (ngModelChange)="updateStatus(o, $event)"
                    class="input input--xs"
                  >
                    @for (s of statuses; track s.key) {
                      <option [value]="s.key">{{ s.label }}</option>
                    }
                  </select>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent implements OnInit {
  private orderSvc = inject(OrderService);
  private toast = inject(ToastService);

  orders = signal<Order[]>([]);
  statusFilter = 'all';
  search = '';

  readonly statuses = [
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'shipping', label: 'Đang giao' },
    { key: 'delivered', label: 'Đã giao' },
    { key: 'cancelled', label: 'Đã hủy' },
  ];

  visibleOrders = () => {
    const q = this.search.toLowerCase();
    return this.orders().filter(
      (o) =>
        (this.statusFilter === 'all' || o.status === this.statusFilter) &&
        (!q || o.id.toLowerCase().includes(q) || (o.customerName ?? '').toLowerCase().includes(q)),
    );
  };

  ngOnInit(): void {
    this.orderSvc.getOrders().subscribe((o) => this.orders.set(o));
  }
  onFilter(s: string): void {
    this.statusFilter = s;
  }

  updateStatus(order: Order, status: string): void {
    this.orderSvc.updateOrderStatus(order.id, status).subscribe({
      next: () => {
        this.toast.success('Đã cập nhật trạng thái!');
        this.orders.update((list) =>
          list.map((o) => (o.id === order.id ? { ...o, status: status as any } : o)),
        );
      },
      error: () => this.toast.error('Lỗi khi cập nhật.'),
    });
  }
}
