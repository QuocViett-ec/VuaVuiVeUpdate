import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../app/core/services/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'admin-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  credential = '';
  password = '';
  loading = signal(false);
  error = signal('');
  customerPortalUrl = environment.customerPortalBase;

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
    const result = await this.auth.loginAdmin({
      email: isEmail ? normalizedCredential.toLowerCase() : undefined,
      phone: isEmail ? undefined : normalizedCredential,
      password: normalizedPassword,
    });

    this.loading.set(false);

    if (!result.ok) {
      this.error.set(result.message || 'Đăng nhập quản trị thất bại.');
      return;
    }

    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (this.auth.isSafeReturnUrl(returnUrl)) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    this.router.navigateByUrl('/dashboard');
  }
}
