import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'app-loading-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (loading.isLoading()) {
      <div class="loading-bar">
        <div class="loading-bar__progress"></div>
      </div>
    }
  `,
  styles: [
    `
      .loading-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        z-index: 9998;
        background: rgba(46, 125, 50, 0.15);
      }
      .loading-bar__progress {
        height: 100%;
        background: #2e7d32;
        animation: progress 1.5s ease-in-out infinite;
      }
      @keyframes progress {
        0% {
          width: 0;
          margin-left: 0;
        }
        50% {
          width: 70%;
          margin-left: 15%;
        }
        100% {
          width: 0;
          margin-left: 100%;
        }
      }
    `,
  ],
})
export class LoadingBarComponent {
  readonly loading = inject(LoadingService);
}
