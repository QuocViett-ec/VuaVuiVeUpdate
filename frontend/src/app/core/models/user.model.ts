export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  role?: 'customer' | 'admin';
  createdAt?: string;
}

export interface AuthSession {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  role?: string;
}

export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email?: string;
  phone: string;
  password: string;
  address?: string;
}

export interface AuthResponse {
  ok: boolean;
  message?: string;
  reason?: string;
  user?: User;
}

export interface UpdateProfileRequest {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}
