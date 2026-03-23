import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

type RecommendationSection = 'personal' | 'similar' | 'trending';
type UserSegment = 'new_account' | 'with_history';
type TelemetryWindow = 7 | 14 | 30;
type GapMetric = 'ctr' | 'add_to_cart';

interface SectionTelemetry {
  section: RecommendationSection;
  impressions: number;
  clicks: number;
  addToCart: number;
  ctr: number;
  addToCartRate: number;
}

interface TelemetryResponse {
  success: boolean;
  data: SectionTelemetry[];
  breakdown: Array<SectionTelemetry & { segment: UserSegment }>;
  daily?: DailySectionTelemetry[];
}

interface DailySectionTelemetry {
  day: string;
  section: RecommendationSection;
  impressions: number;
  clicks: number;
  addToCart: number;
  ctr: number;
  addToCartRate: number;
}

interface SectionTelemetryCard {
  section: RecommendationSection;
  label: string;
  ctr: number;
  addToCartRate: number;
  impressions: number;
  clicks: number;
  addToCart: number;
}

interface SegmentRow {
  section: RecommendationSection;
  label: string;
  newAccountCtr: number;
  withHistoryCtr: number;
  newAccountAddToCartRate: number;
  withHistoryAddToCartRate: number;
}

interface GapAlert {
  section: RecommendationSection;
  label: string;
  gap: number;
}

