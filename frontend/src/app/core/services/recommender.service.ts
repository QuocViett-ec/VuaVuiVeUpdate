import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Recommendation } from '../models/product.model';

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
  private readonly api = environment.mlApi;

  constructor(private http: HttpClient) {}

  getRecommendations(req: RecommendRequest): Observable<RecommendResponse> {
    return this.http
      .post<RecommendResponse>(`${this.api}/api/recommend`, req)
      .pipe(catchError(() => of({ user_id: req.user_id, recommendations: [] })));
  }

  getTimeAwareRecommendations(userId: string, n = 8): Observable<Recommendation[]> {
    return this.http
      .get<Recommendation[]>(`${environment.apiBase}/api/recommendations?userId=${userId}&n=${n}`)
      .pipe(catchError(() => of([])));
  }
}
