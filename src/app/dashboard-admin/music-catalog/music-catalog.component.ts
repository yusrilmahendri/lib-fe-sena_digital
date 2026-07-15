import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';
import { Notyf } from 'notyf';
import Swal from 'sweetalert2';
import {
  AdminMusicCatalogItem,
  AdminMusicCatalogSortPayload,
} from 'src/app/interfaces/admin-music-catalog.interfaces';
import { AdminMusicCatalogService } from 'src/app/services/admin-music-catalog.service';

@Component({
  selector: 'wc-music-catalog',
  templateUrl: './music-catalog.component.html',
  styleUrls: ['./music-catalog.component.scss'],
})
export class MusicCatalogComponent implements OnInit {
  private readonly allowedMusicExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];
  private readonly maxMusicUploadSizeInBytes = 20 * 1024 * 1024;

  items: AdminMusicCatalogItem[] = [];
  isLoading = false;
  isUploading = false;
  isSavingSort = false;
  uploadError = '';
  errorMessage = '';

  selectedMusicFile: File | null = null;
  uploadTitle = '';
  uploadArtist = '';
  uploadSubtitle = '';

  editState: Record<number, { title: string; artist: string; subtitle: string; isSaving: boolean }> = {};

  private readonly notyf = new Notyf({
    duration: 2800,
    position: { x: 'right', y: 'top' },
  });

  constructor(private readonly musicCatalogService: AdminMusicCatalogService) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  loadCatalog(): void {
    this.isLoading = true;
    this.musicCatalogService.getCatalog({ per_page: 200 }).subscribe({
      next: (result) => {
        this.items = result.items;
        this.syncEditState();
        this.isLoading = false;
      },
      error: (err) => {
        this.logHttpError('Gagal memuat musik katalog', err);
        this.items = [];
        this.isLoading = false;
      },
    });
  }

  onMusicFileSelected(event: Event): void {
    this.uploadError = '';
    this.errorMessage = '';
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;

    if (!file) {
      this.selectedMusicFile = null;
      return;
    }

    const fileExtension = this.getMusicFileExtension(file);

    if (!this.allowedMusicExtensions.includes(fileExtension)) {
      this.uploadError = 'Format file musik tidak didukung. Gunakan MP3, WAV, M4A, AAC, atau OGG.';
      this.errorMessage = this.uploadError;
      input.value = '';
      this.selectedMusicFile = null;
      return;
    }

    if (file.size > this.maxMusicUploadSizeInBytes) {
      this.uploadError = 'Ukuran file maksimal 20 MB.';
      this.errorMessage = this.uploadError;
      input.value = '';
      this.selectedMusicFile = null;
      return;
    }

    this.selectedMusicFile = file;
    console.log('[ADMIN_MUSIC_FILE_SELECTED]', {
      name: file.name,
      size: file.size,
      type: file.type
    });
  }

  uploadMusicCatalog(): void {
    if (this.isUploading) return;
    if (!(this.selectedMusicFile instanceof File)) {
      this.uploadError = 'File musik wajib dipilih.';
      this.errorMessage = this.uploadError;
      return;
    }

    this.isUploading = true;
    this.uploadError = '';
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('musik', this.selectedMusicFile, this.selectedMusicFile.name);
    formData.append('title', this.uploadTitle || '');
    formData.append('judul', this.uploadTitle || '');
    formData.append('artist', this.uploadArtist || '');
    formData.append('subtitle', this.uploadSubtitle || '');
    formData.append('description', this.uploadSubtitle || '');

    const entries = (formData as any).entries?.();
    if (entries) {
      for (const pair of entries) {
        console.log('[ADMIN_MUSIC_UPLOAD_FORMDATA]', pair[0], pair[1]);
      }
    } else {
      formData.forEach((value, key) => {
        console.log('[ADMIN_MUSIC_UPLOAD_FORMDATA]', key, value);
      });
    }

    this.musicCatalogService.uploadMusicCatalog(formData).subscribe({
      next: (res) => {
        this.notyf.success('Musik katalog berhasil diupload.');
        this.resetUploadForm();
        this.isUploading = false;
        this.loadCatalog();
      },
      error: (err) => {
        this.logHttpError('Gagal mengunggah musik katalog', err);
        this.uploadError = this.resolveUploadErrorMessage(err);
        this.errorMessage = this.uploadError;
        this.notyf.error(this.uploadError);
        this.isUploading = false;
      },
    });
  }

  toggleActive(item: AdminMusicCatalogItem): void {
    const isActive = item.is_active === true;
    this.musicCatalogService.toggleCatalogMusic(item.id, !isActive).subscribe({
      next: () => {
        this.notyf.success(!isActive ? 'Musik katalog ditampilkan ke user.' : 'Musik katalog disembunyikan dari user.');
        this.loadCatalog();
      },
      error: (err) => {
        this.logHttpError('Gagal memperbarui status musik katalog', err);
        this.notyf.error(this.resolveCatalogActionErrorMessage(err, 'Gagal memperbarui status musik katalog.'));
      },
    });
  }

  setAsDefault(item: AdminMusicCatalogItem): void {
    this.musicCatalogService.setDefaultCatalogMusic(item.id).subscribe({
      next: () => {
        this.notyf.success('Musik default berhasil diperbarui.');
        this.loadCatalog();
      },
      error: (err) => {
        this.logHttpError('Gagal memperbarui musik default', err);
        this.notyf.error(this.resolveCatalogActionErrorMessage(err, 'Gagal memperbarui musik default.'));
      },
    });
  }

  saveMetadata(item: AdminMusicCatalogItem): void {
    const state = this.editState[item.id];
    if (!state || state.isSaving) return;

    state.isSaving = true;
    this.musicCatalogService.updateCatalogMusic(item.id, {
      title: state.title,
      artist: state.artist,
      subtitle: state.subtitle,
      description: state.subtitle,
    }).subscribe({
      next: () => {
        this.notyf.success('Perubahan musik katalog berhasil disimpan.');
        state.isSaving = false;
        this.loadCatalog();
      },
      error: (err) => {
        this.logHttpError('Gagal memperbarui metadata musik katalog', err);
        state.isSaving = false;
        this.notyf.error(this.resolveCatalogActionErrorMessage(err, 'Gagal memperbarui metadata musik katalog.'));
      },
    });
  }

  async deleteItem(item: AdminMusicCatalogItem): Promise<void> {
    const result = await Swal.fire({
      title: 'Hapus musik katalog?',
      text: `Lagu "${item.title}" akan dihapus permanen.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, hapus',
      cancelButtonText: 'Batal',
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#94a3b8',
      width: 460,
    });

    if (!result.isConfirmed) return;

    this.musicCatalogService.deleteCatalogMusic(item.id).subscribe({
      next: () => {
        this.notyf.success('Musik katalog berhasil dihapus.');
        this.loadCatalog();
      },
      error: (err) => {
        this.logHttpError('Gagal menghapus musik katalog', err);
        this.notyf.error(this.resolveCatalogActionErrorMessage(err, 'Gagal menghapus musik katalog.'));
      },
    });
  }

  dropSort(event: CdkDragDrop<AdminMusicCatalogItem[]>): void {
    if (event.previousIndex === event.currentIndex || this.isSavingSort) return;

    const previous = [...this.items];
    const reordered = [...this.items];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.items = reordered.map((item, index) => ({ ...item, sort_order: index + 1 }));

    const payload: AdminMusicCatalogSortPayload[] = this.items.map((item, index) => ({
      id: item.id,
      sort_order: index + 1,
    }));

    this.isSavingSort = true;
    this.musicCatalogService.sortCatalogMusic(payload).subscribe({
      next: () => {
        this.notyf.success('Urutan musik katalog berhasil disimpan.');
      },
      error: (err) => {
        this.logHttpError('Gagal menyimpan urutan musik katalog', err);
        this.items = previous;
        this.notyf.error(err?.error?.message || 'Gagal menyimpan urutan musik katalog.');
      },
      complete: () => {
        this.isSavingSort = false;
      },
    });
  }

  getDuration(item: AdminMusicCatalogItem): string {
    if (item.duration_label) return item.duration_label;
    if (typeof item.duration === 'string' && item.duration.trim()) return item.duration;

    const seconds = Number(item.duration);
    if (!Number.isFinite(seconds) || seconds <= 0) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = Math.floor(seconds % 60);
    return `${minutes}:${String(remainSeconds).padStart(2, '0')}`;
  }

  trackByMusicId(_index: number, item: AdminMusicCatalogItem): number {
    return item.id;
  }

  private syncEditState(): void {
    const nextState: Record<number, { title: string; artist: string; subtitle: string; isSaving: boolean }> = {};
    this.items.forEach((item) => {
      const current = this.editState[item.id];
      nextState[item.id] = {
        title: current?.title ?? item.title ?? '',
        artist: current?.artist ?? item.artist ?? '',
        subtitle: current?.subtitle ?? item.subtitle ?? '',
        isSaving: false,
      };
    });
    this.editState = nextState;
  }

  private resetUploadForm(): void {
    this.selectedMusicFile = null;
    this.uploadTitle = '';
    this.uploadArtist = '';
    this.uploadSubtitle = '';
    this.uploadError = '';
    this.errorMessage = '';
    const input = document.getElementById('admin-music-upload') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  private resolveUploadMessage(response: any, fallback: string): string {
    return this.firstString([
      response?.message,
      response?.errors?.music?.[0],
      response?.errors?.file?.[0],
      response?.errors?.musik?.[0],
    ]) || fallback;
  }

  private resolveUploadErrorMessage(error: any): string {
    if (error?.status === 403) {
      return 'Akun admin ini belum memiliki izin upload katalog musik.';
    }

    if (error?.status === 413) {
      return 'Ukuran file terlalu besar.';
    }

    if (error?.status === 422) {
      return this.resolveUploadMessage(error?.error, 'File musik tidak valid. Periksa format atau ukuran file.');
    }

    return this.resolveUploadMessage(error?.error, 'Gagal mengunggah file musik.');
  }

  private resolveCatalogActionErrorMessage(error: any, fallback: string): string {
    if (error?.status === 403) {
      return 'Akun admin belum memiliki izin mengelola katalog musik.';
    }

    const message = this.firstString([
      error?.error?.message,
      error?.message,
    ]);

    if (message && !message.toLowerCase().includes('right roles')) {
      return message;
    }

    return fallback;
  }

  private getMusicFileExtension(file: File): string {
    const fileName = String(file?.name || '').trim();
    return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  }

  private firstString(values: unknown[]): string | null {
    const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof value === 'string' ? value : null;
  }

  private logHttpError(context: string, error: any): void {
    console.error('[AdminMusicCatalog]', context, {
      status: error?.status,
      url: error?.url,
      error: error?.error,
    });
  }
}
