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
          <div class="vv-header__info">
            <div class="vv-header__avatar">🍏</div>
            <div>
              <h3>Vựa Vui Vẻ AI <span class="vv-status-dot"></span></h3>
              <p>Luôn sẵn sàng hỗ trợ bạn</p>
            </div>
          </div>
          <button class="vv-close" type="button" (click)="isOpen = false" aria-label="Đóng Chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
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
            <div class="vv-avatar">{{ msg.role === 'bot' ? '🍏' : 'Bạn' }}</div>
            <div class="vv-bubble" [innerHTML]="formatMessage(msg.text)"></div>
          </article>
          <article class="vv-message" *ngIf="isSending">
            <div class="vv-avatar">🍏</div>
            <div class="vv-bubble">
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </article>
        </div>

        <form class="vv-input" (ngSubmit)="sendText()">
          <textarea
            name="message"
            [(ngModel)]="draft"
            rows="1"
            maxlength="400"
            placeholder="Nhập nội dung hỏi đáp..."
            [disabled]="isSending"
            (keydown.enter)="onEnter($event)"
          ></textarea>
          <button type="submit" [disabled]="isSending || !draft.trim()">Gửi</button>
        </form>
      </div>

      <button
        class="vv-launcher"
        type="button"
        (click)="toggleOpen()"
        [attr.aria-expanded]="isOpen"
        aria-controls="vv-chat-panel"
        title="Trợ lý Vựa Vui Vẻ"
      >
        <span class="vv-launcher__icon">🍏</span>
      </button>
    </section>
  `,
  styles: [
    `
      .vv-chat {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 1200;
        font-family: 'Segoe UI', system-ui, sans-serif;
      }

      .vv-panel {
        position: absolute;
        right: 0;
        bottom: calc(100% + 16px);
        width: min(390px, calc(100vw - 32px));
        height: min(720px, calc(100vh - 110px));
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: #ffffff;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
        display: flex;
        flex-direction: column;
      }

      .vv-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: #ffffff;
        color: #1e293b;
        border-bottom: 1px solid #e2e8f0;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        position: relative;
        z-index: 10;
      }

      .vv-header__info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .vv-header__avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(34, 197, 94, 0.2);
        border: 2px solid #fff;
      }

      .vv-header h3 {
        margin: 0 0 4px 0;
        font-size: 17px;
        font-weight: 800;
        color: #0f172a;
        display: flex;
        align-items: center;
        gap: 8px;
        letter-spacing: -0.3px;
      }

      .vv-status-dot {
        width: 8px;
        height: 8px;
        background-color: #22c55e;
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
        70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
        100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
      }

      .vv-header p {
        margin: 0;
        font-size: 13px;
        color: #64748b;
        font-weight: 500;
      }

      .vv-close {
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 50%;
        background: #f1f5f9;
        color: #64748b;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .vv-close:hover {
        background: #e2e8f0;
        color: #0f172a;
        transform: rotate(90deg);
      }

      .vv-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px 16px;
        background: #fffdf2; /* Tone vàng nhạt vanilla / lúa mạch */
        border-bottom: 1px solid #fef08a;
      }

      .vv-chip {
        border: 1px solid #fde047;
        border-radius: 20px;
        background: #ffffff;
        color: #854d0e; /* Nâu vàng ấm */
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s ease;
        box-shadow: 0 1px 2px rgba(250, 204, 21, 0.1);
      }

      .vv-chip:hover {
        background: #fef08a;
        border-color: #facc15;
        color: #713f12;
        transform: translateY(-2px);
        box-shadow: 0 4px 6px -1px rgba(234, 179, 8, 0.25);
      }

      .vv-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #ffffff;
      }

      .vv-message {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        align-items: flex-end;
      }

      .vv-message--user {
        flex-direction: row-reverse;
      }

      .vv-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #dcfce7;
        color: #166534;
        font-size: 11px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .vv-message--user .vv-avatar {
        background: #166534;
        color: #fff;
      }

      .vv-bubble {
        max-width: 75%;
        padding: 12px 16px;
        border-radius: 18px 18px 18px 4px;
        background: #f1f5f9;
        color: #1e293b;
        font-size: 14px;
        line-height: 1.5;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        border: 1px solid #e2e8f0;
      }

      .vv-message--user .vv-bubble {
        border-radius: 18px 18px 4px 18px;
        background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
        color: #fff;
        border: none;
        box-shadow: 0 4px 12px rgba(34,197,94,0.3);
      }

      /* Typing indicator animation */
      .typing-indicator {
        display: flex;
        gap: 4px;
        padding: 4px 2px;
      }
      .typing-indicator span {
        width: 6px;
        height: 6px;
        background-color: #94a3b8;
        border-radius: 50%;
        animation: typing 1.4s infinite ease-in-out both;
      }
      .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
      .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
      @keyframes typing {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      .vv-input {
        display: flex;
        gap: 10px;
        padding: 16px;
        background: #fff;
        border-top: 1px solid #f1f5f9;
        align-items: center;
      }

      .vv-input textarea {
        flex: 1;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        padding: 12px 16px;
        background: #f8fafc;
        color: #0f172a;
        resize: none;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
        outline: none;
        height: 44px;
        transition: all 0.2s ease;
        overflow: hidden;
        scrollbar-width: none;
      }

      .vv-input textarea:focus {
        border-color: #22c55e;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
      }

      .vv-input textarea::-webkit-scrollbar {
        display: none;
      }

      .vv-input button {
        border: 0;
        border-radius: 50%;
        background: #16a34a;
        color: #fff;
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 6px 16px rgba(22, 163, 74, 0.25);
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      .vv-input button:hover:not(:disabled) {
        transform: scale(1.08) translateY(-2px);
        background: #15803d;
        box-shadow: 0 8px 20px rgba(21, 128, 61, 0.35);
      }

      .vv-input button:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }

      .vv-launcher {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 68px;
        height: 68px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        box-shadow: none;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .vv-launcher__icon {
        font-size: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        border-radius: 50%;
        padding: 4px;
      }

      .vv-launcher:hover .vv-launcher__icon {
        transform: scale(1.1) translateY(-4px);
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px 0 rgba(117, 198, 137, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.5);
      }

      @media (max-width: 640px) {
        .vv-chat {
          right: 16px;
          bottom: 16px;
        }

        .vv-panel {
          width: calc(100vw - 32px);
          height: min(75vh, 600px);
        }

        .vv-launcher__text {
          display: none;
        }
        
        .vv-launcher {
          padding: 12px;
        }
      }
    `,
  ],
})
export class ChatShellComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  readonly enabled = environment.chatbotEnabled && !!environment.chatbotApi;
  readonly webhookTimeoutMs = 15000;
  isOpen = false;
  isSending = false;
  draft = '';
  private readonly sessionId: string;
  private routeSub?: Subscription;

  readonly suggestions: SuggestionItem[] = [
    {
      label: 'Cách đặt hàng',
      question: 'Cách đặt hàng trên Vựa Vui Vẻ như thế nào?',
      answer:
        'Dạ, bạn có thể tham quan gian hàng và <strong><a href="/products" style="color: #166534; font-weight: 900; background: #dcfce7; padding: 2px 6px; border-radius: 4px; text-decoration: none;">CHỌN MUA SẢN PHẨM TẠI ĐÂY</a></strong>. Sau đó bấm vào Giỏ hàng, nhập địa chỉ và thanh toán.\nVựa Vui Vẻ sẽ lên đơn và giao tận nơi ạ!',
    },
    {
      label: 'Phí giao hàng',
      question: 'Phí giao hàng được tính ra sao?',
      answer:
        'Vựa Vui Vẻ áp dụng <strong>Miễn phí giao hàng (Freeship)</strong> cho mọi đơn từ 300K. Các đơn dưới 300K sẽ có phí đồng giá 15K-25K tuỳ khu vực nha bạn.',
    },
    {
      label: 'Sản phẩm nổi bật',
      question: 'Hôm nay Vựa Vui Vẻ có nông sản nào nổi bật?',
      answer:
        'Dạ, Vựa Vui Vẻ luôn có trái cây theo mùa siêu tươi ngon và rau củ chuẩn sạch. Xin mời bạn <strong><a href="/products" style="color: #166534; font-weight: 900; background: #dcfce7; padding: 2px 6px; border-radius: 4px; text-decoration: none;">VÀO XEM MENU SẢN PHẨM</a></strong> để bắt kịp "mùa nào thức nấy" nha!',
    },
    {
      label: 'Liên hệ hỗ trợ',
      question: 'Cần liên hệ hỗ trợ thì làm sao?',
      answer:
        'Dạ, Trợ lý AI có thể giải đáp phần lớn thông tin cơ bản. Tuy nhiên, nếu bạn cần hỗ trợ gấp đơn hàng xin vui lòng gọi Hotline ở cuối trang hoặc liên hệ Fanpage Vựa Vui Vẻ nhé!',
    },
  ];

  messages: ChatMessage[] = [
    { role: 'bot', text: 'Xin chào, mình là Trợ lý AI của Vựa Vui Vẻ.' },
    {
      role: 'bot',
      text: 'Bạn có thể bấm các gợi ý ở trên để nhận câu trả lời nhanh. Nếu bạn gõ câu hỏi, mình sẽ cố gắng giải đáp các câu hỏi trong khả năng nhé!',
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

    // Instant Response (0ms)
    const reply = this.resolveLocalFallback(text);
    this.messages = [...this.messages, { role: 'bot', text: reply }];
    this.isSending = false;
    this.scrollToBottom();
  }

  onEnter(event: Event): void {
    event.preventDefault();
    this.sendText();
  }

  private resolveLocalFallback(text: string): string {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();

    if (
      normalized.includes('giao hang') ||
      normalized.includes('ship') ||
      normalized.includes('van chuyen') ||
      normalized.includes('nhan hang') ||
      normalized.includes('mat bao lau')
    ) {
      return 'Dạ, Vựa Vui Vẻ giao hàng siêu chuẩn xác. Trong nội thành chỉ **1-3 giờ** sau khi đặt là bạn có thể nhận nông sản tươi ngon rồi ạ! Đơn từ 300K còn được **Freeship** nữa nha.';
    }

    if (
      normalized.includes('dat hang') ||
      normalized.includes('mua hang') ||
      normalized.includes('thanh toan') ||
      normalized.includes('thanh tien') ||
      normalized.includes('cach mua')
    ) {
      return 'Dạ bạn hãy lướt xem các gian hàng và <strong><a href="/products" style="color: #166534; font-weight: 900; background: #dcfce7; padding: 2px 6px; border-radius: 4px; text-decoration: none;">CHON SẢN PHẨM Ở ĐÂY</a></strong> nha. Vựa Vui Vẻ hỗ trợ thanh toán khi nhận hàng (COD) hoặc quét mã Momo/VNPay cực kỳ tiện lợi ạ.';
    }

    if (
      normalized.includes('lien he') ||
      normalized.includes('ho tro') ||
      normalized.includes('hotline') ||
      normalized.includes('so dien thoai') ||
      normalized.includes('tong dai')
    ) {
      return 'Trợ lý AI luôn sẵn sàng 24/7! Nhưng nếu bạn cần khiếu nại hoặc kiểm tra gấp đơn hàng, xin vui lòng gọi ngay <strong>Hotline: 1900 xxxx</strong> ở chân trang ạ.';
    }

    if (
      normalized.includes('san pham') ||
      normalized.includes('ban chay') ||
      normalized.includes('noi bat') ||
      normalized.includes('ngon') ||
      normalized.includes('trai cay') ||
      normalized.includes('rau') ||
      normalized.includes('tuoi') ||
      normalized.includes('gia')
    ) {
      return 'Vựa Vui Vẻ tự hào cung cấp **rau củ sạch tươi rói mỗi sáng** và **trái cây ngọt lành theo mùa**. Mời bạn ghé qua <strong><a href="/products" style="color: #166534; font-weight: 900; background: #dcfce7; padding: 2px 6px; border-radius: 4px; text-decoration: none;">MENU SẢN PHẨM KHUYẾN MÃI</a></strong> để tha hồ lựa chọn nhé!';
    }

    if (
      normalized.includes('vua vui ve') ||
      normalized.includes('chao') ||
      normalized.includes('hello') ||
      normalized.includes('hi')
    ) {
      return 'Vựa Vui Vẻ AI xin chào! Mình có thể giúp gì cho bữa ăn gia đình bạn hôm nay ạ? Mình biết tư vấn Món ngon, Sản phẩm và Hướng dẫn đặt mua hàng nha.';
    }

    // Unrelated queries fallback
    return 'Xin lỗi bạn, Trợ lý AI chỉ được lập trình để giải đáp các thắc mắc xoay quanh <strong>nông sản và chính sách của Vựa Vui Vẻ</strong>. \n\nNếu bạn cần hỗ trợ vấn đề khác, vui lòng liên hệ trực tiếp <strong><a href="/" style="color: #166534; font-weight: 900; background: #dcfce7; padding: 2px 6px; border-radius: 4px; text-decoration: none;">Fanpage Vựa Vui Vẻ</a></strong> nhé!';
  }

  formatMessage(text: string): string {
    if (!text) return '';
    return text.replace(/\n/g, '<br>');
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
