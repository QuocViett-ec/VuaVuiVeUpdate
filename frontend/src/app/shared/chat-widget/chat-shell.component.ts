import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, Inject, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationStart, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

type ChatRole = 'bot' | 'user';

interface ChatMessage {
  role: ChatRole;
  text: string;
}

interface SuggestionItem {
  label: string;
  question: string;
  answer: string;
}

interface ChatbotResponse {
  success?: boolean;
  reply?: string;
  message?: string;
  detail?: string;
}

@Component({
  selector: 'app-chat-shell',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="vv-chat" *ngIf="enabled">
      <div class="vv-panel" *ngIf="isOpen" id="vv-chat-panel">
        <header class="vv-header">
          <div>
            <div class="vv-status">Ho tro nhanh</div>
            <h3>VuiVe Bot</h3>
            <p>Tra loi nhanh bang AI va cau tra loi san co.</p>
          </div>
          <button class="vv-close" type="button" (click)="isOpen = false" aria-label="Dong">
            x
          </button>
        </header>

        <div class="vv-suggestions">
          <button
            *ngFor="let item of suggestions"
            type="button"
            class="vv-chip"
            (click)="sendSuggestion(item)"
          >
            {{ item.label }}
          </button>
        </div>

        <div class="vv-messages">
          <article
            class="vv-message"
            *ngFor="let msg of messages"
            [class.vv-message--user]="msg.role === 'user'"
          >
            <div class="vv-avatar">{{ msg.role === 'bot' ? 'VV' : 'Ban' }}</div>
            <div class="vv-bubble">{{ msg.text }}</div>
          </article>
          <article class="vv-message" *ngIf="isSending">
            <div class="vv-avatar">VV</div>
            <div class="vv-bubble">Dang tra loi...</div>
          </article>
        </div>

        <form class="vv-input" (ngSubmit)="sendText()">
          <textarea
            name="message"
            [(ngModel)]="draft"
            rows="2"
            maxlength="400"
            placeholder="Nhap noi dung..."
            [disabled]="isSending"
          ></textarea>
          <button type="submit" [disabled]="isSending || !draft.trim()">Gui</button>
        </form>
      </div>

      <button
        class="vv-launcher"
        type="button"
        (click)="toggleOpen()"
        [attr.aria-expanded]="isOpen"
        aria-controls="vv-chat-panel"
      >
        <span class="vv-launcher__badge">Hoi nhanh</span>
        <span class="vv-launcher__icon">VV</span>
        <span class="vv-launcher__text">VuiVe Bot</span>
      </button>
    </section>
  `,
  styles: [
    `
      .vv-chat {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 1200;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }

      .vv-panel {
        position: absolute;
        right: 0;
        bottom: calc(100% + 14px);
        width: min(390px, calc(100vw - 24px));
        height: min(700px, calc(100vh - 100px));
        border-radius: 24px;
        overflow: hidden;
        border: 1px solid rgba(58, 112, 74, 0.18);
        background: linear-gradient(180deg, #f7fbf4 0%, #edf6eb 100%);
        box-shadow: 0 24px 70px rgba(24, 52, 34, 0.24);
        display: flex;
        flex-direction: column;
      }

      .vv-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 18px 18px 14px;
        background: linear-gradient(130deg, #215b36 0%, #3b8b52 55%, #86c055 100%);
        color: #fff;
      }

      .vv-status {
        display: inline-block;
        margin-bottom: 8px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.2);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .vv-header h3 {
        margin: 0;
        font-size: 26px;
        line-height: 1.1;
      }

      .vv-header p {
        margin: 6px 0 0;
        font-size: 13px;
        opacity: 0.95;
      }

      .vv-close {
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        flex: 0 0 auto;
      }

      .vv-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px;
        border-bottom: 1px solid rgba(80, 128, 83, 0.14);
        background: rgba(255, 255, 255, 0.65);
      }

      .vv-chip {
        border: 1px solid rgba(74, 122, 79, 0.2);
        border-radius: 999px;
        background: #fff;
        color: #1f3a29;
        padding: 8px 11px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(44, 73, 51, 0.08);
      }

      .vv-chip:hover {
        background: #f4fbf1;
      }

      .vv-messages {
        flex: 1;
        overflow: auto;
        padding: 12px;
      }

      .vv-message {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
        align-items: flex-end;
      }

      .vv-message--user {
        flex-direction: row-reverse;
      }

      .vv-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #dceedd;
        color: #204733;
        font-size: 11px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
      }

      .vv-message--user .vv-avatar {
        background: #2f7d4a;
        color: #fff;
      }

      .vv-bubble {
        max-width: 78%;
        padding: 10px 12px;
        border-radius: 15px 15px 15px 8px;
        background: #fff;
        color: #173024;
        font-size: 14px;
        line-height: 1.45;
        box-shadow: 0 8px 18px rgba(34, 60, 42, 0.08);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .vv-message--user .vv-bubble {
        border-radius: 15px 15px 8px 15px;
        background: linear-gradient(135deg, #2f7d4a 0%, #55a55d 100%);
        color: #fff;
      }

      .vv-input {
        display: flex;
        gap: 8px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.9);
        border-top: 1px solid rgba(83, 130, 86, 0.14);
      }

      .vv-input textarea {
        flex: 1;
        border: 1px solid rgba(84, 133, 87, 0.22);
        border-radius: 14px;
        padding: 10px 12px;
        background: #fff;
        color: #173024;
        -webkit-text-fill-color: #173024;
        caret-color: #245f39;
        resize: none;
        font: inherit;
        line-height: 1.4;
        outline: none;
      }

      .vv-input textarea::placeholder {
        color: #6f826f;
        -webkit-text-fill-color: #6f826f;
      }

      .vv-input button {
        border: 0;
        border-radius: 12px;
        background: linear-gradient(135deg, #2f7d4a 0%, #56a45c 100%);
        color: #fff;
        padding: 0 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .vv-input button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .vv-launcher {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        border: 0;
        border-radius: 999px;
        padding: 12px 16px 12px 12px;
        background: linear-gradient(135deg, #2f7d4a 0%, #5cab57 100%);
        color: #fff;
        box-shadow: 0 16px 35px rgba(28, 72, 44, 0.28);
        cursor: pointer;
        margin-left: auto;
      }

      .vv-launcher__badge {
        position: absolute;
        top: -8px;
        left: 14px;
        padding: 3px 8px;
        border-radius: 999px;
        background: #fff4cf;
        color: #805d06;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .vv-launcher__icon {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
      }

      .vv-launcher__text {
        font-size: 14px;
        font-weight: 700;
      }

      @media (max-width: 640px) {
        .vv-chat {
          right: 12px;
          bottom: 12px;
        }

        .vv-panel {
          width: calc(100vw - 24px);
          height: min(72vh, 620px);
        }

        .vv-launcher__text {
          display: none;
        }
      }
    `,
  ],
})
export class ChatShellComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly enabled = environment.chatbotEnabled && !!environment.chatbotApi;
  readonly webhookTimeoutMs = 6000;
  isOpen = false;
  isSending = false;
  draft = '';
  private readonly sessionId: string;
  private routeSub?: Subscription;

  readonly suggestions: SuggestionItem[] = [
    {
      label: 'Cach dat hang',
      question: 'Cach dat hang tren VuaVuiVe nhu the nao?',
      answer:
        'Ban chon san pham, them vao gio hang, vao thanh toan, nhap dia chi va xac nhan don hang.',
    },
    {
      label: 'Phi giao hang',
      question: 'Phi giao hang duoc tinh ra sao?',
      answer:
        'Phi ship phu thuoc khu vuc, thoi diem va gia tri don. He thong se hien thi phi truoc khi ban xac nhan.',
    },
    {
      label: 'San pham noi bat',
      question: 'Hom nay co nhom san pham nao noi bat?',
      answer:
        'Ban co the xem rau cu tuoi, trai cay theo mua, do kho va cac mat hang ban chay ngay tren trang chu.',
    },
    {
      label: 'Lien he ho tro',
      question: 'Can lien he ho tro thi lam sao?',
      answer:
        'Ban xem thong tin lien he o chan trang hoac gui yeu cau qua trang lien he de duoc ho tro nhanh.',
    },
  ];

  messages: ChatMessage[] = [
    { role: 'bot', text: 'Xin chao, minh la VuiVe Bot.' },
    {
      role: 'bot',
      text: 'Ban co the bam cac goi y de nhan cau tra loi nhanh. Neu tu go cau hoi, minh se tra loi bang AI.',
    },
  ];

  constructor(
    @Inject(PLATFORM_ID) platformId: object,
    private router: Router,
  ) {
    this.sessionId = this.getSessionId(platformId);

    this.routeSub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.isOpen = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  sendSuggestion(item: SuggestionItem): void {
    this.messages = [
      ...this.messages,
      { role: 'user', text: item.question },
      { role: 'bot', text: item.answer },
    ];
    this.scrollToBottom();
  }

  sendText(): void {
    const text = this.draft.trim();
    if (!text || this.isSending) return;

    this.messages = [...this.messages, { role: 'user', text }];
    this.draft = '';
    this.isSending = true;
    this.scrollToBottom();

    this.http
      .post<ChatbotResponse>(environment.chatbotApi, {
        message: text,
        sessionId: this.sessionId,
      })
      .pipe(timeout(this.webhookTimeoutMs))
      .subscribe({
        next: (response) => {
          if (!response?.success || !response.reply) {
            throw new Error(response?.message || 'AI returned no reply');
          }

          this.messages = [
            ...this.messages,
            { role: 'bot', text: `[AI] ${response.reply.trim()}` },
          ];
          this.isSending = false;
          this.scrollToBottom();
        },
        error: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          const fallback = this.resolveLocalFallback(text);
          const timeoutError = message.toLowerCase().includes('timeout');
          this.messages = [
            ...this.messages,
            {
              role: 'bot',
              text: timeoutError
                ? fallback ||
                  'AI phan hoi cham qua, minh da dung cho de ban khong doi lau. Ban thu hoi ngan gon hon hoac bam cau hoi goi y nha.'
                : fallback || `Ket noi AI dang loi: ${message}`,
            },
          ];
          this.isSending = false;
          this.scrollToBottom();
        },
      });
  }

  private resolveLocalFallback(text: string): string {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    if (
      normalized.includes('giao hang') ||
      normalized.includes('ship') ||
      normalized.includes('van chuyen')
    ) {
      return 'Tam thoi AI dang ban. Ve giao hang, don thuong duoc giao trong 1-3 gio tuy khu vuc va thoi diem dat.';
    }

    if (
      normalized.includes('dat hang') ||
      normalized.includes('mua hang') ||
      normalized.includes('thanh toan')
    ) {
      return 'Tam thoi AI dang ban. Ban co the chon san pham, them vao gio, vao thanh toan, nhap dia chi va xac nhan don hang.';
    }

    if (
      normalized.includes('lien he') ||
      normalized.includes('ho tro') ||
      normalized.includes('hotline')
    ) {
      return 'Tam thoi AI dang ban. Ban vui long xem thong tin lien he o chan trang hoac gui yeu cau qua trang lien he de duoc ho tro nhanh.';
    }

    if (
      normalized.includes('san pham') ||
      normalized.includes('ban chay') ||
      normalized.includes('noi bat')
    ) {
      return 'Tam thoi AI dang ban. Ban co the xem cac nhom rau cu tuoi, trai cay theo mua, do kho va cac mat hang ban chay ngay tren trang chu.';
    }

    return '';
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const container = document.querySelector('.vv-messages');
      container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }, 30);
  }

  private getSessionId(platformId: object): string {
    if (!isPlatformBrowser(platformId)) {
      return 'vuive-ssr';
    }

    const storageKey = 'vuive-chat-session-id';
    const existing = window.localStorage.getItem(storageKey);
    if (existing) return existing;

    const created = `vuive-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(storageKey, created);
    return created;
  }
}
