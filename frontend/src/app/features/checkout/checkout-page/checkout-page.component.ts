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
import { switchMap } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { PaymentService } from '../../../core/services/payment.service';

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
  private paymentSvc = inject(PaymentService);

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
  slotError = signal('');
  selectedIds = signal<Set<string> | null>(null);

  readonly stockIssues = computed(() =>
    this.cartItems()
      .filter((item) => {
        const stock = Math.max(0, Number(item.product.stock ?? 0));
        return stock <= 0 || item.quantity > stock;
      })
      .map((item) => {
        const stock = Math.max(0, Number(item.product.stock ?? 0));
        return {
          id: item.product.id,
          name: item.product.name,
          requested: item.quantity,
          stock,
        };
      }),
  );

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

    const nextSlots = this.orderSvc.getDeliverySlots();
    this.slots.set(nextSlots);
    this.selectedSlotId = nextSlots[0]?.id || '';
    const user = this.auth.currentUser();
    if (user) {
      this.name = user.name;
      this.phone = user.phone;
      this.email = user.email;
      this.address = user.address ?? '';
    }
  }

  applyVoucher(): void {
    this.orderSvc
      .applyVoucher(this.voucherCode, this.subtotal(), this.shippingFee())
      .subscribe((result) => {
        this.voucherResult.set(result);
        if (result.ok) {
          this.toast.success(result.message);
          if (result.warning) this.toast.warning(result.warning);
        } else {
          this.toast.error(result.message);
        }
      });
  }

  clearVoucher(): void {
    this.voucherCode = '';
    this.voucherResult.set(null);
  }

  onVoucherCodeChange(value: string): void {
    this.voucherCode = value;
    this.voucherResult.set(null);
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
    this.slotError.set('');

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

    if (this.stockIssues().length > 0) {
      const first = this.stockIssues()[0];
      this.toast.error(
        `Sản phẩm ${first.name} chỉ còn ${first.stock}. Vui lòng cập nhật giỏ hàng.`,
      );
      return;
    }

    if (!this.selectedSlotId) {
      this.slotError.set('Vui lòng chọn khung giờ giao hàng.');
      this.toast.error('Vui lòng chọn khung giờ giao hàng.');
      return;
    }

    if (!this.slots().some((slot) => slot.id === this.selectedSlotId)) {
      this.slotError.set('Khung giờ đã chọn không còn hợp lệ. Vui lòng chọn lại.');
      this.toast.error('Khung giờ đã chọn không còn hợp lệ. Vui lòng chọn lại.');
      return;
    }

    const objectIdRegex = /^[a-f\d]{24}$/i;
    const invalidItem = this.cartItems().find(
      (i) => !i.product.name || !i.product.price || !objectIdRegex.test(String(i.product.id || '')),
    );
    if (invalidItem) {
      this.toast.error(
        'Giỏ hàng có sản phẩm không hợp lệ. Vui lòng cập nhật giỏ hàng rồi thử lại.',
      );
      return;
    }

    this.loading.set(true);
    try {
      const items = this.cartItems().map((i) => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        price: i.product.price,
        subtotal: i.product.price * i.quantity,
      }));

      const payload = {
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

      const order = await firstValueFrom(this.orderSvc.createOrder(payload));
      const orderId = String(order?.orderId ?? order?._id ?? '').trim();
      if (!orderId) {
        throw new Error('ORDER_ID_MISSING');
      }

      const selected = this.selectedIds();
      if (selected && selected.size > 0) {
        selected.forEach((id) => this.cart.removeFromCart(id));
      } else {
        this.cart.clearCart();
      }

      if (this.paymentMethod === 'vnpay') {
        try {
          const result = await firstValueFrom(
            this.paymentSvc.createGatewayUrl('vnpay', { orderId }),
          );
          if (result.paymentUrl) {
            window.location.href = result.paymentUrl;
            return;
          }
          this.toast.warning(
            result.message ||
              'Không tạo được link VNPay. Đơn hàng đã lưu, vui lòng thanh toán sau.',
          );
        } catch {
          this.toast.warning('Không kết nối được VNPay. Đơn hàng đã lưu với phương thức COD.');
        }
      } else if (this.paymentMethod === 'momo') {
        try {
          const result = await firstValueFrom(
            this.paymentSvc.createGatewayUrl('momo', { orderId }),
          );
          if (result.paymentUrl) {
            window.location.href = result.paymentUrl;
            return;
          }
          this.toast.warning(result.message || 'Không tạo được link MoMo. Đơn hàng đã lưu.');
        } catch {
          this.toast.warning('Không kết nối được MoMo. Đơn hàng đã lưu.');
        }
      }

      this.toast.success('Đặt hàng thành công! 🎉');
      this.router.navigate(['/orders']);
    } catch (err: any) {
      const backendMessage = String(err?.error?.message || '');
      this.toast.error(
        backendMessage || 'Đặt hàng thất bại. Vui lòng đăng nhập lại hoặc thử lại sau.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