interface DeltaCard {
  section: RecommendationSection;
  label: string;
  ctrDelta: number;
  addDelta: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-ml-insights',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-ml-insights.component.html',
  styleUrl: './admin-ml-insights.component.scss',
})
export class AdminMlInsightsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private chartModulePromise: Promise<{ default: any }> | null = null;
  private chartInstances = new Map<string, any>();

  loading = signal(true);
  error = signal('');
  recommendationCards = signal<SectionTelemetryCard[]>([]);
  recommendationBreakdown = signal<SegmentRow[]>([]);
  dailyRows = signal<DailySectionTelemetry[]>([]);
  deltaCards = signal<DeltaCard[]>([]);
  telemetryDays = signal<TelemetryWindow>(7);
  gapMetric = signal<GapMetric>('ctr');
  gapAlertThreshold = signal(3);
  gapAlerts = signal<GapAlert[]>([]);

  ngOnInit(): void {
    this.fetchTelemetry();
  }

  ngOnDestroy(): void {
    for (const instance of this.chartInstances.values()) {
      instance.destroy();
    }
    this.chartInstances.clear();
  }

  private sectionLabel(section: RecommendationSection): string {
    if (section === 'personal') return 'Cho riêng bạn';
    if (section === 'similar') return 'Sản phẩm tương tự';
    return 'Mua nhiều tại Vua Vui Vẻ';
  }

  private buildRecommendationCards(rows: SectionTelemetry[]): SectionTelemetryCard[] {
    const defaults: RecommendationSection[] = ['personal', 'similar', 'trending'];
    const bySection = new Map<RecommendationSection, SectionTelemetry>(
      rows.map((row) => [row.section, row]),
    );

    return defaults.map((section) => {
      const row = bySection.get(section);
      return {
        section,
        label: this.sectionLabel(section),
        ctr: Number(row?.ctr ?? 0),
        addToCartRate: Number(row?.addToCartRate ?? 0),
        impressions: Number(row?.impressions ?? 0),
        clicks: Number(row?.clicks ?? 0),
        addToCart: Number(row?.addToCart ?? 0),
      };
    });
  }

  private buildRecommendationBreakdown(
    rows: Array<SectionTelemetry & { segment: UserSegment }>,
  ): SegmentRow[] {
    const sections: RecommendationSection[] = ['personal', 'similar', 'trending'];
    const byKey = new Map<string, SectionTelemetry & { segment: UserSegment }>(
      rows.map((row) => [`${row.segment}:${row.section}`, row]),
    );

    return sections.map((section) => {
      const newAccount = byKey.get(`new_account:${section}`);
      const withHistory = byKey.get(`with_history:${section}`);

      return {
        section,
        label: this.sectionLabel(section),
        newAccountCtr: Number(newAccount?.ctr ?? 0),
        withHistoryCtr: Number(withHistory?.ctr ?? 0),
        newAccountAddToCartRate: Number(newAccount?.addToCartRate ?? 0),
        withHistoryAddToCartRate: Number(withHistory?.addToCartRate ?? 0),
      };
    });
  }

  private updateGapAlerts(): void {
    const threshold = this.gapAlertThreshold();
    const metric = this.gapMetric();
    const isCtr = metric === 'ctr';

    const alerts = this.recommendationBreakdown()
      .map((row) => ({
        section: row.section,
        label: row.label,
        gap: isCtr
          ? row.withHistoryCtr - row.newAccountCtr
          : row.withHistoryAddToCartRate - row.newAccountAddToCartRate,
      }))
      .filter((row) => Math.abs(row.gap) >= threshold)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

    this.gapAlerts.set(alerts);
  }

  private buildDeltaCards(rows: SegmentRow[]): DeltaCard[] {
    return rows.map((row) => ({
      section: row.section,
      label: row.label,
      ctrDelta: Number((row.withHistoryCtr - row.newAccountCtr).toFixed(2)),
      addDelta: Number((row.withHistoryAddToCartRate - row.newAccountAddToCartRate).toFixed(2)),
    }));
  }

  private sortedDays(): string[] {
    const days = new Set(this.dailyRows().map((r) => r.day));
    return [...days].sort((a, b) => a.localeCompare(b));
  }

  private seriesFor(section: RecommendationSection, metric: 'ctr' | 'addToCartRate'): number[] {
    const byDay = new Map<string, DailySectionTelemetry>();
    for (const row of this.dailyRows()) {
      if (row.section === section) {
        byDay.set(row.day, row);
      }
    }
    return this.sortedDays().map((d) => Number(byDay.get(d)?.[metric] ?? 0));
  }

  sampleQuality(impressions: number): { label: string; tone: 'low' | 'medium' | 'good' } {
    if (impressions < 100) return { label: 'Low sample', tone: 'low' };
    if (impressions < 300) return { label: 'Medium sample', tone: 'medium' };
    return { label: 'Good sample', tone: 'good' };
  }

  heatColor(value: number, maxValue: number): string {
    const ratio = maxValue > 0 ? Math.max(0, Math.min(1, value / maxValue)) : 0;
    const alpha = 0.1 + ratio * 0.75;
    return `rgba(31, 95, 169, ${alpha})`;
  }

  maxBreakdownRate(metric: 'ctr' | 'addToCartRate'): number {
    const values = this.recommendationBreakdown().flatMap((row) =>
      metric === 'ctr'
        ? [row.newAccountCtr, row.withHistoryCtr]
        : [row.newAccountAddToCartRate, row.withHistoryAddToCartRate],
    );
    return Math.max(1, ...values);
  }

  private loadChartModule(): Promise<{ default: any }> {
    if (!this.chartModulePromise) {
      this.chartModulePromise = import('chart.js/auto');
    }
    return this.chartModulePromise;
  }

  private setChart(key: string, instance: any): void {
    const prev = this.chartInstances.get(key);
    if (prev) prev.destroy();
    this.chartInstances.set(key, instance);
  }

  private drawColdStartGapChart(coldStartGapCanvas: HTMLCanvasElement, ChartCtor: any): void {
    const rows = this.recommendationBreakdown();
    const labels = rows.map((row) => row.label);
    const isCtr = this.gapMetric() === 'ctr';
    const newSeries = isCtr
      ? rows.map((row) => row.newAccountCtr)
      : rows.map((row) => row.newAccountAddToCartRate);
    const historySeries = isCtr
      ? rows.map((row) => row.withHistoryCtr)
      : rows.map((row) => row.withHistoryAddToCartRate);
    const gapSeries = historySeries.map((value, idx) => value - (newSeries[idx] || 0));
    const metricLabel = isCtr ? 'CTR' : 'Add-to-cart rate';

    this.setChart(
      'cold-start-gap',
      new ChartCtor(coldStartGapCanvas, {
        data: {
          labels,
          datasets: [
            {
              type: 'bar',
              label: `${metricLabel} tài khoản mới`,
              data: newSeries,
              backgroundColor: 'rgba(59, 130, 246, 0.72)',
              borderRadius: 8,
            },
            {
              type: 'bar',
              label: `${metricLabel} có lịch sử`,
              data: historySeries,
              backgroundColor: 'rgba(16, 185, 129, 0.72)',
              borderRadius: 8,
            },
            {
              type: 'line',
              label: `Gap ${metricLabel} (có lịch sử - mới)`,
              data: gapSeries,
              yAxisID: 'yGap',
              borderColor: '#b44d68',
              backgroundColor: 'rgba(180, 77, 104, 0.15)',
              tension: 0.35,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
          },
          scales: {
            y: {
              beginAtZero: true,
              position: 'left',
              ticks: {
                callback: (value: number | string) => `${Number(value).toFixed(1)}%`,
              },
            },
            yGap: {
              beginAtZero: false,
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: {
                callback: (value: number | string) => `${Number(value).toFixed(1)}%`,
              },
            },
          },
        },
      }),
    );
  }

  private drawFunnelSectionChart(canvas: HTMLCanvasElement, ChartCtor: any): void {
    const cards = this.recommendationCards();
    const labels = cards.map((c) => c.label);

    this.setChart(
      'funnel-section',
      new ChartCtor(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Impression',
              data: cards.map((c) => c.impressions),
              backgroundColor: 'rgba(148, 163, 184, 0.72)',
              borderRadius: 6,
            },
            {
              label: 'Click',
              data: cards.map((c) => c.clicks),
              backgroundColor: 'rgba(59, 130, 246, 0.78)',
              borderRadius: 6,
            },
            {
              label: 'Add-to-cart',
              data: cards.map((c) => c.addToCart),
              backgroundColor: 'rgba(16, 185, 129, 0.78)',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value: number | string) => Number(value).toLocaleString('vi-VN'),
              },
            },
          },
        },
      }),
    );
  }

  private drawSparklineCharts(ChartCtor: any): void {
    const sectionMap: RecommendationSection[] = ['personal', 'similar', 'trending'];
    const labels = this.sortedDays().map((d) => d.slice(5));

    for (const section of sectionMap) {
      const canvas = document.getElementById(`sparkline-${section}`) as HTMLCanvasElement | null;
      if (!canvas) continue;
      this.setChart(
        `sparkline-${section}`,
        new ChartCtor(canvas, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'CTR',
                data: this.seriesFor(section, 'ctr'),
                borderColor: 'rgba(31, 95, 169, 0.95)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
              },
              {
                label: 'Add-to-cart',
                data: this.seriesFor(section, 'addToCartRate'),
                borderColor: 'rgba(16, 185, 129, 0.95)',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              x: { display: false },
              y: {
                display: true,
                ticks: {
                  maxTicksLimit: 3,
                  callback: (value: number | string) => `${Number(value).toFixed(1)}%`,
                },
                grid: { color: 'rgba(148, 163, 184, 0.15)' },
              },
            },
          },
        }),
      );
    }
  }

  private async tryDrawColdStartGapChart(attempts = 0): Promise<void> {
    const canvas = document.getElementById('coldStartGapChart') as HTMLCanvasElement | null;
    if (!canvas) {
      if (attempts < 40) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return this.tryDrawColdStartGapChart(attempts + 1);
      }
      return;
    }

    const chartModule = await this.loadChartModule();
    this.drawColdStartGapChart(canvas, chartModule.default);

    const funnelCanvas = document.getElementById('funnelSectionChart') as HTMLCanvasElement | null;
    if (funnelCanvas) {
      this.drawFunnelSectionChart(funnelCanvas, chartModule.default);
    }

    this.drawSparklineCharts(chartModule.default);
  }

  private refreshChart(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.tryDrawColdStartGapChart().catch(() => {
      this.error.set('Không tải được chart machine learning.');
    });
  }

  fetchTelemetry(): void {
    this.loading.set(true);
    this.http
      .get<TelemetryResponse>(
        `${environment.apiBase}/api/recommend/telemetry/sections?days=${this.telemetryDays()}`,
        { withCredentials: true },
      )
      .pipe(
        catchError(() =>
          of({
            success: false,
            data: [],
            breakdown: [],
          } as TelemetryResponse),
        ),
      )
      .subscribe({
        next: (telemetry) => {
          this.recommendationCards.set(this.buildRecommendationCards(telemetry.data ?? []));
          const breakdown = this.buildRecommendationBreakdown(telemetry.breakdown ?? []);
          this.recommendationBreakdown.set(breakdown);
          this.deltaCards.set(this.buildDeltaCards(breakdown));
          this.dailyRows.set(telemetry.daily ?? []);
          this.updateGapAlerts();
          this.loading.set(false);
          this.refreshChart();
        },
        error: () => {
          this.error.set('Không tải được dữ liệu machine learning.');
          this.loading.set(false);
        },
      });
  }

  setTelemetryWindow(days: TelemetryWindow): void {
    if (this.telemetryDays() === days) return;
    this.telemetryDays.set(days);
    this.fetchTelemetry();
  }

  setGapMetric(metric: GapMetric): void {
    if (this.gapMetric() === metric) return;
    this.gapMetric.set(metric);
    this.updateGapAlerts();
    this.refreshChart();
  }
}
