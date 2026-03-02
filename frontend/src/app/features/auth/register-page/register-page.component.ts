import { Component, ChangeDetectionStrategy, inject, signal, OnDestroy, input } from '@angular/core';
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
  if (!confirm) return null;
  return pw === confirm ? null : { passwordMismatch: true };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent implements OnDestroy {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  showPw = signal(false);
  loading = signal(false);
  serverError = signal('');
  showOtp = signal(false);
  resendCountdown = signal(0);
  private _resendTimer: ReturnType<typeof setInterval> | null = null;
  private _otpValues: string[] = ['', '', '', '', '', ''];

  // ── Reactive Form ─────────────────────────────────────────────────────────
  registerForm: FormGroup = this.fb.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, phoneValidator]],
      dob: [''],
      email: ['', [Validators.email]],
      address: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordMatchValidator },
  );

  get f() {
    return this.registerForm.controls;
  }

  isInvalid(field: string): boolean {
    const c = this.f[field];
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  async onSubmit(): Promise<void> {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;

    this.loading.set(true);
    this.serverError.set('');
    const { name, phone, dob, email, password, address } = this.registerForm.value;
    const result = await this.auth.register({
      name,
      phone,
      dob: dob || undefined,
      email,
      password,
      address,
    });
    this.loading.set(false);
    if (result.ok) {
      this.toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
      this.router.navigate(['/auth/login']);
    } else {
      this.serverError.set(result.message || 'Đăng ký thất bại.');
    }
  }

  // ── OTP overlay helpers ───────────────────────────────────────────────────
  onOtpInput(e: Event, i: number): void {
    const input = e.target as HTMLInputElement;
    this._otpValues[i] = input.value.replace(/\D/g, '').slice(-1);
    input.value = this._otpValues[i];
    if (this._otpValues[i] && i < 5) {
      const next = document.getElementById(`otp-${i + 1}`) as HTMLInputElement | null;
      next?.focus();
    }
  }

  onOtpKeydown(e: KeyboardEvent, i: number): void {
    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && i > 0) {
      const prev = document.getElementById(`otp-${i - 1}`) as HTMLInputElement | null;
      prev?.focus();
    }
  }

  verifyOtp(): void {
    const code = this._otpValues.join('');
    if (code.length < 6) return;
    this.showOtp.set(false);
    this.toast.success('Xác thực thành công! Vui lòng đăng nhập.');
    this.router.navigate(['/auth/login']);
  }

  resendOtp(): void {
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
