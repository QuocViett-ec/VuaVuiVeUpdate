import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

const VALUES = [
  { icon: '🌿', title: 'Tươi sạch tuyệt đối', desc: 'Cam kết 100% sản phẩm tươi sạch, chọn lọc từ nông trại đến tay bạn.' },
  { icon: '🚀', title: 'Giao hàng siêu tốc', desc: 'Đặt hàng trước 10:00, nhận hàng trước 12:00 – nhanh hơn bạn nghĩ.' },
  { icon: '💚', title: 'Thân thiện với người dùng', desc: 'Giao diện đơn giản, dễ sử dụng, phù hợp mọi lứa tuổi.' },
  { icon: '🤖', title: 'Gợi ý thông minh AI', desc: 'Hệ thống đề xuất cá nhân hóa dựa trên lịch sử mua hàng.' },
];

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule],
  template: `
<section class="about-hero">
  <div class="container">
    <h1>Về Vựa Vui Vẻ</h1>
    <p>Cửa hàng thực phẩm tươi sống, tiện lợi và thân thiện.</p>
  </div>
</section>

<section class="section section--brand">
  <div class="container">
    <img src="../../../../images/brand/Aboutus.png" alt="Giới thiệu Vựa Vui Vẻ"
         class="brand-img" onerror="this.style.display='none'" />
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="title"><h2>Hành trình của chúng tôi</h2></div>
    <p class="about-text">
      Vựa Vui Vẻ ra đời từ niềm đam mê mang đến những sản phẩm tươi ngon, sạch sẽ
      đến tay người tiêu dùng Việt Nam một cách nhanh chóng và tiện lợi nhất.
      Chúng tôi hợp tác trực tiếp với các nông trại, loại bỏ trung gian để đảm bảo
      chất lượng và giá cả tốt nhất.
    </p>
  </div>
</section>

<section class="section section--values">
  <div class="container">
    <div class="title"><h2>Giá trị mang đến</h2></div>
    <div class="values-grid">
      @for (v of values; track v.title) {
        <div class="value-card">
          <span class="value-icon">{{ v.icon }}</span>
          <h3>{{ v.title }}</h3>
          <p>{{ v.desc }}</p>
        </div>
      }
    </div>
  </div>
</section>

<section class="section section--contact">
  <div class="container">
    <div class="title"><h2 id="mission">Sứ mệnh</h2></div>
    <p class="about-text">
      Mang lại bữa ăn ngon, lành mạnh cho mọi gia đình Việt với chi phí hợp lý,
      giao hàng đúng giờ và dịch vụ tận tâm.
    </p>
    <div class="contact-info">
      <p>📞 Hotline: <strong>012 345 678</strong></p>
      <p>📍 Địa chỉ: Vựa Vui Vẻ, TP.HCM</p>
      <p>📧 Email: hello&#64;vuavuive.vn</p>
    </div>
  </div>
</section>
  `,
  styleUrl: './about-page.component.scss',
})
export class AboutPageComponent {
  readonly values = VALUES;
}
