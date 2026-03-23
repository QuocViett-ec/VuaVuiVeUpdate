import {
  Component,
  ChangeDetectionStrategy,
  signal,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../../core/services/payment.service';

/**
 * VNPay return page — verify chữ ký server-side, hiển thị trạng thái.
 * Backend return endpoint commit trạng thái theo cơ chế idempotent.
 * IPN vẫn là nguồn commit chính, return đảm bảo đồng bộ nhanh cho UI.
 * Không dùng fallback regex để lấy orderId — bắt buộc phải có vnp_TxnRef.
 * Khi verify thành công (code=00): hiển thị "đang xác nhận".
 * Khi lỗi: hiển thị lỗi, KHÔNG set success = true.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vnpay-return-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vnpay-return-page.component.html',
  styleUrl: './vnpay-return-page.component.scss',
  host: { class: 'vnpay-page-host' },
})
export class VnpayReturnPageComponent implements OnInit, OnDestroy {
  loading = signal(true);
  /** true khi backend verify callback VNPay thành công */
  success = signal(false);
  orderId = signal('');
  amount = signal('');
  bankCode = signal('');
  payDate = signal('');
  message = signal('');
  countdown = signal(5);

  private route = inject(ActivatedRoute);
  private paymentSvc = inject(PaymentService);
  private router = inject(Router);

  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams as Record<string, string>;
    const code = p['vnp_ResponseCode'];
    const amt = p['vnp_Amount'] || '0';
    const bank = p['vnp_BankCode'] || '';
    const rawDate = p['vnp_PayDate'] || '';
    const txnNo = (p['vnp_TransactionNo'] || '').trim();

    // Bắt buộc dùng vnp_TxnRef — không fallback regex từ vnp_OrderInfo
    const orderId = (p['vnp_TxnRef'] || '').trim();

    // Format amount (VNPay sends in units * 100)
    const formatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
      parseInt(amt) / 100,
    );

    // Format date  yyyyMMddHHmmss  →  dd/MM/yyyy HH:mm:ss
    let dateStr = rawDate;
    if (rawDate.length === 14) {
      dateStr =
        rawDate.slice(6, 8) +
        '/' +
        rawDate.slice(4, 6) +
        '/' +
        rawDate.slice(0, 4) +
        ' ' +
        rawDate.slice(8, 10) +
        ':' +
        rawDate.slice(10, 12) +
        ':' +
        rawDate.slice(12, 14);
    }

    this.amount.set(formatted);
    this.bankCode.set(bank);
    this.payDate.set(dateStr);

    const failWithCode = (rawCode: string) => {
      const messages: Record<string, string> = {
        '07': 'Giao dịch bị nghi ngờ gian lận.',
        '09': 'Thẻ / tài khoản chưa đăng ký dịch vụ.',
        '10': 'Xác thực thẻ thất bại quá 3 lần.',
        '11': 'Đã hết hạn thanh toán.',
        '12': 'Thẻ / tài khoản bị khóa.',
        '24': 'Bạn đã hủy giao dịch.',
        '51': 'Số dư không đủ.',
        '65': 'Vượt hạn mức giao dịch trong ngày.',
        '75': 'Ngân hàng bảo trì.',
        '99': 'Lỗi không xác định.',
      };
      // KHÔNG set success(true) trong nhánh lỗi
      this.success.set(false);
      this.message.set(messages[rawCode] ?? 'Thanh toán không thành công.');
      this.loading.set(false);
      this._startCountdown();
    };

    // Từ chối ngay nếu không có vnp_TxnRef
    if (!orderId) {
      failWithCode(code || '99');
      return;
    }

    this.paymentSvc.verifyVNPayReturn(p).subscribe({
      next: (verify) => {
        if (verify.success) {
          this.orderId.set(orderId);
          this.success.set(true);
          this.message.set('Thanh toán VNPay thành công. Đơn hàng đã được xác nhận.');
          this.loading.set(false);
          this._startCountdown();
          return;
        }

        // Verify thất bại (sig sai, amount mismatch, v.v.)
        // KHÔNG set success(true)
        failWithCode(verify.code || code || '99');
      },
      error: () => {
        // Network/server error khi verify — không kết luận thành công
        failWithCode(code || '99');
      },
    });
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
