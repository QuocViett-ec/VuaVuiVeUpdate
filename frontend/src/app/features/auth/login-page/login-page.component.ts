import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">🛒 Vựa Vui Vẻ</div>
        <h1 class="auth-title">Đăng nhập</h1>

        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="field">
            <label>Số điện thoại / Email</label>
            <input
              [(ngModel)]="credential"
              name="credential"
              type="text"
              placeholder="0912345678 hoặc email"
              class="input"
              required
            />
          </div>
          <div class="field">
            <label>Mật khẩu</label>
            <div class="input-pw">
              <input
                [(ngModel)]="password"
                name="password"
                [type]="showPw ? 'text' : 'password'"
                placeholder="Mật khẩu"
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
            {{ loading() ? 'Đang đăng nhập...' : 'Đăng nhập' }}
          </button>
        </form>

        <div class="auth-links">
          <a routerLink="/auth/forgot-password">Quên mật khẩu?</a>
          <span>·</span>
          <span>Chưa có tài khoản? <a routerLink="/auth/register">Đăng ký ngay</a></span>
        </div>
      </div>
    </div>
  `,
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  credential = '';
  password = '';
  showPw = false;
  loading = signal(false);
  error = signal('');

  async onSubmit(): Promise<void> {
    if (!this.credential || !this.password) {
      this.error.set('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const isEmail = this.credential.includes('@');
    const result = await this.auth.login({
      email: isEmail ? this.credential : undefined,
      phone: isEmail ? undefined : this.credential,
      password: this.password,
    });

    this.loading.set(false);
    if (result.ok) {
      this.toast.success(`Chào mừng ${result.user?.name}!`);
      const returnUrl = this.route.snapshot.queryParams['returnUrl'];
      if (returnUrl) {
        this.router.navigateByUrl(returnUrl);
      } else if (this.auth.isAdmin()) {
        this.router.navigate(['/admin']);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      this.error.set(result.message || 'Đăng nhập thất bại.');
    }
  }
}
