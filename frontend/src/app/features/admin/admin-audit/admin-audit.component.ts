import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface AuditEntry {
  id?: string;
  timestamp: string;
  action: string;
  who?: string;
  metadata?: Record<string, any>;
}

const ACTION_LABELS: Record<string, string> = {
  ADMIN_LOGIN: 'Đăng nhập admin',
  ADMIN_LOGOUT: 'Đăng xuất admin',
  UPDATE_USER: 'Cập nhật người dùng',
  DELETE_USER: 'Vô hiệu hóa người dùng',
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  'order.create': 'Tạo đơn hàng',
  'order.update': 'Cập nhật đơn',
  'order.cancel': 'Hủy đơn',
  'product.create': 'Tạo sản phẩm',
  'product.update': 'Cập nhật sản phẩm',
  'product.delete': 'Xóa sản phẩm',
  'profile.update': 'Cập nhật thông tin',
  'password.change': 'Đổi mật khẩu',
  seed: 'Khởi tạo dữ liệu',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-audit.component.html',
  styleUrl: './admin-audit.component.scss',
})
export class AdminAuditComponent implements OnInit {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  allLogs = signal<AuditEntry[]>([]);
  search = signal('');
  categoryFilter = signal('');

  filtered = computed(() => {
    let logs = this.allLogs();
    const q = this.search().toLowerCase();
    const cat = this.categoryFilter();
    if (q)
      logs = logs.filter(
        (l) =>
          (l.who ?? '').toLowerCase().includes(q) || (l.action ?? '').toLowerCase().includes(q),
      );
    if (cat) logs = logs.filter((l) => (l.action ?? '').toLowerCase().includes(cat));
    return logs;
  });

  actionLabel(key: string): string {
    return ACTION_LABELS[key] ?? key;
  }

  metaStr(m?: Record<string, any>): string {
    if (!m) return '—';
    return Object.entries(m)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ');
  }

  ngOnInit(): void {
    this.http
      .get<any>(`${environment.apiBase}/api/users/audit-logs`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          const logs = Array.isArray(res) ? res : (res?.data ?? []);
          const mapped: AuditEntry[] = logs.map((log: any) => ({
            id: String(log?._id ?? ''),
            timestamp: log?.createdAt ?? new Date().toISOString(),
            action: String(log?.action ?? ''),
            who: log?.adminId?.name ?? log?.adminId?.email ?? 'System',
            metadata: log?.details ?? {},
          }));
          this.allLogs.set(mapped);
        },
        error: () => {
          this.allLogs.set([]);
        },
      });
  }

  exportCsv(): void {
    const rows = [
      ['Thời gian', 'Hành động', 'Người thực hiện', 'Chi tiết'],
      ...this.filtered().map((l) => [
        l.timestamp,
        this.actionLabel(l.action),
        l.who ?? 'System',
        this.metaStr(l.metadata),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'audit-log.csv';
    a.click();
  }
}
