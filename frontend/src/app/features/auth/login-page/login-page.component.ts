import { Component, ChangeDetectionStrategy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss' })
export class LoginPageComponent {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  credential = '';
  password = '';
  showPw = false;
  rememberMe = false;
  loading = signal(false);
  error = signal('');
  capsLock = signal(false);

  onKeydown(e: KeyboardEvent): void {
    this.capsLock.set(e.getModifierState?.('CapsLock') ?? false);
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    this.capsLock.set(e.getModifierState?.('CapsLock') ?? false);
  }

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
      password: this.password });

    this.loading.set(false);
    if (result.ok) {
      this.toast.success(`Chào mừng ${result.user?.name}!`);
      const returnUrl = this.route.snapshot.queryParams['returnUrl'];
      if (returnUrl && returnUrl.startsWith('/')) {
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
