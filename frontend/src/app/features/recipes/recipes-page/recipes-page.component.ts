import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductService } from '../../../core/services/product.service';
import { Product } from '../../../core/models/product.model';
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

<<<<<<< Updated upstream
=======
interface HowToStep {
  id: string;
  icon: string;
  number: string;
  title: string;
  desc: string;
  tone: 'green' | 'cyan' | 'orange';
}

interface PaginationToken {
  id: string;
  type: 'page' | 'ellipsis';
  value?: number;
}

const INGREDIENT_ALIASES: Record<string, string[]> = {
  'bi do': ['bi do', 'bi ngo'],
  'thit heo ba roi': ['thit heo ba roi', 'ba roi heo', 'ba chi heo'],
  'hanh la': ['hanh la', 'hanh xanh'],
  'nuoc mam nam ngu': ['nuoc mam nam ngu', 'nuoc mam'],
  'ca basa phi le': ['ca basa phi le', 'phi le ca basa', 'ca basa'],
  'bot ngot ajinomoto': ['bot ngot ajinomoto', 'bot ngot'],
  'dau an neptune': ['dau an neptune', 'dau an'],
  'muoi i ot': ['muoi i ot', 'muoi'],
  'ca chua bi': ['ca chua bi', 'ca chua'],
  'rau mong toi': ['rau mong toi', 'mong toi'],
  'khoai tay': ['khoai tay'],
  'ca rot': ['ca rot'],
  'nam rom': ['nam rom'],
  'nuoc tuong maggi': ['nuoc tuong maggi', 'nuoc tuong'],
  'bi xanh': ['bi xanh'],
  'bau sao': ['bau sao', 'bau'],
  'uc ga phi le': ['uc ga phi le', 'uc ga'],
  'nam kim cham': ['nam kim cham'],
  'dui ga ta': ['dui ga ta', 'dui ga'],
  'ca hoi cat lat': ['ca hoi cat lat', 'ca hoi'],
  'bot banh ran ajinomoto': ['bot banh ran ajinomoto', 'bot banh ran'],
  'bap bo': ['bap bo', 'thit bap bo'],
  'nam bo': ['nam bo', 'thit bo nam'],
  'cai thia': ['cai thia'],
  'bach tuoc': ['bach tuoc'],
  'rau muc': ['rau muc', 'muc'],
  'he la': ['he la', 'he'],
  'xa lach thuy tinh thuy canh': ['xa lach thuy tinh thuy canh', 'xa lach'],
  'bun kho': ['bun kho', 'bun'],
  'mi hao hao': ['mi hao hao', 'mi goi hao hao', 'hao hao'],
  'gao st25': ['gao st25', 'gao'],
  'rong bien rac gion gia vi': ['rong bien rac gion gia vi', 'rong bien'],
  'kho qua so che': ['kho qua so che', 'kho qua'],
  'cai be xanh': ['cai be xanh'],
  'suon non': ['suon non'],
  'dau xanh': ['dau xanh'],
  'dau do': ['dau do'],
};

>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    this.prodSvc.getAllProducts().subscribe((allProducts) => {
      let added   = 0;
=======
    this.prodSvc.getProducts({ _limit: 100 }).subscribe((allProducts) => {
      let added = 0;
>>>>>>> Stashed changes
      let missing = 0;
      const missingIngredients: string[] = [];

      recipe.ingredients.forEach((ing) => {
<<<<<<< Updated upstream
        const kw = ing.name.toLowerCase();
        const match = allProducts.find(
          (p) => p.name.toLowerCase().includes(kw) || kw.includes(p.name.toLowerCase()),
        );
        if (match) { this.cart.addToCart(match, 1); added++; }
        else { missing++; }
=======
        const match = this.findBestProductMatch(ing.name, allProducts);
        if (match) {
          this.cart.addToCart(match, 1);
          added++;
        } else {
          missing++;
          missingIngredients.push(ing.name);
        }
>>>>>>> Stashed changes
      });

      if (added === 0) {
        this.toast.error('Chưa tìm thấy sản phẩm phù hợp để thêm vào giỏ hàng.');
        return;
      }

      if (missing === 0) {
        this.toast.success(`Đã thêm ${added} nguyên liệu vào giỏ hàng!`);
      } else {
<<<<<<< Updated upstream
        this.toast.success(`Đã thêm ${added}/${added + missing} nguyên liệu (${missing} sản phẩm không tìm thấy)`);
=======
        this.toast.warning(
          `Đã thêm ${added}/${added + missing} nguyên liệu. Thiếu: ${missingIngredients.join(', ')}`,
        );
>>>>>>> Stashed changes
      }
    });
  }

  /** Lấy URL ảnh: nếu image bắt đầu bằng / thì dùng trực tiếp, ngược lại thêm apiBase */
  recipeImg(r: Recipe): string {
    if (!r.image) return 'images/brand/LogoVVV.png';
    if (r.image.startsWith('http')) return r.image;
    return `${environment.apiBase}${r.image}`;
  }
<<<<<<< Updated upstream
=======

  focusRecipeSearch(): void {
    const el = document.getElementById('recipeSearchInput') as HTMLInputElement | null;
    if (!el) return;
    el.focus();
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  setShowAll(value: boolean): void {
    this.showAll.set(value);
    this.currentPage.set(1);
  }

  prevPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  nextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }

  goToPage(page: number): void {
    this.currentPage.set(Math.min(this.totalPages(), Math.max(1, page)));
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private ingredientKeywords(name: string): string[] {
    const normalized = this.normalizeText(name);
    const aliases = INGREDIENT_ALIASES[normalized] ?? [];
    return [normalized, ...aliases].filter(Boolean);
  }

  private productMatchScore(productName: string, ingredientName: string): number {
    const product = this.normalizeText(productName);
    const keywords = this.ingredientKeywords(ingredientName);
    let bestScore = 0;

    for (const keyword of keywords) {
      if (!keyword) continue;
      if (product === keyword) {
        bestScore = Math.max(bestScore, 100);
        continue;
      }
      if (product.includes(keyword)) {
        bestScore = Math.max(bestScore, 80 + keyword.length / 100);
        continue;
      }
      if (keyword.includes(product) && product.length >= 4) {
        bestScore = Math.max(bestScore, 60 + product.length / 100);
      }
    }

    return bestScore;
  }

  private findBestProductMatch(
    ingredientName: string,
    allProducts: Product[],
  ): Product | undefined {
    return allProducts
      .map((product) => ({
        product,
        score: this.productMatchScore(product.name, ingredientName),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.product;
  }
>>>>>>> Stashed changes
}
