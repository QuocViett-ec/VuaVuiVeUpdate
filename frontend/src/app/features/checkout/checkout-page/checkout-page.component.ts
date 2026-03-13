import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { DeliverySlot, VoucherResult } from '../../../core/models/product.model';
import { environment } from '../../../../environments/environment';
import { switchMap } from 'rxjs/operators';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-checkout-page',
  imports: [RouterLink, FormsModule, DecimalPipe],
  templateUrl: './checkout-page.component.html',
  styleUrl: './checkout-page.component.scss',
})
export class CheckoutPageComponent implements OnInit {
  protected cart = inject(CartService);
  private orderSvc = inject(OrderService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private geoSvc = inject(GeolocationService);

  // Form fields
  name = '';
  phone = '';
  email = '';
  address = '';
  note = '';
  paymentMethod: 'cod' | 'vnpay' | 'momo' = 'cod';
  selectedSlotId = '';
  voucherCode = '';

  slots = signal<DeliverySlot[]>([]);
  voucherResult = signal<VoucherResult | null>(null);
  loading = signal(false);
  isLocating = signal(false);
  locationError = signal('');
  selectedIds = signal<Set<string> | null>(null);

  readonly cartItems = computed(() => {
    const allItems = this.cart.items();
    const selected = this.selectedIds();
    if (!selected || selected.size === 0) return allItems;
    return allItems.filter((item) => selected.has(item.product.id));
  });

  readonly itemCount = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0),
  );

  readonly subtotal = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.product.price * item.quantity, 0),
  );
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

  readonly totalAmount = computed(() =>
    Math.max(0, this.subtotal() + this.shippingFee() - this.discount()),
  );

  ngOnInit(): void {
    const navState = history.state?.selectedIds;
    if (Array.isArray(navState) && navState.length > 0) {
      this.selectedIds.set(new Set(navState.map((id: unknown) => String(id))));
    }

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

  /** Lấy địa chỉ từ GPS + Nominatim reverse geocoding */
  getLocation(): void {
    this.isLocating.set(true);
    this.locationError.set('');
    this.geoSvc
      .getCurrentPosition()
      .pipe(switchMap((coords) => this.geoSvc.reverseGeocode(coords.latitude, coords.longitude)))
      .subscribe({
        next: (addr) => {
          if (addr) {
            this.address = addr;
          } else {
            this.locationError.set('Không thể xác định địa chỉ.');
          }
          this.isLocating.set(false);
        },
        error: (msg: string) => {
          this.locationError.set(msg);
          this.isLocating.set(false);
        },
      });
  }

  async placeOrder(): Promise<void> {
    if (!this.auth.isLoggedIn()) {
      this.toast.error('Vui lòng đăng nhập để đặt hàng.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }
    if (!this.name || !this.phone || !this.address) {
      this.toast.error('Vui lòng điền đầy đủ thông tin giao hàng.');
      return;
    }
    if (this.itemCount() === 0) {
      this.toast.error('Giỏ hàng trống.');
      return;
    }
    // Kiểm tra cart đã có đầy đủ thông tin sản phẩm chưa
    const hasInvalidItem = this.cartItems().some((i) => !i.product.name || !i.product.price);
    if (hasInvalidItem) {
      this.toast.error(
        'Không thể tải thông tin sản phẩm. Vui lòng quay lại trang sản phẩm và thử lại.',
      );
      return;
    }

    this.loading.set(true);
    const items = this.cartItems().map((i) => ({
      productId: i.product.id,
      productName: i.product.name,
      quantity: i.quantity,
      price: i.product.price,
      subtotal: i.product.price * i.quantity,
    }));

    const payload = {
      userId: this.auth.currentUser()?.id,
      items,
      delivery: {
        name: this.name,
        phone: this.phone,
        address: this.address,
        slot: this.selectedSlotId || '',
      },
      payment: { method: this.paymentMethod, status: 'pending' },
      note: this.note,
      subtotal: this.subtotal(),
      shippingFee: this.shippingFee(),
      discount: this.discount(),
      totalAmount: this.totalAmount(),
      voucherCode: this.voucherCode || undefined,
    };

    this.orderSvc.createOrder(payload).subscribe({
      next: async (order) => {
        // Lưu totalAmount TRƯỚC khi clear cart (vì sau clearCart() computed sẽ về 0)
        const amount = order.totalAmount ?? payload.totalAmount ?? 0;
        const orderId = order.orderId ?? order._id ?? '';
        const selected = this.selectedIds();
        if (selected && selected.size > 0) {
          selected.forEach((id) => this.cart.removeFromCart(id));
        } else {
          this.cart.clearCart();
        }
        this.loading.set(false);

        if (this.paymentMethod === 'vnpay') {
          const vnpayUrl = `${environment.paymentApi}/vnpay/create`;
          const body = { amount, orderId };
          try {
            const resp = await fetch(vnpayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (data?.data) {
              window.location.href = data.data;
              return;
            }
            this.toast.warning(
              'Không tạo được link VNPay. Đơn hàng đã lưu, vui lòng thanh toán sau.',
            );
          } catch {
            this.toast.warning('Không kết nối được VNPay. Đơn hàng đã lưu với phương thức COD.');
          }
        } else if (this.paymentMethod === 'momo') {
          const momoUrl = `${environment.paymentApi}/momo/create`;
          const body = { amount, orderId };
          try {
            const resp = await fetch(momoUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(body),
            });
            const data = await resp.json();
            if (data?.payUrl) {
              window.location.href = data.payUrl;
              return;
            }
            this.toast.warning(data?.message || 'Không tạo được link MoMo. Đơn hàng đã lưu.');
          } catch {
            this.toast.warning('Không kết nối được MoMo. Đơn hàng đã lưu.');
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
