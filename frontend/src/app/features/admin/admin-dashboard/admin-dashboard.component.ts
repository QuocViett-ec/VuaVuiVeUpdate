import { Component, inject, OnInit, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ProductService } from '../../../core/services/product.service';
import { OrderService } from '../../../core/services/order.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private prodSvc = inject(ProductService);
  private orderSvc = inject(OrderService);
  private platformId = inject(PLATFORM_ID);

  stats = signal<any[]>([]);
  recentOrders = signal<any[]>([]);

  ngOnInit(): void {
    forkJoin({
      products: this.prodSvc.getAllProducts(),
      orders: this.orderSvc.getOrders(),
      users: this.http.get<any[]>(`${environment.apiBase}/users`),
    }).subscribe(({ products, orders, users }) => {
      const paid = orders.filter((o: any) => o.paymentStatus === 'paid');
      const revenue = paid.reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0);
      this.stats.set([
        { icon: '🛍️', label: 'Sản phẩm', value: products.length.toLocaleString(), bg: '#dcfce7', color: '#15803d' },
        { icon: '📦', label: 'Đơn hàng', value: orders.length.toLocaleString(), bg: '#dbeafe', color: '#1d4ed8' },
        { icon: '👥', label: 'Người dùng', value: users.length.toLocaleString(), bg: '#fef9c3', color: '#a16207' },
        { icon: '💰', label: 'Doanh thu', value: revenue.toLocaleString('vi-VN') + 'đ', bg: '#fce7f3', color: '#be185d' },
      ]);
      this.recentOrders.set(orders.slice(-10).reverse());
      if (isPlatformBrowser(this.platformId)) {
        this.loadChartJs().then(() => this.drawCharts(orders));
      }
    });
  }

  private loadChartJs(): Promise<void> {
    return new Promise(resolve => {
      if ((window as any).Chart) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }

  private drawCharts(orders: any[]): void {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    // Revenue last 7 days
    const days: string[] = [], rev: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push(d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));
      rev.push(orders.filter((o: any) => o.createdAt?.slice(0, 10) === key && o.paymentStatus === 'paid')
        .reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0));
    }
    const rc = document.getElementById('revenueChart') as HTMLCanvasElement;
    if (rc) {
      if ((rc as any).__ch) (rc as any).__ch.destroy();
      (rc as any).__ch = new Chart(rc, {
        type: 'line',
        data: { labels: days, datasets: [{ label: 'Doanh thu', data: rev, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', tension: .4, fill: true, pointBackgroundColor: '#10b981' }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => v.toLocaleString('vi-VN') } } } }
      });
    }
    // Status donut
    const cnt: Record<string, number> = {};
    orders.forEach((o: any) => { cnt[o.status] = (cnt[o.status] || 0) + 1; });
    const sc = document.getElementById('statusChart') as HTMLCanvasElement;
    if (sc) {
      if ((sc as any).__ch) (sc as any).__ch.destroy();
      (sc as any).__ch = new Chart(sc, {
        type: 'doughnut',
        data: { labels: Object.keys(cnt), datasets: [{ data: Object.values(cnt), backgroundColor: ['#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899'] }] },
        options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }, cutout: '60%' }
      });
    }
  }
}
