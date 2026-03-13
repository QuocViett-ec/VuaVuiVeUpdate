import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { GoogleLoginButtonComponent } from '../../../shared/google-login-button/google-login-button.component';
import { AuthSession } from '../../../core/models/user.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login-page',
  imports: [RouterLink, FormsModule, GoogleLoginButtonComponent],
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  templateUrl: './login-page.component.html',
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
  rememberMe = false;
  loading = signal(false);
  error = signal('');
  capsLock = signal(false);

  onKeydown(e: KeyboardEvent): void {
    this.capsLock.set(e.getModifierState?.('CapsLock') ?? false);
  }

  onGlobalKey(e: KeyboardEvent): void {
    this.capsLock.set(e.getModifierState?.('CapsLock') ?? false);
  }

  async onSubmit(): Promise<void> {
    const normalizedCredential = this.credential.trim();
    const normalizedPassword = this.password;

    if (!normalizedCredential || !normalizedPassword) {
      this.error.set('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const isEmail = normalizedCredential.includes('@');
    const result = await this.auth.login({
      email: isEmail ? normalizedCredential.toLowerCase() : undefined,
      phone: isEmail ? undefined : normalizedCredential,
      password: normalizedPassword,
    });

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

  async onGoogleSuccess(session: AuthSession): Promise<void> {
    this.toast.success(`Chào mừng ${session.name}!`);
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl && returnUrl.startsWith('/')) {
      this.router.navigateByUrl(returnUrl);
    } else if (session.role === 'admin') {
      this.router.navigate(['/admin']);
    } else {
      this.router.navigate(['/']);
    }
  }
}
