import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { PaymentService } from '../../../core/services/payment.service';

/**
 * MoMo return page — luôn verify server-side qua backend trước khi hiển thị kết quả.
 * Backend return endpoint sẽ commit trạng thái theo cơ chế idempotent.
 * IPN vẫn là nguồn commit chính, return đảm bảo đồng bộ nhanh cho UI.
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
  private paymentSvc = inject(PaymentService);

  loading = signal(true);
  /** true khi backend verify callback MoMo thành công */
  success = signal(false);
  orderId = signal('');
  amount = signal('');
  message = signal('');
  countdown = signal(5);

  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams as Record<string, string>;
    const resultCode = Number(p['resultCode'] ?? '-1');
    const orderId = String(p['orderId'] ?? '').trim();
    const rawAmount = p['amount'] ?? '0';
    const errMessage = String(p['message'] ?? 'Thanh toán không thành công.');

    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(rawAmount));

    this.amount.set(formatted);

    const failWithCode = (rawCode: string, fallbackMessage?: string) => {
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
      this.success.set(false);
      this.message.set(momoErrors[String(rawCode)] ?? fallbackMessage ?? errMessage);
      this.loading.set(false);
      this._startCountdown('/orders');
    };

    if (!orderId) {
      failWithCode(String(resultCode || 99));
      return;
    }

    this.paymentSvc.verifyMoMoReturn(p).subscribe({
      next: (verify) => {
        if (verify.success) {
          this.orderId.set(String(verify.orderId || orderId));
          this.success.set(true);
          this.message.set('Thanh toán MoMo thành công. Đơn hàng đã được xác nhận.');
          this.loading.set(false);
          this._startCountdown('/orders');
          return;
        }
        failWithCode(verify.code || String(resultCode || 99), verify.message || errMessage);
      },
      error: () => {
        failWithCode(String(resultCode || 99));
      },
    });
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
