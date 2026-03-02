import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../core/models/product.model';

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
                  🕐 Chờ xác nhận
                }
                @case ('confirmed') {
                  ✅ Đã xác nhận
                }
                @case ('shipping') {
                  🚚 Đang giao hàng
                }
                @case ('delivered') {
                  📦 Đã giao
                }
                @case ('cancelled') {
                  ❌ Đã hủy
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
                {{ order()!.paymentMethod === 'vnpay' ? '🏦 VNPay' : '💵 COD' }}
              </p>
              <p>
                <strong>Trạng thái:</strong>
                {{ order()!.paymentStatus === 'paid' ? '✅ Đã thanh toán' : '⏳ Chưa thanh toán' }}
              </p>
              @if (order()!.paidAt) {
                <p><strong>Thanh toán lúc:</strong> {{ order()!.paidAt | date: 'dd/MM HH:mm' }}</p>
              }
            </section>
          </div>

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
            @if (order()!.status === 'pending' || order()!.status === 'confirmed') {
              <button class="btn btn--danger" (click)="cancelOrder()" [disabled]="cancelling()">
                {{ cancelling() ? 'Đang hủy...' : '✕ Hủy đơn hàng' }}
              </button>
            }
            <button class="btn btn--outline" (click)="reorder()">🔄 Mua lại</button>
            <a routerLink="/orders" class="btn btn--ghost">← Quay lại</a>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './order-detail-page.component.scss' })
export class OrderDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderSvc = inject(OrderService);
  private cartSvc = inject(CartService);
  private toast = inject(ToastService);

  order = signal<Order | null>(null);
  loading = signal(true);
  cancelling = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
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
    this.orderSvc.updateOrderStatus(o.id, 'cancelled').subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.cancelling.set(false);
        this.toast.success('Đơn hàng đã được hủy.');
      },
      error: () => {
        this.cancelling.set(false);
        this.toast.error('Không thể hủy đơn hàng. Vui lòng thử lại.');
      } });
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
          stock: 99 } as any,
        item.quantity,
      );
    });
    this.toast.success(`Đã thêm ${o.items.length} sản phẩm vào giỏ!`);
    this.router.navigate(['/cart']);
  }
}
