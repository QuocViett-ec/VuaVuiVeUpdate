import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

type Tab = 'profile' | 'orders' | 'security';

function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const v = control.value || '';
  if (v.length < 8) return { tooShort: true };
  if (!/[A-Z]/.test(v)) return { noUppercase: true };
  if (!/[0-9]/.test(v)) return { noNumber: true };
  return null;
}

function confirmMatchValidator(group: AbstractControl): ValidationErrors | null {
  const pw = group.get('newPassword')?.value;
  const confirm = group.get('confirmNew')?.value;
  return pw === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent {
  private auth  = inject(AuthService);
  private toast = inject(ToastService);
  private fb    = inject(FormBuilder);

  readonly user = this.auth.currentUser;

  tab      = signal<Tab>('profile');
  saving   = signal(false);
  savingPw = signal(false);
  pwMsg    = signal('');
  acctMsg  = signal('');

  editName    = '';
  editAddress = '';

  passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, strongPasswordValidator]],
      confirmNew: ['', Validators.required],
    },
    { validators: confirmMatchValidator },
  );

  ngOnInit(): void {
    const u = this.user();
    this.editName    = u?.name    ?? '';
    this.editAddress = u?.address ?? '';
  }

  async saveProfile(): Promise<void> {
    this.saving.set(true); this.acctMsg.set('');
    const r = await this.auth.updateProfile({ name: this.editName, address: this.editAddress });
    this.saving.set(false);
    this.acctMsg.set(r.ok ? 'Da luu thong tin!' : (r.message ?? 'Loi khi luu.'));
    if (r.ok) this.toast.success('Da cap nhat thong tin!');
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.pwMsg.set('');
    this.savingPw.set(true);
    const { currentPassword, newPassword } = this.passwordForm.value;
    const r = await this.auth.changePassword({ oldPassword: currentPassword, newPassword });
    this.savingPw.set(false);
    if (r.ok) {
      this.pwMsg.set('Doi mat khau thanh cong!');
      this.passwordForm.reset();
      this.toast.success('Doi mat khau thanh cong!');
    } else {
      this.passwordForm.get('currentPassword')?.setErrors({ serverError: r.message ?? 'Loi.' });
    }
  }

  logout(): void { this.auth.logout(); }
}
