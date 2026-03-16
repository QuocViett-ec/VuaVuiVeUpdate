import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Overview {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  paidOrders: number;
  averageOrderValue: number;
}

interface SeriesPoint {
  day?: string;
  month?: string;
  revenue: number;
  orders: number;
}

interface DashboardAnalytics {
  overview: Overview;
  revenueLast30Days: SeriesPoint[];
  revenueByMonth: SeriesPoint[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-reports-v2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-reports-v2.component.html',
  styleUrl: './admin-reports-v2.component.scss',
})
export class AdminReportsV2Component implements OnInit {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  loading = signal(true);
  error = signal('');
  byMonth = signal<SeriesPoint[]>([]);
  byDay = signal<SeriesPoint[]>([]);
  totalRevenue = signal(0);
  totalOrders = signal(0);
  averageOrderValue = signal(0);
  
  private chartsDrawn = false;

  ngOnInit(): void {
    this.http
      .get<{ success: boolean; data: DashboardAnalytics }>(
        `${environment.apiBase}/api/users/dashboard/analytics`,
        { withCredentials: true },
      )
      .subscribe({
        next: (res) => {
          const analytics = res.data;
          this.byMonth.set(analytics.revenueByMonth);
          this.byDay.set(analytics.revenueLast30Days);
          this.totalRevenue.set(analytics.overview.totalRevenue);
          this.totalOrders.set(analytics.overview.totalOrders);
          this.averageOrderValue.set(analytics.overview.averageOrderValue);
          this.loading.set(false);

          if (isPlatformBrowser(this.platformId)) {
            this.loadChartJs().then(() => this.tryDrawCharts());
          }
        },
        error: () => {
          this.error.set('Khong tai duoc du lieu bao cao.');
          this.loading.set(false);
        },
      });
  }

  private tryDrawCharts(attempts = 0): void {
    const ChartClass = (window as any).Chart;
    const dayCanvas = document.getElementById('dayRevChart');
    const monthCanvas = document.getElementById('monthRevChart');

    if (ChartClass && dayCanvas && monthCanvas) {
      if (!this.chartsDrawn) {
        this.drawCharts();
        this.chartsDrawn = true;
      }
    } else if (attempts < 40) {
      // Retry every 50ms up to 2 seconds
      setTimeout(() => this.tryDrawCharts(attempts + 1), 50);
    }
  }

  private loadChartJs(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).Chart) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private drawCharts(): void {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    const dayCanvas = document.getElementById('dayRevChart') as HTMLCanvasElement | null;
    if (dayCanvas) {
      if ((dayCanvas as any).__chart) (dayCanvas as any).__chart.destroy();
      (dayCanvas as any).__chart = new Chart(dayCanvas, {
        type: 'line',
        data: {
          labels: this.byDay().map((item) =>
            new Date(item.day || '').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          ),
          datasets: [
            {
              label: 'Doanh thu 30 ngay',
              data: this.byDay().map((item) => item.revenue),
              borderColor: '#1d4ed8',
              backgroundColor: 'rgba(59,130,246,0.14)',
              fill: true,
              tension: 0.35,
              pointRadius: 3,
            },
          ],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value: number | string) => Number(value).toLocaleString('vi-VN'),
              },
            },
          },
        },
      });
    }

    const monthCanvas = document.getElementById('monthRevChart') as HTMLCanvasElement | null;
    if (monthCanvas) {
      if ((monthCanvas as any).__chart) (monthCanvas as any).__chart.destroy();
      (monthCanvas as any).__chart = new Chart(monthCanvas, {
        type: 'bar',
        data: {
          labels: this.byMonth().map((item) => item.month || ''),
          datasets: [
            {
              label: 'Doanh thu theo thang',
              data: this.byMonth().map((item) => item.revenue),
              backgroundColor: 'rgba(16,185,129,0.78)',
              borderRadius: 10,
            },
          ],
        },
        options: {
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value: number | string) => Number(value).toLocaleString('vi-VN'),
              },
            },
          },
        },
      });
    }
  }

  exportCsv(): void {
    const rows = [
      ['Month', 'Revenue', 'Orders'],
      ...this.byMonth().map((item) => [item.month || '', item.revenue, item.orders]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'admin-report.csv';
    link.click();
  }
}
