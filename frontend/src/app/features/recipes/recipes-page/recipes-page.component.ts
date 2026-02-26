import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

interface RecipeIngredient { name: string; qty: string; unit: string; }
interface Recipe { id: string; name: string; ingredients: RecipeIngredient[]; }

@Component({
  selector: 'app-recipes-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipes-page.component.html',
  styleUrl: './recipes-page.component.scss',
})
export class RecipesPageComponent implements OnInit {
  private http = inject(HttpClient);
  private cart = inject(CartService);
  private toast = inject(ToastService);

  query     = '';
  recipes   = signal<Recipe[]>([]);
  results   = signal<Recipe[]>([]);
  selected  = signal<Recipe | null>(null);
  loading   = signal(false);

  ngOnInit(): void {
    this.http.get<Recipe[]>(`${environment.apiBase}/recipes`).subscribe({
      next: r => this.recipes.set(r),
      error: () => {}
    });
  }

  search(): void {
    const q = this.query.trim().toLowerCase();
    if (!q) return;
    this.results.set(this.recipes().filter(r => r.name.toLowerCase().includes(q)));
    this.selected.set(null);
  }

  select(r: Recipe): void { this.selected.set(r); }

  addAllToCart(): void {
    const recipe = this.selected();
    if (!recipe) return;
    this.toast.success(`Đã thêm nguyên liệu "${recipe.name}" vào giỏ!`);
  }
}
