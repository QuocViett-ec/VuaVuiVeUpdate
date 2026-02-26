import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { DeliverySlot, VoucherResult } from '../../../core/models/product.model';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
})
export class CheckoutPageComponent implements OnInit {
  protected cart = inject(CartService);
  private orderSvc = inject(OrderService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  // Form fields
  name = '';
  phone = '';
  email = '';
  address = '';
  note = '';
  paymentMethod: 'cod' | 'vnpay' = 'cod';
  selectedSlotId = '';
  voucherCode = '';

  slots = signal<DeliverySlot[]>([]);
  voucherResult = signal<VoucherResult | null>(null);
  loading = signal(false);

  readonly cartItems = this.cart.items;
  readonly subtotal = this.cart.subtotal;
  readonly shippingFee = computed(() =>
    this.orderSvc.calcShippingFee(this.address, this.subtotal()),
  );

  readonly discount = computed(() => {
    const v = this.voucherResult();
    if (!v?.ok) return 0;
    if (v.type === 'ship') return this.shippingFee();
    if (v.type === 'percent') {
      const val = Math.round((this.subtotal() * v.value!) / 100);
      return v.cap ? Math.min(val, v.cap) : val;
    }
    return v.value ?? 0;
  });

  readonly totalAmount = computed(() => this.subtotal() + this.shippingFee() - this.discount());

  ngOnInit(): void {
    this.slots.set(this.orderSvc.getDeliverySlots());
    const user = this.auth.currentUser();
    if (user) {
      this.name = user.name;
      this.phone = user.phone;
      this.email = user.email;
      this.address = user.address ?? '';
    }
  }

  applyVoucher(): void {
    const result = this.orderSvc.applyVoucher(
      this.voucherCode,
      this.subtotal(),
      this.shippingFee(),
    );
    this.voucherResult.set(result);
    result.ok ? this.toast.success(result.message) : this.toast.error(result.message);
  }

  async placeOrder(): Promise<void> {
    if (!this.name || !this.phone || !this.address) {
      this.toast.error('Vui lòng điền đầy đủ thông tin giao hàng.');
      return;
    }
    if (this.cart.itemCount() === 0) {
      this.toast.error('Giỏ hàng trống.');
      return;
    }

    this.loading.set(true);
    const items = this.cart.items().map((i) => ({
      productId: i.product.id,
      productName: i.product.name,
      quantity: i.quantity,
      price: i.product.price,
      subtotal: i.product.price * i.quantity,
    }));

    const payload = {
      id: this.orderSvc.generateOrderId(),
      userId: this.auth.currentUser()?.id,
      customerName: this.name,
      email: this.email,
      phone: this.phone,
      address: this.address,
      note: this.note,
      items,
      subtotal: this.subtotal(),
      shippingFee: this.shippingFee(),
      discount: this.discount(),
      totalAmount: this.totalAmount(),
      voucherCode: this.voucherCode || undefined,
      deliverySlot: this.selectedSlotId || undefined,
      paymentMethod: this.paymentMethod,
      paymentStatus: 'unpaid' as const,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    this.orderSvc.createOrder(payload).subscribe({
      next: async (order) => {
        this.cart.clearCart();
        this.loading.set(false);

        if (this.paymentMethod === 'vnpay') {
          // Redirect to VNPay
          const vnpayUrl = `${environment.vnpayApi}/order/create_payment_url`;
          const body = {
            amount: order.totalAmount,
            orderId: order.id,
            orderInfo: `Thanh toan don hang ${order.id}`,
          };
          try {
            const res = await fetch(vnpayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.url) {
              window.location.href = data.url;
              return;
            }
          } catch {
            this.toast.warning('Không kết nối được VNPay. Đơn hàng đã lưu COD.');
          }
        }

        this.toast.success('Đặt hàng thành công! 🎉');
        this.router.navigate(['/orders']);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Đặt hàng thất bại. Vui lòng thử lại.');
      },
    });
  }
}
