import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AdminMusicCatalogItem,
  AdminMusicCatalogListResult,
  AdminMusicCatalogPayload,
  AdminMusicCatalogSortPayload,
} from '../interfaces/admin-music-catalog.interfaces';

@Injectable({
  providedIn: 'root',
})
export class AdminMusicCatalogService {
  private readonly musicBaseUrl = `${this.apiOrigin}/api/music`;

  constructor(private http: HttpClient) {}

  getCatalog(params?: { search?: string; status?: 'active' | 'inactive'; page?: number; per_page?: number }): Observable<AdminMusicCatalogListResult> {
    let queryParams = new HttpParams();
    if (params?.search) queryParams = queryParams.set('search', params.search);
    if (params?.status) queryParams = queryParams.set('status', params.status);
    if (params?.page) queryParams = queryParams.set('page', String(params.page));
    if (params?.per_page) queryParams = queryParams.set('per_page', String(params.per_page));

    return this.http.get<any>(`${this.musicBaseUrl}/tracks`, { params: queryParams }).pipe(
      map((response) => ({
        items: this.normalizeCatalogItems(response),
      }))
    );
  }

  uploadMusicCatalog(formData: FormData): Observable<any> {
    return this.http.post(`${this.musicBaseUrl}/upload`, formData);
  }

  updateCatalogMusic(id: number, payload: AdminMusicCatalogPayload): Observable<any> {
    return this.http.put(`${this.musicBaseUrl}/tracks/${id}`, {
      title: payload.title,
      artist: payload.artist,
      subtitle: payload.subtitle,
      description: payload.description ?? payload.subtitle,
    });
  }

  toggleCatalogMusic(id: number, isActive: boolean): Observable<any> {
    return this.http.patch(`${this.musicBaseUrl}/tracks/${id}/status`, { is_active: isActive });
  }

  setDefaultCatalogMusic(id: number): Observable<any> {
    return this.http.patch(`${this.musicBaseUrl}/tracks/${id}/default`, {});
  }

  deleteCatalogMusic(id: number): Observable<any> {
    return this.http.delete(`${this.musicBaseUrl}/tracks/${id}`);
  }

  sortCatalogMusic(items: AdminMusicCatalogSortPayload[]): Observable<any> {
    return this.unsupportedEndpoint('Pengurutan musik belum tersedia pada kontrak endpoint backend.');
  }

  private get apiOrigin(): string {
    return environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  }

  private unsupportedEndpoint(message: string): Observable<never> {
    return throwError(() => ({
      status: 0,
      url: this.musicBaseUrl,
      error: { message },
    }));
  }

  private normalizeCatalogItems(response: any): AdminMusicCatalogItem[] {
    const rawList = this.findMusicArray(response);
    return rawList
      .map((item: any) => this.normalizeMusicItem(item))
      .filter((item: AdminMusicCatalogItem | null): item is AdminMusicCatalogItem => item !== null)
      .sort((a, b) => {
        const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
  }

  private findMusicArray(source: any): any[] {
    if (Array.isArray(source)) return source;
    if (!source || typeof source !== 'object') return [];

    const keys = [
      'music_catalog',
      'catalog',
      'admin_catalog',
      'music_options',
      'tracks',
      'items',
      'data',
      'results',
      'list',
      'records',
    ];

    for (const key of keys) {
      const found = this.findMusicArray(source[key]);
      if (found.length) return found;
    }

    return [];
  }

  private normalizeMusicItem(item: any): AdminMusicCatalogItem | null {
    if (!item || typeof item !== 'object') return null;
    const id = Number(item.id ?? item.music_id);
    if (!Number.isFinite(id)) return null;

    const pickString = (values: unknown[]): string | null => {
      const value = values.find((entry) => typeof entry === 'string' && entry.trim().length > 0);
      return typeof value === 'string' ? value : null;
    };
    const pickBoolean = (value: unknown): boolean | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      return value === true || value === 1 || value === '1' || value === 'true';
    };
    const pickNumber = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    return {
      id,
      title: pickString([item.title, item.name, item.judul]) || `Musik ${id}`,
      artist: pickString([item.artist, item.penyanyi]),
      subtitle: pickString([item.subtitle, item.description, item.deskripsi, item.caption]),
      audio_url: pickString([item.audio_url, item.music_url, item.url, item.path]),
      file_url: pickString([item.file_url, item.audio_url, item.music_url, item.url, item.path]),
      duration: item.duration ?? item.duration_seconds ?? item.seconds ?? null,
      duration_label: pickString([item.duration_label, item.formatted_duration, item.duration_text]),
      sort_order: pickNumber(item.sort_order ?? item.order),
      is_active: pickBoolean(item.is_active),
      is_default: pickBoolean(item.is_default),
      created_at: pickString([item.created_at]),
      updated_at: pickString([item.updated_at]),
    };
  }
}
