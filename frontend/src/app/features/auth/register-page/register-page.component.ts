import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

// ── Custom Validators ─────────────────────────────────────────────────────────

/** Kiểm tra số điện thoại Việt Nam: 10 chữ số, bắt đầu 03x-09x */
function phoneValidator(control: AbstractControl): ValidationErrors | null {
  const val = (control.value || '').toString().trim();
  return /^(0[3-9]\d{8})$/.test(val) ? null : { invalidPhone: true };
}

/** Group validator: password và confirmPassword phải giống nhau */
function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!confirm) return null; // chưa nhập thì chưa validate
  return pw === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-logo">🛒 Vựa Vui Vẻ</div>
        <h1 class="auth-title">Đăng ký tài khoản</h1>

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="auth-form" novalidate>

          <!-- Họ và tên -->
          <div class="field">
            <label for="reg-name">Họ và tên <span class="required">*</span></label>
            <input
              id="reg-name"
              formControlName="name"
              type="text"
              placeholder="Nguyễn Văn A"
              class="input"
              [class.input--error]="isInvalid('name')"
            />
            @if (isInvalid('name')) {
              @if (f['name'].errors?.['required']) {
                <p class="field-error">Vui lòng nhập họ tên.</p>
              } @else if (f['name'].errors?.['minlength']) {
                <p class="field-error">Họ tên ít nhất 2 ký tự.</p>
              }
            }
          </div>

          <!-- Số điện thoại -->
          <div class="field">
            <label for="reg-phone">Số điện thoại <span class="required">*</span></label>
            <input
              id="reg-phone"
              formControlName="phone"
              type="tel"
              placeholder="0912345678"
              class="input"
              [class.input--error]="isInvalid('phone')"
            />
            @if (isInvalid('phone')) {
              @if (f['phone'].errors?.['required']) {
                <p class="field-error">Vui lòng nhập số điện thoại.</p>
              } @else if (f['phone'].errors?.['invalidPhone']) {
                <p class="field-error">Số điện thoại không hợp lệ (VD: 0912345678).</p>
              }
            }
          </div>

          <!-- Email -->
          <div class="field">
            <label for="reg-email">Email (tùy chọn)</label>
            <input
              id="reg-email"
              formControlName="email"
              type="email"
              placeholder="example@gmail.com"
              class="input"
              [class.input--error]="isInvalid('email')"
            />
            @if (isInvalid('email')) {
              <p class="field-error">Email không đúng định dạng.</p>
            }
          </div>

          <!-- Địa chỉ -->
          <div class="field">
            <label for="reg-address">Địa chỉ (tùy chọn)</label>
            <input
              id="reg-address"
              formControlName="address"
              type="text"
              placeholder="Số nhà, đường, phường, quận"
              class="input"
            />
          </div>

          <!-- Mật khẩu -->
          <div class="field">
            <label for="reg-pw">Mật khẩu <span class="required">*</span></label>
            <div class="input-pw">
              <input
                id="reg-pw"
                formControlName="password"
                [type]="showPw() ? 'text' : 'password'"
                placeholder="Ít nhất 6 ký tự"
                class="input"
                [class.input--error]="isInvalid('password')"
              />
              <button type="button" class="toggle-pw" (click)="showPw.set(!showPw())">
                {{ showPw() ? '🙈' : '👁' }}
              </button>
            </div>
            @if (isInvalid('password')) {
              @if (f['password'].errors?.['required']) {
                <p class="field-error">Vui lòng nhập mật khẩu.</p>
              } @else if (f['password'].errors?.['minlength']) {
                <p class="field-error">Mật khẩu ít nhất 6 ký tự.</p>
              }
            }
          </div>

          <!-- Xác nhận mật khẩu -->
          <div class="field">
            <label for="reg-confirm">Xác nhận mật khẩu <span class="required">*</span></label>
            <div class="input-pw">
              <input
                id="reg-confirm"
                formControlName="confirmPassword"
                [type]="showPw() ? 'text' : 'password'"
                placeholder="Nhập lại mật khẩu"
                class="input"
                [class.input--error]="isInvalid('confirmPassword') || registerForm.errors?.['passwordMismatch']"
              />
            </div>
            @if (registerForm.errors?.['passwordMismatch'] && f['confirmPassword'].touched) {
              <p class="field-error">Mật khẩu xác nhận không khớp.</p>
            }
          </div>

          @if (serverError()) {
            <p class="error-msg">{{ serverError() }}</p>
          }

          <button
            type="submit"
            class="btn btn--primary btn--full"
            [disabled]="loading() || registerForm.invalid"
          >
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
  private fb = inject(FormBuilder);

  showPw = signal(false);
  loading = signal(false);
  serverError = signal('');

  // ── Reactive Form ─────────────────────────────────────────────────────────
  registerForm: FormGroup = this.fb.group(
    {
      name:            ['', [Validators.required, Validators.minLength(2)]],
      phone:           ['', [Validators.required, phoneValidator]],
      email:           ['', [Validators.email]],
      address:         [''],
      password:        ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator },
  );

  /** Shortcut truy cập controls */
  get f() { return this.registerForm.controls; }

  /** True khi field bị lỗi VÀ đã touched/dirty */
  isInvalid(field: string): boolean {
    const c = this.f[field];
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  async onSubmit(): Promise<void> {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;

    this.loading.set(true);
    this.serverError.set('');
    const { name, phone, email, password, address } = this.registerForm.value;
    const result = await this.auth.register({ name, phone, email, password, address });
    this.loading.set(false);
    if (result.ok) {
      this.toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      this.router.navigate(['/auth/login']);
    } else {
      this.serverError.set(result.message || 'Đăng ký thất bại.');
    }
  }
}
