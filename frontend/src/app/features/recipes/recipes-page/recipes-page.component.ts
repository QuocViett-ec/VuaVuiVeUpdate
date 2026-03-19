import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  WritableSignal,
  OnInit,
} from '@angular/core';
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

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recipes-page',
  imports: [FormsModule],
  templateUrl: './recipes-page.component.html',
  styleUrl: './recipes-page.component.scss',
})
export class RecipesPageComponent implements OnInit {
  private http = inject(HttpClient);
  private cart = inject(CartService);
  private toast = inject(ToastService);
  private prodSvc = inject(ProductService);

  query = '';
  allRecipes = signal<Recipe[]>([]);
  recipes = signal<Recipe[]>([]); // = allRecipes after load
  results = signal<Recipe[]>([]);
  selected = signal<Recipe | null>(null);
  loading = signal(true);

  /** Dùng để hiển thị danh sách khi chưa search */
  showAll = signal(false);

  readonly pageSize = 9;
  currentPage: WritableSignal<number> = signal(1);

  /** 9 công thức đầu để hiển thị trên trang */
  featured = computed(() => this.allRecipes().slice(0, this.pageSize));

  /** Danh sách hiển thị trong browse-all */
  browseList = computed(() => this.allRecipes());

  totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.browseList().length / this.pageSize));
  });

  pageItems = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * this.pageSize;
    return this.browseList().slice(start, start + this.pageSize);
  });

  paginationTokens = computed<PaginationToken[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => ({
        id: `page-${index + 1}`,
        type: 'page' as const,
        value: index + 1,
      }));
    }

    const tokens: PaginationToken[] = [{ id: 'page-1', type: 'page', value: 1 }];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) {
      tokens.push({ id: 'ellipsis-left', type: 'ellipsis' });
    }

    for (let page = start; page <= end; page++) {
      tokens.push({ id: `page-${page}`, type: 'page', value: page });
    }

    if (end < total - 1) {
      tokens.push({ id: 'ellipsis-right', type: 'ellipsis' });
    }

    tokens.push({ id: `page-${total}`, type: 'page', value: total });
    return tokens;
  });

  readonly howToSteps: HowToStep[] = [
    {
      id: 'step-1',
      icon: 'shopping_cart',
      number: '01',
      title: 'Chọn món',
      desc: 'Gõ tên món ăn bạn muốn nấu hoặc chọn từ danh sách gợi ý.',
      tone: 'green',
    },
    {
      id: 'step-2',
      icon: 'deployed_code',
      number: '02',
      title: 'Thêm vào giỏ',
      desc: 'Nhấn nút để tự động thêm tất cả nguyên liệu cần thiết vào giỏ hàng.',
      tone: 'cyan',
    },
    {
      id: 'step-3',
      icon: 'payments',
      number: '03',
      title: 'Thanh toán',
      desc: 'Tiến hành thanh toán và nhận ngay nguyên liệu tươi ngon tại nhà.',
      tone: 'orange',
    },
  ];

  ngOnInit(): void {
    this.http.get<Recipe[]>(`${environment.apiBase}/api/recipes`).subscribe({
      next: (r) => {
        this.allRecipes.set(r);
        this.recipes.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
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
    requestAnimationFrame(() => {
      const detailEl = document.getElementById('recipeDetailCard');
      if (detailEl) {
        detailEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const sectionEl = document.getElementById('recipeSearchSection');
      sectionEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
      let added = 0;
      let missing = 0;
      recipe.ingredients.forEach((ing) => {
        const kw = ing.name.toLowerCase();
        const match = allProducts.find(
          (p) => p.name.toLowerCase().includes(kw) || kw.includes(p.name.toLowerCase()),
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

  /** Lấy URL ảnh: nếu image bắt đầu bằng / thì dùng trực tiếp, ngược lại thêm apiBase */
  recipeImg(r: Recipe): string {
    if (!r.image) return 'images/brand/LogoVVV.png';
    if (r.image.startsWith('http')) return r.image;
    return `${environment.apiBase}${r.image}`;
  }

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
}
