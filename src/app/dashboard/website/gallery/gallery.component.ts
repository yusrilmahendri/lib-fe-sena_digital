import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Notyf } from 'notyf';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import {
  getUserPhotoObjectPosition,
  PHOTO_POSITION_OBJECT_POSITION,
  PhotoDisplayMode,
  PhotoPosition,
  PhotoType,
  UserPhoto,
} from 'src/app/shared/user-photo.model';

type PhotoFormValue = {
  description?: string | null;
  position?: PhotoPosition | null;
  display_mode?: PhotoDisplayMode | null;
  focal_point_x?: number | string | null;
  focal_point_y?: number | string | null;
  is_featured?: boolean | null;
};

@Component({
  selector: 'wc-gallery',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss']
})
export class GalleryComponent implements OnInit, OnDestroy {
  readonly photoTypes: Array<{ value: PhotoType; label: string; empty: string }> = [
    { value: 'gallery', label: 'Foto Galeri', empty: 'Belum ada foto galeri.' },
    { value: 'collage', label: 'Foto Kolase', empty: 'Belum ada foto kolase.' },
  ];

  readonly positionOptions: Array<{ value: PhotoPosition; label: string }> = [
    { value: 'center', label: 'Tengah' },
    { value: 'top', label: 'Atas' },
    { value: 'bottom', label: 'Bawah' },
    { value: 'left', label: 'Kiri' },
    { value: 'right', label: 'Kanan' },
    { value: 'top-left', label: 'Kiri Atas' },
    { value: 'top-right', label: 'Kanan Atas' },
    { value: 'bottom-left', label: 'Kiri Bawah' },
    { value: 'bottom-right', label: 'Kanan Bawah' },
  ];

  readonly displayModeOptions: Array<{ value: PhotoDisplayMode; label: string }> = [
    { value: 'cover', label: 'Cover' },
    { value: 'contain', label: 'Contain' },
  ];

  activeType: PhotoType = 'gallery';
  galleryPhotos: UserPhoto[] = [];
  collagePhotos: UserPhoto[] = [];

  uploadForm: FormGroup = this.createPhotoForm(true);
  editForm: FormGroup = this.createPhotoForm(false);

  isLoading = false;
  isCompressing = false;
  isUploading = false;
  isSorting = false;
  isEditCompressing = false;
  isUpdating = false;

  previewUrl: string | null = null;
  editPreviewUrl: string | null = null;
  selectedFile: File | null = null;
  compressedFile: File | null = null;
  editSelectedFile: File | null = null;
  editCompressedFile: File | null = null;
  originalSize: number | null = null;
  compressedSize: number | null = null;
  editOriginalSize: number | null = null;
  editCompressedSize: number | null = null;
  errorMessage = '';
  successMessage = '';
  editingPhoto: UserPhoto | null = null;
  userData: any = null;

  private readonly compressionQuality = 0.85;
  private readonly maxImageDimension = 1920;
  private readonly allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly notyf = new Notyf({ duration: 3000, position: { x: 'right', y: 'top' } });

  constructor(private dashboardSvc: DashboardService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.clearPreview();
    this.clearEditPreview();
  }

  get activePhotos(): UserPhoto[] {
    return this.activeType === 'gallery' ? this.galleryPhotos : this.collagePhotos;
  }

  get activeTypeLabel(): string {
    return this.photoTypes.find((item) => item.value === this.activeType)?.label || 'Foto';
  }

  get activeEmptyMessage(): string {
    return this.photoTypes.find((item) => item.value === this.activeType)?.empty || 'Belum ada foto.';
  }

  get isPremiumPhotoPackage(): boolean {
    const packageName = this.getUserPackageName().toLowerCase();
    return packageName.includes('platinum') || packageName.includes('diamond');
  }

  get maxUploadSizeMb(): number {
    return this.isPremiumPhotoPackage ? 8 : 5;
  }

  get isUploadDisabled(): boolean {
    return this.uploadForm.invalid || !this.compressedFile || this.isCompressing || this.isUploading;
  }

  setActiveType(type: PhotoType): void {
    if (this.activeType === type) {
      return;
    }
    this.activeType = type;
    this.resetUploadForm();
    this.clearMessages();
  }

  browseFiles(): void {
    document.getElementById('photoFileInput')?.click();
  }

