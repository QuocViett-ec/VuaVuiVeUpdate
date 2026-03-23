import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';

/**
 * MoMo return page — chỉ đọc query params từ MoMo redirect, hiển thị trạng thái.
 * KHÔNG gọi markOrderPaid ở đây — paid được commit bởi MoMo IPN server-to-server.
 * Khi resultCode === 0: hiển thị "thanh toán được xác nhận, đang xử lý".
 * Khi resultCode !== 0: hiển thị lỗi cụ thể, KHÔNG set success = true.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-momo-return-page',
  imports: [RouterLink],
  templateUrl: './momo-return-page.component.html',
  styleUrl: './momo-return-page.component.scss',
  host: { class: 'momo-page-host' },
})
export class MomoReturnPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  /** true chỉ khi verify thành công (resultCode === 0) */
  success = signal(false);
  /** true khi thanh toán thành công nhưng vẫn đang đợi IPN xác nhận */
  pending = signal(false);
  orderId = signal('');
  amount = signal('');
  message = signal('');
  countdown = signal(5);

  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    const resultCode = Number(p['resultCode'] ?? '-1');
    const orderId = String(p['orderId'] ?? '').trim();
    const rawAmount = p['amount'] ?? '0';
    const errMessage = String(p['message'] ?? 'Thanh toán không thành công.');

    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(rawAmount));

    this.amount.set(formatted);

    if (resultCode === 0 && orderId) {
      // Thanh toán thành công ở phía MoMo.
      // Paid status sẽ được cập nhật qua IPN server-to-server — không gọi API ở đây.
      this.orderId.set(orderId);
      this.pending.set(true);  // chờ IPN, hiển thị màn hình "đang xử lý"
      this.success.set(false); // chưa confirmed paid trong DB
      this.loading.set(false);
      this._startCountdown('/orders');
    } else {
      // Thanh toán thất bại hoặc bị huỷ — hiển thị lỗi.
      const momoErrors: Record<string, string> = {
        '1001': 'Giao dịch thất bại do nguồn tiền không hợp lệ.',
        '1002': 'Bị từ chối bởi nhà phát hành thẻ.',
        '1003': 'Đã hết hạn thanh toán.',
        '1004': 'Số tiền vượt quá hạn mức thanh toán.',
        '1005': 'URL thanh toán không tồn tại hoặc đã hết hạn.',
        '1006': 'Giao dịch bị từ chối.',
        '1007': 'Tài khoản không tồn tại hoặc chưa kích hoạt.',
        '1026': 'Giao dịch bị từ chối do vi phạm chính sách.',
        '1080': 'Đối tác không thể thực hiện hoàn tiền.',
        '1088': 'Thông tin thẻ không hợp lệ.',
        '2001': 'Giao dịch không thành công.',
        '9000': 'Giao dịch bị hủy bởi người dùng.',
      };
      // KHÔNG set success(true) trong nhánh lỗi
      this.success.set(false);
      this.pending.set(false);
      this.message.set(momoErrors[String(resultCode)] ?? errMessage);
      this.loading.set(false);
      this._startCountdown('/orders');
    }
  }

  private _startCountdown(destination: string): void {
    this._countdownTimer = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);
      if (next <= 0) {
        clearInterval(this._countdownTimer!);
        this.router.navigate([destination]);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
  }
}
