import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from '../app/shared/toast-container/toast-container.component';
import { LoadingBarComponent } from '../app/shared/loading-bar/loading-bar.component';

@Component({
  selector: 'admin-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, LoadingBarComponent],
  templateUrl: './admin-app.html',
  styleUrl: './admin-app.scss',
})
export class AdminApp {}