  browseEditFiles(): void {
    document.getElementById('editPhotoFileInput')?.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      void this.prepareUploadFile(file);
    }
    input.value = '';
  }

  onEditFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      void this.prepareEditFile(file);
    }
    input.value = '';
  }

  onDropFile(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] || null;
    if (file) {
      void this.prepareUploadFile(file);
    }
  }

  preventDropDefault(event: DragEvent): void {
    event.preventDefault();
  }

  submitUpload(): void {
    if (this.isUploadDisabled || !this.compressedFile) {
      return;
    }

    this.isUploading = true;
    this.clearMessages();
    const formData = this.buildPhotoFormData(this.uploadForm.value as PhotoFormValue, this.activeType, this.compressedFile);

    this.dashboardSvc.create(DashboardServiceType.USER_PHOTOS, formData).subscribe({
      next: () => {
        this.notyf.success(`${this.activeTypeLabel} berhasil diupload.`);
        this.successMessage = `${this.activeTypeLabel} berhasil disimpan.`;
        this.resetUploadForm();
        this.loadPhotos(this.activeType);
      },
      error: (err) => {
        this.showError(this.resolveErrorMessage(err, 'Gagal upload foto.'));
        this.isUploading = false;
      },
      complete: () => {
        this.isUploading = false;
      }
    });
  }

  openEdit(photo: UserPhoto): void {
    this.revokeObjectUrl('editPreviewUrl');
    this.editingPhoto = photo;
    this.editPreviewUrl = photo.photo_url;
    this.editSelectedFile = null;
    this.editCompressedFile = null;
    this.editOriginalSize = null;
    this.editCompressedSize = null;
    this.editForm.reset({
      description: photo.description || '',
      position: photo.position || 'center',
      display_mode: photo.display_mode || 'cover',
      focal_point_x: photo.focal_point_x ?? null,
      focal_point_y: photo.focal_point_y ?? null,
      is_featured: photo.is_featured,
    });
    this.clearMessages();
  }

  closeEdit(): void {
    this.clearEditPreview();
    this.editingPhoto = null;
    this.editForm.reset();
  }

  submitEdit(): void {
    if (!this.editingPhoto || this.editForm.invalid || this.isEditCompressing || this.isUpdating) {
      return;
    }

    this.isUpdating = true;
    this.clearMessages();
    const formData = this.buildPhotoFormData(
      this.editForm.value as PhotoFormValue,
      this.editingPhoto.photo_type,
      this.editCompressedFile
    );
    formData.append('_method', 'PUT');

    this.dashboardSvc.createParam(DashboardServiceType.USER_PHOTOS, formData, `/${this.editingPhoto.id}`).subscribe({
      next: () => {
        const type = this.editingPhoto?.photo_type || this.activeType;
        this.notyf.success('Metadata foto berhasil diperbarui.');
        this.closeEdit();
        this.loadPhotos(type);
      },
      error: (err) => {
        this.showError(this.resolveErrorMessage(err, 'Gagal update foto.'));
        this.isUpdating = false;
      },
      complete: () => {
        this.isUpdating = false;
      }
    });
  }

  setFeatured(photo: UserPhoto): void {
    const formData = this.buildPhotoFormData({
      description: photo.description || '',
      position: photo.position,
      display_mode: photo.display_mode,
      focal_point_x: photo.focal_point_x ?? null,
      focal_point_y: photo.focal_point_y ?? null,
      is_featured: true,
    }, photo.photo_type, null);
    formData.append('_method', 'PUT');

    this.dashboardSvc.createParam(DashboardServiceType.USER_PHOTOS, formData, `/${photo.id}`).subscribe({
      next: () => {
        this.notyf.success('Foto utama berhasil diperbarui.');
        this.loadPhotos(photo.photo_type);
      },
      error: (err) => this.showError(this.resolveErrorMessage(err, 'Gagal menjadikan foto utama.')),
    });
  }

  deletePhoto(photo: UserPhoto): void {
    const confirmed = window.confirm('Apakah Anda yakin ingin menghapus foto ini?');
    if (!confirmed) {
      return;
    }

    this.dashboardSvc.deleteV2(DashboardServiceType.USER_PHOTOS, photo.id).subscribe({
      next: () => {
        this.notyf.success('Foto berhasil dihapus.');
        if (photo.photo_type === 'gallery') {
          this.galleryPhotos = this.galleryPhotos.filter((item) => item.id !== photo.id);
        } else {
          this.collagePhotos = this.collagePhotos.filter((item) => item.id !== photo.id);
        }
      },
      error: (err) => this.showError(this.resolveErrorMessage(err, 'Gagal hapus foto.')),
    });
  }

  dropPhoto(event: CdkDragDrop<UserPhoto[]>): void {
    if (event.previousIndex === event.currentIndex || this.isSorting) {
      return;
    }

    const previous = [...this.activePhotos];
    const next = [...this.activePhotos];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    next.forEach((photo, index) => photo.sort_order = index + 1);
    this.setPhotosForType(this.activeType, next);
    this.isSorting = true;

    this.dashboardSvc.update(DashboardServiceType.USER_PHOTOS_SORT, '', {
      items: next.map((photo) => ({ id: photo.id, sort_order: photo.sort_order })),
    }).subscribe({
      next: () => {
        this.notyf.success('Urutan foto berhasil disimpan.');
      },
      error: (err) => {
        this.setPhotosForType(this.activeType, previous);
        this.showError(this.resolveErrorMessage(err, 'Gagal menyimpan urutan foto.'));
      },
      complete: () => {
        this.isSorting = false;
      }
    });
  }

  getPreviewObjectPosition(formValue: PhotoFormValue): string {
    const x = this.normalizeFocalPoint(formValue.focal_point_x);
    const y = this.normalizeFocalPoint(formValue.focal_point_y);

    if (x !== null && y !== null) {
      return `${x}% ${y}%`;
    }

    return this.mapPosition(formValue.position || 'center');
  }

  getPhotoObjectPosition(photo: UserPhoto): string {
    return getUserPhotoObjectPosition(photo);
  }

  formatFileSize(bytes?: number | null): string {
    if (!bytes) {
      return '-';
    }

    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
  }

  clearFocalPoint(form: FormGroup): void {
    form.patchValue({ focal_point_x: null, focal_point_y: null });
  }

  private loadInitialData(): void {
    this.isLoading = true;
    forkJoin({
      profile: this.dashboardSvc.list(DashboardServiceType.USER_PROFILE, ''),
      gallery: this.dashboardSvc.list(DashboardServiceType.USER_PHOTOS, { type: 'gallery' }),
      collage: this.dashboardSvc.list(DashboardServiceType.USER_PHOTOS, { type: 'collage' }),
    }).subscribe({
      next: ({ profile, gallery, collage }) => {
        this.userData = profile?.data || profile;
        this.galleryPhotos = this.unwrapPhotos(gallery);
        this.collagePhotos = this.unwrapPhotos(collage);
      },
      error: (err) => {
        this.showError(this.resolveErrorMessage(err, 'Gagal memuat data foto. Pastikan sesi login masih aktif.'));
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  private loadPhotos(type: PhotoType): void {
    this.dashboardSvc.list(DashboardServiceType.USER_PHOTOS, { type }).subscribe({
      next: (res) => this.setPhotosForType(type, this.unwrapPhotos(res)),
      error: (err) => this.showError(this.resolveErrorMessage(err, `Gagal memuat ${type === 'gallery' ? 'foto galeri' : 'foto kolase'}.`)),
    });
  }

  private createPhotoForm(requireFile: boolean): FormGroup {
    return new FormGroup({
      file: new FormControl(null, requireFile ? Validators.required : null),
      description: new FormControl(''),
      position: new FormControl('center', Validators.required),
      display_mode: new FormControl('cover', Validators.required),
      focal_point_x: new FormControl(null, [Validators.min(0), Validators.max(100)]),
      focal_point_y: new FormControl(null, [Validators.min(0), Validators.max(100)]),
      is_featured: new FormControl(false),
    });
  }

  private async prepareUploadFile(file: File): Promise<void> {
    this.clearMessages();
    this.clearPreview();

    if (!this.validateFile(file)) {
      this.uploadForm.patchValue({ file: null });
      return;
    }

    this.selectedFile = file;
    this.compressedFile = null;
    this.originalSize = file.size;
    this.compressedSize = null;
    this.updatePreviewFromFile(file, file.name);
    this.logPreviewState('selected');

    this.isCompressing = true;
    try {
      const compressed = await this.compressImage(file);
      const compressedFile = this.ensureFile(compressed, this.buildCompressedFileName(file), compressed.type || 'image/webp');
      this.compressedFile = compressedFile;
      this.compressedSize = compressedFile.size;
      this.updatePreviewFromFile(compressedFile, compressedFile.name);
      this.logPreviewState('compressed');
      this.uploadForm.patchValue({ file: compressedFile });
      this.uploadForm.get('file')?.markAsDirty();
    } catch (error) {
      console.error('[Gallery] compress preview failed', error);
      this.logPreviewState('compress-failed');
      this.showError('Gagal kompresi foto. Coba gunakan file JPG, PNG, WEBP, atau GIF lain.');
      this.uploadForm.patchValue({ file: null });
    } finally {
      this.isCompressing = false;
    }
  }

  private async prepareEditFile(file: File): Promise<void> {
    this.clearMessages();
    this.clearEditPreview();

    if (!this.validateFile(file)) {
      return;
    }

    this.editSelectedFile = file;
    this.editCompressedFile = null;
    this.editOriginalSize = file.size;
    this.editCompressedSize = null;
    this.updateEditPreviewFromFile(file, file.name);

    this.isEditCompressing = true;
    try {
      const compressed = await this.compressImage(file);
      const compressedFile = this.ensureFile(compressed, this.buildCompressedFileName(file), compressed.type || 'image/webp');
      this.editCompressedFile = compressedFile;
      this.editCompressedSize = compressedFile.size;
      this.updateEditPreviewFromFile(compressedFile, compressedFile.name);
    } catch (error) {
      console.error('[Gallery] compress edit preview failed', error);
      this.showError('Gagal kompresi foto edit. Coba gunakan file JPG, PNG, WEBP, atau GIF lain.');
    } finally {
      this.isEditCompressing = false;
    }
  }

  private validateFile(file: File): boolean {
    if (!this.allowedTypes.includes(file.type)) {
      this.showError('Format tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF.');
      return false;
    }

    const maxBytes = this.maxUploadSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      this.showError(`Ukuran terlalu besar. Paket Anda maksimal ${this.maxUploadSizeMb} MB per foto.`);
      return false;
    }

    return true;
  }

  private compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);

      image.onload = () => {
        const ratio = Math.min(
          1,
          this.maxImageDimension / image.naturalWidth,
          this.maxImageDimension / image.naturalHeight
        );
        const width = Math.max(1, Math.round(image.naturalWidth * ratio));
        const height = Math.max(1, Math.round(image.naturalHeight * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');

        if (!context) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas unavailable'));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        canvas.toBlob((webpBlob) => {
          if (webpBlob && webpBlob.type === 'image/webp') {
            URL.revokeObjectURL(url);
            resolve(this.blobToFile(webpBlob, file.name, 'webp'));
            return;
          }

          canvas.toBlob((jpegBlob) => {
            URL.revokeObjectURL(url);
            if (jpegBlob) {
              resolve(this.blobToFile(jpegBlob, file.name, 'jpg'));
              return;
            }
            reject(new Error('Compression failed'));
          }, 'image/jpeg', this.compressionQuality);
        }, 'image/webp', this.compressionQuality);
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };

      image.src = url;
    });
  }

  private blobToFile(blob: Blob, originalName: string, extension: 'webp' | 'jpg'): File {
    const baseName = originalName.replace(/\.[^.]+$/, '') || 'photo';
    const type = extension === 'webp' ? 'image/webp' : 'image/jpeg';
    return new File([blob], `${baseName}.${extension}`, { type });
  }

  private buildPhotoFormData(value: PhotoFormValue, type: PhotoType, image: File | null): FormData {
    const formData = new FormData();
    formData.append('photo_type', type);
    formData.append('description', String(value.description || '').trim());
    formData.append('position', value.position || 'center');
    formData.append('display_mode', value.display_mode || 'cover');
    formData.append('is_featured', value.is_featured ? '1' : '0');

    const focalPointX = this.normalizeFocalPoint(value.focal_point_x);
    const focalPointY = this.normalizeFocalPoint(value.focal_point_y);
    if (focalPointX !== null) {
      formData.append('focal_point_x', String(focalPointX));
    }
    if (focalPointY !== null) {
      formData.append('focal_point_y', String(focalPointY));
    }
    if (image) {
      formData.append('image', image, image.name);
    }

    return formData;
  }

  private unwrapPhotos(response: any): UserPhoto[] {
    const raw = Array.isArray(response?.data?.data)
      ? response.data.data
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

    return raw
      .map((photo: any) => this.normalizePhoto(photo))
      .sort((a: UserPhoto, b: UserPhoto) => a.sort_order - b.sort_order);
  }

  private normalizePhoto(photo: any): UserPhoto {
    return {
      id: Number(photo?.id),
      photo_type: photo?.photo_type === 'collage' ? 'collage' : 'gallery',
      photo_url: String(photo?.photo_url || ''),
      description: photo?.description ?? null,
      position: this.isPhotoPosition(photo?.position) ? photo.position : 'center',
      display_mode: photo?.display_mode === 'contain' ? 'contain' : 'cover',
      focal_point_x: this.normalizeFocalPoint(photo?.focal_point_x),
      focal_point_y: this.normalizeFocalPoint(photo?.focal_point_y),
      object_position: photo?.object_position ?? null,
      is_featured: Boolean(photo?.is_featured),
      sort_order: Number(photo?.sort_order || 0),
      original_size: photo?.original_size ?? null,
      compressed_size: photo?.compressed_size ?? null,
      quality: photo?.quality ?? null,
      created_at: photo?.created_at ?? null,
    };
  }

  private setPhotosForType(type: PhotoType, photos: UserPhoto[]): void {
    if (type === 'gallery') {
      this.galleryPhotos = photos;
    } else {
      this.collagePhotos = photos;
    }
  }

  private resetUploadForm(): void {
    this.uploadForm.reset({
      file: null,
      description: '',
      position: 'center',
      display_mode: 'cover',
      focal_point_x: null,
      focal_point_y: null,
      is_featured: false,
    });
    this.clearPreview();
  }

  private clearPreview(): void {
    this.revokeObjectUrl('previewUrl');
    this.previewUrl = null;
    this.selectedFile = null;
    this.compressedFile = null;
    this.originalSize = null;
    this.compressedSize = null;
  }

  private clearEditPreview(): void {
    this.revokeObjectUrl('editPreviewUrl');
    this.editPreviewUrl = null;
    this.editSelectedFile = null;
    this.editCompressedFile = null;
    this.editOriginalSize = null;
    this.editCompressedSize = null;
  }

  private updatePreviewFromFile(file: File | Blob | null, fileName = 'preview.webp'): void {
    this.revokeObjectUrl('previewUrl');
    this.previewUrl = null;

    if (!file) {
      return;
    }

    const previewFile = this.ensureFile(file, fileName, file.type || 'image/webp');
    this.previewUrl = URL.createObjectURL(previewFile);
  }

  private updateEditPreviewFromFile(file: File | Blob | null, fileName = 'preview.webp'): void {
    this.revokeObjectUrl('editPreviewUrl');
    this.editPreviewUrl = null;

    if (!file) {
      return;
    }

    const previewFile = this.ensureFile(file, fileName, file.type || 'image/webp');
    this.editPreviewUrl = URL.createObjectURL(previewFile);
  }

  private ensureFile(file: File | Blob, fileName: string, fallbackType: string): File {
    if (file instanceof File) {
      return file;
    }

    return new File([file], fileName, { type: file.type || fallbackType });
  }

  private buildCompressedFileName(file: File): string {
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'preview';
    return `${baseName}.webp`;
  }

  private revokeObjectUrl(target: 'previewUrl' | 'editPreviewUrl'): void {
    const currentUrl = this[target];
    if (currentUrl && currentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentUrl);
    }
  }

  private logPreviewState(stage: string): void {
    console.log(`[Gallery Preview] stage=${stage}`);
    console.log('[Gallery Preview] selectedFile', this.selectedFile);
    console.log('[Gallery Preview] compressedFile', this.compressedFile);
    console.log('[Gallery Preview] previewUrl', this.previewUrl);
  }

  private getUserPackageName(): string {
    const sources = [
      this.userData?.package_info?.name,
      this.userData?.package_info?.jenis_paket,
      this.userData?.package_info?.name_paket,
      this.userData?.package_info?.package_tier,
      this.userData?.invitation_package?.name_paket,
      this.userData?.invitation_package?.jenis_paket,
      this.userData?.paket_undangan?.name_paket,
      this.userData?.paket_undangan?.jenis_paket,
    ];

    return sources.filter(Boolean).join(' ');
  }

  private normalizeFocalPoint(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return null;
    }

    return Math.max(0, Math.min(100, numeric));
  }

  private mapPosition(position: PhotoPosition): string {
    return PHOTO_POSITION_OBJECT_POSITION[position] || PHOTO_POSITION_OBJECT_POSITION.center;
  }

  private isPhotoPosition(value: any): value is PhotoPosition {
    return this.positionOptions.some((option) => option.value === value);
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.status === 401) {
      return 'Sesi login habis. Silakan masuk kembali.';
    }

    return error?.error?.message || error?.message || fallback;
  }

  private showError(message: string): void {
    this.errorMessage = message;
    this.successMessage = '';
    this.notyf.error(message);
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }
}
