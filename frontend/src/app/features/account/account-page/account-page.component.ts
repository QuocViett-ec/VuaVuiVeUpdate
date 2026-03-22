import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { switchMap } from 'rxjs/operators';
import { OrderService } from '../../../core/services/order.service';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { Order } from '../../../core/models/product.model';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CartService } from '../../../core/services/cart.service';
import { ProductService } from '../../../core/services/product.service';
import { environment } from '../../../../environments/environment';

type Tab = 'profile' | 'orders' | 'security';

// ── Custom Validators ─────────────────────────────────────────────────────────

/** Mật khẩu mạnh: ≥8 ký tự, ít nhất 1 chữ hoa, ít nhất 1 chữ số. */
function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value || '';
  if (v.length < 8) return { tooShort: true };
  if (!/[A-Z]/.test(v)) return { noUppercase: true };
  if (!/[0-9]/.test(v)) return { noNumber: true };
  return null;
}

/** Group validator: newPassword và confirmNew phải giống nhau */
function confirmNewMatchValidator(group: AbstractControl): ValidationErrors | null {
  const nw = group.get('newPassword')?.value;
  const conf = group.get('confirmNew')?.value;
  if (!conf) return null;
  return nw === conf ? null : { confirmMismatch: true };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-account-page',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private geoSvc = inject(GeolocationService);
  private orderSvc = inject(OrderService);
  private productSvc = inject(ProductService);
  private cartSvc = inject(CartService);
  private realtime = inject(RealtimeSyncService);
  private realtimeSub?: Subscription;

  readonly user = this.auth.currentUser;

  tab = signal<Tab>('profile');
  ordersPreview = signal<Order[]>([]);
  productImageMap = signal<Record<string, string>>({});
  ordersLoading = signal(false);
  saving = signal(false);
  savingPw = signal(false);
  acctMsg = signal('');
  showOldPw = signal(false);
  showNewPw = signal(false);
  isLocating = signal(false);
  locationError = signal('');
  readonly fallbackProductImage = '/images/brand/LogoVVV.png';

  // ── Profile form (Template-Driven) ────────────────────────────────────────
  editName = '';
  editAddress = '';

  // ── Password form (Reactive Forms + Custom Validators) ───────────────────
  passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, strongPasswordValidator]],
      confirmNew: ['', Validators.required],
    },
    { validators: confirmNewMatchValidator },
  );

  get pf() {
    return this.passwordForm.controls;
  }

  isPwInvalid(field: string): boolean {
    const c = this.pf[field];
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  ngOnInit(): void {
    const u = this.user();
    this.editName = u?.name ?? '';
    this.editAddress = u?.address ?? '';

    this.realtimeSub = this.realtime.ofType('order.status_updated').subscribe((evt: any) => {
      if (this.tab() === 'orders') {
        // Keep the preview synced without forcing a full reload request.
        // This avoids wiping the list if there is a transient auth/session issue.
        this.applyRealtimePreviewUpdate(evt?.payload || {});
      }
    });
  }

  ngOnDestroy(): void {
    this.realtimeSub?.unsubscribe();
  }

  setTab(nextTab: Tab): void {
    this.tab.set(nextTab);
    if (nextTab === 'orders') {
      this.loadOrdersPreview();
    }
  }

  orderStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    };
    return labels[status] ?? status;
  }

  private loadOrdersPreview(): void {
    this.ordersLoading.set(true);
    this.orderSvc.getMyOrders().subscribe({
      next: (orders) => {
        const sorted = [...orders].sort((a, b) => {
          const tA = new Date(a.createdAt || 0).getTime();
          const tB = new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });
        this.ordersPreview.set(sorted);
        this.resolveMissingOrderImages(sorted);
        this.ordersLoading.set(false);
      },
      error: () => {
        // Preserve existing preview data to avoid blank state on transient failures.
        this.ordersLoading.set(false);
      },
    });
  }

  private applyRealtimePreviewUpdate(payload: any): void {
    const orderId = String(payload?.orderId || '');
    const dbId = String(payload?.dbId || '');
    const status = String(payload?.status || '');
    const paymentStatus = String(payload?.paymentStatus || '');
    if (!orderId && !dbId) return;

    this.ordersPreview.update((list) =>
      list.map((o) => {
        const isMatch = o.id === orderId || (o.dbId ? o.dbId === dbId : false);
        if (!isMatch) return o;
        return {
          ...o,
          status: (status || o.status) as Order['status'],
          paymentStatus: (paymentStatus || o.paymentStatus) as Order['paymentStatus'],
          updatedAt: payload?.updatedAt || o.updatedAt,
        };
      }),
    );
  }

  canReviewOrder(order: Order): boolean {
    return String(order.status || '') === 'delivered';
  }

  canReturnOrder(_order: Order): boolean {
    return false;
  }

  onReviewOrder(order: Order): void {
    if (!this.canReviewOrder(order)) return;
    this.toast.info('Tính năng đánh giá sẽ được bật ở bản cập nhật tiếp theo.');
  }

  onReturnOrder(_order: Order): void {
    this.toast.info('Tính năng trả hàng hiện chưa khả dụng.');
  }

  reorderOrder(order: Order): void {
    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      this.toast.warning('Đơn hàng không có sản phẩm để mua lại.');
      return;
    }

    for (const item of items) {
      this.cartSvc.addToCart(
        {
          id: String(item.productId || ''),
          name: item.productName || 'Sản phẩm',
          price: Number(item.price || 0),
          cat: 'all',
          sub: 'all',
          stock: 99,
          img: this.getOrderItemImage(item),
        },
        Math.max(1, Number(item.quantity || 1)),
      );
    }

    this.toast.success(`Đã thêm lại ${items.length} sản phẩm từ đơn ${order.id} vào giỏ.`);
    this.router.navigate(['/cart']);
  }

  getOrderItemThumbs(order: Order, limit = 4): string[] {
    const items = Array.isArray(order.items) ? order.items.slice(0, limit) : [];
    return items.map((item) => this.getOrderItemImage(item));
  }

  private getOrderItemImage(item: any): string {
    const itemImage = this.normalizeImage(
      item?.imageUrl || item?.productImage || item?.image || item?.product?.imageUrl || '',
    );
    if (itemImage) return itemImage;

    const productId = String(item?.productId || '');
    const byMap = this.productImageMap()[productId];
    return byMap || this.fallbackProductImage;
  }

  private normalizeImage(raw: string): string {
    const value = String(raw || '').trim();
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) {
      return value;
    }
    return `${environment.apiBase}/${value}`;
  }

  private resolveMissingOrderImages(orders: Order[]): void {
    const currentMap = { ...this.productImageMap() };
    const missingIds = new Set<string>();

    for (const order of orders) {
      for (const item of order.items || []) {
        const id = String(item.productId || '');
        if (!id) continue;

        const direct = this.normalizeImage(
          item.imageUrl || item.productImage || (item as any)?.image || '',
        );
        if (direct) {
          currentMap[id] = direct;
          continue;
        }

        if (!currentMap[id]) {
          missingIds.add(id);
        }
      }
    }

    this.productImageMap.set(currentMap);

    if (!missingIds.size) return;

    const idList = [...missingIds];
    const requests = idList.map((id) =>
      this.productSvc
        .getProductById(id)
        .pipe(catchError(() => of(null))),
    );

    forkJoin(requests).subscribe((products) => {
      this.productImageMap.update((map) => {
        const next = { ...map };
        products.forEach((product, idx) => {
          const id = idList[idx];
          const resolved = this.normalizeImage(product?.img || '');
          if (id && resolved) {
            next[id] = resolved;
          }
        });
        return next;
      });
    });
  }

  async saveProfile(): Promise<void> {
    this.saving.set(true);
    this.acctMsg.set('');
    const r = await this.auth.updateProfile({ name: this.editName, address: this.editAddress });
    this.saving.set(false);
    this.acctMsg.set(r.ok ? 'Đã lưu thông tin!' : (r.message ?? 'Lỗi khi lưu.'));
    if (r.ok) this.toast.success('Đã cập nhật thông tin!');
  }

  /** Lấy địa chỉ từ GPS + Nominatim reverse geocoding */
  getLocation(): void {
    this.isLocating.set(true);
    this.locationError.set('');
    this.geoSvc
      .getCurrentPosition()
      .pipe(switchMap((coords) => this.geoSvc.reverseGeocode(coords.latitude, coords.longitude)))
      .subscribe({
        next: (address) => {
          if (address) {
            this.editAddress = address;
            this.toast.success('Đã lấy địa chỉ từ vị trí hiện tại!');
          } else {
            this.locationError.set('Không thể xác định địa chỉ từ vị trí.');
          }
          this.isLocating.set(false);
        },
        error: (msg: string) => {
          this.locationError.set(msg);
          this.isLocating.set(false);
        },
      });
  }

  async changePassword(): Promise<void> {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;

    this.savingPw.set(true);
    const { currentPassword, newPassword } = this.passwordForm.value;
    const r = await this.auth.changePassword({ currentPassword, newPassword });
    this.savingPw.set(false);
    if (r.ok) {
      this.toast.success('Đổi mật khẩu thành công!');
      this.passwordForm.reset();
    } else {
      this.pf['currentPassword'].setErrors({ serverError: r.message ?? 'Lỗi.' });
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
