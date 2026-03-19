import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, Subscription, filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface RealtimeEvent<T = unknown> {
  type: string;
  payload: T;
}

@Injectable({ providedIn: 'root' })
export class RealtimeSyncService {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);

  private stream: EventSource | null = null;
  private eventsSubject = new Subject<RealtimeEvent>();
  readonly events$ = this.eventsSubject.asObservable();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private activeSubscribers = 0;
  private readonly boundOrderListener = (event: MessageEvent) => {
    this.pushEvent('order.status_updated', event);
  };
  private readonly boundProductListener = (event: MessageEvent) => {
    this.pushEvent('product.changed', event);
  };
  private readonly boundErrorListener = () => {
    // Stop browser-native reconnect storm and switch to controlled backoff.
    this.cleanupStream();
    this.scheduleReconnect();
  };
  private readonly boundOpenListener = () => {
    this.reconnectAttempt = 0;
  };

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    window.addEventListener('vvv:auth-logout', () => this.stop());
  }

  start(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.auth.isLoggedIn()) return;
    if (this.activeSubscribers <= 0) return;
    if (this.stream) return;

    const streamUrl = `${environment.apiBase}/api/realtime/stream`;
    this.stream = new EventSource(streamUrl, { withCredentials: true });
    this.stream.addEventListener('open', this.boundOpenListener);
    this.stream.addEventListener('error', this.boundErrorListener);
    this.stream.addEventListener('order.status_updated', this.boundOrderListener);
    this.stream.addEventListener('product.changed', this.boundProductListener);
  }

  stop(): void {
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    this.cleanupStream();
  }

  ofType<T = unknown>(type: string): Observable<RealtimeEvent<T>> {
    return new Observable<RealtimeEvent<T>>((subscriber) => {
      this.activeSubscribers += 1;
      this.start();

      const sub: Subscription = this.events$
        .pipe(filter((evt) => evt.type === type))
        .subscribe(subscriber as any);

      return () => {
        sub.unsubscribe();
        this.activeSubscribers = Math.max(0, this.activeSubscribers - 1);
        if (this.activeSubscribers === 0) {
          this.stop();
        }
      };
    });
  }

  private cleanupStream(): void {
    if (!this.stream) return;
    this.stream.removeEventListener('open', this.boundOpenListener);
    this.stream.removeEventListener('error', this.boundErrorListener);
    this.stream.removeEventListener('order.status_updated', this.boundOrderListener);
    this.stream.removeEventListener('product.changed', this.boundProductListener);
    this.stream.close();
    this.stream = null;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (!this.auth.isLoggedIn()) return;
    if (this.activeSubscribers <= 0) return;

    this.reconnectAttempt += 1;
    const delayMs = Math.min(30000, Math.max(1200, 1000 * 2 ** (this.reconnectAttempt - 1)));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.start();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private pushEvent(type: string, event: MessageEvent): void {
    try {
      const payload = JSON.parse(event.data);
      this.eventsSubject.next({ type, payload });
    } catch {
      // Ignore malformed events to keep stream alive.
    }
  }
}
