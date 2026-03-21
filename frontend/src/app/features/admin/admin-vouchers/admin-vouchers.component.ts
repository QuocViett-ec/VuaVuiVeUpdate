import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/services/toast.service';

type Voucher = {
  _id: string;
  code: string;
  type: 'ship' | 'percent' | 'fixed';
  value: number;
  cap?: number;
  minOrderValue?: number;
  startsAt?: string;
  expiresAt?: string;
  maxUses?: number;
  usedCount?: number;
  isActive: boolean;
  note?: string;
};

@Component({
  selector: 'app-admin-vouchers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="admin-section">
      <div class="section-head">
        <h1>Mã giảm giá</h1>
        <button class="btn btn--primary" (click)="openCreate()">+ Tạo voucher</button>
      </div>

      <div class="toolbar">
        <input
          class="input"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="load()"
          placeholder="Nhập mã voucher..."
        />
        <button class="btn btn--outline" (click)="load()">Tìm</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã</th>
              <th>Loại</th>
              <th>Giá trị</th>
              <th>Điều kiện</th>
              <th>Hiệu lực</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            @for (v of vouchers(); track v._id) {
              <tr>
                <td>
                  <strong>{{ v.code }}</strong>
                </td>
                <td>
                  {{
                    v.type === 'ship' ? 'Freeship' : v.type === 'percent' ? 'Phần trăm' : 'Tiền mặt'
                  }}
                </td>
                <td>
                  {{ v.type === 'percent' ? v.value + '%' : (v.value | number) + 'đ' }}
                </td>
                <td>Min {{ v.minOrderValue || 0 | number }}đ</td>
                <td>
                  <span
                    class="validity"
                    [class.expired]="getValidityStatus(v) === 'expired'"
                    [class.upcoming]="getValidityStatus(v) === 'upcoming'"
                  >
                    {{ getValidityLabel(v) }}
                  </span>
                  <small class="validity-range">
                    {{ v.startsAt ? (v.startsAt | date: 'dd/MM/yyyy') : '-' }} -
                    {{ v.expiresAt ? (v.expiresAt | date: 'dd/MM/yyyy') : '-' }}
                  </small>
                </td>
                <td>
                  <span [class.inactive]="!v.isActive">{{
                    v.isActive ? 'active' : 'inactive'
                  }}</span>
                </td>
                <td class="actions">
                  <button class="btn btn--sm btn--outline" (click)="openEdit(v)">Sửa</button>
                  <button class="btn btn--sm" (click)="toggleActive(v)">
                    {{ v.isActive ? 'Tắt' : 'Bật' }}
                  </button>
                  <button class="btn btn--sm btn--danger" (click)="remove(v)">Xóa</button>
                </td>
              </tr>
            }
            @if (!vouchers().length) {
              <tr>
                <td colspan="7" class="empty-row">Không có voucher.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (showModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal-box" (click)="$event.stopPropagation()">
            <h2>{{ editingId() ? 'Cập nhật' : 'Tạo mới' }} voucher</h2>
            <form class="modal-form" (ngSubmit)="save()">
              <div class="field">
                <label>Mã *</label>
                <input
                  class="input"
                  [(ngModel)]="form.code"
                  name="code"
                  [readonly]="!!editingCode()"
                  required
                />
              </div>

              <div class="row">
                <div class="field">
                  <label>Loại</label>
                  <select class="input" [(ngModel)]="form.type" name="type">
                    <option value="ship">ship</option>
                    <option value="percent">percent</option>
                    <option value="fixed">fixed</option>
                  </select>
                </div>
                <div class="field">
                  <label>Giá trị</label>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [(ngModel)]="form.value"
                    name="value"
                  />
                </div>
              </div>

              <div class="row">
                <div class="field">
                  <label>Đơn tối thiểu</label>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [(ngModel)]="form.minOrderValue"
                    name="minOrderValue"
                  />
                </div>
                <div class="field">
                  <label>Giảm tối đa</label>
                  <input class="input" type="number" min="0" [(ngModel)]="form.cap" name="cap" />
                </div>
              </div>

              <div class="row">
                <div class="field">
                  <label>Ngày bắt đầu</label>
                  <input
                    class="input"
                    type="datetime-local"
                    [(ngModel)]="form.startsAt"
                    name="startsAt"
                  />
                </div>
                <div class="field">
                  <label>Ngày kết thúc</label>
                  <input
                    class="input"
                    type="datetime-local"
                    [(ngModel)]="form.expiresAt"
                    name="expiresAt"
                  />
                </div>
              </div>

              <div class="row">
                <div class="field">
                  <label>Giới hạn lượt dùng</label>
                  <input
                    class="input"
                    type="number"
                    min="0"
                    [(ngModel)]="form.maxUses"
                    name="maxUses"
                  />
                </div>
                <div class="field">
                  <label>Trạng thái</label>
                  <select class="input" [(ngModel)]="form.isActive" name="isActive">
                    <option [ngValue]="true">active</option>
                    <option [ngValue]="false">inactive</option>
                  </select>
                </div>
              </div>

              <div class="field">
                <label>Ghi chú</label>
                <textarea class="input" rows="3" [(ngModel)]="form.note" name="note"></textarea>
              </div>

              <div class="modal-actions">
                <button type="submit" class="btn btn--primary">Lưu</button>
                <button type="button" class="btn" (click)="closeModal()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './admin-vouchers.component.scss',
})
export class AdminVouchersComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  vouchers = signal<Voucher[]>([]);
  search = signal('');
  showModal = signal(false);
  editingId = signal('');
  editingCode = signal('');

  form: Partial<Voucher> = {
    code: '',
    type: 'ship',
    value: 0,
    minOrderValue: 0,
    cap: 0,
    maxUses: 0,
    isActive: true,
    note: '',
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const q = this.search().trim();
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    this.http
      .get<any>(`${environment.apiBase}/api/admin/vouchers${query}`, { withCredentials: true })
      .subscribe({
        next: (res) => this.vouchers.set(Array.isArray(res) ? res : (res?.data ?? [])),
        error: () => {
          this.vouchers.set([]);
          this.toast.error('Không tải được voucher.');
        },
      });
  }

  openCreate(): void {
    this.editingId.set('');
    this.editingCode.set('');
    this.form = {
      code: '',
      type: 'ship',
      value: 0,
      minOrderValue: 0,
      cap: 0,
      maxUses: 0,
      isActive: true,
      note: '',
    };
    this.showModal.set(true);
  }

  openEdit(v: Voucher): void {
    this.editingId.set(v._id);
    this.editingCode.set(
      String(v.code || '')
        .trim()
        .toUpperCase(),
    );
    this.form = {
      ...v,
      startsAt: v.startsAt ? this.toLocalDateTime(v.startsAt) : '',
      expiresAt: v.expiresAt ? this.toLocalDateTime(v.expiresAt) : '',
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingCode.set('');
  }

  save(): void {
    if (!String(this.form.code || '').trim()) {
      this.toast.error('Vui lòng nhập mã voucher.');
      return;
    }

    const payload = {
      ...this.form,
      code: String(this.form.code).trim().toUpperCase(),
      value: Math.max(0, Number(this.form.value || 0)),
      minOrderValue: Math.max(0, Number(this.form.minOrderValue || 0)),
      cap: Math.max(0, Number(this.form.cap || 0)),
      maxUses: Math.max(0, Number(this.form.maxUses || 0)),
    } as any;

    const request$ = this.editingId()
      ? this.http.put(
          `${environment.apiBase}/api/admin/vouchers/${encodeURIComponent(this.editingCode() || String(this.form.code || ''))}`,
          payload,
          { withCredentials: true },
        )
      : this.http.post(`${environment.apiBase}/api/admin/vouchers`, payload, {
          withCredentials: true,
        });

    request$.subscribe({
      next: () => {
        this.toast.success('Đã lưu voucher.');
        this.closeModal();
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Không thể lưu voucher.'),
    });
  }

  toggleActive(v: Voucher): void {
    this.http
      .put(
        `${environment.apiBase}/api/admin/vouchers/${encodeURIComponent(v.code)}`,
        { isActive: !v.isActive },
        { withCredentials: true },
      )
      .subscribe({
        next: () => {
          this.toast.success('Đã cập nhật trạng thái voucher.');
          this.load();
        },
        error: () => this.toast.error('Không thể cập nhật trạng thái voucher.'),
      });
  }

  remove(v: Voucher): void {
    if (!confirm(`Xóa voucher ${v.code}?`)) return;
    this.http
      .delete(`${environment.apiBase}/api/admin/vouchers/${encodeURIComponent(v.code)}`, {
        withCredentials: true,
      })
      .subscribe({
        next: () => {
          this.toast.success('Đã xóa voucher.');
          this.load();
        },
        error: () => this.toast.error('Không thể xóa voucher.'),
      });
  }

  getValidityStatus(v: Voucher): 'upcoming' | 'active' | 'expired' | 'unlimited' {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = this.startOfDay(v.startsAt);
    const end = this.startOfDay(v.expiresAt);

    if (start && now < start) return 'upcoming';
    if (end && now > end) return 'expired';
    if (!start && !end) return 'unlimited';
    return 'active';
  }

  getValidityLabel(v: Voucher): string {
    const status = this.getValidityStatus(v);
    if (status === 'unlimited') return 'Không giới hạn';
    if (status === 'expired') return 'Đã hết hạn';

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = this.startOfDay(v.startsAt);
    const end = this.startOfDay(v.expiresAt);

    if (status === 'upcoming' && start) {
      const daysToStart = this.dayDiff(now, start);
      return daysToStart <= 0 ? 'Bắt đầu hôm nay' : `Bắt đầu sau ${daysToStart} ngày`;
    }

    if (!end) return 'Đang hiệu lực';

    const daysLeft = this.dayDiff(now, end);
    if (daysLeft < 0) return 'Đã hết hạn';
    if (daysLeft === 0) return 'Hết hạn hôm nay';
    return `Còn ${daysLeft} ngày`;
  }

  private startOfDay(value?: string | Date): Date | null {
    if (!value) return null;
    const d = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private dayDiff(from: Date, to: Date): number {
    const ms = to.getTime() - from.getTime();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  private toLocalDateTime(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
