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
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { switchMap } from 'rxjs/operators';
import { OrderService } from '../../../core/services/order.service';
import { RealtimeSyncService } from '../../../core/services/realtime-sync.service';
import { Order } from '../../../core/models/product.model';
import { Subscription } from 'rxjs';

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
  imports: [FormsModule, ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private geoSvc = inject(GeolocationService);
  private orderSvc = inject(OrderService);
  private realtime = inject(RealtimeSyncService);
  private realtimeSub?: Subscription;

  readonly user = this.auth.currentUser;

  tab = signal<Tab>('profile');
  ordersPreview = signal<Order[]>([]);
  ordersLoading = signal(false);
  saving = signal(false);
  savingPw = signal(false);
  acctMsg = signal('');
  showOldPw = signal(false);
  showNewPw = signal(false);
  isLocating = signal(false);
  locationError = signal('');

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
        this.ordersPreview.set(orders.slice(0, 5));
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
