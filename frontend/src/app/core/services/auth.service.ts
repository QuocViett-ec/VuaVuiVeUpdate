import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  User,
  AuthSession,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from '../models/user.model';

const LS_SESSION = 'vvv_session_v1';
const API_BASE = environment.apiBase;
const BACKOFFICE_ROLES = new Set(['admin', 'staff', 'audit']);

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<AuthSession | null>(this._loadSession());
  private _isLoggingOut = false;
  readonly currentUser = this._session.asReadonly();
  readonly isLoggedIn = computed(() => !!this._session());
  readonly isAdmin = computed(() =>
    BACKOFFICE_ROLES.has(String(this._session()?.role || '').toLowerCase()),
  );

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    // Dọn dẹp data localStorage cũ (fake users từ phiên bản trước)
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('vvv_users_v1');
    }
    const initialRole = String(this._session()?.role || '').toLowerCase();
    if (this._isCustomerPortalRuntime() && BACKOFFICE_ROLES.has(initialRole)) {
      this._clearSession();
    }
    if (this._isAdminPortalRuntime() && initialRole && !BACKOFFICE_ROLES.has(initialRole)) {
      this._clearSession();
    }

    // Admin login must always show the login screen first.
    // When opening /auth/login on admin portal, ignore cached session restore.
    // Do not call server logout here to avoid racing with a new login request.
    if (this._isAdminPortalRuntime() && this._isAdminLoginPath()) {
      this._clearSession();
      return;
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key !== LS_SESSION) return;
        this._session.set(this._loadSession());
      });
    }

    // Restore session từ server cookie khi app khởi động
    this._restoreServerSession();
  }

  private _isAdminLoginPath(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.pathname.startsWith('/auth/login');
  }

  private _isAdminPortalRuntime(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return new URL(environment.adminPortalBase).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  private _isCustomerPortalRuntime(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return new URL(environment.customerPortalBase).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  // ─── Restore session từ server (GET /api/auth/me) ───────────────────────────
  private _restoreServerSession(): void {
    if (typeof window === 'undefined') return;
    this.http.get<any>(`${API_BASE}/api/auth/me`, { withCredentials: true }).subscribe({
      next: (res) => {
        if (this._isLoggingOut) return;
        if (res?.data) {
          const role = String(res.data.role || '').toLowerCase();
          if (this._isCustomerPortalRuntime() && BACKOFFICE_ROLES.has(role)) {
            this._clearSession();
            return;
          }
          if (this._isAdminPortalRuntime() && !BACKOFFICE_ROLES.has(role)) {
            this._clearSession();
            return;
          }

          const sess: AuthSession = {
            id: res.data._id ?? res.data.id,
            name: res.data.name,
            email: res.data.email ?? '',
            phone: res.data.phone ?? '',
            address: res.data.address ?? '',
            role: res.data.role ?? 'user',
            avatar: res.data.avatar ?? '',
            provider: res.data.provider ?? 'local',
          };
          this._saveSession(sess);
        } else {
          // Server không còn session hợp lệ → xóa cache cũ
          this._clearSession();
        }
      },
      error: (err) => {
        if (err?.status === 401 || err?.status === 403) {
          this._clearSession();
          return;
        }
        // Backend không chạy → giữ nguyên session cache để UI hiển thị
      },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  private _loadSession(): AuthSession | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
    } catch {
      return null;
    }
  }

  private _saveSession(sess: AuthSession): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_SESSION, JSON.stringify(sess));
    }
    this._session.set(sess);
  }

  private _clearSession(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_SESSION);
    }
    this._session.set(null);
  }

  isSafeReturnUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (!value.startsWith('/')) return false;
    if (value.startsWith('//')) return false;
    return !/^[\w-]+:/.test(value);
  }

  forceClearClientSession(): void {
    this._clearSession();
  }

  // ─── Register ───────────────────────────────────────────────────────────────
  async register(req: RegisterRequest): Promise<AuthResponse> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${API_BASE}/api/auth/register`, req, { withCredentials: true }),
      );
      if (res?.data) {
        // Không tự đăng nhập sau đăng ký — chuyển về trang login
        return { ok: true, user: res.data as User };
      }
      return { ok: false, message: 'Đăng ký thất bại. Vui lòng thử lại.' };
    } catch (err: any) {
      if (err?.status === 0) {
        return {
          ok: false,
          message: 'Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.',
        };
      }
      return { ok: false, message: err.error?.message ?? 'Đăng ký thất bại.' };
    }
  }

  // ─── Forgot password ───────────────────────────────────────────────────────
  async forgotPassword(payload: { phone?: string; email?: string }): Promise<AuthResponse> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${API_BASE}/api/auth/forgot-password`, payload, {
          withCredentials: true,
        }),
      );
      if (res?.success) {
        return { ok: true, message: res.message };
      }
      return { ok: false, message: res?.message ?? 'Gửi yêu cầu thất bại.' };
    } catch (err: any) {
      if (err?.status === 0) {
        return { ok: false, message: 'Không thể kết nối đến server. Vui lòng thử lại.' };
      }
      return { ok: false, message: err.error?.message ?? 'Gửi yêu cầu thất bại.' };
    }
  }

  // ─── Login ──────────────────────────────────────────────────────────────────
  async login(req: LoginRequest): Promise<AuthResponse> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${API_BASE}/api/auth/login`, req, { withCredentials: true }),
      );
      if (res?.data) {
        const sess: AuthSession = {
          id: res.data._id ?? res.data.id,
          name: res.data.name,
          email: res.data.email ?? '',
          phone: res.data.phone ?? '',
          address: res.data.address ?? '',
          role: res.data.role ?? 'user',
          avatar: res.data.avatar ?? '',
          provider: res.data.provider ?? 'local',
        };
        this._saveSession(sess);
        return { ok: true, user: sess as unknown as User };
      }
      return { ok: false, message: 'Đăng nhập thất bại. Vui lòng thử lại.' };
    } catch (err: any) {
      if (err?.status === 0) {
        return {
          ok: false,
          message: 'Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.',
        };
      }
      return { ok: false, message: err.error?.message ?? 'Đăng nhập thất bại.' };
    }
  }

  // ─── Admin Login (separate admin portal entrypoint) ─────────────────────────
  async loginAdmin(req: LoginRequest): Promise<AuthResponse> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${API_BASE}/api/auth/admin/login`, req, { withCredentials: true }),
      );
      if (res?.data) {
        const sess: AuthSession = {
          id: res.data._id ?? res.data.id,
          name: res.data.name,
          email: res.data.email ?? '',
          phone: res.data.phone ?? '',
          address: res.data.address ?? '',
          role: res.data.role ?? 'admin',
          avatar: res.data.avatar ?? '',
          provider: res.data.provider ?? 'local',
        };
        this._saveSession(sess);
        return { ok: true, user: sess as unknown as User };
      }
      return { ok: false, message: 'Đăng nhập quản trị thất bại.' };
    } catch (err: any) {
      if (err?.status === 0) {
        return {
          ok: false,
          message: 'Không thể kết nối đến server. Vui lòng kiểm tra backend đang chạy.',
        };
      }
      return { ok: false, message: err.error?.message ?? 'Đăng nhập quản trị thất bại.' };
    }
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  logout(): void {
    this._isLoggingOut = true;
    this.http.post(`${API_BASE}/api/auth/logout`, {}, { withCredentials: true }).subscribe({
      next: () => {
        this._clearSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vvv:auth-logout'));
        }
        this.router.navigate(['/auth/login'], { replaceUrl: true });
        this._isLoggingOut = false;
      },
      error: () => {
        // Dù backend lỗi, vẫn clear local session để người dùng thoát khỏi UI hiện tại.
        this._clearSession();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vvv:auth-logout'));
        }
        this.router.navigate(['/auth/login'], { replaceUrl: true });
        this._isLoggingOut = false;
      },
    });
  }

  // ─── Update profile ──────────────────────────────────────────────────────────
  async updateProfile(req: UpdateProfileRequest): Promise<AuthResponse> {
    const sess = this._session();
    if (!sess) return { ok: false, message: 'Chưa đăng nhập.' };
    try {
      const res = await firstValueFrom(
        this.http.put<any>(`${API_BASE}/api/auth/profile`, req, { withCredentials: true }),
      );
      if (res?.data || res?.success) {
        this._saveSession({
          ...sess,
          name: req.name || sess.name,
          address: req.address || sess.address,
        });
        return { ok: true, user: res.data ?? sess };
      }
      return { ok: false, message: 'Cập nhật thất bại.' };
    } catch (err: any) {
      if (err?.status === 0) {
        return { ok: false, message: 'Không thể kết nối đến server.' };
      }
      return { ok: false, message: err.error?.message ?? 'Cập nhật thất bại.' };
    }
  }

  // ─── Change password ─────────────────────────────────────────────────────────
  async changePassword(req: ChangePasswordRequest): Promise<AuthResponse> {
    const sess = this._session();
    if (!sess) return { ok: false, message: 'Chưa đăng nhập.' };
    try {
      const res = await firstValueFrom(
        this.http.put<any>(`${API_BASE}/api/auth/password`, req, { withCredentials: true }),
      );
      if (res?.success || res?.data) return { ok: true };
      return { ok: false, message: 'Đổi mật khẩu thất bại.' };
    } catch (err: any) {
      if (err?.status === 0) {
        return { ok: false, message: 'Không thể kết nối đến server.' };
      }
      return { ok: false, message: err.error?.message ?? 'Đổi mật khẩu thất bại.' };
    }
  }

  // ─── Google Login ────────────────────────────────────────────────────────────
  async googleLogin(idToken: string): Promise<AuthResponse> {
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${API_BASE}/api/auth/google`, { idToken }, { withCredentials: true }),
      );
      if (res?.data) {
        const sess: AuthSession = {
          id: res.data._id ?? res.data.id,
          name: res.data.name,
          email: res.data.email ?? '',
          phone: res.data.phone ?? '',
          address: res.data.address ?? '',
          role: res.data.role ?? 'user',
          avatar: res.data.avatar ?? '',
          provider: res.data.provider ?? 'google',
        };
        this._saveSession(sess);

        return { ok: true, user: sess as unknown as User };
      }
      return { ok: false, message: 'Đăng nhập Google thất bại.' };
    } catch (err: any) {
      return { ok: false, message: err.error?.message ?? 'Đăng nhập Google thất bại.' };
    }
  }
}
