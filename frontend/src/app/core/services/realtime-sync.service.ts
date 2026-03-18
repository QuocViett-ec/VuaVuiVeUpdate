import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject, filter } from 'rxjs';
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

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    window.addEventListener('vvv:auth-logout', () => this.stop());
  }

  start(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.auth.isLoggedIn()) return;
    if (this.stream) return;

    const streamUrl = `${environment.apiBase}/api/realtime/stream`;
    this.stream = new EventSource(streamUrl, { withCredentials: true });

    this.stream.addEventListener('order.status_updated', (event: MessageEvent) => {
      this.pushEvent('order.status_updated', event);
    });

    this.stream.addEventListener('product.changed', (event: MessageEvent) => {
      this.pushEvent('product.changed', event);
    });
  }

  stop(): void {
    if (this.stream) {
      this.stream.close();
      this.stream = null;
    }
  }

  ofType<T = unknown>(type: string): Observable<RealtimeEvent<T>> {
    this.start();
    return this.events$.pipe(filter((evt) => evt.type === type)) as Observable<RealtimeEvent<T>>;
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
