import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Recommendation, Product } from '../models/product.model';

export interface RecommendRequest {
  user_id: number | string;
  n?: number;
  filter_purchased?: boolean;
}

export interface RecommendResponse {
  user_id: number | string;
  recommendations: Recommendation[];
}

@Injectable({ providedIn: 'root' })
export class RecommenderService {
  /** Proxied through backend (works in production) */
  private readonly api = `${environment.apiBase}/api/recommend`;
  /** Direct ML API (used in dev for similar-product queries) */
  private readonly mlApi = environment.mlApi;

  constructor(private http: HttpClient) {}

  getRecommendations(req: RecommendRequest): Observable<RecommendResponse> {
    return this.http
      .post<{ success: boolean; data: RecommendResponse }>(this.api, req, { withCredentials: true })
      .pipe(
        map((res) => res?.data ?? (res as unknown as RecommendResponse)),
        catchError(() => of({ user_id: req.user_id, recommendations: [] })),
      );
  }

  getTimeAwareRecommendations(userId: string, n = 8): Observable<Recommendation[]> {
    return this.http
      .post<{ success: boolean; data: RecommendResponse }>(
        this.api,
        { user_id: userId, n, filter_purchased: true },
        { withCredentials: true },
      )
      .pipe(
        map((res) => res?.data?.recommendations ?? []),
        catchError(() => of([])),
      );
  }

  /** Direct call to ML API — get products similar to a given product id */
  getSimilarProducts(productId: string | number, n = 6): Observable<Recommendation[]> {
    return this.http
      .post<{
        similar_items: Recommendation[];
      }>(`${this.mlApi}/api/similar`, { product_id: productId, n })
      .pipe(
        map((res) => res?.similar_items ?? []),
        catchError(() => of([])),
      );
  }

  /** Backend content-based: sản phẩm tương tự dựa trên category + tags */
  getSimilarProductsFromBackend(productId: string, n = 8): Observable<Product[]> {
    return this.http
      .get<{ success: boolean; data: Product[] }>(
        `${environment.apiBase}/api/recommend/similar/${productId}?n=${n}`,
        { withCredentials: true },
      )
      .pipe(
        map((res) => res?.data ?? []),
        catchError(() => of([])),
      );
  }
}
