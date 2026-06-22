import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface WebsiteTheme {
  id: number;
  nama_kategori: string;
  slug: string;
  image: string | null;
  is_active: boolean;
  status: 'active' | 'inactive';
  category_id: number;
  created_at: string;
  updated_at: string;
}

export interface ThemeListResponse {
  status: boolean;
  data: WebsiteTheme[];
  meta: {
    current_page: number;
    from: number;
    to: number;
    per_page: number;
    total: number;
  };
}

export interface ThemeListParams {
  search?: string;
  status?: 'active' | 'inactive';
  per_page?: number;
  page?: number;
}

/**
 * Website Theme Service
 *
 * Service untuk mengelola tema website yang tersinkronisasi dengan kategori
 */
@Injectable({
  providedIn: 'root'
})
export class WebsiteThemeService {
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/website-categories`;

  // State management
  private themesSubject = new BehaviorSubject<WebsiteTheme[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  public themes$ = this.themesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get website themes (synchronized with categories)
   */
  /**
   * Get website themes (synchronized with categories)
   */
  getThemes(params?: ThemeListParams): Observable<ThemeListResponse> {
    // Filter out undefined values
    const cleanParams: any = {};
    if (params?.search && params.search !== undefined && params.search.trim() !== '') {
      cleanParams.search = params.search;
    }
    if (params?.status && params.status !== undefined) {
      cleanParams.status = params.status;
    }
    if (params?.per_page && params.per_page > 0) {
      cleanParams.per_page = params.per_page;
    }
    if (params?.page && params.page > 0) {
      cleanParams.page = params.page;
    }

    const queryParams = new HttpParams({
      fromObject: cleanParams
    });

    return this.http.get<ThemeListResponse>(`${this.baseUrl}`, { params: queryParams })
      .pipe(
        tap(response => {
          // Map category data to theme format for synchronization
          const themesWithStatus = response.data.map(category => ({
            id: category.id,
            nama_kategori: category.nama_kategori,
            slug: category.slug,
            image: category.image,
            is_active: category.is_active,
            status: category.is_active ? 'active' as const : 'inactive' as const,
            category_id: category.id, // Link to original category
            created_at: category.created_at,
            updated_at: category.updated_at
          }));
          this.themesSubject.next(themesWithStatus);
          this.loadingSubject.next(false);
        }),
        catchError(error => {
          this.handleError(error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Toggle theme activation status
   */
  toggleActivation(id: number, isActive: boolean): Observable<any> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    const request = { is_active: isActive };

    return this.http.patch(`${this.baseUrl}/${id}/toggle`, request)
      .pipe(
        tap(() => {
          this.refreshThemes();
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Delete theme (same as deleting category since they're synchronized)
   */
  deleteTheme(id: number): Observable<any> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.delete(`${this.baseUrl}/${id}`)
      .pipe(
        tap((response) => {
          // Force immediate refresh of themes data
          this.forceRefreshThemes();
          this.loadingSubject.next(false);
          console.log('Theme deleted successfully, data refreshed');
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get theme statistics
   */
  getStatistics(): Observable<any> {
    return this.http.get(`${this.baseUrl}/statistics`)
      .pipe(
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Refresh themes list
   */
  refreshThemes(): void {
    this.getThemes().subscribe();
  }

  /**
   * Force refresh themes list with immediate update
   */
  forceRefreshThemes(): void {
    console.log('Force refreshing website themes...');
    this.loadingSubject.next(true);

    this.getThemes({ per_page: 100 }).subscribe({
      next: (response) => {
        console.log('Website themes force refreshed:', response.data.length, 'themes loaded');
        // Explicitly emit the updated data
        const themesWithStatus = response.data.map(category => ({
          id: category.id,
          nama_kategori: category.nama_kategori,
          slug: category.slug,
          image: category.image,
          is_active: category.is_active,
          status: category.is_active ? 'active' as const : 'inactive' as const,
          category_id: category.id,
          created_at: category.created_at,
          updated_at: category.updated_at
        }));
        this.themesSubject.next(themesWithStatus);
        this.loadingSubject.next(false);
      },
      error: (error) => {
        console.error('Error force refreshing themes:', error);
        this.loadingSubject.next(false);
      }
    });
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Get storage URL for theme image
   */
  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    return `/storage/website-categories/${imagePath}`;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    this.loadingSubject.next(false);

    let errorMessage = 'Terjadi kendala saat memuat data tema. Silakan coba lagi.';

    if (error.status === 0) {
      errorMessage = 'Koneksi ke server sedang bermasalah. Silakan coba lagi sebentar lagi.';
    } else if (error.status === 404) {
      errorMessage = 'Data tema yang diminta belum tersedia.';
    } else if (error.status >= 500) {
      errorMessage = 'Server sedang mengalami kendala. Silakan coba lagi beberapa saat lagi.';
    }

    this.errorSubject.next(errorMessage);
    return throwError(() => error);
  }
}
