import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { CartItem } from '../../../core/models/product.model';

@Component({
  selector: 'app-cart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent implements OnInit {
  private cartSvc = inject(CartService);
  private router = inject(Router);

  readonly items = this.cartSvc.items;
  selected = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.selected.set(new Set(this.items().map((i) => i.product.id)));
  }

  allSelected(): boolean {
    return this.selected().size === this.items().length && this.items().length > 0;
  }

  selectedCount(): number {
    return this.selected().size;
  }

  toggle(id: string, e: Event): void {
    const s = new Set(this.selected());
    if ((e.target as HTMLInputElement).checked) s.add(id);
    else s.delete(id);
    this.selected.set(s);
  }

  toggleAll(e: Event): void {
    if ((e.target as HTMLInputElement).checked) {
      this.selected.set(new Set(this.items().map((i) => i.product.id)));
    } else {
      this.selected.set(new Set());
    }
  }

  subtotal(): number {
    return this.items()
      .filter((i) => this.selected().has(i.product.id))
      .reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  }

  inc(item: CartItem): void {
    this.cartSvc.addToCart(item.product, 1);
  }

  dec(item: CartItem): void {
    this.cartSvc.updateQuantity(item.product.id, item.quantity - 1);
  }

  remove(id: string): void {
    this.cartSvc.removeFromCart(id);
  }

  clearCart(): void {
    this.cartSvc.clearCart();
  }

  checkout(): void {
    const selectedIds = Array.from(this.selected());
    this.router.navigate(['/checkout'], { state: { selectedIds } });
  }
}
