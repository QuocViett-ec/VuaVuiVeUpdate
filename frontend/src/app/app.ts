import { Component, Inject, NgZone, OnDestroy, PLATFORM_ID, afterNextRender } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { CartSidebarComponent } from './shared/cart-sidebar/cart-sidebar.component';
import { ToastContainerComponent } from './shared/toast-container/toast-container.component';
import { LoadingBarComponent } from './shared/loading-bar/loading-bar.component';
import { ChatShellComponent } from './shared/chat-widget/chat-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    CartSidebarComponent,
    ToastContainerComponent,
    LoadingBarComponent,
    ChatShellComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private routeSub?: Subscription;
  private observer?: MutationObserver;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private router: Router,
    private zone: NgZone,
  ) {
    if (!isPlatformBrowser(this.platformId)) return;

    afterNextRender(() => {
      this.forceMuteAllVideos();

      this.routeSub = this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.forceMuteAllVideos();
        }
      });

      this.observer = new MutationObserver(() => this.forceMuteAllVideos());
      this.observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.observer?.disconnect();
  }

  private forceMuteAllVideos(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.zone.runOutsideAngular(() => {
      const videos = document.querySelectorAll('video');
      videos.forEach((video) => {
        video.muted = true;
        video.defaultMuted = true;
        video.volume = 0;

        if (!video.dataset['vvForceMuted']) {
          video.dataset['vvForceMuted'] = '1';
          video.addEventListener('volumechange', () => {
            if (!video.muted || video.volume > 0) {
              video.muted = true;
              video.volume = 0;
            }
          });
        }
      });
    });
  }
}
