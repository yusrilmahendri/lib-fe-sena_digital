import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  WebsiteCategory,
  CategoryListResponse,
  CategoryCreateRequest,
  CategoryCreateResponse,
  CategoryUpdateRequest,
  CategoryUpdateResponse,
  CategoryDeleteResponse,
  CategoryShowResponse,
  CategoryToggleRequest,
  CategoryToggleResponse,
  CategoryStatisticsResponse,
  CategoryListParams,
  CategoryErrorResponse,
  CategoryOperationResult
} from '../interfaces/admin-category.interfaces';

/**
 * Website Category Service
 *
 * Professional service for managing website invitation categories
 * Implements full CRUD operations with proper error handling and type safety
 */
@Injectable({
  providedIn: 'root'
})
export class WebsiteCategoryService {
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/website-categories`;
  private readonly maxImageSize = 2 * 1024 * 1024; // 2MB
  private readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];

  // State management
  private categoriesSubject = new BehaviorSubject<WebsiteCategory[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  public categories$ = this.categoriesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get website categories with filtering and pagination
   */
  getCategories(params?: CategoryListParams): Observable<CategoryListResponse<WebsiteCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());

    return this.http.get<CategoryListResponse<WebsiteCategory>>(this.baseUrl, { params: httpParams })
      .pipe(
        tap(response => {
          this.categoriesSubject.next(response.data);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get single website category by ID
   */
  getCategory(id: number): Observable<CategoryShowResponse<WebsiteCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<CategoryShowResponse<WebsiteCategory>>(`${this.baseUrl}/${id}`)
      .pipe(
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Create new website category with optional image upload
   */
  createCategory(request: CategoryCreateRequest): Observable<CategoryOperationResult<WebsiteCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    // Validate image if provided
    if (request.image) {
      const imageValidation = this.validateImage(request.image);
      if (!imageValidation.valid) {
        this.loadingSubject.next(false);
        return throwError(() => ({
          success: false,
          error: imageValidation.error
        }));
      }
    }

    const formData = this.buildFormData(request);

    return this.http.post<CategoryCreateResponse<WebsiteCategory>>(this.baseUrl, formData)
      .pipe(
        map(response => ({
          success: response.status,
          data: response.data,
          message: response.message,
          error: response.status ? undefined : response.message
        })),
        tap(result => {
          if (result.success) {
            this.refreshCategories();
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Update website category
   */
  updateCategory(id: number, request: CategoryUpdateRequest): Observable<CategoryOperationResult<WebsiteCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    // Validate image if provided
    const uploadFile = request.image || request.preview_image;
    if (uploadFile) {
      const imageValidation = this.validateImage(uploadFile);
      if (!imageValidation.valid) {
        this.loadingSubject.next(false);
        return throwError(() => ({
          success: false,
          error: imageValidation.error
        }));
      }
    }

    const formData = this.buildFormData(request);

    return this.http.put<CategoryUpdateResponse<WebsiteCategory>>(`${this.baseUrl}/${id}`, formData)
      .pipe(
        map(response => ({
          success: response.status,
          data: response.data,
          message: response.message,
          error: response.status ? undefined : response.message
        })),
        tap(result => {
          if (result.success) {
            this.refreshCategories();
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Delete website category
   */
  deleteCategory(id: number): Observable<CategoryOperationResult> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.delete<CategoryDeleteResponse>(`${this.baseUrl}/${id}`)
      .pipe(
        map(response => ({
          success: response.status,
          error: response.status ? undefined : response.message
        })),
        tap(result => {
          if (result.success) {
            this.refreshCategories();
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Toggle category activation status
   */
  toggleActivation(id: number, isActive: boolean): Observable<CategoryOperationResult<WebsiteCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    const request: CategoryToggleRequest = { is_active: isActive };

    return this.http.patch<CategoryToggleResponse<WebsiteCategory>>(`${this.baseUrl}/${id}/toggle`, request)
      .pipe(
        map(response => ({
          success: response.status,
          data: response.data,
          error: response.status ? undefined : response.message
        })),
        tap(result => {
          if (result.success) {
            this.refreshCategories();
          }
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get website category statistics
   */
  getStatistics(): Observable<CategoryStatisticsResponse> {
    return this.http.get<CategoryStatisticsResponse>(`${this.baseUrl}/statistics`)
      .pipe(
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Refresh categories list
   */
  refreshCategories(): void {
    this.getCategories().subscribe();
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this.errorSubject.next(null);
  }

  /**
   * Build FormData for API requests with image upload
   */
  private buildFormData(request: CategoryCreateRequest | CategoryUpdateRequest): FormData {
    const formData = new FormData();

    const namaKategori = request.nama_kategori?.trim();
    if (namaKategori) {
      formData.append('nama_kategori', namaKategori);
    }

    const slug = request.slug?.trim();
    if (slug) {
      formData.append('slug', slug);
    }

    if (request.urutan !== undefined && request.urutan !== null && request.urutan !== '') {
      formData.append('urutan', String(request.urutan));
    }

    if (request.image) {
      formData.append('image', request.image);
    }

    if (request.preview_image) {
      formData.append('preview_image', request.preview_image);
    }

    if (request.is_active !== undefined) {
      const isActiveValue = request.is_active.toString();
      formData.append('is_active', isActiveValue);
    }

    if (request.status !== undefined) {
      const statusValue = request.status.toString();
      formData.append('status', statusValue);
    }

    return formData;
  }

  /**
   * Validate image file
   */
  private validateImage(file: File): { valid: boolean; error?: string } {
    if (!this.allowedImageTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Please upload JPEG, PNG, JPG, or GIF.'
      };
    }

    if (file.size > this.maxImageSize) {
      return {
        valid: false,
        error: 'File size too large. Maximum size is 2MB.'
      };
    }

    return { valid: true };
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any): Observable<never> {
    this.loadingSubject.next(false);

    let errorMessage = 'Terjadi kendala saat memuat data tema. Silakan coba lagi.';
    let validationErrors: { [key: string]: string[] } | undefined;

    console.error('Website Category Service Error:', {
      status: error?.status,
      url: error?.url,
      error: error?.error,
    });

    if (error.status === 0) {
      errorMessage = 'Koneksi ke server sedang bermasalah. Silakan coba lagi sebentar lagi.';
    } else if (error.status === 500) {
      errorMessage = 'Server sedang mengalami kendala. Silakan coba lagi beberapa saat lagi.';
    } else if (error.status === 422) {
      errorMessage = 'Beberapa data belum sesuai. Mohon periksa kembali input Anda.';
    } else if (error.status === 404) {
      errorMessage = 'Data tema yang diminta belum tersedia.';
    }

    if (error.error) {
      const errorResponse = error.error as CategoryErrorResponse;

      if (errorResponse.errors) {
        validationErrors = errorResponse.errors;
        errorMessage = this.formatValidationErrors(errorResponse.errors);
      }
    }

    this.errorSubject.next(errorMessage);

    return throwError(() => ({
      success: false,
      error: errorMessage,
      validationErrors,
      status: error.status,
      originalError: error
    }));
  }

  private formatValidationErrors(errors: { [key: string]: string[] }): string {
    const messages = Object.values(errors)
      .reduce((acc: string[], value) => acc.concat(Array.isArray(value) ? value : []), [])
      .filter((message) => typeof message === 'string' && message.trim().length > 0);

    return messages.length
      ? messages.join(' ')
      : 'Beberapa data belum sesuai. Mohon periksa kembali input Anda.';
  }

  /**
   * Generate image preview URL from File
   */
  generateImagePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get storage URL for category image
   */
  getImageUrl(imagePath: string): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;
    const apiOrigin = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
    if (imagePath.startsWith('/')) {
      return `${apiOrigin}${imagePath}`;
    }
    if (/^(storage|uploads|upload)\//i.test(imagePath)) {
      return `${apiOrigin}/${imagePath}`;
    }
    return `/storage/website-categories/${imagePath}`;
  }
}
