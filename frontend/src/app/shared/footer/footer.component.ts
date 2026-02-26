import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="container footer__grid">
        <div class="footer__brand">
          <h3>🛒 Vựa Vui Vẻ</h3>
          <p>Cửa hàng thực phẩm tươi sạch, giao hàng nhanh tận nơi.</p>
        </div>
        <div class="footer__links">
          <h4>Danh mục</h4>
          <a routerLink="/products" [queryParams]="{ cat: 'veg' }">Rau củ</a>
          <a routerLink="/products" [queryParams]="{ cat: 'fruit' }">Trái cây</a>
          <a routerLink="/products" [queryParams]="{ cat: 'meat' }">Thịt cá</a>
          <a routerLink="/products" [queryParams]="{ cat: 'drink' }">Đồ uống</a>
        </div>
        <div class="footer__links">
          <h4>Hỗ trợ</h4>
          <a routerLink="/orders">Tra cứu đơn hàng</a>
          <a routerLink="/account">Tài khoản</a>
        </div>
        <div class="footer__contact">
          <h4>Liên hệ</h4>
          <p>📞 1900 xxxx</p>
          <p>📧 support&#64;vuavuive.vn</p>
          <p>⏰ 7:00 – 22:00 hàng ngày</p>
        </div>
      </div>
      <div class="footer__bottom">
        <p>© {{ year }} Vựa Vui Vẻ. All rights reserved.</p>
      </div>
    </footer>
  `,
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly year = new Date().getFullYear();
}
