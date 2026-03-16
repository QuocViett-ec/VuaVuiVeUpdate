import { Component, ChangeDetectionStrategy, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule, DatePipe } from '@angular/common';
import { RssService, RssItem } from '../../../core/services/rss.service';

const SECTIONS = [
  { key: 'sucKhoe', label: 'Sức khỏe', feed: 'https://vnexpress.net/rss/suc-khoe.rss', more: 'https://vnexpress.net/suc-khoe' },
  { key: 'congNghe', label: 'Công nghệ', feed: 'https://vnexpress.net/rss/so-hoa.rss', more: 'https://vnexpress.net/so-hoa' },
  { key: 'giaoDuc', label: 'Giáo dục', feed: 'https://vnexpress.net/rss/giao-duc.rss', more: 'https://vnexpress.net/giao-duc' },
  { key: 'duLich', label: 'Du lịch', feed: 'https://vnexpress.net/rss/du-lich.rss', more: 'https://vnexpress.net/du-lich' },
  { key: 'doiSong', label: 'Đời sống', feed: 'https://vnexpress.net/rss/gia-dinh.rss', more: 'https://vnexpress.net/gia-dinh' },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-news-page',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './news-page.component.html',
  styleUrl: './news-page.component.scss'
})
export class NewsPageComponent implements OnInit {
  private rssService = inject(RssService);
  private platformId = inject(PLATFORM_ID);
  isBrowser = isPlatformBrowser(this.platformId);

  sections = SECTIONS;
  activeKey = signal('sucKhoe');
  articles = signal<Record<string, RssItem[]>>({});
  loading = signal<Record<string, boolean>>({});

  get activeSection() {
    return this.sections.find((s) => s.key === this.activeKey()) ?? this.sections[0];
  }

  ngOnInit() {
    if (!this.isBrowser) return;
    this.loadSection(this.sections[0]);
  }

  setTab(section: (typeof SECTIONS)[0]) {
    this.activeKey.set(section.key);
    if (!this.articles()[section.key]) {
      this.loadSection(section);
    }
  }

  private loadSection(section: (typeof SECTIONS)[0]) {
    const key = section.key;
    this.loading.update((l) => ({ ...l, [key]: true }));

    this.rssService.getFeed(section.feed).subscribe({
      next: (items) => {
        this.articles.update((a) => ({ ...a, [key]: items.slice(0, 12) }));
        this.loading.update((l) => ({ ...l, [key]: false }));
      },
      error: () => {
        this.articles.update((a) => ({ ...a, [key]: [] }));
        this.loading.update((l) => ({ ...l, [key]: false }));
      }
    });
  }
}
