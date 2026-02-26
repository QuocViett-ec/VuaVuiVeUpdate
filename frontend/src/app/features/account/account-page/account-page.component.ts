import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

type Tab = 'profile' | 'orders' | 'security';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './account-page.component.html',
  styleUrl: './account-page.component.scss',
})
export class AccountPageComponent {
  private auth  = inject(AuthService);
  private toast = inject(ToastService);

  readonly user = this.auth.currentUser;

  tab      = signal<Tab>('profile');
  saving   = signal(false);
  savingPw = signal(false);
  pwError  = signal('');
  pwMsg    = signal('');
  acctMsg  = signal('');

  editName    = '';
  editAddress = '';
  oldPw = ''; newPw = ''; confirmPw = '';

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
    this.pwError.set(''); this.pwMsg.set('');
    if (this.newPw !== this.confirmPw) { this.pwError.set('Mat khau xac nhan khong khop.'); return; }
    this.savingPw.set(true);
    const r = await this.auth.changePassword({ oldPassword: this.oldPw, newPassword: this.newPw });
    this.savingPw.set(false);
    if (r.ok) { this.pwMsg.set('Doi mat khau thanh cong!'); this.oldPw = this.newPw = this.confirmPw = ''; }
    else { this.pwError.set(r.message ?? 'Loi.'); }
  }

  logout(): void { this.auth.logout(); }
}
