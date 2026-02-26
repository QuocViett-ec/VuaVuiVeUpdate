import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="admin-section">
      <h1>👥 Người dùng</h1>
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
              <th>Ngày tạo</th>
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
                  <span class="role-badge" [class.admin]="u.role === 'admin'">{{
                    u.role ?? 'customer'
                  }}</span>
                </td>
                <td>{{ u.createdAt | date: 'dd/MM/yyyy' }}</td>
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
  users = signal<User[]>([]);

  ngOnInit(): void {
    this.http.get<User[]>(`${environment.apiBase}/users`).subscribe((u) => this.users.set(u));
  }
}
