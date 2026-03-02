import { Component, ChangeDetectionStrategy, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vnpay-return-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vnpay-return-page.component.html',
  styleUrl: './vnpay-return-page.component.scss',
  host: { class: 'vnpay-page-host' } })
export class VnpayReturnPageComponent implements OnInit {
  loading  = signal(true);
  success  = signal(false);
  orderId  = signal('');
  amount   = signal('');
  bankCode = signal('');
  payDate  = signal('');
  message  = signal('');

  constructor(
    private route:    ActivatedRoute,
    private orderSvc: OrderService,
  ) {}

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    const code     = p['vnp_ResponseCode'];
    const info     = p['vnp_OrderInfo']   || '';
    const amt      = p['vnp_Amount']      || '0';
    const bank     = p['vnp_BankCode']    || '';
    const rawDate  = p['vnp_PayDate']     || '';

    const orderIdMatch = info.match(/ORD-[A-Z0-9-]+/);
    const orderId = orderIdMatch ? orderIdMatch[0] : '';

    // Format amount (VNPay sends in units * 100)
    const formatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(parseInt(amt) / 100);

    // Format date  yyyyMMddHHmmss  →  dd/MM/yyyy HH:mm:ss
    let dateStr = rawDate;
    if (rawDate.length === 14) {
      dateStr = rawDate.slice(6,8) + '/' + rawDate.slice(4,6) + '/' + rawDate.slice(0,4)
        + ' ' + rawDate.slice(8,10) + ':' + rawDate.slice(10,12) + ':' + rawDate.slice(12,14);
    }

    this.amount.set(formatted);
    this.bankCode.set(bank);
    this.payDate.set(dateStr);

    if (code === '00' && orderId) {
      this.orderSvc.markOrderPaid(orderId).subscribe({
        next: () => {
          this.orderId.set(orderId);
          this.success.set(true);
          this.loading.set(false);
        },
        error: () => {
          // Even if marking fails, VNPay confirmed payment
          this.orderId.set(orderId);
          this.success.set(true);
          this.loading.set(false);
        } });
    } else {
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
        '99': 'Lỗi không xác định.' };
      this.message.set(messages[code] ?? 'Thanh toán không thành công.');
      this.loading.set(false);
    }
  }
}
