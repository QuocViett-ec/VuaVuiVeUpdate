import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <!-- USP STRIP -->
      <div class="footer__usp">
        <div class="container footer__usp-grid">
          <div class="footer__usp-item">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 18H3c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2h-1M5 18c0 1.1.9 2 2 2s2-.9 2-2M5 18c0-1.1-.9-2-2-2s-2 .9-2 2M17 18c0 1.1.9 2 2 2s2-.9 2-2M17 18c0-1.1-.9-2-2-2s-2 .9-2 2m5-3V9h4l3 3v3h-7z"/>
            </svg>
            <div class="text">
              <strong>Freeship > 299k</strong>
              <small>Giao hàng trong ngày</small>
            </div>
          </div>
          <div class="footer__usp-item">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <div class="text">
              <strong>Hàng tươi mỗi ngày</strong>
              <small>Nhập trực tiếp từ vườn</small>
            </div>
          </div>
          <div class="footer__usp-item">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <div class="text">
              <strong>Kiểm soát chất lượng</strong>
              <small>100% kiểm tra trước khi xuất</small>
            </div>
          </div>
          <div class="footer__usp-item">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div class="text">
              <strong>Hỗ trợ 24/7</strong>
              <small>Phản hồi nhanh chóng</small>
            </div>
          </div>
        </div>
      </div>

      <div class="container footer__grid">
        <div class="footer__brand">
          <h3>Vựa Vui Vẻ</h3>
          <p>Cửa hàng thực phẩm tươi sạch, giao hàng nhanh tận nơi.</p>
        </div>
        <div class="footer__links">
          <h4>Về Vựa Vui Vẻ</h4>
          <a routerLink="/about">Giới thiệu</a>
          <a routerLink="/job">Tuyển dụng</a>
          <a routerLink="/about2">Phát triển bền vững</a>
          <a routerLink="/news">Tin tức</a>
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
          <p>Hotline: 1900 xxxx</p>
          <p>Email: support&#64;vuavuive.vn</p>
          <p>Giờ làm việc: 7:00 – 22:00 hàng ngày</p>
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
