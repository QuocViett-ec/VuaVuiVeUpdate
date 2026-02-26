import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  show(message: string, type: Toast['type'] = 'info', duration = 3500): void {
    const id = Date.now().toString();
    this._toasts.update((t) => [...t, { id, message, type, duration }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(msg: string, duration?: number): void {
    this.show(msg, 'success', duration);
  }
  error(msg: string, duration?: number): void {
    this.show(msg, 'error', duration ?? 5000);
  }
  warning(msg: string, duration?: number): void {
    this.show(msg, 'warning', duration);
  }
  info(msg: string, duration?: number): void {
    this.show(msg, 'info', duration);
  }

  dismiss(id: string): void {
    this._toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
