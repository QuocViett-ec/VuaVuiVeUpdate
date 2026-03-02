import { Component, ChangeDetectionStrategy, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Article {
  title: string;
  link: string;
  desc: string;
  image: string;
  pub: string;
}

const SECTIONS = [
  {
    key: 'depda',
    label: 'Sức khỏe',
    rss: 'https://dantri.com.vn/rss/suc-khoe.rss',
    more: 'https://dantri.com.vn/suc-khoe.htm',
    lead: true },
  {
    key: 'dinhduong',
    label: 'Công nghệ',
    rss: 'https://dantri.com.vn/rss/cong-nghe.rss',
    more: 'https://dantri.com.vn/cong-nghe.htm',
    lead: false },
  {
    key: 'chuyengia',
    label: 'Giáo dục',
    rss: 'https://dantri.com.vn/rss/giao-duc.rss',
    more: 'https://dantri.com.vn/giao-duc.htm',
    lead: false },
  {
    key: 'congnghe',
    label: 'Du lịch',
    rss: 'https://dantri.com.vn/rss/du-lich.rss',
    more: 'https://dantri.com.vn/du-lich.htm',
    lead: false },
  {
    key: 'monngon',
    label: 'Đời sống',
    rss: 'https://dantri.com.vn/rss/doi-song.rss',
    more: 'https://dantri.com.vn/doi-song.htm',
    lead: false },
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-news-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-page.component.html',
  styleUrl: './news-page.component.scss' })
export class NewsPageComponent implements OnInit {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  isBrowser = isPlatformBrowser(this.platformId);

  sections = SECTIONS;
  activeKey = signal('depda');
  articles = signal<Record<string, Article[]>>({});
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
    const cached = sessionStorage.getItem(`rss:${key}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.ts < 600_000) {
          this.articles.update((a) => ({ ...a, [key]: parsed.data }));
          return;
        }
      } catch {}
    }
    this.loading.update((l) => ({ ...l, [key]: true }));
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(section.rss)}`;
    this.http.get<{ contents: string }>(proxyUrl).subscribe({
      next: (res) => {
        const items = this.parseRss(res.contents);
        this.articles.update((a) => ({ ...a, [key]: items }));
        this.loading.update((l) => ({ ...l, [key]: false }));
        try {
          sessionStorage.setItem(`rss:${key}`, JSON.stringify({ ts: Date.now(), data: items }));
        } catch {}
      },
      error: () => {
        this.articles.update((a) => ({ ...a, [key]: [] }));
        this.loading.update((l) => ({ ...l, [key]: false }));
      } });
  }

  private parseRss(xml: string): Article[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = Array.from(doc.querySelectorAll('item')).slice(0, 10);
    return items.map((item) => {
      const title = item.querySelector('title')?.textContent?.trim() ?? '';
      const link = item.querySelector('link')?.textContent?.trim() ?? '#';
      const desc =
        item
          .querySelector('description')
          ?.textContent?.replace(/<[^>]+>/g, '')
          .trim()
          .slice(0, 120) ?? '';
      const encImg = item.querySelector('enclosure')?.getAttribute('url') ?? '';
      const mediaImg = item.querySelector('thumbnail')?.getAttribute('url') ?? '';
      const image = encImg || mediaImg || '';
      const pub = item.querySelector('pubDate')?.textContent?.trim() ?? '';
      return { title, link, desc, image, pub };
    });
  }
}
