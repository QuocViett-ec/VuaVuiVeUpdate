import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../core/models/product.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-section">
      <h1>
        <span class="material-symbols-outlined g-icon">package_2</span>
        Quản lý đơn hàng
      </h1>

      <div class="filters">
        <select
          [ngModel]="statusFilter()"
          (ngModelChange)="onFilter($event)"
          class="input filter-status"
        >
          <option value="all">Tất cả trạng thái</option>
          @for (s of statuses; track s.key) {
            <option [value]="s.key">{{ s.label }}</option>
          }
        </select>

        <div class="search-box">
          <input
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            [ngModelOptions]="{ standalone: true }"
            (keyup.enter)="applySearch()"
            type="search"
            placeholder="Tìm mã đơn / tên KH / SĐT..."
            class="input"
          />
          <button class="btn btn-search" (click)="applySearch()">Tìm</button>
          <button class="btn btn-ghost" (click)="clearSearch()">Xóa</button>
        </div>

        <div class="table-meta">
          <span>Hiển thị {{ orders().length }} / {{ total() }} đơn</span>
          <span>Trang {{ page() }} / {{ totalPages() }}</span>
        </div>
      </div>

      @if (error()) {
        <p class="error-text">{{ error() }}</p>
      }

      @if (loading()) {
        <p class="loading-text">Đang tải đơn hàng...</p>
      }

      <div class="table-wrap" [class.dimmed]="loading()">
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
                  <span class="badge" [attr.data-status]="o.status">
                    @switch (o.status) {
                      @case ('pending') {
                        <span class="material-symbols-outlined g-icon">schedule</span> Chờ xác nhận
                      }
                      @case ('confirmed') {
                        <span class="material-symbols-outlined g-icon">check_circle</span> Đã xác
                        nhận
                      }
                      @case ('shipping') {
                        <span class="material-symbols-outlined g-icon">local_shipping</span> Đang
                        giao
                      }
                      @case ('delivered') {
                        <span class="material-symbols-outlined g-icon">inventory_2</span> Đã giao
                      }
                      @case ('cancelled') {
                        <span class="material-symbols-outlined g-icon">cancel</span> Đã hủy
                      }
                      @default {
                        {{ o.status }}
                      }
                    }
                  </span>
                </td>
                <td>
                  <span class="pay-badge" [class.paid]="o.paymentStatus === 'paid'">{{
                    o.paymentStatus === 'paid' ? 'paid' : 'pending'
                  }}</span>
                </td>
                <td>{{ o.createdAt | date: 'dd/MM HH:mm' }}</td>
                <td>
                  <select
                    [ngModel]="o.status"
                    (ngModelChange)="updateStatus(o, $event)"
                    class="input input--xs"
                    [disabled]="isRowUpdating(o.id)"
                  >
                    @for (s of statuses; track s.key) {
                      <option [value]="s.key" [disabled]="!canTransition(o.status, s.key)">
                        {{ s.label }}
                      </option>
                    }
                  </select>
                </td>
              </tr>
            }

            @if (!visibleOrders().length && !loading()) {
              <tr>
                <td colspan="8" class="empty-row">Không có đơn hàng phù hợp bộ lọc.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="pager">
        <button class="btn btn-ghost" [disabled]="page() <= 1" (click)="setPage(page() - 1)">
          Trang trước
        </button>
        <button
          class="btn btn-ghost"
          [disabled]="page() >= totalPages()"
          (click)="setPage(page() + 1)"
        >
          Trang sau
        </button>
      </div>
    </div>
  `,
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent implements OnInit {
  private orderSvc = inject(OrderService);
  private toast = inject(ToastService);
  private router = inject(Router);

  orders = signal<Order[]>([]);
  loading = signal(false);
  error = signal('');
  statusFilter = signal('all');
  search = signal('');
  page = signal(1);
  limit = signal(20);
  total = signal(0);
  totalPages = signal(1);
  private updatingIds = signal(new Set<string>());

  readonly statuses = [
    { key: 'pending', label: 'Chờ xác nhận' },
    { key: 'confirmed', label: 'Đã xác nhận' },
    { key: 'shipping', label: 'Đang giao' },
    { key: 'delivered', label: 'Đã giao' },
    { key: 'cancelled', label: 'Đã hủy' },
  ];

  readonly allowedTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['shipping', 'cancelled'],
    shipping: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  visibleOrders = () => this.orders();

  statusLabel(status: string): string {
    return this.statuses.find((s) => s.key === status)?.label ?? status;
  }

  isRowUpdating(orderId: string): boolean {
    return this.updatingIds().has(orderId);
  }

  canTransition(current: string, next: string): boolean {
    if (current === next) return true;
    return (this.allowedTransitions[current] || []).includes(next);
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  private loadOrders(): void {
    this.loading.set(true);
    this.error.set('');
    this.orderSvc
      .getAdminOrdersPaged({
        status: this.statusFilter(),
        page: this.page(),
        limit: this.limit(),
        q: this.search(),
      })
      .subscribe({
        next: (res) => {
          this.orders.set(res.data);
          this.total.set(res.pagination.total);
          this.totalPages.set(Math.max(1, res.pagination.totalPages || 1));
          this.loading.set(false);
        },
        error: (err) => {
          if (err?.status === 401 || err?.status === 403) {
            this.loading.set(false);
            this.error.set('Phiên quản trị không hợp lệ. Vui lòng đăng nhập lại.');
            this.toast.error('Phiên quản trị đã hết hạn hoặc không đủ quyền.');
            this.router.navigateByUrl('/auth/login?returnUrl=/orders');
            return;
          }
          this.loading.set(false);
          this.error.set(err?.error?.message || 'Không tải được danh sách đơn hàng.');
          this.orders.set([]);
        },
      });
  }

  onFilter(s: string): void {
    this.statusFilter.set(s);
    this.page.set(1);
    this.loadOrders();
  }

  applySearch(): void {
    this.page.set(1);
    this.loadOrders();
  }

  clearSearch(): void {
    if (!this.search().trim()) return;
    this.search.set('');
    this.page.set(1);
    this.loadOrders();
  }

  setPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.page()) return;
    this.page.set(page);
    this.loadOrders();
  }

  updateStatus(order: Order, status: string): void {
    if (this.isRowUpdating(order.id)) return;
    if (!this.canTransition(order.status, status)) {
      this.toast.error('Không thể chuyển trạng thái theo luồng hiện tại.');
      return;
    }

    const updatedIds = new Set(this.updatingIds());
    updatedIds.add(order.id);
    this.updatingIds.set(updatedIds);

    this.orderSvc.updateOrderStatus(order.id, status).subscribe({
      next: (updated) => {
        this.orders.update((list) =>
          list.map((o) => (o.id === order.id ? { ...o, ...updated } : o)),
        );
        this.toast.success(
          `Đã cập nhật ${this.statusLabel(updated.status)}${updated.paymentStatus === 'paid' ? ' - thanh toán Paid' : ''}`,
        );
      },
      error: (err) => {
        if (err?.status === 401 || err?.status === 403) {
          this.toast.error('Phiên quản trị đã hết hạn hoặc không đủ quyền.');
          this.router.navigateByUrl('/auth/login?returnUrl=/orders');
          return;
        }
        this.toast.error(err?.error?.message || 'Lỗi khi cập nhật.');
      },
      complete: () => {
        const next = new Set(this.updatingIds());
        next.delete(order.id);
        this.updatingIds.set(next);
      },
    });
  }
}
