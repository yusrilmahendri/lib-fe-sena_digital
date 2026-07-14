import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { Notyf } from 'notyf';
import Swal from 'sweetalert2';
import { DashboardService, DashboardServiceType } from 'src/app/dashboard.service';
import {
  getUserPhotoObjectPosition,
  PHOTO_POSITION_OBJECT_POSITION,
  PhotoDisplayMode,
  PhotoPosition,
  PhotoType,
  UserPhoto,
  resolveInvitationPhotoUrl,
} from 'src/app/shared/user-photo.model';
import { getFriendlyErrorMessage } from 'src/app/shared/api-error-message.util';

type PhotoFormValue = {
  description?: string | null;
  position?: PhotoPosition | null;
  display_mode?: PhotoDisplayMode | null;
  focal_point_x?: number | string | null;
  focal_point_y?: number | string | null;
  is_featured?: boolean | null;
};

type YoutubeVideoFormValue = {
  url_video?: string | null;
  description?: string | null;
};

@Component({
  selector: 'wc-gallery',
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.scss']
})
export class GalleryComponent implements AfterViewChecked, OnInit, OnDestroy {
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
  youtubeForm: FormGroup = this.createYoutubeForm();

  isLoading = false;
  isCompressing = false;
  isUploading = false;
  isSorting = false;
  isEditCompressing = false;
  isUpdating = false;
  isSavingYoutubeVideo = false;

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
  youtubeErrorMessage = '';
  youtubeSuccessMessage = '';
  editingPhoto: UserPhoto | null = null;
  userData: any = null;
  previewSessionId = 0;

  @ViewChild('previewImage') private previewImage?: ElementRef<HTMLImageElement>;

  private readonly compressionQuality = 0.85;
  private readonly maxImageDimension = 1920;
  private readonly allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly allowedCoverExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  private readonly notyf = new Notyf({ duration: 3000, position: { x: 'right', y: 'top' } });

