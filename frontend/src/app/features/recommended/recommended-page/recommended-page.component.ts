import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RecommenderService } from '../../../core/services/recommender.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Product, Recommendation } from '../../../core/models/product.model';
import { ProductCardComponent } from '../../../shared/product-card/product-card.component';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-recommended-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './recommended-page.component.html',
  styleUrl: './recommended-page.component.scss' })
export class RecommendedPageComponent implements OnInit {
  private recommenderSvc = inject(RecommenderService);
  private productSvc = inject(ProductService);
  private auth = inject(AuthService);
  private cart = inject(CartService);
  private toast = inject(ToastService);

  personal  = signal<Recommendation[]>([]);
  similar   = signal<Product[]>([]);
  trending  = signal<Product[]>([]);
  loading   = signal(true);
  interests = signal<string[]>([]);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const user = this.auth.currentUser();
    if (user?.id) {
      this.recommenderSvc.getTimeAwareRecommendations(user.id, 12).subscribe({
        next: (recs) => {
          this.personal.set(recs);
          const cats = [...new Set(recs.map(r => r.category).filter(Boolean))];
          this.interests.set(cats.slice(0, 5) as string[]);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    } else {
      this.loading.set(false);
    }
    this.productSvc.getProducts({ _limit: 12 }).subscribe(products => {
      this.similar.set(products.filter(p => p.cat === 'veg' || p.cat === 'fruit').slice(0, 8));
      this.trending.set(products.slice(0, 8));
    });
  }

  addToCart(p: Product): void {
    this.cart.addToCart(p, 1);
    this.toast.success(`Đã thêm "${p.name}" vào giỏ!`);
  }
}
