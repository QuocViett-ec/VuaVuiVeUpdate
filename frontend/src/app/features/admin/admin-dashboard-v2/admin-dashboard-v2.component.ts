import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
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

interface StatusPoint {
  status: string;
  count: number;
}

interface RecentOrder {
  orderId?: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  delivery?: {
    name?: string;
  };
}

interface DashboardAnalytics {
  overview: Overview;
  revenueLast7Days: SeriesPoint[];
  revenueLast30Days: SeriesPoint[];
  revenueByMonth: SeriesPoint[];
  ordersByStatus: StatusPoint[];
  recentOrders: RecentOrder[];
}

interface StatCard {
  label: string;
  value: string;
  hint: string;
  icon: string;
  tone: 'emerald' | 'blue' | 'amber' | 'rose';
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-dashboard-v2',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard-v2.component.html',
  styleUrl: './admin-dashboard-v2.component.scss',
})
export class AdminDashboardV2Component implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  loading = signal(true);
  error = signal('');
  stats = signal<StatCard[]>([]);
  recentOrders = signal<RecentOrder[]>([]);
  headline = signal('Buc tranh van hanh hom nay');

  private refreshInterval: any;
  private analyticsData: DashboardAnalytics | null = null;
  private chartsDrawn = false;

  ngOnInit(): void {
    this.fetchDashboardData();
    if (isPlatformBrowser(this.platformId)) {
      // Auto-refresh every 30 seconds
      this.refreshInterval = setInterval(() => {
        this.fetchDashboardData(true);
      }, 30000);
    }
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  private fetchDashboardData(isRefresh = false): void {
    if (!isRefresh) this.loading.set(true);

    this.http
      .get<{ success: boolean; data: DashboardAnalytics }>(
        `${environment.apiBase}/api/users/dashboard/analytics`,
        { withCredentials: true },
      )
      .subscribe({
        next: (res) => {
          this.analyticsData = res.data;
          this.stats.set(this.buildStats(this.analyticsData.overview));
          this.recentOrders.set(this.analyticsData.recentOrders);
          this.headline.set(this.buildHeadline(this.analyticsData.overview));
          this.loading.set(false);
          this.chartsDrawn = false; // Need to redraw when data refreshes
          
          if (isPlatformBrowser(this.platformId)) {
            this.loadChartJs().then(() => this.tryDrawCharts());
          }
        },
        error: () => {
          if (!isRefresh) this.error.set('Khong tai duoc du lieu dashboard.');
          this.loading.set(false);
        },
      });
  }

  private tryDrawCharts(attempts = 0): void {
    if (!this.analyticsData) return;
    
    const ChartClass = (window as any).Chart;
    const revenueCanvas = document.getElementById('revenueChart');
    const statusCanvas = document.getElementById('statusChart');
    const monthCanvas = document.getElementById('monthChart');

    // Make sure both Chart.js library is loaded AND Angular has rendered the DOM elements
    if (ChartClass && revenueCanvas && statusCanvas && monthCanvas) {
      if (!this.chartsDrawn) {
        this.drawCharts(this.analyticsData);
        this.chartsDrawn = true;
      }
    } else if (attempts < 40) {
      // Retry every 50ms up to 2 seconds (40 * 50ms)
      setTimeout(() => this.tryDrawCharts(attempts + 1), 50);
    }
  }

  private buildStats(overview: Overview): StatCard[] {
    return [
      {
        label: 'Doanh thu',
        value: overview.totalRevenue.toLocaleString('vi-VN') + 'd',
        hint: `${overview.paidOrders.toLocaleString('vi-VN')} don da thanh toan`,
        icon: 'Revenue',
        tone: 'emerald',
      },
      {
        label: 'Don hang',
        value: overview.totalOrders.toLocaleString('vi-VN'),
        hint: `${overview.pendingOrders.toLocaleString('vi-VN')} don dang cho`,
        icon: 'Orders',
        tone: 'blue',
      },
      {
        label: 'Nguoi dung',
        value: overview.totalUsers.toLocaleString('vi-VN'),
        hint: `${overview.totalProducts.toLocaleString('vi-VN')} san pham dang ban`,
        icon: 'Users',
        tone: 'amber',
      },
      {
        label: 'Gia tri trung binh',
        value: Math.round(overview.averageOrderValue).toLocaleString('vi-VN') + 'd',
        hint: 'Tren moi don khong bi huy',
        icon: 'AOV',
        tone: 'rose',
      },
    ];
  }

  private buildHeadline(overview: Overview): string {
    if (overview.pendingOrders >= 12) {
      return 'Luong don dang cho xu ly dang tang, nen uu tien xac nhan som.';
    }
    if (overview.totalRevenue >= 10000000) {
      return 'Doanh thu giu nhip tot, co the day them combo va cross-sell.';
    }
    return 'Dashboard da co du lieu song de theo doi theo ngay va theo thang.';
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

  private drawCharts(analytics: DashboardAnalytics): void {
    const Chart = (window as any).Chart;
    if (!Chart) return;

    const revenueCanvas = document.getElementById('revenueChart') as HTMLCanvasElement | null;
    if (revenueCanvas) {
      if ((revenueCanvas as any).__chart) (revenueCanvas as any).__chart.destroy();
      (revenueCanvas as any).__chart = new Chart(revenueCanvas, {
        type: 'line',
        data: {
          labels: analytics.revenueLast7Days.map((item) =>
            new Date(item.day || '').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          ),
          datasets: [
            {
              label: 'Doanh thu 7 ngay',
              data: analytics.revenueLast7Days.map((item) => item.revenue),
              borderColor: '#0f9f6e',
              backgroundColor: 'rgba(15,159,110,0.12)',
              fill: true,
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6,
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

    const statusCanvas = document.getElementById('statusChart') as HTMLCanvasElement | null;
    if (statusCanvas) {
      if ((statusCanvas as any).__chart) (statusCanvas as any).__chart.destroy();
      (statusCanvas as any).__chart = new Chart(statusCanvas, {
        type: 'doughnut',
        data: {
          labels: analytics.ordersByStatus.map((item) => this.statusLabel(item.status)),
          datasets: [
            {
              data: analytics.ordersByStatus.map((item) => item.count),
              backgroundColor: ['#0f9f6e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
          },
          cutout: '66%',
        },
      });
    }

    const monthCanvas = document.getElementById('monthChart') as HTMLCanvasElement | null;
    if (monthCanvas) {
      if ((monthCanvas as any).__chart) (monthCanvas as any).__chart.destroy();
      (monthCanvas as any).__chart = new Chart(monthCanvas, {
        type: 'bar',
        data: {
          labels: analytics.revenueByMonth.slice(-6).map((item) => item.month || ''),
          datasets: [
            {
              label: 'Doanh thu theo thang',
              data: analytics.revenueByMonth.slice(-6).map((item) => item.revenue),
              backgroundColor: ['#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669'],
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

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Cho xac nhan',
      confirmed: 'Da xac nhan',
      shipping: 'Dang giao',
      delivered: 'Da giao',
      cancelled: 'Da huy',
    };
    return labels[status] || status;
  }

  customerName(order: RecentOrder): string {
    return order.delivery?.name || 'Khach le';
  }
}
