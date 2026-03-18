import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const VALUES = [
  {
    icon: 'eco',
    title: 'Tươi sạch tuyệt đối',
    desc: 'Cam kết 100% sản phẩm tươi sạch, chọn lọc từ nông trại đến tay bạn.',
  },
  {
    icon: 'rocket_launch',
    title: 'Giao hàng siêu tốc',
    desc: 'Đặt hàng trước 10:00, nhận hàng trước 12:00 – nhanh hơn bạn nghĩ.',
  },
  {
    icon: 'favorite',
    title: 'Thân thiện với người dùng',
    desc: 'Giao diện đơn giản, dễ sử dụng, phù hợp mọi lứa tuổi.',
  },
  {
    icon: 'smart_toy',
    title: 'Gợi ý thông minh AI',
    desc: 'Hệ thống đề xuất cá nhân hóa dựa trên lịch sử mua hàng.',
  },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about-page.component.html',
  styleUrl: './about-page.component.scss',
})
export class AboutPageComponent {
  readonly values = VALUES;
}
