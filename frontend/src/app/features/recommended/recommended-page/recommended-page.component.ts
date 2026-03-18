import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RecommenderService, RecommendRequest } from '../../../core/services/recommender.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { EventTrackingService } from '../../../core/services/event-tracking.service';
import { Product, Recommendation } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/product-card/product-card.component';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

type RecommendationSection = 'personal' | 'similar' | 'trending';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recommended-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './recommended-page.component.html',
  styleUrl: './recommended-page.component.scss',
})
export class RecommendedPageComponent implements OnInit {
  private recommenderSvc = inject(RecommenderService);
  private productSvc = inject(ProductService);
  private auth = inject(AuthService);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private eventTracking = inject(EventTrackingService);

  personal = signal<Recommendation[]>([]);
  similar = signal<Product[]>([]);
  trending = signal<Product[]>([]);
  loading = signal(true);
  interests = signal<string[]>([]);
  isGuest = signal(false);
  hasPersonalHistory = signal(false);
  private loadVersion = 0;
  private impressionKeys = new Set<string>();

  ngOnInit(): void {
    this.load();
  }

  private fallbackCatalogIfNeeded(): void {
    this.productSvc.getProducts({ _limit: 16 }).subscribe((products) => {
      if (!this.similar().length) {
        const similarFallback = this.diversifyProducts(products, 8, 2);
        this.similar.set(similarFallback);
        this.trackSectionImpressions(
          'similar',
          similarFallback.map((p) => p.id),
        );
      }
      if (!this.trending().length) {
        const trendingFallback = this.diversifyProducts(products, 8, 2);
        this.trending.set(trendingFallback);
        this.trackSectionImpressions(
          'trending',
          trendingFallback.map((p) => p.id),
        );
      }
    });
  }

  private trackEvent(
    eventType: 'view_product' | 'add_to_cart',
    section: RecommendationSection,
    productId: string,
    action: 'impression' | 'click' | 'add_to_cart',
    extra?: Record<string, unknown>,
  ): void {
    const userSegment = this.isGuest()
      ? 'guest'
      : this.hasPersonalHistory()
        ? 'with_history'
        : 'new_account';

    this.eventTracking.trackEvent(eventType, productId, {
      source: 'recommended_page',
      section,
      action,
      user_segment: userSegment,
      timestamp: Date.now(),
      ...extra,
    });
  }

  private trackSectionImpressions(section: RecommendationSection, productIds: string[]): void {
    for (const productId of productIds.filter(Boolean)) {
      const key = `${section}:${productId}`;
      if (this.impressionKeys.has(key)) continue;
      this.impressionKeys.add(key);
      this.trackEvent('view_product', section, productId, 'impression');
    }
  }

  onProductClick(section: RecommendationSection, productId: string): void {
    if (!productId) return;
    this.trackEvent('view_product', section, productId, 'click');
  }

  onAddToCart(section: RecommendationSection, product: Product): void {
    this.cart.addToCart(product, 1);
    this.toast.success(`Đã thêm "${product.name}" vào giỏ!`);
    this.trackEvent('add_to_cart', section, product.id, 'add_to_cart', {
      price: product.price,
      category: product.cat,
      subCategory: product.sub,
    });
  }

  toProduct(rec: Recommendation): Product {
    return this.recommenderSvc.toProduct(rec);
  }

  private rootOfCategory(category: string): string {
    const cat = String(category || '').trim();
    return cat.includes('/') ? cat.split('/')[0] : cat || 'other';
  }

  private pickDiverseSeedIds(recs: Recommendation[], maxSeeds = 4): string[] {
    const byRoot = new Map<string, string>();
    const fallback: string[] = [];

    for (const rec of recs) {
      const pid = String(rec.product_id || '').trim();
      if (!pid) continue;
      const root = this.rootOfCategory(rec.category || '');
      if (!byRoot.has(root)) {
        byRoot.set(root, pid);
      }
      fallback.push(pid);
    }

    return [...byRoot.values(), ...fallback]
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .slice(0, maxSeeds);
  }

  private diversifyProducts(
    products: Product[],
    limit = 8,
    capPerRoot = 2,
    excludeIds?: Set<string>,
  ): Product[] {
    const selected: Product[] = [];
    const seen = new Set<string>();
    const rootQuota = new Map<string, number>();

    const tryPush = (p: Product, enforceCap: boolean) => {
      if (!p?.id || seen.has(p.id)) return false;
      if (excludeIds?.has(p.id)) return false;
      const root = (p.cat || 'other').trim() || 'other';
      const used = rootQuota.get(root) || 0;
      if (enforceCap && used >= capPerRoot) return false;
      selected.push(p);
      seen.add(p.id);
      rootQuota.set(root, used + 1);
      return true;
    };

    for (const p of products) {
      tryPush(p, true);
      if (selected.length >= limit) return selected;
    }

    for (const p of products) {
      tryPush(p, false);
      if (selected.length >= limit) return selected;
    }

    return selected;
  }

