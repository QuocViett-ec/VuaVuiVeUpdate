import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductService } from '../../../core/services/product.service';
import { environment } from '../../../../environments/environment';

interface RecipeIngredient {
  name: string;
  qty: string;
  unit: string;
}
interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recipes-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipes-page.component.html',
  styleUrl: './recipes-page.component.scss' })
export class RecipesPageComponent implements OnInit {
  private http = inject(HttpClient);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private prodSvc = inject(ProductService);

  query = '';
  recipes = signal<Recipe[]>([]);
  results = signal<Recipe[]>([]);
  selected = signal<Recipe | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    this.http.get<Recipe[]>(`${environment.apiBase}/recipes`).subscribe({
      next: (r) => this.recipes.set(r),
      error: () => {} });
  }

  search(): void {
    const q = this.query.trim().toLowerCase();
    if (!q) return;
    this.results.set(this.recipes().filter((r) => r.name.toLowerCase().includes(q)));
    this.selected.set(null);
  }

  select(r: Recipe): void {
    this.selected.set(r);
  }

  addAllToCart(): void {
    const recipe = this.selected();
    if (!recipe) return;
    this.prodSvc.getProducts({ _limit: 500 }).subscribe((allProducts) => {
      let added = 0;
      let missing = 0;
      recipe.ingredients.forEach((ing) => {
        const keyword = ing.name.toLowerCase();
        const match = allProducts.find(
          (p) => p.name.toLowerCase().includes(keyword) || keyword.includes(p.name.toLowerCase()),
        );
        if (match) {
          this.cart.addToCart(match, 1);
          added++;
        } else {
          missing++;
        }
      });
      if (missing === 0) {
        this.toast.success(`Đã thêm ${added} nguyên liệu vào giỏ hàng!`);
      } else {
        this.toast.success(
          `Đã thêm ${added}/${added + missing} nguyên liệu (${missing} sản phẩm không tìm thấy)`,
        );
      }
    });
  }
}
