import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">🛒 Vựa Vui Vẻ</div>
        <h1 class="auth-title">Quên mật khẩu</h1>
        <p class="subtitle">Nhập SĐT để nhận hướng dẫn đặt lại mật khẩu.</p>
        <form (ngSubmit)="onSubmit()" class="auth-form">
          <div class="field">
            <label>Số điện thoại / Email</label>
            <input
              [(ngModel)]="credential"
              name="credential"
              type="text"
              placeholder="Nhập SĐT hoặc email"
              class="input"
              required
            />
          </div>
          @if (sent()) {
            <p class="success-msg">✓ Nếu tài khoản tồn tại, hướng dẫn sẽ được gửi đến bạn.</p>
          }
          <button type="submit" class="btn btn--primary btn--full">Gửi yêu cầu</button>
        </form>
        <p class="auth-links"><a routerLink="/auth/login">← Quay lại đăng nhập</a></p>
      </div>
    </div>
  `,
  styleUrl: './forgot-password-page.component.scss',
})
export class ForgotPasswordPageComponent {
  credential = '';
  sent = signal(false);
  private toast = inject(ToastService);

  onSubmit(): void {
    // Placeholder: real reset flow requires backend
    this.sent.set(true);
    this.toast.info('Tính năng này yêu cầu backend hỗ trợ email/SMS.');
  }
}
