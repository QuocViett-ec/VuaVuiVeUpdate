import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { User } from '../../../core/models/user.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-section">
      <h1>
        <span class="material-symbols-outlined g-icon">group</span>
        Người dùng
      </h1>

      <div class="toolbar">
        <input
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keyup.enter)="loadUsers()"
          class="input"
          type="search"
          placeholder="Tìm tên / email / SĐT"
        />
        <button class="btn btn--outline btn--sm" (click)="loadUsers()">Tìm</button>
        <button class="btn btn--ghost btn--sm" (click)="clearSearch()">Xóa</button>
        <button class="btn btn--ghost btn--sm" (click)="exportCsv()">Export CSV</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tên</th>
              <th>SĐT</th>
              <th>Email</th>
              <th>Địa chỉ</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id; let i = $index) {
              <tr>
                <td>{{ i + 1 }}</td>
                <td>
                  <strong>{{ u.name }}</strong>
                </td>
                <td>{{ u.phone }}</td>
                <td>{{ u.email }}</td>
                <td class="address">{{ u.address }}</td>
                <td>
                  <select
                    class="input input--xs"
                    [disabled]="isRowUpdating(u.id)"
                    [ngModel]="u.role ?? 'user'"
                    (ngModelChange)="updateRole(u, $event)"
                  >
                    <option value="user">user</option>
                    <option value="staff">staff</option>
                    <option value="audit">audit</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>
                  <span class="status-badge" [class.inactive]="u.isActive === false">
                    {{ u.isActive === false ? 'inactive' : 'active' }}
                  </span>
                </td>
                <td>{{ u.createdAt | date: 'dd/MM/yyyy' }}</td>
                <td>
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    [disabled]="isRowUpdating(u.id)"
                    (click)="toggleActive(u)"
                  >
                    {{ u.isActive === false ? 'Mở lại' : 'Khóa' }}
                  </button>
                </td>
              </tr>
            }

            @if (!users().length) {
              <tr>
                <td colspan="9" class="empty-row">Không có người dùng phù hợp.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  users = signal<User[]>([]);
  search = signal('');
  private updatingIds = signal(new Set<string>());

  private readonly writeOptions = {
    withCredentials: true,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  };

  isRowUpdating(id: string): boolean {
    return this.updatingIds().has(id);
  }

  private normalizeUser(raw: any): User {
    return {
      ...raw,
      id: String(raw?.id || raw?._id || ''),
      role: raw?.role || 'user',
      isActive: raw?.isActive !== false,
      createdAt: raw?.createdAt,
    };
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  clearSearch(): void {
    this.search.set('');
    this.loadUsers();
  }

  loadUsers(): void {
    const q = this.search().trim();
    const query = q ? `?search=${encodeURIComponent(q)}` : '';
    this.http
      .get<any>(`${environment.apiBase}/api/users/users${query}`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res) ? res : (res?.data ?? []);
          this.users.set(list.map((u: any) => this.normalizeUser(u)));
        },
        error: () => {
          this.users.set([]);
          this.toast.error('Không tải được danh sách người dùng.');
        },
      });
  }

  updateRole(user: User, role: 'user' | 'admin' | 'staff' | 'audit'): void {
    if (!user?.id || role === user.role) return;
    this.setUpdating(user.id, true);

    this.http
      .put<any>(`${environment.apiBase}/api/users/users/${user.id}`, { role }, this.writeOptions)
      .subscribe({
        next: () => {
          this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, role } : u)));
          this.toast.success('Đã cập nhật vai trò.');
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Không cập nhật được vai trò.');
        },
        complete: () => this.setUpdating(user.id, false),
      });
  }

  exportCsv(): void {
    const q = this.search().trim();
    const query = q ? `?search=${encodeURIComponent(q)}` : '';
    this.http
      .get(`${environment.apiBase}/api/admin/users/export${query}`, {
        withCredentials: true,
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `users-${Date.now()}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          this.toast.success('Đã xuất CSV người dùng.');
        },
        error: () => this.toast.error('Không thể xuất CSV người dùng.'),
      });
  }

  toggleActive(user: User): void {
    if (!user?.id) return;
    const nextActive = user.isActive === false;
    this.setUpdating(user.id, true);

    this.http
      .put<any>(
        `${environment.apiBase}/api/users/users/${user.id}`,
        { isActive: nextActive },
        this.writeOptions,
      )
      .subscribe({
        next: () => {
          this.users.update((list) =>
            list.map((u) => (u.id === user.id ? { ...u, isActive: nextActive } : u)),
          );
          this.toast.success(nextActive ? 'Đã mở lại tài khoản.' : 'Đã khóa tài khoản.');
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Không cập nhật được trạng thái tài khoản.');
        },
        complete: () => this.setUpdating(user.id, false),
      });
  }

  private setUpdating(id: string, isUpdating: boolean): void {
    const set = new Set(this.updatingIds());
    if (isUpdating) set.add(id);
    else set.delete(id);
    this.updatingIds.set(set);
  }
}
