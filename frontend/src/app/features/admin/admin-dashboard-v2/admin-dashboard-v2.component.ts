import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  computed,
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
  topProducts?: TopProduct[];
  ordersByStatus: StatusPoint[];
  recentOrders: RecentOrder[];
}

interface TopProduct {
  productId?: string;
  productName: string;
  soldQuantity: number;
  revenue: number;
  imageUrl?: string;
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
  topProducts = signal<TopProduct[]>([]);
  topProductColumns = computed(() => {
    const items = this.topProducts();
    const columns: TopProduct[][] = [];
    for (let i = 0; i < 10; i += 2) {
      const col = items.slice(i, i + 2);
      if (col.length > 0) columns.push(col);
    }
    return columns;
  });
  headline = signal('Bức tranh vận hành hôm nay');
  readonly fallbackProductImage = '/images/brand/LogoVVV.png';

  private refreshInterval: any;
  private analyticsData: DashboardAnalytics | null = null;
  private chartsDrawn = false;
  private readonly onVisibilityChange = () => {
    if (!isPlatformBrowser(this.platformId)) return;
    if (document.hidden) return;
    this.fetchDashboardData(true);
  };

  ngOnInit(): void {
    this.fetchDashboardData();
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      // Auto-refresh every 30 seconds
      this.refreshInterval = setInterval(() => {
        if (document.hidden) return;
        this.fetchDashboardData(true);
      }, 30000);
    }
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private fetchDashboardData(isRefresh = false): void {
    if (!isRefresh) this.loading.set(true);

    this.http
      .get<{
        success: boolean;
        data: DashboardAnalytics;
      }>(`${environment.apiBase}/api/users/dashboard/analytics`, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.analyticsData = res.data;
          this.stats.set(this.buildStats(this.analyticsData.overview));
          this.recentOrders.set(this.analyticsData.recentOrders);
          this.topProducts.set(
            (this.analyticsData.topProducts ?? []).map((item) => ({
              ...item,
              productName: item.productName || 'Sản phẩm',
              imageUrl: this.normalizeProductImage(item.imageUrl),
              soldQuantity: Number(item.soldQuantity || 0),
              revenue: Number(item.revenue || 0),
            })),
          );
          this.headline.set(this.buildHeadline(this.analyticsData.overview));
          this.loading.set(false);
          this.chartsDrawn = false; // Need to redraw when data refreshes

          if (isPlatformBrowser(this.platformId)) {
            this.loadChartJs().then(() => this.tryDrawCharts());
          }
        },
        error: () => {
          if (!isRefresh) this.error.set('Không tải được dữ liệu dashboard.');
          this.loading.set(false);
        },
      });
  }

  private tryDrawCharts(attempts = 0): void {
    if (!this.analyticsData) return;

    const ChartClass = (window as any).Chart;
    const revenueCanvas = document.getElementById('revenueChart');
    const statusCanvas = document.getElementById('statusChart');

    // Make sure both Chart.js library is loaded AND Angular has rendered the DOM elements
    if (ChartClass && revenueCanvas && statusCanvas) {
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
        value: overview.totalRevenue.toLocaleString('vi-VN') + 'đ',
        hint: `${overview.paidOrders.toLocaleString('vi-VN')} đơn đã thanh toán`,
        icon: 'payments',
        tone: 'emerald',
      },
      {
        label: 'Đơn hàng',
        value: overview.totalOrders.toLocaleString('vi-VN'),
        hint: `${overview.pendingOrders.toLocaleString('vi-VN')} đơn đang chờ`,
        icon: 'inventory_2',
        tone: 'blue',
      },
      {
        label: 'Người dùng',
        value: overview.totalUsers.toLocaleString('vi-VN'),
        hint: `${overview.totalProducts.toLocaleString('vi-VN')} sản phẩm đang bán`,
        icon: 'person',
        tone: 'amber',
      },
      {
        label: 'Giá trị trung bình',
        value: Math.round(overview.averageOrderValue).toLocaleString('vi-VN') + 'đ',
        hint: 'Trên mỗi đơn không bị hủy',
        icon: 'analytics',
        tone: 'rose',
      },
    ];
  }

  private buildHeadline(overview: Overview): string {
    if (overview.pendingOrders >= 12) {
      return `Có ${overview.pendingOrders} đơn đang chờ xử lý - nên ưu tiên xác nhận sớm!`;
    }
    if (overview.totalRevenue >= 10000000) {
      return 'Doanh thu giữ nhịp tốt - có thể đẩy thêm combo và cross-sell.';
    }
    return 'Hệ thống hoạt động ổn định - theo dõi dữ liệu theo ngày và tháng.';
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
            new Date(item.day || '').toLocaleDateString('vi-VN', {
              day: '2-digit',
              month: '2-digit',
            }),
          ),
          datasets: [
            {
              label: 'Doanh thu 7 ngày',
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
  }

  private normalizeProductImage(raw?: string): string {
    const value = String(raw || '').trim();
    if (!value) return this.fallbackProductImage;
    const apiOrigin = this.resolveApiOrigin();
    const cleaned = value.replace(/^\.\//, '').replace(/^\.\.\//, '');

    if (value.startsWith('data:image/')) {
      return value;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }

    if (cleaned.startsWith('uploads/')) {
      return `${apiOrigin}/${cleaned}`;
    }

    if (cleaned.startsWith('images/') || cleaned.startsWith('vid/')) {
      return `/${cleaned}`;
    }

    if (value.startsWith('/uploads/')) {
      return `${apiOrigin}${value}`;
    }

    if (value.startsWith('/images/') || value.startsWith('/vid/')) {
      return value;
    }

    if (value.startsWith('/')) {
      return apiOrigin ? `${apiOrigin}${value}` : value;
    }

    if (apiOrigin) {
      return `${apiOrigin}/${cleaned}`;
    }

    return this.fallbackProductImage;
  }

  private resolveApiOrigin(): string {
    const base = String(environment.apiBase || '').trim();
    if (base.startsWith('http://') || base.startsWith('https://')) {
      return base.replace(/\/$/, '').replace(/\/api$/, '');
    }
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return '';
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    };
    return labels[status] || status;
  }

  customerName(order: RecentOrder): string {
    return order.delivery?.name || 'Khách lẻ';
  }

  onProductImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.endsWith(this.fallbackProductImage)) return;
    img.src = this.fallbackProductImage;
  }
}
