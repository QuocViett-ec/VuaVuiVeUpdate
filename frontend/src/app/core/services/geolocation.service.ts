import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

interface NominatimResponse {
  display_name: string;
  address?: {
    road?: string;
    quarter?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private http = inject(HttpClient);

  /**
   * Lấy vị trí hiện tại của thiết bị qua Geolocation API của trình duyệt.
   * Trả về Observable<GeolocationCoordinates> hoặc throw error message string.
   */
  getCurrentPosition(): Observable<GeolocationCoordinates> {
    return new Observable((observer) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        observer.error('Trình duyệt không hỗ trợ định vị.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          observer.next(pos.coords);
          observer.complete();
        },
        (err) => {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              observer.error('Bạn đã từ chối quyền truy cập vị trí.');
              break;
            case err.POSITION_UNAVAILABLE:
              observer.error('Không thể xác định vị trí của bạn.');
              break;
            case err.TIMEOUT:
              observer.error('Yêu cầu định vị quá thời gian. Vui lòng thử lại.');
              break;
            default:
              observer.error('Lỗi định vị không xác định.');
          }
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    });
  }

  /**
   * Chuyển đổi tọa độ GPS (lat, lng) thành chuỗi địa chỉ tiếng Việt
   * sử dụng Nominatim OpenStreetMap (miễn phí, không cần API key).
   */
  reverseGeocode(lat: number, lng: number): Observable<string> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=vi`;
    return this.http
      .get<NominatimResponse>(url, {
        headers: { 'Accept-Language': 'vi' },
      })
      .pipe(
        map((r) => {
          if (!r?.display_name) return '';
          // Tạo chuỗi địa chỉ ngắn gọn hơn từ các thành phần
          const a = r.address;
          if (a) {
            const parts = [
              a.road,
              a.quarter ?? a.suburb ?? a.city_district,
              a.city ?? a.county,
              a.state,
            ].filter(Boolean);
            if (parts.length > 0) return parts.join(', ');
          }
          return r.display_name;
        }),
        catchError(() => of('')),
      );
  }
}
