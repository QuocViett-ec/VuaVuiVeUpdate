import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type EventType = 'view_product' | 'add_to_cart' | 'purchase' | 'view_recipe';

@Injectable({ providedIn: 'root' })
export class EventTrackingService {
  private http = inject(HttpClient);
  private readonly api = `${environment.apiBase}/api/recommend/event`;

  /**
   * Gửi sự kiện hành vi người dùng lên backend (fire & forget).
   * Không throw error nếu backend không chạy.
   */
  trackEvent(
    eventType: EventType,
    productId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.http
      .post(this.api, { eventType, productId, metadata }, { withCredentials: true })
      .subscribe({ error: () => { /* silent fail */ } });
  }
}
