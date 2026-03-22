import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface TeamMember {
  name: string;
  role: string;
  imagePath: string;
  accent: string;
  highlight: string;
}

interface SkillItem {
  icon: string;
  title: string;
  points: string[];
}

// Put images under frontend/public/images/team/ and keep forward slashes.
const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Quốc Việt',
    role: 'Frontend Lead & UI Engineering',
    imagePath: '/images/team/quoc-viet.jpg',
    accent: 'emerald',
    highlight: 'Thiết kế trải nghiệm người dùng và kiến trúc component.',
  },
  {
    name: 'Khánh Như',
    role: 'Product & UX Content',
    imagePath: '/images/team/khanh-nhu.jpg',
    accent: 'sky',
    highlight: 'Chuẩn hóa nội dung, flow người dùng và tính rõ ràng giao diện.',
  },
  {
    name: 'Thanh Ngân',
    role: 'Backend API & Data Flow',
    imagePath: '/images/team/thanh-ngan.jpg',
    accent: 'amber',
    highlight: 'Xây dựng API, session auth và quy tắc nghiệp vụ đơn hàng.',
  },
  {
    name: 'Thanh Thảo',
    role: 'Quality & Integration',
    imagePath: '/images/team/thanh-thao.jpg',
    accent: 'rose',
    highlight: 'Kiểm thử luồng thanh toán, realtime sync và tính ổn định hệ thống.',
  },
  {
    name: 'Chí Đức',
    role: 'Deployment & System Operations',
    imagePath: '/images/team/chi-duc1.png',
    accent: 'violet',
    highlight: 'Tối ưu build, vận hành môi trường dev và tích hợp dịch vụ.',
  },
];

const FRONTEND_SKILLS: SkillItem[] = [
  {
    icon: 'web',
    title: 'Angular Standalone Architecture',
    points: [
      'Tổ chức route lazy-loading theo feature module.',
      'Signal + OnPush để tối ưu cập nhật UI.',
      'Interceptor xử lý credential, loading, auth lỗi tập trung.',
    ],
  },
  {
    icon: 'dashboard',
    title: 'UI/UX Engineering',
    points: [
      'Thiết kế dashboard quản trị có filter, pager, badge trạng thái.',
      'Responsive layout cho desktop/mobile với SCSS theo component.',
      'Realtime feedback bằng toast, loading state, empty state.',
    ],
  },
];

const BACKEND_SKILLS: SkillItem[] = [
  {
    icon: 'dns',
    title: 'Node.js + Express API Design',
    points: [
      'REST API tách lớp route/controller/model rõ ràng.',
      'Middleware auth/admin/csrf/rate-limit bảo vệ endpoint.',
      'MongoDB Mongoose cho schema order/user/product.',
    ],
  },
  {
    icon: 'hub',
    title: 'Realtime & Domain Rules',
    points: [
      'SSE đồng bộ trạng thái đơn hàng đến khách hàng theo userId.',
      'Ràng buộc nghiệp vụ chuyển trạng thái đơn theo flow hợp lệ.',
      'Tự động hóa delivered -> paid và ghi audit log thao tác admin.',
    ],
  },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-about-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './about-page.page.html',
  styleUrl: './about-page.component.scss',
})
export class AboutPageComponent {
  readonly members = TEAM_MEMBERS;
  readonly frontendSkills = FRONTEND_SKILLS;
  readonly backendSkills = BACKEND_SKILLS;
}
