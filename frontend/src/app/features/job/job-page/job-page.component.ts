import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

interface FlipCard {
  id: number;
  icon: string;
  title: string;
  back: string;
  flipped: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-job-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './job-page.component.html',
  styleUrl: './job-page.component.scss' })
export class JobPageComponent {
  cards: FlipCard[] = [
    {
      id: 1,
      icon: 'images-Job/Nội%20dung%20đoạn%20văn%20bản%20của%20bạn%20(2).png',
      title: 'Tận tâm',
      back: 'Chúng tôi đặt tâm huyết trong từng hành động, hướng đến chất lượng và sự tin yêu của khách hàng.',
      flipped: false },
    {
      id: 2,
      icon: 'images-Job/15.png',
      title: 'Sáng tạo',
      back: 'Không ngừng đổi mới trong công việc, dám nghĩ dám làm để tạo ra giá trị vượt trội.',
      flipped: false },
    {
      id: 3,
      icon: 'images-Job/16.png',
      title: 'Hợp tác',
      back: 'Tinh thần đồng đội, gắn kết và cùng nhau phát triển là nền tảng trong văn hóa Vựa Vui Vẻ.',
      flipped: false },
    {
      id: 4,
      icon: 'images-Job/17.png',
      title: 'Phát triển',
      back: 'Hướng đến sự cân bằng giữa tăng trưởng kinh doanh, bảo vệ môi trường và trách nhiệm xã hội.',
      flipped: false },
  ];

  teams = [
    {
      num: '01',
      title: 'Bán hàng trực tiếp đến người tiêu dùng',
      sub: '5 vị trí đang tuyển',
      desc: 'Quản lý các kênh bán lẻ trực tiếp như chuỗi cửa hàng Vựa Vui Vẻ và thương mại điện tử. Tập trung cá nhân hóa trải nghiệm khách hàng, gia tăng sự tương tác và chuyển đổi mua hàng từ các điểm chạm trực tiếp.' },
    {
      num: '02',
      title: 'Hoạch định Chiến lược & Đổi mới sáng tạo',
      sub: '1 vị trí đang tuyển',
      desc: 'Dẫn dắt quá trình hoạch định chiến lược dài hạn cho toàn công ty, phân tích xu hướng thị trường và khởi xướng các sáng kiến đổi mới.' },
    {
      num: '03',
      title: 'Kinh doanh (Nội địa & Quốc tế)',
      sub: '14 vị trí đang tuyển',
      desc: 'Tổ chức và phát triển hoạt động kinh doanh trên toàn thị trường trong và ngoài nước. Tối ưu hệ thống phân phối, xây dựng mối quan hệ chiến lược với khách hàng và đối tác.' },
    {
      num: '04',
      title: 'Chuyển đổi số',
      sub: '1 vị trí đang tuyển',
      desc: 'Trung tâm công nghệ số toàn diện, thúc đẩy hiện đại hóa quy trình, khai thác sức mạnh dữ liệu và chuyển đổi cách thức vận hành để tạo lợi thế cạnh tranh số.' },
  ];

  flip(card: FlipCard) {
    card.flipped = !card.flipped;
  }
}
