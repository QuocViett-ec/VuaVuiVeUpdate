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
    const id = String(p.id ?? p._id ?? p.slug ?? '');
    const catRaw = p.cat ?? p.category ?? '';
    const subRaw = p.sub ?? p.subCategory ?? p.subcategory ?? '';
    const slug = this._slugify(catRaw);
    const cat = (CATEGORY_MAP[slug] ?? slug) || 'all';
    const oldPrice = p.oldPrice ?? p.originalPrice;
    // Map backend imageUrl → frontend img
    const img = p.img ?? p.imageUrl ?? p.image ?? '';
    // Build image URL: if it's a relative path (not starting with http or /),
    // prefix with the API base so ProductCard can display it
    const resolvedImg =
      img && !img.startsWith('http') && !img.startsWith('/') ? `${this.api}/${img}` : img;
    return {
      ...p,
      id,
      oldPrice,
      cat,
      sub: subRaw || 'all',
      img: resolvedImg,
    };
  }

  private _slugify(s: string): string {
    return (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private toApiProduct(p: Partial<Product>): Record<string, unknown> {
    return {
      name: p.name,
      price: p.price,
      originalPrice: p.oldPrice,
      category: p.cat,
      subCategory: p.sub,
      imageUrl: p.img,
      description: p.description,
      stock: p.stock,
      unit: p.unit,
      isActive: p.status ? p.status === 'active' : undefined,
    };
  }

  // ─── List products ───────────────────────────────────────────────────────────
  getProducts(params?: {
    cat?: string;
    sub?: string;
    q?: string;
    _limit?: number;
  }): Observable<Product[]> {
    let httpParams = new HttpParams();
    // Backend uses 'category' and 'search', not 'cat' and 'q'
    if (params?.cat && params.cat !== 'all') httpParams = httpParams.set('category', params.cat);
    if (params?.q) httpParams = httpParams.set('search', params.q);
    if (params?._limit) httpParams = httpParams.set('limit', params._limit.toString());

    return this.http.get<any>(`${this.api}/api/products`, { params: httpParams }).pipe(
      map((res: any) => {
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        return list.filter((p: any) => p.isActive !== false).map((p: any) => this.normalize(p));
      }),
      catchError(() => of([])),
    );
  }

  getProductById(id: string): Observable<Product | null> {
    return this.http.get<any>(`${this.api}/api/products/${id}`).pipe(
      map((res: any) => {
        const p = res?.data ?? res;
        return p ? this.normalize(p) : null;
      }),
      catchError(() => of(null)),
    );
  }

  // ─── Admin: full product list ─────────────────────────────────────────────
  getAllProducts(filters?: {
    q?: string;
    category?: string;
    status?: 'all' | 'active' | 'inactive';
    lowStock?: boolean;
  }): Observable<Product[]> {
    const qs = new URLSearchParams();
    if (filters?.q?.trim()) qs.set('search', filters.q.trim());
    if (filters?.category && filters.category !== 'all') qs.set('category', filters.category);
    if (filters?.status && filters.status !== 'all') qs.set('status', filters.status);
    if (filters?.lowStock) qs.set('lowStock', '1');
    qs.set('limit', '500');

    return this.http
      .get<any>(`${this.api}/api/admin/products?${qs.toString()}`, { withCredentials: true })
      .pipe(
        map((res: any) => {
          const list = Array.isArray(res) ? res : (res?.data ?? []);
          return list.map((p: any) => this.normalize(p));
        }),
        catchError(() => of([])),
      );
  }

  exportAdminProductsCsv(filters?: {
    q?: string;
    category?: string;
    status?: 'all' | 'active' | 'inactive';
  }): Observable<Blob> {
    const qs = new URLSearchParams();
    if (filters?.q?.trim()) qs.set('search', filters.q.trim());
    if (filters?.category && filters.category !== 'all') qs.set('category', filters.category);
    if (filters?.status && filters.status !== 'all') qs.set('status', filters.status);
    const url = `${this.api}/api/admin/products/export${qs.toString() ? `?${qs.toString()}` : ''}`;
    return this.http.get(url, { withCredentials: true, responseType: 'blob' });
  }

  createProduct(p: Partial<Product>): Observable<Product> {
    return this.http
      .post<any>(`${this.api}/api/products`, this.toApiProduct(p))
      .pipe(map((res) => this.normalize(res?.data ?? res)));
  }

  updateProduct(id: string, p: Partial<Product>): Observable<Product> {
    return this.http
      .put<any>(`${this.api}/api/products/${id}`, this.toApiProduct(p))
      .pipe(map((res) => this.normalize(res?.data ?? res)));
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/api/products/${id}`);
  }
}
