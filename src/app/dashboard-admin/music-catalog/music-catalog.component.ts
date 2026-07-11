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
  items: AdminMusicCatalogItem[] = [];
  isLoading = false;
  isUploading = false;
  isSavingSort = false;
  uploadError = '';

  uploadFile: File | null = null;
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
      error: () => {
        this.items = [];
        this.isLoading = false;
      },
    });
  }

  onUploadFileSelected(event: Event): void {
    this.uploadError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.uploadFile = null;
      return;
    }

    const allowedExtensions = ['mp3', 'wav', 'ogg', 'm4a'];
    const maxSizeInBytes = 10 * 1024 * 1024;
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedExtensions.includes(fileExtension)) {
      this.uploadError = 'Format file musik tidak didukung. Gunakan MP3, WAV, OGG, atau M4A.';
      input.value = '';
      this.uploadFile = null;
      return;
    }

    if (file.size > maxSizeInBytes) {
      this.uploadError = 'Ukuran file musik melebihi batas maksimum 10 MB.';
      input.value = '';
      this.uploadFile = null;
      return;
    }

    this.uploadFile = file;
  }

  uploadMusic(): void {
    if (this.isUploading) return;
    if (!this.uploadFile) {
      this.uploadError = 'File musik wajib dipilih.';
      return;
    }

    this.isUploading = true;
    this.uploadError = '';

    this.musicCatalogService.uploadCatalogMusic(this.uploadFile, {
      title: this.uploadTitle,
      artist: this.uploadArtist,
      subtitle: this.uploadSubtitle,
    }).subscribe({
      next: (res) => {
        this.notyf.success(this.resolveUploadMessage(res, 'Musik katalog berhasil diunggah.'));
        this.resetUploadForm();
        this.isUploading = false;
        this.loadCatalog();
      },
      error: (err) => {
        this.notyf.error(this.resolveUploadMessage(err?.error, 'Gagal mengunggah file musik.'));
        this.isUploading = false;
      },
    });
  }

  toggleActive(item: AdminMusicCatalogItem): void {
    const isActive = item.is_active === true;
    this.musicCatalogService.toggleCatalogMusic(item.id, !isActive).subscribe({
      next: () => {
        this.loadCatalog();
      },
      error: () => {
        this.notyf.error('Gagal memperbarui status musik katalog.');
      },
    });
  }

  setAsDefault(item: AdminMusicCatalogItem): void {
    this.musicCatalogService.setDefaultCatalogMusic(item.id).subscribe({
      next: () => {
        this.notyf.success('Musik default berhasil diperbarui.');
        this.loadCatalog();
      },
      error: () => {
        this.notyf.error('Gagal memperbarui musik default.');
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
    }).subscribe({
      next: () => {
        this.notyf.success('Metadata musik katalog berhasil diperbarui.');
        state.isSaving = false;
        this.loadCatalog();
      },
      error: () => {
        state.isSaving = false;
        this.notyf.error('Gagal memperbarui metadata musik katalog.');
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
      error: () => {
        this.notyf.error('Gagal menghapus musik katalog.');
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
      error: () => {
        this.items = previous;
        this.notyf.error('Gagal menyimpan urutan musik katalog.');
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
    this.uploadFile = null;
    this.uploadTitle = '';
    this.uploadArtist = '';
    this.uploadSubtitle = '';
    const input = document.getElementById('admin-music-upload') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  private resolveUploadMessage(response: any, fallback: string): string {
    return this.firstString([
      response?.message,
      response?.errors?.musik?.[0],
    ]) || fallback;
  }

  private firstString(values: unknown[]): string | null {
    const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof value === 'string' ? value : null;
  }
}
