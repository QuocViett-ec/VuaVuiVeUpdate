import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

const CATEGORY_MAP: Record<string, string> = {
  'rau cu': 'veg',
  'trai cay': 'fruit',
  'thit ca': 'meat',
  'nuoc giai khat': 'drink',
  'do uong': 'drink',
  'do kho': 'dry',
  'gia vi': 'spice',
  'do gia dung': 'household',
  'do ngot': 'sweet',
};

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly api = environment.apiBase;

  constructor(private http: HttpClient) {}

  // ─── Normalize ───────────────────────────────────────────────────────────────
  private normalize(p: any): Product {
    const catRaw = p.cat ?? p.category ?? '';
    const subRaw = p.sub ?? p.subcategory ?? '';
    const slug = this._slugify(catRaw);
    const cat = (CATEGORY_MAP[slug] ?? slug) || 'all';
    return { ...p, cat, sub: subRaw || 'all' };
  }

  private _slugify(s: string): string {
    return (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // ─── List products ───────────────────────────────────────────────────────────
  getProducts(params?: {
    cat?: string;
    sub?: string;
    q?: string;
    _limit?: number;
  }): Observable<Product[]> {
    let httpParams = new HttpParams();
    if (params?.cat && params.cat !== 'all') httpParams = httpParams.set('cat', params.cat);
    if (params?.sub && params.sub !== 'all') httpParams = httpParams.set('sub', params.sub);
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?._limit) httpParams = httpParams.set('_limit', params._limit.toString());

    return this.http.get<any[]>(`${this.api}/products`, { params: httpParams }).pipe(
      map((list) =>
        list.filter((p) => p.status === 'active' || !p.status).map((p) => this.normalize(p)),
      ),
      catchError(() => of([])),
    );
  }

  getProductById(id: string): Observable<Product | null> {
    return this.http.get<any>(`${this.api}/products/${id}`).pipe(
      map((p) => this.normalize(p)),
      catchError(() => of(null)),
    );
  }

  // ─── Admin: full product list ─────────────────────────────────────────────
  getAllProducts(): Observable<Product[]> {
    return this.http.get<any[]>(`${this.api}/products`).pipe(
      map((list) => list.map((p) => this.normalize(p))),
      catchError(() => of([])),
    );
  }

  createProduct(p: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.api}/products`, p);
  }

  updateProduct(id: string, p: Partial<Product>): Observable<Product> {
    return this.http.patch<Product>(`${this.api}/products/${id}`, p);
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/products/${id}`);
  }
}
