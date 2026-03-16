import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface RssItem {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  thumbnail: string;
  description: string;
  content: string;
  enclosure: any;
  categories: string[];
}

export interface RssResponse {
  status: string;
  feed: any;
  items: RssItem[];
}

@Injectable({
  providedIn: 'root'
})
export class RssService {
  private http = inject(HttpClient);

  getFeed(rssUrl: string): Observable<RssItem[]> {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    return this.http.get<RssResponse>(apiUrl).pipe(
      map(res => {
        const items = res.items || [];
        return items.map(item => {
          let thumbnail = item.thumbnail;

          // Fallback 1: enclosure.link
          if (!thumbnail && item.enclosure?.link) {
            thumbnail = item.enclosure.link;
          }

          // Fallback 2: Extract from description if it's an img tag
          if (!thumbnail && item.description) {
            const imgMatch = item.description.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch && imgMatch[1]) {
              thumbnail = imgMatch[1];
            }
          }

          // Clean up HTML entities in the URL (e.g., &amp; -> &)
          if (thumbnail) {
            thumbnail = thumbnail.replace(/&amp;/g, '&');
          }

          // Fallback 3: Default logo
          if (!thumbnail) {
            thumbnail = 'images/brand/LogoVVV.png';
          }

          return { ...item, thumbnail };
        });
      })
    );
  }
}
