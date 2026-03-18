import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product } from '../../../core/models/product.model';

type CategoryOption = { value: string; label: string };

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'veg', label: 'Rau Củ' },
  { value: 'fruit', label: 'Trái Cây' },
  { value: 'meat', label: 'Thịt & Cá' },
  { value: 'drink', label: 'Đồ Uống' },
  { value: 'dry', label: 'Hàng Khô' },
  { value: 'spice', label: 'Gia Vị' },
  { value: 'household', label: 'Gia Dụng' },
  { value: 'sweet', label: 'Bánh Kẹo' },
];

const SUBCATEGORY_OPTIONS: Record<string, CategoryOption[]> = {
  veg: [
    { value: 'leafy', label: 'Rau Lá' },
    { value: 'root', label: 'Củ Quả' },
    { value: 'herb', label: 'Rau Gia Vị' },
  ],
  fruit: [
    { value: 'tropical', label: 'Nhiệt Đới' },
    { value: 'citrus', label: 'Có Múi' },
    { value: 'berry', label: 'Berry' },
  ],
  meat: [
    { value: 'pork', label: 'Thịt Heo' },
    { value: 'beef', label: 'Thịt Bò' },
    { value: 'seafood', label: 'Hải Sản' },
  ],
  drink: [
    { value: 'milk', label: 'Sữa' },
    { value: 'juice', label: 'Nước Ép' },
    { value: 'soft', label: 'Nước Ngọt' },
  ],
  dry: [
    { value: 'rice', label: 'Gạo' },
    { value: 'noodle', label: 'Mì/Bún' },
    { value: 'bean', label: 'Đậu/Hạt' },
  ],
  spice: [
    { value: 'salt', label: 'Muối/Đường' },
    { value: 'powder', label: 'Bột Gia Vị' },
    { value: 'sauce', label: 'Nước Chấm' },
  ],
  household: [
    { value: 'cleaning', label: 'Vệ Sinh' },
    { value: 'kitchen', label: 'Nhà Bếp' },
    { value: 'paper', label: 'Giấy/Túi' },
  ],
  sweet: [
    { value: 'candy', label: 'Kẹo' },
    { value: 'cake', label: 'Bánh' },
    { value: 'snack', label: 'Snack' },
  ],
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-section">
      <div class="section-head">
        <h1>
          <span class="material-symbols-outlined g-icon">inventory_2</span>
          Quản lý sản phẩm
        </h1>
        <button class="btn btn--primary" (click)="openAdd()">+ Thêm sản phẩm</button>
      </div>

      <div class="search-bar">
        <input
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          type="search"
          placeholder="Nhập tên để tìm nhanh..."
          class="input"
        />
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tên sản phẩm</th>
              <th>Danh mục</th>
              <th>Giá</th>
              <th>Tồn kho</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td>{{ p.name }}</td>
                <td>
                  <span class="cat-badge">{{ p.cat }}</span>
                </td>
                <td>{{ p.price | number }}đ</td>
                <td [class.low-stock]="p.stock < 10">{{ p.stock }}</td>
                <td>
                  <span class="status-dot" [class.active]="p.status !== 'inactive'"></span
                  >{{ p.status ?? 'active' }}
                </td>
                <td class="actions">
                  <button class="btn btn--sm btn--outline" (click)="openEdit(p)">
                    <span class="material-symbols-outlined g-icon">edit</span>
                  </button>
                  <button class="btn btn--sm btn--danger" (click)="deleteProduct(p.id)">
                    <span class="material-symbols-outlined g-icon">delete</span>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Modal -->
      @if (showModal()) {
        <div class="modal-overlay" (click)="closeModal()">
          <div class="modal-box" (click)="$event.stopPropagation()">
            <h2>{{ editingId() ? 'Sửa' : 'Thêm' }} sản phẩm</h2>
            <form (ngSubmit)="saveProduct()" class="modal-form">
              <div class="field">
                <label>Tên sản phẩm *</label
                ><input
                  [(ngModel)]="form.name"
                  name="name"
                  class="input"
                  placeholder="Ví dụ: Táo Envy New Zealand"
                  required
                />
              </div>
              <div class="form-row">
                <div class="field">
                  <label>Danh mục</label>
                  <select
                    [(ngModel)]="form.cat"
                    (ngModelChange)="onCategoryChange($event)"
                    name="cat"
                    class="input"
                    required
                  >
                    @for (option of categoryOptions; track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </div>
                <div class="field">
                  <label>Danh mục con</label>
                  <select [(ngModel)]="form.sub" name="sub" class="input">
                    @for (option of currentSubOptions(); track option.value) {
                      <option [value]="option.value">{{ option.label }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="field">
                  <label>Giá (đ)</label
                  ><input
                    [(ngModel)]="form.price"
                    (ngModelChange)="onNonNegativeChange('price', $event)"
                    name="price"
                    type="number"
                    min="0"
                    class="input"
                    placeholder="Ví dụ: 45000"
                  />
                </div>
                <div class="field">
                  <label>Tồn kho</label
                  ><input
                    [(ngModel)]="form.stock"
                    (ngModelChange)="onNonNegativeChange('stock', $event)"
                    name="stock"
                    type="number"
                    min="0"
                    class="input"
                    placeholder="Ví dụ: 120"
                  />
                </div>
              </div>
              <div class="field">
                <label>URL ảnh</label
                ><input
                  [(ngModel)]="form.img"
                  name="img"
                  class="input"
                  placeholder="Ví dụ: /images/FRUIT/Mixed/Táo.jpg hoặc https://..."
                />
              </div>
              <div class="field">
                <label>Đơn vị</label
                ><input
                  [(ngModel)]="form.unit"
                  name="unit"
                  class="input"
                  placeholder="Ví dụ: kg, bó, quả, chai, gói"
                />
              </div>
              <div class="field">
                <label>Trạng thái</label>
                <select [(ngModel)]="form.status" name="status" class="input">
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
              <div class="modal-actions">
                <button type="submit" class="btn btn--primary">Lưu</button>
                <button type="button" class="btn btn--ghost" (click)="closeModal()">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './admin-products.component.scss',
})
export class AdminProductsComponent implements OnInit {
  private prodSvc = inject(ProductService);
  private toast = inject(ToastService);

  readonly categoryOptions = CATEGORY_OPTIONS;

  products = signal<Product[]>([]);
  search = signal('');
  showModal = signal(false);
  editingId = signal('');
  form: Partial<Product & { status: string }> = {};

  filtered = () => {
    const q = this.search().toLowerCase();
    return q ? this.products().filter((p) => p.name.toLowerCase().includes(q)) : this.products();
  };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.prodSvc.getAllProducts().subscribe((p) => this.products.set(p));
  }

  openAdd(): void {
    const defaultCategory = this.categoryOptions[0]?.value || 'veg';
    this.form = {
      status: 'active',
      stock: 0,
      price: 0,
      cat: defaultCategory,
      sub: SUBCATEGORY_OPTIONS[defaultCategory]?.[0]?.value || 'all',
    };
    this.editingId.set('');
    this.showModal.set(true);
  }

  openEdit(p: Product): void {
    const fallbackCategory = this.categoryOptions[0]?.value || 'veg';
    const category = p.cat || fallbackCategory;
    const validSubs = SUBCATEGORY_OPTIONS[category] || [];
    const sub = p.sub || validSubs[0]?.value || 'all';

    this.form = { ...p, cat: category, sub };
    this.editingId.set(p.id);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  currentSubOptions(): CategoryOption[] {
    const category = String(this.form.cat || this.categoryOptions[0]?.value || 'veg');
    const options = SUBCATEGORY_OPTIONS[category] || [];
    return options.length ? options : [{ value: 'all', label: 'Mặc định' }];
  }

  onCategoryChange(category: string): void {
    const options = SUBCATEGORY_OPTIONS[category] || [];
    const currentSub = String(this.form.sub || '');
    const hasCurrentSub = options.some((option) => option.value === currentSub);
    if (!hasCurrentSub) {
      this.form.sub = options[0]?.value || 'all';
    }
  }

  onNonNegativeChange(field: 'price' | 'stock', value: number | string | null): void {
    const numericValue = Number(value);
    this.form[field] = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  }

  saveProduct(): void {
    if (!this.form.name?.toString().trim()) {
      this.toast.error('Vui lòng nhập tên sản phẩm.');
      return;
    }

    if (!this.form.cat?.toString().trim()) {
      this.toast.error('Vui lòng chọn danh mục.');
      return;
    }

    this.form.price = Math.max(0, Number(this.form.price ?? 0));
    this.form.stock = Math.max(0, Number(this.form.stock ?? 0));

    const isNew = !this.editingId();
    const obs = isNew
      ? this.prodSvc.createProduct(this.form)
      : this.prodSvc.updateProduct(this.editingId(), this.form);

    obs.subscribe({
      next: () => {
        this.toast.success(isNew ? 'Đã thêm sản phẩm.' : 'Đã cập nhật sản phẩm.');
        this.closeModal();
        this.load();
      },
      error: () => this.toast.error('Lỗi khi lưu.'),
    });
  }

  deleteProduct(id: string): void {
    if (!confirm('Xác nhận xóa sản phẩm này?')) return;
    this.prodSvc.deleteProduct(id).subscribe({
      next: () => {
        this.toast.success('Đã xóa!');
        this.load();
      },
      error: () => this.toast.error('Lỗi khi xóa.'),
    });
  }
}
