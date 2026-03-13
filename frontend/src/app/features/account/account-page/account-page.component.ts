import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import {
  ReactiveFormsModule,
  FormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { switchMap } from 'rxjs/operators';

type Tab = 'profile' | 'orders' | 'security';

// ── Custom Validators ─────────────────────────────────────────────────────────

/** Mật khẩu mạnh: ≥8 ký tự, ít nhất 1 chữ hoa, ít nhất 1 chữ số. */
function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const v: string = control.value || '';
  if (v.length < 8) return { tooShort: true };
  if (!/[A-Z]/.test(v)) return { noUppercase: true };
  if (!/[0-9]/.test(v)) return { noNumber: true };
  return null;
}

/** Group validator: newPassword và confirmNew phải giống nhau */
function confirmNewMatchValidator(group: AbstractControl): ValidationErrors | null {
  const nw = group.get('newPassword')?.value;
  const conf = group.get('confirmNew')?.value;
  if (!conf) return null;
  return nw === conf ? null : { confirmMismatch: true };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-account-page',
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent implements OnInit {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);
  private geoSvc = inject(GeolocationService);

  readonly user = this.auth.currentUser;

  tab = signal<Tab>('profile');
  saving = signal(false);
  savingPw = signal(false);
  acctMsg = signal('');
  showOldPw = signal(false);
  showNewPw = signal(false);
  isLocating = signal(false);
  locationError = signal('');

  // ── Profile form (Template-Driven) ────────────────────────────────────────
  editName = '';
  editAddress = '';

  // ── Password form (Reactive Forms + Custom Validators) ───────────────────
  passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, strongPasswordValidator]],
      confirmNew: ['', Validators.required],
    },
    { validators: confirmNewMatchValidator },
  );

  get pf() {
    return this.passwordForm.controls;
  }

  isPwInvalid(field: string): boolean {
    const c = this.pf[field];
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  ngOnInit(): void {
    const u = this.user();
    this.editName = u?.name ?? '';
    this.editAddress = u?.address ?? '';
  }

  async saveProfile(): Promise<void> {
    this.saving.set(true);
    this.acctMsg.set('');
    const r = await this.auth.updateProfile({ name: this.editName, address: this.editAddress });
    this.saving.set(false);
    this.acctMsg.set(r.ok ? 'Đã lưu thông tin!' : (r.message ?? 'Lỗi khi lưu.'));
    if (r.ok) this.toast.success('Đã cập nhật thông tin!');
  }

  /** Lấy địa chỉ từ GPS + Nominatim reverse geocoding */
  getLocation(): void {
    this.isLocating.set(true);
    this.locationError.set('');
    this.geoSvc
      .getCurrentPosition()
      .pipe(switchMap((coords) => this.geoSvc.reverseGeocode(coords.latitude, coords.longitude)))
      .subscribe({
        next: (address) => {
          if (address) {
            this.editAddress = address;
            this.toast.success('Đã lấy địa chỉ từ vị trí hiện tại!');
          } else {
            this.locationError.set('Không thể xác định địa chỉ từ vị trí.');
          }
          this.isLocating.set(false);
        },
        error: (msg: string) => {
          this.locationError.set(msg);
          this.isLocating.set(false);
        },
      });
  }

  async changePassword(): Promise<void> {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) return;

    this.savingPw.set(true);
    const { currentPassword, newPassword } = this.passwordForm.value;
    const r = await this.auth.changePassword({ currentPassword, newPassword });
    this.savingPw.set(false);
    if (r.ok) {
      this.toast.success('Đổi mật khẩu thành công!');
      this.passwordForm.reset();
    } else {
      this.pf['currentPassword'].setErrors({ serverError: r.message ?? 'Lỗi.' });
    }
  }

  logout(): void {
    this.auth.logout();
  }
}