  constructor(private dashboardSvc: DashboardService) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.clearPreview();
    this.clearEditPreview();
    this.clearYoutubeCoverPreview();
  }

  ngAfterViewChecked(): void {
    this.syncPreviewImageSrc();
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

  get youtubeCoverPreviewUrl(): string {
    return this.previewUrlForYoutubeCover || this.getYoutubeThumbnailUrl(this.youtubeForm.value.url_video) || '';
  }

  get isYoutubeSaveDisabled(): boolean {
    return this.youtubeForm.invalid || this.isSavingYoutubeVideo || this.isCompressing;
  }

  previewUrlForYoutubeCover: string | null = null;
  youtubeCoverFile: File | null = null;
  youtubeCoverOriginalSize: number | null = null;
  youtubeCoverCompressedSize: number | null = null;

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

  browseYoutubeCover(): void {
    document.getElementById('youtubeCoverFileInput')?.click();
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

  onYoutubeCoverSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (file) {
      void this.prepareYoutubeCoverFile(file);
    }
    input.value = '';
  }

  onYoutubeCoverDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] || null;
    if (file) {
      void this.prepareYoutubeCoverFile(file);
    }
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

  submitYoutubeVideo(): void {
    if (this.isYoutubeSaveDisabled) {
      return;
    }

    const formValue = this.youtubeForm.value as YoutubeVideoFormValue;
    const youtubeUrl = String(formValue.url_video || '').trim();

    if (!youtubeUrl) {
      this.youtubeErrorMessage = 'Link YouTube wajib diisi.';
      return;
    }

    this.isSavingYoutubeVideo = true;
    this.clearMessages();
    this.youtubeErrorMessage = '';
    this.youtubeSuccessMessage = '';

    const formData = this.buildYoutubeVideoFormData(formValue, this.youtubeCoverFile);

    this.dashboardSvc.create(DashboardServiceType.USER_PHOTOS, formData).subscribe({
      next: () => {
        this.notyf.success('Video YouTube berhasil disimpan.');
        this.youtubeSuccessMessage = 'Video YouTube berhasil disimpan.';
        this.resetYoutubeForm();
        this.loadPhotos('gallery');
      },
      error: (err) => {
        this.youtubeErrorMessage = this.resolveYoutubeVideoErrorMessage(err);
        this.notyf.error(this.youtubeErrorMessage);
      },
      complete: () => {
        this.isSavingYoutubeVideo = false;
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

  async deletePhoto(photo: UserPhoto): Promise<void> {
    const result = await Swal.fire({
      title: 'Hapus foto ini?',
      text: 'Foto yang dihapus tidak dapat dikembalikan.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#94a3b8',
      width: 460,
      customClass: {
        popup: 'gallery-delete-swal',
      },
    });

    if (!result.isConfirmed) {
      return;
    }

    this.dashboardSvc.deleteV2(DashboardServiceType.USER_PHOTOS, photo.id).subscribe({
      next: () => {
        void Swal.fire({
          icon: 'success',
          title: 'Foto berhasil dihapus',
          timer: 1600,
          showConfirmButton: false,
          width: 420,
          customClass: {
            popup: 'gallery-delete-swal',
          },
        });
        if (photo.photo_type === 'gallery') {
          this.galleryPhotos = this.galleryPhotos.filter((item) => item.id !== photo.id);
        } else {
          this.collagePhotos = this.collagePhotos.filter((item) => item.id !== photo.id);
        }
      },
      error: (err) => {
        const message = this.resolveErrorMessage(err, 'Gagal hapus foto.');
        this.showError(message);
        void Swal.fire({
          icon: 'error',
          title: 'Gagal menghapus foto',
          text: message,
          confirmButtonText: 'Tutup',
          confirmButtonColor: '#e11d48',
          width: 460,
          customClass: {
            popup: 'gallery-delete-swal',
          },
        });
      },
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

  hasPhotoVideo(photo: UserPhoto): boolean {
    return !!(photo.url_video || photo.video_url || photo.link_video);
  }

  openPhotoVideo(photo: UserPhoto): void {
    const videoUrl = photo.url_video || photo.video_url || photo.link_video || '';
    if (videoUrl) {
      window.open(videoUrl, '_blank', 'noopener,noreferrer');
    }
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

  private createYoutubeForm(): FormGroup {
    return new FormGroup({
      url_video: new FormControl('', [Validators.required, this.youtubeUrlValidator.bind(this)]),
      description: new FormControl('Video YouTube'),
    });
  }

  private async prepareUploadFile(file: File): Promise<void> {
    this.clearMessages();
    this.clearPreview(false);

    if (!this.validateFile(file)) {
      this.uploadForm.patchValue({ file: null });
      return;
    }

    const sessionId = ++this.previewSessionId;
    this.selectedFile = file;
    this.compressedFile = null;
    this.originalSize = file.size;
    this.compressedSize = null;
    this.setPreviewUrlFromBlob(file, file.name);

    this.isCompressing = true;
    try {
      const compressed = await this.compressImage(file);
      if (sessionId !== this.previewSessionId) {
        return;
      }
      const compressedFile = this.ensureFile(compressed, this.buildCompressedFileName(file), compressed.type || 'image/webp');
      this.compressedFile = compressedFile;
      this.compressedSize = compressedFile.size;
      this.setPreviewUrlFromBlob(compressedFile, compressedFile.name);
      this.uploadForm.patchValue({ file: compressedFile });
      this.uploadForm.get('file')?.markAsDirty();
    } catch (error) {
      if (sessionId !== this.previewSessionId) {
        return;
      }
      console.error('[Gallery] compress preview failed', error);
      console.error('[Gallery Preview] compression failed, fallback to original', error);
      this.showError('Gagal kompresi foto. Coba gunakan file JPG, PNG, WEBP, atau GIF lain.');
      this.uploadForm.patchValue({ file: null });
    } finally {
      if (sessionId === this.previewSessionId) {
        this.isCompressing = false;
      }
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

  private validateYoutubeCoverFile(file: File): boolean {
    const extension = this.getFileExtension(file.name);
    if (!this.allowedCoverExtensions.includes(extension)) {
      this.youtubeErrorMessage = 'Format cover tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP.';
      this.notyf.error(this.youtubeErrorMessage);
      return false;
    }

    const maxBytes = this.maxUploadSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      this.youtubeErrorMessage = `Ukuran cover terlalu besar. Maksimal ${this.maxUploadSizeMb} MB.`;
      this.notyf.error(this.youtubeErrorMessage);
      return false;
    }

    return true;
  }

  private async prepareYoutubeCoverFile(file: File): Promise<void> {
    this.youtubeErrorMessage = '';
    this.clearYoutubeCoverPreview();

    if (!this.validateYoutubeCoverFile(file)) {
      return;
    }

    this.youtubeCoverOriginalSize = file.size;
    this.youtubeCoverCompressedSize = null;
    this.youtubeCoverFile = file;
    this.previewUrlForYoutubeCover = URL.createObjectURL(file);
    this.isCompressing = true;

    try {
      const compressed = await this.compressImage(file);
      const compressedFile = this.ensureFile(compressed, this.buildCompressedFileName(file), compressed.type || 'image/webp');
      this.youtubeCoverFile = compressedFile;
      this.youtubeCoverCompressedSize = compressedFile.size;
      this.clearYoutubeCoverPreview();
      this.previewUrlForYoutubeCover = URL.createObjectURL(compressedFile);
    } catch (error) {
      console.error('[Gallery] youtube cover compression failed', error);
      this.youtubeErrorMessage = 'Gagal kompresi cover. Coba gunakan file JPG, PNG, atau WEBP lain.';
      this.notyf.error(this.youtubeErrorMessage);
      this.youtubeCoverFile = null;
      this.clearYoutubeCoverPreview();
    } finally {
      this.isCompressing = false;
    }
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

  private buildYoutubeVideoFormData(value: YoutubeVideoFormValue, image: File | null): FormData {
    const formData = new FormData();
    const youtubeUrl = String(value.url_video || '').trim();

    formData.append('photo_type', 'gallery');
    formData.append('media_type', 'video');
    formData.append('description', String(value.description || 'Video YouTube').trim());
    formData.append('position', 'center');
    formData.append('object_position', this.mapPosition('center'));
    formData.append('display_mode', 'cover');
    formData.append('is_featured', '0');

    formData.append('url_video', youtubeUrl);

    if (image instanceof File) {
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
    const urlVideo = photo?.url_video ?? photo?.video_url ?? photo?.link_video ?? null;
    const normalizedPhotoUrl = resolveInvitationPhotoUrl({
      ...photo,
      url_video: urlVideo,
      video_url: photo?.video_url ?? urlVideo,
      link_video: photo?.link_video ?? urlVideo,
    });

    return {
      id: Number(photo?.id),
      photo_type: photo?.photo_type === 'collage' ? 'collage' : 'gallery',
      photo_url: normalizedPhotoUrl,
      url_video: urlVideo,
      video_url: photo?.video_url ?? urlVideo,
      link_video: photo?.link_video ?? urlVideo,
      media_type: photo?.media_type ?? null,
      image_url: photo?.image_url ?? null,
      preview_url: photo?.preview_url ?? null,
      photo: photo?.photo ?? null,
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

  private resetYoutubeForm(): void {
    this.youtubeForm.reset({
      url_video: '',
      description: 'Video YouTube',
    });
    this.clearYoutubeCoverPreview();
    this.youtubeCoverFile = null;
    this.youtubeCoverOriginalSize = null;
    this.youtubeCoverCompressedSize = null;
  }

  private clearPreview(invalidateSession = true): void {
    if (invalidateSession) {
      this.previewSessionId++;
    }
    this.clearPreviewUrl();
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

  private setPreviewUrlFromBlob(blob: Blob | File | null, fallbackName = 'preview-image.jpg'): void {
    this.clearPreviewUrl();

    if (!blob) {
      return;
    }

    const file =
      blob instanceof File
        ? blob
        : new File([blob], fallbackName, { type: blob.type || 'image/jpeg' });

    this.previewUrl = URL.createObjectURL(file);
  }

  private clearPreviewUrl(): void {
    if (this.previewUrl && this.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = null;
  }

  private clearYoutubeCoverPreview(): void {
    if (this.previewUrlForYoutubeCover && this.previewUrlForYoutubeCover.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrlForYoutubeCover);
    }
    this.previewUrlForYoutubeCover = null;
  }

  private syncPreviewImageSrc(): void {
    if (!this.previewUrl || !this.previewImage?.nativeElement) {
      return;
    }

    const image = this.previewImage.nativeElement;
    if (image.getAttribute('src') !== this.previewUrl) {
      image.src = this.previewUrl;
    }
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

  private youtubeUrlValidator(control: AbstractControl): { youtubeUrl: true } | null {
    const value = String(control.value || '').trim();
    if (!value) return null;
    return this.isValidYoutubeUrl(value) ? null : { youtubeUrl: true };
  }

  isValidYoutubeUrl(value: string | null | undefined): boolean {
    const raw = String(value || '').trim();
    if (!raw) return true;

    try {
      const url = new URL(raw);
      const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
      if (hostname === 'youtu.be') {
        return url.pathname.replace(/\//g, '').length > 0;
      }
      if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
        return (url.pathname === '/watch' && !!url.searchParams.get('v')) || url.pathname.startsWith('/embed/');
      }
    } catch {
      return false;
    }

    return false;
  }

  getYoutubeThumbnailUrl(value: string | null | undefined): string {
    const videoId = this.extractYoutubeVideoId(value);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  private extractYoutubeVideoId(value: string | null | undefined): string {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
      const url = new URL(raw);
      const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
      if (hostname === 'youtu.be') {
        return url.pathname.split('/').filter(Boolean)[0] || '';
      }
      if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
        if (url.pathname === '/watch') return url.searchParams.get('v') || '';
        if (url.pathname.startsWith('/embed/')) return url.pathname.split('/').filter(Boolean)[1] || '';
      }
    } catch {
      return '';
    }

    return '';
  }

  private getFileExtension(fileName: string): string {
    return String(fileName || '').split('.').pop()?.toLowerCase() || '';
  }

  onPreviewImageLoad(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    image?.classList.remove('is-hidden');
  }

  onPreviewImageError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    image?.classList.add('is-hidden');
  }

  onPhotoImageError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    image?.classList.add('is-hidden');
    image?.closest('.thumb')?.classList.add('is-image-missing');
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
    return getFriendlyErrorMessage(error) || fallback;
  }

  private resolveYoutubeVideoErrorMessage(error: any): string {
    if (error?.status >= 500) {
      return 'Video belum berhasil disimpan. Silakan coba lagi.';
    }

    return this.resolveErrorMessage(error, 'Video belum berhasil disimpan. Silakan coba lagi.');
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
