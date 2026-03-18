import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Recommendation, Product } from '../models/product.model';

export interface RecommendRequest {
  user_id: number | string;
  user_email?: string;
  user_name?: string;
  user_phone?: string;
  n?: number;
  filter_purchased?: boolean;
  diversify?: boolean;
  max_per_root?: number;
  min_unique_roots?: number;
  w_cf?: number;
  w_basket?: number;
  w_pop?: number;
  recency_decay_days?: number;
}

export interface RecommendResponse {
  user_id: number | string;
  recommendations: Recommendation[];
  method?: string;
  has_history?: boolean;
  debug?: {
    vvv_history_count?: number;
    [key: string]: unknown;
  };
}

@Injectable({ providedIn: 'root' })
export class RecommenderService {
  /** Proxied through backend (works in production) */
  private readonly api = `${environment.apiBase}/api/recommend`;
  /** Direct ML API (used in dev for similar-product queries) */
  private readonly mlApi = environment.mlApi;

  constructor(private http: HttpClient) {}

  toProduct(rec: Recommendation): Product {
    const rawCategory = String(rec.category ?? '').trim();
    const [cat = 'other', sub = 'all'] = rawCategory.split('/');

    let img = String(rec.image ?? '').trim();
    if (img.startsWith('../')) {
      img = img.replace(/^\.\.\//, '');
    }
    if (img && !img.startsWith('http') && !img.startsWith('/')) {
      img = `/${img}`;
    }

    return {
      id: String(rec.product_id),
      name: rec.name,
      price: Number(rec.price ?? 0),
      stock: 999,
      cat: cat || 'other',
      sub: sub || 'all',
      img: img || '/images/brand/LogoVVV.png',
      description: rec.reason,
      unit: '',
      rating: Math.min(5, Math.max(0, Number(rec.score ?? 0) / 20)),
    };
  }

  getRecommendations(req: RecommendRequest): Observable<RecommendResponse> {
    return this.http
      .post<{ success: boolean; data: RecommendResponse }>(this.api, req, { withCredentials: true })
      .pipe(
        map((res) => res?.data ?? (res as unknown as RecommendResponse)),
        catchError(() => of({ user_id: req.user_id, recommendations: [] })),
      );
  }

  getTimeAwareRecommendations(req: RecommendRequest): Observable<Recommendation[]> {
    return this.http
      .post<{
        success: boolean;
        data: RecommendResponse;
      }>(
        this.api,
        { ...req, filter_purchased: req.filter_purchased ?? true },
        { withCredentials: true },
      )
      .pipe(
        map((res) => res?.data?.recommendations ?? []),
        catchError(() => of([])),
      );
  }

  getRecommendationPayload(req: RecommendRequest): Observable<RecommendResponse> {
    return this.http
      .post<{
        success: boolean;
        data: RecommendResponse;
      }>(
        this.api,
        { ...req, filter_purchased: req.filter_purchased ?? true },
        { withCredentials: true },
      )
      .pipe(
        map((res) => res?.data ?? { user_id: req.user_id, recommendations: [] }),
        catchError(() => of({ user_id: req.user_id, recommendations: [] })),
      );
  }

  /** Proxy through backend first; fallback to direct ML API in dev */
  getSimilarProducts(productId: string | number, n = 6): Observable<Recommendation[]> {
    return this.http
      .post<{
        success: boolean;
        data?: { similar_items?: Recommendation[] };
      }>(
        `${environment.apiBase}/api/recommend/similar-ml`,
        { product_id: productId, n },
        { withCredentials: true },
      )
      .pipe(
        map((res) => res?.data?.similar_items ?? []),
        catchError(() =>
          this.http
            .post<{
              similar_items: Recommendation[];
            }>(`${this.mlApi}/api/similar`, { product_id: productId, n })
            .pipe(
              map((res) => res?.similar_items ?? []),
              catchError(() => of([])),
            ),
        ),
      );
  }

  /** Backend content-based: sản phẩm tương tự dựa trên category + tags */
  getSimilarProductsFromBackend(productId: string, n = 8): Observable<Product[]> {
    return this.http
      .get<{
        success: boolean;
        data: Product[];
      }>(`${environment.apiBase}/api/recommend/similar/${productId}?n=${n}`, {
        withCredentials: true,
      })
      .pipe(
        map((res) => res?.data ?? []),
        catchError(() => of([])),
      );
  }
}
