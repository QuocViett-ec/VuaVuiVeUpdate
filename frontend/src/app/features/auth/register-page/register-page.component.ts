import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">🛒 Vựa Vui Vẻ</div>
        <h1 class="auth-title">Đăng ký tài khoản</h1>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="field">
            <label>Họ và tên <span class="required">*</span></label>
            <input
              [(ngModel)]="name"
              name="name"
              type="text"
              placeholder="Nguyễn Văn A"
              class="input"
              required
            />
          </div>
          <div class="field">
            <label>Số điện thoại <span class="required">*</span></label>
            <input
              [(ngModel)]="phone"
              name="phone"
              type="tel"
              placeholder="0912345678"
              class="input"
              required
            />
          </div>
          <div class="field">
            <label>Email (tùy chọn)</label>
            <input
              [(ngModel)]="email"
              name="email"
              type="email"
              placeholder="example@gmail.com"
              class="input"
            />
          </div>
          <div class="field">
            <label>Địa chỉ (tùy chọn)</label>
            <input
              [(ngModel)]="address"
              name="address"
              type="text"
              placeholder="Số nhà, đường, phường, quận"
              class="input"
            />
          </div>
          <div class="field">
            <label>Mật khẩu <span class="required">*</span></label>
            <div class="input-pw">
              <input
                [(ngModel)]="password"
                name="password"
                [type]="showPw ? 'text' : 'password'"
                placeholder="Ít nhất 6 ký tự"
                class="input"
                required
              />
              <button type="button" class="toggle-pw" (click)="showPw = !showPw">
                {{ showPw ? '🙈' : '👁' }}
              </button>
            </div>
          </div>

          @if (error()) {
            <p class="error-msg">{{ error() }}</p>
          }

          <button type="submit" class="btn btn--primary btn--full" [disabled]="loading()">
            {{ loading() ? 'Đang xử lý...' : 'Đăng ký' }}
          </button>
        </form>

        <p class="auth-links">Đã có tài khoản? <a routerLink="/auth/login">Đăng nhập</a></p>
      </div>
    </div>
  `,
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  name = '';
  phone = '';
  email = '';
  password = '';
  address = '';
  showPw = false;
  loading = signal(false);
  error = signal('');

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const result = await this.auth.register({
      name: this.name,
      phone: this.phone,
      email: this.email,
      password: this.password,
      address: this.address,
    });
    this.loading.set(false);
    if (result.ok) {
      this.toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      this.router.navigate(['/auth/login']);
    } else {
      this.error.set(result.message || 'Đăng ký thất bại.');
    }
  }
}
