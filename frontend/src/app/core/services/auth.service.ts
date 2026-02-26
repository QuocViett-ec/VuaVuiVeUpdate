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

const LS_USERS = 'vvv_users_v1';
const LS_SESSION = 'vvv_session_v1';
const API_BASE = environment.apiBase;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<AuthSession | null>(this._loadSession());
  readonly currentUser = this._session.asReadonly();
  readonly isLoggedIn = computed(() => !!this._session());
  readonly isAdmin = computed(() => this._session()?.role?.toLowerCase() === 'admin');

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    this._seedAdmin();
    // Thử restore session từ server khi app khởi động (nếu backend đang chạy)
    this._restoreServerSession();
  }

  // ─── Restore session từ server (GET /api/auth/me) ───────────────────────────
  private _restoreServerSession(): void {
    if (typeof window === 'undefined') return;
    this.http
      .get<any>(`${API_BASE}/api/auth/me`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          if (res?.user) {
            const sess: AuthSession = {
              id: res.user._id ?? res.user.id,
              name: res.user.name,
              email: res.user.email ?? '',
              phone: res.user.phone ?? '',
              address: res.user.address ?? '',
              role: res.user.role ?? 'customer',
            };
            this._saveSession(sess);
          }
        },
        error: () => { /* backend chưa chạy → dùng localStorage như cũ */ },
      });
  }

  // ─── Seed default admin (runs once on first load) ────────────────────────────
  private _seedAdmin(): void {
    if (typeof localStorage === 'undefined') return;
    const users = this._getUsers();
    const hasAdmin = users.some((u: any) => u.email === 'admin@vuavuive.com');
    if (!hasAdmin) {
      const adminUser = {
        id: 'admin-1',
        name: 'Admin VVV',
        email: 'admin@vuavuive.com',
        phone: '0900000001',
        password: 'admin123',
        address: '',
        role: 'admin' as 'admin',
        createdAt: '2025-01-01T00:00:00.000Z',
      };
      users.unshift(adminUser);
      this._setUsers(users);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────
  private _loadSession(): AuthSession | null {
    try {
      return JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
    } catch {
      return null;
    }
  }

  private _getUsers(): User[] {
    try {
      const u = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
      return Array.isArray(u) ? u : [];
    } catch {
      return [];
    }
  }

  private _setUsers(list: User[]): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(LS_USERS, JSON.stringify(list));
  }

  private _saveSession(sess: AuthSession): void {
    localStorage.setItem(LS_SESSION, JSON.stringify(sess));
    this._session.set(sess);
  }

  // ─── Register ───────────────────────────────────────────────────────────────
  async register(req: RegisterRequest): Promise<AuthResponse> {
    // Thử gọi backend trước
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${API_BASE}/api/auth/register`, req, { withCredentials: true })
      );
      if (res?.user) {
        return { ok: true, user: res.user };
      }
    } catch (err: any) {
      // Nếu backend trả lỗi rõ ràng (4xx) thì dừng lại
      if (err?.status && err.status !== 0) {
        return { ok: false, message: err.error?.message ?? 'Đăng ký thất bại.' };
      }
      // Nếu backend không chạy (status 0 / network error) → fallback localStorage
    }

    // ─── Fallback: localStorage (khi backend chưa chạy) ─────────────────────
    const users = this._getUsers();
    const phone = req.phone.replace(/\D/g, '');
    const email = (req.email || '').trim().toLowerCase();

    if (!req.name || !phone || !req.password)
      return { ok: false, message: 'Vui lòng nhập đủ họ tên, SĐT và mật khẩu.' };
    if (email && users.some((u) => (u.email || '').toLowerCase() === email))
      return { ok: false, message: 'Email đã tồn tại.' };
    if (users.some((u) => (u.phone || '') === phone))
      return { ok: false, message: 'Số điện thoại đã tồn tại.' };
    if (req.password.length < 6) return { ok: false, message: 'Mật khẩu phải ít nhất 6 ký tự.' };

    const user: User & { password?: string } = {
      id: Date.now().toString(),
      name: req.name.trim(),
      email,
      phone,
      password: req.password,
      address: (req.address || '').trim(),
      role: 'customer',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    this._setUsers(users);
    this._log('user.register', email || phone, { userId: user.id });
    return {
      ok: true,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address },
    };
  }

  // ─── Login ──────────────────────────────────────────────────────────────────
  async login(req: LoginRequest): Promise<AuthResponse> {
    // Thử gọi backend trước
    try {
      const res = await firstValueFrom(
        this.http.post<any>(`${API_BASE}/api/auth/login`, req, { withCredentials: true })
      );
      if (res?.user) {
        const sess: AuthSession = {
          id: res.user._id ?? res.user.id,
          name: res.user.name,
          email: res.user.email ?? '',
          phone: res.user.phone ?? '',
          address: res.user.address ?? '',
          role: res.user.role ?? 'customer',
        };
        this._saveSession(sess);
        this._log('user.login', sess.email || sess.phone, { via: 'server' });
        return { ok: true, user: sess as unknown as User };
      }
    } catch (err: any) {
      if (err?.status && err.status !== 0) {
        return { ok: false, message: err.error?.message ?? 'Đăng nhập thất bại.' };
      }
      // Network error → fallback localStorage
    }

    // ─── Fallback: localStorage ──────────────────────────────────────────────
    const users = this._getUsers();
    const email = (req.email || '').trim().toLowerCase();
    const phone = (req.phone || '').replace(/\D/g, '');
    const candidate = users.find(
      (x: any) =>
        (email && (x.email || '').toLowerCase() === email) || (phone && (x.phone || '') === phone),
    ) as any;

    if (!candidate)
      return { ok: false, reason: 'user_not_found', message: 'Không tìm thấy tài khoản.' };
    if (candidate.password !== req.password)
      return { ok: false, reason: 'wrong_password', message: 'Mật khẩu không đúng.' };

    const sess: AuthSession = {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      phone: candidate.phone,
      address: candidate.address,
      role: candidate.role || 'customer',
    };
    this._saveSession(sess);
    this._log('user.login', sess.email || sess.phone, { userId: sess.id });
    return {
      ok: true,
      user: {
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        address: candidate.address,
      },
    };
  }

  // ─── Logout ─────────────────────────────────────────────────────────────────
  logout(): void {
    localStorage.removeItem(LS_SESSION);
    this._session.set(null);
    this.router.navigate(['/auth/login']);
  }

  // ─── Update profile ──────────────────────────────────────────────────────────
  async updateProfile(req: UpdateProfileRequest): Promise<AuthResponse> {
    const sess = this._session();
    if (!sess) return { ok: false, message: 'Chưa đăng nhập.' };
    const users = this._getUsers() as any[];
    let idx = users.findIndex((x: any) => x.id === sess.id);
    if (idx === -1) return { ok: false, message: 'Không tìm thấy người dùng.' };

    users[idx] = { ...users[idx], ...req };
    this._setUsers(users);
    this._saveSession({
      ...sess,
      name: req.name || sess.name,
      address: req.address || sess.address,
    });
    return { ok: true, user: users[idx] };
  }

  // ─── Change password ─────────────────────────────────────────────────────────
  async changePassword(req: ChangePasswordRequest): Promise<AuthResponse> {
    const sess = this._session();
    if (!sess) return { ok: false, message: 'Chưa đăng nhập.' };
    const users = this._getUsers() as any[];
    const idx = users.findIndex((x: any) => x.id === sess.id);
    if (idx === -1) return { ok: false, message: 'Không tìm thấy người dùng.' };
    if (users[idx].password !== req.oldPassword)
      return { ok: false, reason: 'wrong_old_password', message: 'Mật khẩu hiện tại không đúng.' };
    if (req.newPassword.length < 6)
      return { ok: false, reason: 'weak_password', message: 'Mật khẩu mới phải ≥ 6 ký tự.' };
    if (req.newPassword === req.oldPassword)
      return { ok: false, message: 'Mật khẩu mới không được trùng mật khẩu cũ.' };

    users[idx] = { ...users[idx], password: req.newPassword };
    this._setUsers(users);
    return { ok: true };
  }

  // ─── Audit log ───────────────────────────────────────────────────────────────
  private _log(action: string, who: string, meta: Record<string, unknown> = {}): void {
    const entry = {
      id: Date.now().toString(),
      action,
      who,
      metadata: meta,
      timestamp: new Date().toISOString(),
    };
    try {
      this.http.post(`${API_BASE}/auditLogs`, entry).subscribe({ error: () => {} });
    } catch {}
  }
}
