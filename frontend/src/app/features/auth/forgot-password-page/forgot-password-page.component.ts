import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-forgot-password-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './forgot-password-page.component.html',
  styleUrl: './forgot-password-page.component.scss',
})
export class ForgotPasswordPageComponent implements OnDestroy {
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  step = signal(1);
  loading = signal(false);
  error = signal('');
  showPw = signal(false);
  resendCountdown = signal(0);
  private _resendTimer: ReturnType<typeof setInterval> | null = null;
  private _otpValues: string[] = ['', '', '', '', '', ''];

  credential = '';
  newPassword = '';
  confirmPassword = '';

  async sendOtp(): Promise<void> {
    const normalized = this.credential.trim();
    if (!normalized) {
      this.error.set('Vui lòng nhập SĐT hoặc email.');
      return;
    }

    const isEmail = normalized.includes('@');

    this.loading.set(true);
    this.error.set('');

    const result = await this.auth.forgotPassword({
      email: isEmail ? normalized.toLowerCase() : undefined,
      phone: isEmail ? undefined : normalized,
    });

    this.loading.set(false);
    if (result.ok) {
      this.step.set(2);
      this.toast.success(result.message ?? 'Yêu cầu đặt lại mật khẩu đã được ghi nhận.');
      this.startResendCountdown();
      return;
    }

    this.error.set(result.message ?? 'Gửi yêu cầu thất bại.');
  }

  onOtpInput(e: Event, i: number): void {
    const input = e.target as HTMLInputElement;
    this._otpValues[i] = input.value.replace(/\D/g, '').slice(-1);
    input.value = this._otpValues[i];
    if (this._otpValues[i] && i < 5) {
      const next = document.getElementById(`fp-otp-${i + 1}`) as HTMLInputElement | null;
      next?.focus();
    }
  }

  onOtpKeydown(e: KeyboardEvent, i: number): void {
    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && i > 0) {
      const prev = document.getElementById(`fp-otp-${i - 1}`) as HTMLInputElement | null;
      prev?.focus();
    }
  }

  verifyOtp(): void {
    const code = this._otpValues.join('');
    if (code.length < 6) {
      this.error.set('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    // Demo: accept any 6-digit code
    setTimeout(() => {
      this.loading.set(false);
      this.step.set(3);
    }, 600);
  }

  resetPassword(): void {
    if (!this.newPassword || this.newPassword.length < 6) {
      this.error.set('Mật khẩu ít nhất 6 ký tự.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Mật khẩu không khớp.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    setTimeout(() => {
      this.loading.set(false);
      this.step.set(4);
      this.toast.success('Mật khẩu đã được đặt lại thành công!');
    }, 800);
  }

  private startResendCountdown(): void {
    if (this._resendTimer) clearInterval(this._resendTimer);
    this.resendCountdown.set(60);
    this._resendTimer = setInterval(() => {
      this.resendCountdown.update((v) => {
        if (v <= 1) {
          clearInterval(this._resendTimer!);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this._resendTimer) clearInterval(this._resendTimer);
  }
}
