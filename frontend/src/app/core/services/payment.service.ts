import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

type Gateway = 'vnpay' | 'momo';

interface PaymentCreatePayload {
  orderId: string;
}

export interface VNPayReturnVerifyResult {
  success: boolean;
  code: string;
  message?: string;
  orderId?: string;
  transactionId?: string;
  amount?: number;
}

interface RawPaymentResponse {
  success?: boolean;
  data?: string;
  paymentUrl?: string;
  payUrl?: string;
  message?: string;
}

export interface PaymentUrlResult {
  success: boolean;
  paymentUrl: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly base = environment.paymentApi;
  private readonly writeOptions = {
    withCredentials: true,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  };

  constructor(private readonly http: HttpClient) {}

  createGatewayUrl(gateway: Gateway, payload: PaymentCreatePayload): Observable<PaymentUrlResult> {
    return this.http
      .post<RawPaymentResponse>(`${this.base}/${gateway}/create`, payload, this.writeOptions)
      .pipe(
        map((res) => ({
          success: Boolean(res?.success ?? true),
          paymentUrl: String(res?.paymentUrl || res?.data || res?.payUrl || ''),
          message: res?.message,
        })),
      );
  }

  verifyVNPayReturn(query: Record<string, string>): Observable<VNPayReturnVerifyResult> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).length > 0) {
        params = params.set(key, String(value));
      }
    });

    return this.http
      .get<VNPayReturnVerifyResult>(`${this.base}/vnpay/return`, {
        params,
        withCredentials: true,
      })
      .pipe(
        map((res) => ({
          success: Boolean(res?.success),
          code: String(res?.code || '99'),
          message: res?.message,
          orderId: res?.orderId,
          transactionId: res?.transactionId,
          amount: res?.amount,
        })),
      );
  }
}
