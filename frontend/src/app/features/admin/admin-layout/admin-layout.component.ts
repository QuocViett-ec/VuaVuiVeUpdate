import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  auth = inject(AuthService);
  customerPortalUrl = environment.customerPortalBase;

  hasAnyRole(roles: string[]): boolean {
    const role = String(this.auth.currentUser()?.role || '').toLowerCase();
    return roles.includes(role);
  }

  hasRole(role: string): boolean {
    return this.hasAnyRole([role]);
  }

  logout() {
    this.auth.logout();
  }
}
