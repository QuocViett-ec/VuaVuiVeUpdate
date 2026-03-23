import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  loading?: boolean;
}

const QUICK_REPLIES = [
  { label: 'Tổng quan hôm nay', value: 'Tổng quan hệ thống hôm nay' },
  { label: 'Đơn trễ', value: 'Có đơn hàng nào đang bị trễ không?' },
  { label: 'Nguy cơ hủy đơn', value: 'Đơn nào có nguy cơ bị hủy?' },
  { label: 'Đơn chờ xử lý', value: 'Đơn nào đang chờ xác nhận?' },
  { label: 'Tồn kho thấp', value: 'Sản phẩm nào sắp hết hàng?' },
];

const ICON_TOKEN_MAP: Array<{ token: string; icon: string }> = [
  { token: '📦', icon: 'inventory_2' },
  { token: '👤', icon: 'person' },
  { token: '📞', icon: 'call' },
  { token: '📍', icon: 'location_on' },
  { token: '🛒', icon: 'shopping_cart' },
  { token: '💰', icon: 'payments' },
  { token: '💳', icon: 'credit_card' },
  { token: '📊', icon: 'analytics' },
  { token: '🕐', icon: 'schedule' },
  { token: '⏳', icon: 'hourglass_top' },
  { token: '✅', icon: 'check_circle' },
  { token: '❌', icon: 'cancel' },
  { token: '⚠️', icon: 'warning' },
  { token: '⚠', icon: 'warning' },
  { token: '🚨', icon: 'emergency' },
  { token: '🔴', icon: 'radio_button_checked' },
  { token: '💡', icon: 'lightbulb' },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-chatbot.component.html',
  styleUrl: './admin-chatbot.component.scss',
})
export class AdminChatbotComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  private http = inject(HttpClient);

  isOpen = signal(false);
  messages = signal<ChatMessage[]>([
    {
      role: 'bot',
      content: `Xin chào, trợ lý nội bộ Vựa Vui Vẻ có thể giúp bạn:\n• Tra cứu đơn hàng theo mã\n• Phân tích đơn trễ\n• Phát hiện nguy cơ hủy đơn\n• Xem tổng quan hệ thống\n\nHãy nhập yêu cầu của bạn.`,
      timestamp: new Date(),
    },
  ]);
  inputValue = signal('');
  isLoading = signal(false);
  hasUnread = signal(false);
  quickReplies = QUICK_REPLIES;

  private shouldScroll = false;

  toggleChat(): void {
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.hasUnread.set(false);
      this.shouldScroll = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  sendQuickReply(reply: { label: string; value: string }): void {
    this.sendMessage(reply.value);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(text?: string): void {
    const msg = (text || this.inputValue()).trim();
    if (!msg || this.isLoading()) return;

    // Add user message
    this.messages.update((msgs) => [
      ...msgs,
      { role: 'user', content: msg, timestamp: new Date() },
    ]);
    this.inputValue.set('');
    this.isLoading.set(true);
    this.shouldScroll = true;

    // Add loading bot message
    this.messages.update((msgs) => [
      ...msgs,
      { role: 'bot', content: '', timestamp: new Date(), loading: true },
    ]);
    this.shouldScroll = true;

    this.http
      .post<{
        success: boolean;
        data: { message: string; type: string };
      }>(`${environment.apiBase}/api/admin/chatbot`, { message: msg }, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.messages.update((msgs) => {
            const updated = [...msgs];
            const lastIdx = updated.length - 1;
            updated[lastIdx] = {
              role: 'bot',
              content: res.data?.message || 'Không có phản hồi.',
              timestamp: new Date(),
              loading: false,
            };
            return updated;
          });
          this.isLoading.set(false);
          this.shouldScroll = true;
          if (!this.isOpen()) this.hasUnread.set(true);
        },
        error: () => {
          this.messages.update((msgs) => {
            const updated = [...msgs];
            const lastIdx = updated.length - 1;
            updated[lastIdx] = {
              role: 'bot',
              content: '⚠️ Không thể kết nối đến server. Vui lòng thử lại.',
              timestamp: new Date(),
              loading: false,
            };
            return updated;
          });
          this.isLoading.set(false);
          this.shouldScroll = true;
        },
      });
  }

  clearChat(): void {
    this.messages.set([
      {
        role: 'bot',
        content: `Trợ lý nội bộ Vựa Vui Vẻ đã sẵn sàng. Hãy nhập yêu cầu của bạn!`,
        timestamp: new Date(),
      },
    ]);
  }

  formatMessage(content: string): string {
    const safeContent = this.escapeHtml(content);
    const withIcons = this.replaceIconTokens(safeContent);

    return withIcons
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  private replaceIconTokens(content: string): string {
    let next = content;
    for (const item of ICON_TOKEN_MAP) {
      const iconHtml = `<span class="material-symbols-outlined chat-inline-icon" aria-hidden="true">${item.icon}</span>`;
      next = next.split(item.token).join(iconHtml);
    }
    return next;
  }

  private escapeHtml(content: string): string {
    return String(content || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
}
