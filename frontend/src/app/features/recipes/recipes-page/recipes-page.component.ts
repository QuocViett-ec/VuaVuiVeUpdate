import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
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
  image?: string;
  ingredients: RecipeIngredient[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recipes-page',
  imports: [FormsModule],
  templateUrl: './recipes-page.component.html',
  styleUrl: './recipes-page.component.scss',
})
export class RecipesPageComponent implements OnInit {
  private http     = inject(HttpClient);
  private cart     = inject(CartService);
  private toast    = inject(ToastService);
  private prodSvc  = inject(ProductService);

  query    = '';
  allRecipes = signal<Recipe[]>([]);
  recipes    = signal<Recipe[]>([]);   // = allRecipes after load
  results    = signal<Recipe[]>([]);
  selected   = signal<Recipe | null>(null);
  loading    = signal(true);

  /** Dùng để hiển thị danh sách khi chưa search */
  showAll = signal(false);

  /** 12 công thức đầu để hiển thị trên trang */
  featured = computed(() => this.allRecipes().slice(0, 12));

  /** Danh sách hiển thị trong browse-all */
  browseList = computed(() => this.allRecipes());

  ngOnInit(): void {
    this.http.get<Recipe[]>(`${environment.apiBase}/api/recipes`).subscribe({
      next: (r) => {
        this.allRecipes.set(r);
        this.recipes.set(r);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); },
    });
  }

  search(): void {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.results.set([]);
      this.selected.set(null);
      return;
    }
    this.results.set(this.allRecipes().filter((r) => r.name.toLowerCase().includes(q)));
    this.selected.set(null);
  }

  select(r: Recipe): void {
    this.selected.set(r);
    this.showAll.set(false);
  }

  back(): void {
    this.selected.set(null);
    this.results.set([]);
    this.query = '';
  }

  addAllToCart(): void {
    const recipe = this.selected();
    if (!recipe) return;
    this.prodSvc.getAllProducts().subscribe((allProducts) => {
      let added   = 0;
      let missing = 0;
      recipe.ingredients.forEach((ing) => {
        const kw = ing.name.toLowerCase();
        const match = allProducts.find(
          (p) => p.name.toLowerCase().includes(kw) || kw.includes(p.name.toLowerCase()),
        );
        if (match) { this.cart.addToCart(match, 1); added++; }
        else { missing++; }
      });
      if (missing === 0) {
        this.toast.success(`Đã thêm ${added} nguyên liệu vào giỏ hàng!`);
      } else {
        this.toast.success(`Đã thêm ${added}/${added + missing} nguyên liệu (${missing} sản phẩm không tìm thấy)`);
      }
    });
  }

  /** Lấy URL ảnh: nếu image bắt đầu bằng / thì dùng trực tiếp, ngược lại thêm apiBase */
  recipeImg(r: Recipe): string {
    if (!r.image) return 'images/brand/LogoVVV.png';
    if (r.image.startsWith('http')) return r.image;
    return `${environment.apiBase}${r.image}`;
  }
}
