import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';

interface MonthStat {
  month: string;
  revenue: number;
  orders: number;
}

interface DayStat {
  day: string;
  revenue: number;
  orders: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-reports.component.html',
  styleUrl: './admin-reports.component.scss',
})
export class AdminReportsComponent implements OnInit {
  private orderSvc = inject(OrderService);
  private platformId = inject(PLATFORM_ID);

  byMonth = signal<MonthStat[]>([]);
  byDay = signal<DayStat[]>([]);
  totalRevenue = signal(0);
  totalOrders = signal(0);

  ngOnInit(): void {
    this.orderSvc.getAdminOrders({ limit: 1000 }).subscribe((orders) => {
      const map: Record<string, MonthStat> = {};
      const dailyMap: Record<string, DayStat> = {};
      orders.forEach((o) => {
        const m = new Date(o.createdAt).toISOString().slice(0, 7);
        const d = new Date(o.createdAt).toISOString().slice(0, 10);
        if (!map[m]) map[m] = { month: m, revenue: 0, orders: 0 };
        if (!dailyMap[d]) dailyMap[d] = { day: d, revenue: 0, orders: 0 };
        map[m].revenue += o.totalAmount ?? 0;
        map[m].orders++;
        dailyMap[d].revenue += o.totalAmount ?? 0;
        dailyMap[d].orders++;
      });
      const sorted = Object.values(map).sort((a, b) => a.month.localeCompare(b.month));
      const last30Days = Object.values(dailyMap)
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-30);
      this.byMonth.set(sorted);
      this.byDay.set(last30Days);
      this.totalRevenue.set(orders.reduce((s, o) => s + (o.totalAmount ?? 0), 0));
      this.totalOrders.set(orders.length);
      if (isPlatformBrowser(this.platformId)) {
        this.loadChartJs().then(() => {
          this.drawChart(sorted);
          this.drawDayChart(last30Days);
        });
      }
    });
  }

  private loadChartJs(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).Chart) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }

  private drawChart(data: MonthStat[]): void {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    const canvas = document.getElementById('monthRevChart') as HTMLCanvasElement;
    if (!canvas) return;
    if ((canvas as any).__ch) (canvas as any).__ch.destroy();
    (canvas as any).__ch = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map((d) => d.month),
        datasets: [
          {
            label: 'Doanh thu',
            data: data.map((d) => d.revenue),
            backgroundColor: 'rgba(16,185,129,.75)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: any) => v.toLocaleString('vi-VN') + 'đ' },
          },
        },
      },
    });
  }

  private drawDayChart(data: DayStat[]): void {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    const canvas = document.getElementById('dayRevChart') as HTMLCanvasElement;
    if (!canvas) return;
    if ((canvas as any).__ch) (canvas as any).__ch.destroy();
    (canvas as any).__ch = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((d) =>
          new Date(d.day).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        ),
        datasets: [
          {
            label: 'Doanh thu 30 ngày',
            data: data.map((d) => d.revenue),
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(59,130,246,.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: '#1d4ed8',
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: any) => v.toLocaleString('vi-VN') + 'đ' },
          },
        },
      },
    });
  }

  exportCsv(): void {
    const rows = [
      ['Tháng', 'Doanh thu', 'Số đơn'],
      ...this.byMonth().map((d) => [d.month, d.revenue, d.orders]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'bao-cao-doanh-thu.csv';
    a.click();
  }
}
