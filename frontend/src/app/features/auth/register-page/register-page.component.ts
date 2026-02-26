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

function phoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return /^(0[3-9]\d{8})$/.test(control.value) ? null : { invalidPhone: true };
}

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
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

        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()" class="auth-form">
          <div class="field">
            <label>Họ và tên <span class="required">*</span></label>
            <input
              formControlName="name"
              type="text"
              placeholder="Nguyễn Văn A"
              class="input"
            />
            @if (registerForm.get('name')?.touched && registerForm.get('name')?.errors?.['required']) {
              <p class="field-error">Vui lòng nhập họ và tên.</p>
            }
            @if (registerForm.get('name')?.touched && registerForm.get('name')?.errors?.['minlength']) {
              <p class="field-error">Tên phải ít nhất 2 ký tự.</p>
            }
          </div>
          <div class="field">
            <label>Số điện thoại <span class="required">*</span></label>
            <input
              formControlName="phone"
              type="tel"
              placeholder="0912345678"
              class="input"
            />
            @if (registerForm.get('phone')?.touched && registerForm.get('phone')?.errors?.['required']) {
              <p class="field-error">Vui lòng nhập số điện thoại.</p>
            }
            @if (registerForm.get('phone')?.touched && registerForm.get('phone')?.errors?.['invalidPhone']) {
              <p class="field-error">Số điện thoại không hợp lệ (VD: 0912345678).</p>
            }
          </div>
          <div class="field">
            <label>Email (tùy chọn)</label>
            <input
              formControlName="email"
              type="email"
              placeholder="example@gmail.com"
              class="input"
            />
            @if (registerForm.get('email')?.touched && registerForm.get('email')?.errors?.['email']) {
              <p class="field-error">Email không hợp lệ.</p>
            }
          </div>
          <div class="field">
            <label>Địa chỉ (tùy chọn)</label>
            <input
              formControlName="address"
              type="text"
              placeholder="Số nhà, đường, phường, quận"
              class="input"
            />
          </div>
          <div class="field">
            <label>Mật khẩu <span class="required">*</span></label>
            <div class="input-pw">
              <input
                formControlName="password"
                [type]="showPw ? 'text' : 'password'"
                placeholder="Ít nhất 6 ký tự"
                class="input"
              />
              <button type="button" class="toggle-pw" (click)="showPw = !showPw">
                {{ showPw ? '🙈' : '👁' }}
              </button>
            </div>
            @if (registerForm.get('password')?.touched && registerForm.get('password')?.errors?.['required']) {
              <p class="field-error">Vui lòng nhập mật khẩu.</p>
            }
            @if (registerForm.get('password')?.touched && registerForm.get('password')?.errors?.['minlength']) {
              <p class="field-error">Mật khẩu phải ít nhất 6 ký tự.</p>
            }
          </div>
          <div class="field">
            <label>Xác nhận mật khẩu <span class="required">*</span></label>
            <input
              formControlName="confirmPassword"
              type="password"
              placeholder="Nhập lại mật khẩu"
              class="input"
            />
            @if (registerForm.get('confirmPassword')?.touched && registerForm.get('confirmPassword')?.errors?.['required']) {
              <p class="field-error">Vui lòng xác nhận mật khẩu.</p>
            }
            @if (registerForm.get('confirmPassword')?.touched && registerForm.errors?.['passwordMismatch']) {
              <p class="field-error">Mật khẩu không khớp.</p>
            }
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
  private fb = inject(FormBuilder);

  showPw = false;
  loading = signal(false);
  error = signal('');

  registerForm: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, phoneValidator]],
      email: ['', [Validators.email]],
      address: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator },
  );

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { name, phone, email, password, address } = this.registerForm.value;
    const result = await this.auth.register({ name, phone, email, password, address });
    this.loading.set(false);
    if (result.ok) {
      this.toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      this.router.navigate(['/auth/login']);
    } else {
      this.error.set(result.message || 'Đăng ký thất bại.');
    }
  }
}
