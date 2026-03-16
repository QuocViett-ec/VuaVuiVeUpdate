import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../core/services/product.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product } from '../../../core/models/product.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-section">
      <div class="section-head">
        <h1>🛍️ Quản lý sản phẩm</h1>
        <button class="btn btn--primary" (click)="openAdd()">+ Thêm sản phẩm</button>
      </div>

      <div class="search-bar">
        <input
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          type="search"
          placeholder="Tìm sản phẩm..."
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
                  <button class="btn btn--sm btn--outline" (click)="openEdit(p)">✏️</button>
                  <button class="btn btn--sm btn--danger" (click)="deleteProduct(p.id)">🗑</button>
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
                ><input [(ngModel)]="form.name" name="name" class="input" required />
              </div>
              <div class="form-row">
                <div class="field">
                  <label>Danh mục</label><input [(ngModel)]="form.cat" name="cat" class="input" />
                </div>
                <div class="field">
                  <label>Danh mục con</label
                  ><input [(ngModel)]="form.sub" name="sub" class="input" />
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
                  />
                </div>
              </div>
              <div class="field">
                <label>URL ảnh</label><input [(ngModel)]="form.img" name="img" class="input" />
              </div>
              <div class="field">
                <label>Đơn vị</label><input [(ngModel)]="form.unit" name="unit" class="input" />
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
  private router = inject(Router);

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
    this.form = { status: 'active', stock: 0, price: 0 };
    this.editingId.set('');
    this.showModal.set(true);
  }
  openEdit(p: Product): void {
    this.form = { ...p };
    this.editingId.set(p.id);
    this.showModal.set(true);
  }
  closeModal(): void {
    this.showModal.set(false);
  }

  onNonNegativeChange(field: 'price' | 'stock', value: number | string | null): void {
    const numericValue = Number(value);
    this.form[field] = Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
  }

  saveProduct(): void {
    this.form.price = Math.max(0, Number(this.form.price ?? 0));
    this.form.stock = Math.max(0, Number(this.form.stock ?? 0));

    const isNew = !this.editingId();
    const obs = isNew
      ? this.prodSvc.createProduct(this.form)
      : this.prodSvc.updateProduct(this.editingId(), this.form);

    obs.subscribe({
      next: (res) => {
        this.toast.success('Đã lưu!');
        this.closeModal();
        if (isNew && res.id) {
          this.router.navigate(['/products', res.id]);
        } else {
          this.load();
        }
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
