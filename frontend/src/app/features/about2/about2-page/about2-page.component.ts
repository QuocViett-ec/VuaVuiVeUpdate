import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-about2-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './about2-page.component.html',
  styleUrl: './about2-page.component.scss' })
export class About2PageComponent {}
