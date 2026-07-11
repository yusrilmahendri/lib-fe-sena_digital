import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  VideoCategory,
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
 * Video Category Service
 * 
 * Professional service for managing video invitation categories
 * Implements full CRUD operations with proper error handling and type safety
 */
@Injectable({
  providedIn: 'root'
})
export class VideoCategoryService {
  private readonly baseUrl = `${environment.apiBaseUrl}/admin/video-categories`;
  private readonly maxImageSize = 2 * 1024 * 1024; // 2MB
  private readonly allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];

  // State management
  private categoriesSubject = new BehaviorSubject<VideoCategory[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string | null>(null);

  public categories$ = this.categoriesSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();
  public error$ = this.errorSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get video categories with filtering and pagination
   */
  getCategories(params?: CategoryListParams): Observable<CategoryListResponse<VideoCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.per_page) httpParams = httpParams.set('per_page', params.per_page.toString());
    if (params?.page) httpParams = httpParams.set('page', params.page.toString());

    return this.http.get<CategoryListResponse<VideoCategory>>(this.baseUrl, { params: httpParams })
      .pipe(
        tap(response => {
          this.categoriesSubject.next(response.data);
          this.loadingSubject.next(false);
        }),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Get single video category by ID
   */
  getCategory(id: number): Observable<CategoryShowResponse<VideoCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<CategoryShowResponse<VideoCategory>>(`${this.baseUrl}/${id}`)
      .pipe(
        tap(() => this.loadingSubject.next(false)),
        catchError(this.handleError.bind(this))
      );
  }

  /**
   * Create new video category with optional image upload
   */
  createCategory(request: CategoryCreateRequest): Observable<CategoryOperationResult<VideoCategory>> {
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

    return this.http.post<CategoryCreateResponse<VideoCategory>>(this.baseUrl, formData)
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
   * Update video category
   */
  updateCategory(id: number, request: CategoryUpdateRequest): Observable<CategoryOperationResult<VideoCategory>> {
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

    return this.http.put<CategoryUpdateResponse<VideoCategory>>(`${this.baseUrl}/${id}`, formData)
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
   * Delete video category
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
  toggleActivation(id: number, isActive: boolean): Observable<CategoryOperationResult<VideoCategory>> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    const request: CategoryToggleRequest = { is_active: isActive };

    return this.http.patch<CategoryToggleResponse<VideoCategory>>(`${this.baseUrl}/${id}/toggle`, request)
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
   * Get video category statistics
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

    if (request.nama_kategori) {
      formData.append('nama_kategori', request.nama_kategori);
    }

    if (request.slug) {
      formData.append('slug', request.slug);
    }

    if (request.image) {
      formData.append('image', request.image);
    }

    if (request.is_active !== undefined) {
      formData.append('is_active', request.is_active.toString());
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

    let errorMessage = 'An unexpected error occurred';
    let validationErrors: { [key: string]: string[] } | undefined;

    if (error.error) {
      const errorResponse = error.error as CategoryErrorResponse;
      
      if (errorResponse.message) {
        errorMessage = errorResponse.message;
      }

      if (errorResponse.errors) {
        validationErrors = errorResponse.errors;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    this.errorSubject.next(errorMessage);

    return throwError(() => ({
      success: false,
      error: errorMessage,
      validationErrors
    }));
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
    return `/storage/video-categories/${imagePath}`;
  }
}
