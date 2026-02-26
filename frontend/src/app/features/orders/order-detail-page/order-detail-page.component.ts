import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/product.model';

@Component({
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
            <span class="status-badge" [attr.data-status]="order()!.status">{{
              order()!.status
            }}</span>
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
        </div>
      }
    </div>
  `,
  styleUrl: './order-detail-page.component.scss',
})
export class OrderDetailPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private orderSvc = inject(OrderService);
  order = signal<Order | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.orderSvc.getOrderById(id).subscribe((o) => {
      this.order.set(o);
      this.loading.set(false);
    });
  }
}