  private buildSimilarProducts$(
    seedProductIds: string[],
    excludeProductIds: Set<string>,
    limit = 8,
    capPerRoot = 2,
  ): Observable<Product[]> {
    if (!seedProductIds.length) return of([] as Product[]);

    return forkJoin(seedProductIds.map((id) => this.recommenderSvc.getSimilarProducts(id, 8))).pipe(
      map((groups) => {
        const flattened: Product[] = [];
        for (const group of groups) {
          for (const rec of group) {
            flattened.push(this.recommenderSvc.toProduct(rec));
          }
        }
        return this.diversifyProducts(flattened, limit, capPerRoot, excludeProductIds);
      }),
    );
  }

  private loadGuestSections(version: number): void {
    const trendingReq: RecommendRequest = {
      user_id: '__trending__',
      n: 8,
      filter_purchased: false,
      diversify: true,
      max_per_root: 2,
      min_unique_roots: 4,
    };

    this.recommenderSvc
      .getRecommendationPayload(trendingReq)
      .pipe(
        switchMap((trendingPayload) => {
          const trendingRecs = trendingPayload?.recommendations ?? [];
          const trendingProducts = this.diversifyProducts(
            trendingRecs.map((r) => this.toProduct(r)),
            8,
            2,
          );

          const seedIds = this.pickDiverseSeedIds(trendingRecs, 4);
          return this.buildSimilarProducts$(seedIds, new Set<string>(), 8, 2).pipe(
            map((similarProducts) => ({ trendingProducts, similarProducts })),
          );
        }),
      )
      .subscribe({
        next: ({ trendingProducts, similarProducts }) => {
          if (version !== this.loadVersion) return;
          this.trending.set(trendingProducts);
          this.similar.set(similarProducts);
          this.trackSectionImpressions(
            'trending',
            trendingProducts.map((p) => p.id),
          );
          this.trackSectionImpressions(
            'similar',
            similarProducts.map((p) => p.id),
          );
          this.loading.set(false);
          this.fallbackCatalogIfNeeded();
        },
        error: () => {
          if (version !== this.loadVersion) return;
          this.loading.set(false);
          this.fallbackCatalogIfNeeded();
        },
      });
  }

  load(): void {
    this.loadVersion += 1;
    const version = this.loadVersion;
    this.impressionKeys.clear();
    this.loading.set(true);
    const user = this.auth.currentUser();
    this.isGuest.set(!user?.id);

    if (!user?.id) {
      this.personal.set([]);
      this.interests.set([]);
      this.hasPersonalHistory.set(false);
      this.loadGuestSections(version);
      return;
    }

    const identity: RecommendRequest = {
      user_id: user.id,
      user_email: user.email || undefined,
      user_name: user.name || undefined,
      user_phone: user.phone || undefined,
      n: 12,
      filter_purchased: true,
      diversify: true,
      max_per_root: 2,
      min_unique_roots: 4,
      recency_decay_days: 21,
    };

    this.recommenderSvc
      .getRecommendationPayload(identity)
      .pipe(
        switchMap((personalPayload) => {
          const personalRecs = personalPayload?.recommendations ?? [];
          this.personal.set(personalRecs);
          this.trackSectionImpressions(
            'personal',
            personalRecs.map((r) => String(r.product_id)),
          );

          const hasHistorySignals =
            !!personalPayload?.has_history ||
            Number(personalPayload?.debug?.vvv_history_count ?? 0) > 0 ||
            (personalPayload?.method === 'hybrid_instacart_mapping' && personalRecs.length > 0);
          this.hasPersonalHistory.set(hasHistorySignals);

          const cats = [...new Set(personalRecs.map((r) => r.category).filter(Boolean))];
          this.interests.set(cats.slice(0, 5) as string[]);

          const seedProductIds = this.pickDiverseSeedIds(personalRecs, 4);
          const personalIdSet = new Set(personalRecs.map((r) => String(r.product_id)));

          const similar$ = this.buildSimilarProducts$(seedProductIds, personalIdSet, 8, 2);

          // Use global cold-start request for trending so it reflects platform-wide popularity,
          // not this user's personal purchase profile.
          const trendingReq: RecommendRequest = {
            user_id: '__trending__',
            n: 8,
            filter_purchased: false,
            diversify: true,
            max_per_root: 2,
            min_unique_roots: 4,
          };

          const trending$ = this.recommenderSvc.getRecommendationPayload(trendingReq).pipe(
            map((payload) =>
              this.diversifyProducts(
                (payload?.recommendations ?? []).map((r) => this.toProduct(r)),
                8,
                2,
              ),
            ),
          );

          return forkJoin({ similar: similar$, trending: trending$ });
        }),
      )
      .subscribe({
        next: ({ similar, trending }) => {
          if (version !== this.loadVersion) return;
          this.similar.set(similar);
          this.trending.set(trending);
          this.trackSectionImpressions(
            'similar',
            similar.map((p) => p.id),
          );
          this.trackSectionImpressions(
            'trending',
            trending.map((p) => p.id),
          );
          this.loading.set(false);
          this.fallbackCatalogIfNeeded();
        },
        error: () => {
          if (version !== this.loadVersion) return;
          this.loading.set(false);
          this.fallbackCatalogIfNeeded();
        },
      });
  }

  addToCart(p: Product): void {
    this.onAddToCart('personal', p);
  }
}
