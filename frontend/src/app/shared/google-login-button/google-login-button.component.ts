import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  signal,
  AfterViewInit,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';
import { AuthSession } from '../../core/models/user.model';

declare const google: {
  accounts: {
    id: {
      initialize: (config: unknown) => void;
      renderButton: (parent: HTMLElement, options: unknown) => void;
      disableAutoSelect: () => void;
    };
  };
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-google-login-button',
  template: `
    @if (hasClientId()) {
      <div #googleBtn class="google-btn-wrap"></div>
    } @else {
      <button type="button" class="btn-google-disabled" disabled>
        <span>Google OAuth chưa được cấu hình</span>
      </button>
    }
    @if (loading()) {
      <p class="google-loading">Đang xử lý...</p>
    }
    @if (errorMsg()) {
      <p class="google-error" role="alert">{{ errorMsg() }}</p>
    }
  `,
  styles: [
    `
      .google-btn-wrap {
        width: 100%;
        display: flex;
        justify-content: center;
        min-height: 44px;
      }
      /* Force Google button to fill width */
      .google-btn-wrap > div,
      .google-btn-wrap iframe {
        width: 100% !important;
      }
      .btn-google-disabled {
        width: 100%;
        padding: 11px 16px;
        border: 1.5px solid #dadce0;
        border-radius: 8px;
        background: #f5f5f5;
        color: #aaa;
        font-size: 14px;
        cursor: not-allowed;
      }
      .google-loading {
        font-size: 13px;
        color: #555;
        margin: 6px 0 0;
        text-align: center;
      }
      .google-error {
        font-size: 13px;
        color: #d93025;
        margin: 6px 0 0;
        text-align: center;
      }
    `,
  ],
})
export class GoogleLoginButtonComponent implements AfterViewInit {
  @ViewChild('googleBtn') googleBtnRef?: ElementRef<HTMLElement>;

  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  readonly success = output<AuthSession>();
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly hasClientId = signal(!!environment.googleClientId);

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!environment.googleClientId || !this.googleBtnRef) return;

    // Đợi Google SDK load xong
    const init = () => {
      if (typeof google === 'undefined') {
        setTimeout(init, 200);
        return;
      }
      google.accounts.id.initialize({
        client_id: environment.googleClientId,
        callback: async (response: { credential: string }) => {
          this.loading.set(true);
          this.errorMsg.set('');
          const result = await this.authService.googleLogin(response.credential);
          this.loading.set(false);
          if (result.ok && result.user) {
            this.success.emit(result.user as unknown as AuthSession);
          } else {
            this.errorMsg.set(result.message ?? 'Đăng nhập Google thất bại.');
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render Google's own button vào div container
      google.accounts.id.renderButton(this.googleBtnRef!.nativeElement, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        locale: 'vi',
        width: 360,
        logo_alignment: 'center',
      });
    };

    init();
  }
}
