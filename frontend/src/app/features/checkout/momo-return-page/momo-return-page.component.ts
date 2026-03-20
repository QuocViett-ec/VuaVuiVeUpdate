import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';

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
  private orderSvc = inject(OrderService);

  loading = signal(true);
  success = signal(false);
  orderId = signal('');
  amount = signal('');
  message = signal('');
  countdown = signal(3);

  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    const resultCode = Number(p['resultCode'] ?? '-1');
    const orderId = p['orderId'] ?? '';
    const transId = String(p['transId'] ?? '').trim();
    const rawAmount = p['amount'] ?? '0';
    const errMessage = p['message'] ?? 'Thanh toán không thành công.';

    const formatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
      Number(rawAmount),
    );

    this.amount.set(formatted);

    if (resultCode === 0 && orderId) {
      this.orderSvc.markOrderPaid(orderId, { gateway: 'momo', transactionId: transId }).subscribe({
        next: () => {
          this.orderId.set(orderId);
          this.success.set(true);
          this.loading.set(false);
          this._startCountdown();
        },
        error: () => {
          // MoMo đã xác nhận — vẫn hiển thị thành công
          this.orderId.set(orderId);
          this.success.set(true);
          this.loading.set(false);
          this._startCountdown();
        },
      });
    } else {
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
      this.message.set(momoErrors[String(resultCode)] ?? errMessage);
      this.loading.set(false);
      this._startCountdown();
    }
  }

  private _startCountdown(): void {
    this._countdownTimer = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);
      if (next <= 0) {
        clearInterval(this._countdownTimer!);
        this.router.navigate(['/orders']);
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
  }
}
