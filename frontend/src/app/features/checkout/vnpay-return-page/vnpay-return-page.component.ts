import { Component, ChangeDetectionStrategy, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { PaymentService } from '../../../core/services/payment.service';

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
  success = signal(false);
  orderId = signal('');
  amount = signal('');
  bankCode = signal('');
  payDate = signal('');
  message = signal('');
  countdown = signal(3);

  private _countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private orderSvc: OrderService,
    private paymentSvc: PaymentService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams as Record<string, string>;
    const code = p['vnp_ResponseCode'];
    const info = p['vnp_OrderInfo'] || '';
    const amt = p['vnp_Amount'] || '0';
    const bank = p['vnp_BankCode'] || '';
    const rawDate = p['vnp_PayDate'] || '';

    const orderIdMatch = info.match(/ORD-[A-Z0-9-]+/);
    // Ưu tiên vnp_TxnRef (chứa orderId chính xác), fallback sang regex từ OrderInfo
    const orderId = (p['vnp_TxnRef'] || '').trim() || (orderIdMatch ? orderIdMatch[0] : '');
    const txnNo = (p['vnp_TransactionNo'] || '').trim();

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
      this.message.set(messages[rawCode] ?? 'Thanh toán không thành công.');
      this.loading.set(false);
      this._startCountdown();
    };

    if (!orderId) {
      failWithCode(code || '99');
      return;
    }

    this.paymentSvc.verifyVNPayReturn(p).subscribe({
      next: (verify) => {
        if (verify.success) {
          this.orderSvc
            .markOrderPaid(orderId, { gateway: 'vnpay', transactionId: txnNo })
            .subscribe({
              next: () => {
                this.orderId.set(orderId);
                this.success.set(true);
                this.loading.set(false);
                this._startCountdown();
              },
              error: () => {
                // Backend return đã verify và có thể đã cập nhật paid, vẫn hiển thị thành công.
                this.orderId.set(orderId);
                this.success.set(true);
                this.loading.set(false);
                this._startCountdown();
              },
            });
          return;
        }

        failWithCode(verify.code || code || '99');
      },
      error: () => {
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
