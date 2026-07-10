import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Notyf } from 'notyf';
import { DashboardService } from 'src/app/dashboard.service';
import { MusicTrack, UserMusicSelection } from 'src/app/shared/invitation-music.model';

@Component({
  selector: 'wc-musik-undangan',
  templateUrl: './musik-undangan.component.html',
  styleUrls: ['./musik-undangan.component.scss'],
})
export class MusikUndanganComponent implements OnInit, OnDestroy {
  isLoadingMusic = false;
  isSavingMusic = false;
  isUploadingMusic = false;
  previewingMusicId: number | 'custom' | 'default' | null = null;
  selectedMusicId: number | null = null;
  musicOptions: MusicTrack[] = [];
  musicSelection: UserMusicSelection | null = null;
  uploadError = '';
  loadError = '';
  selectedUploadFile: File | null = null;
  selectedUploadFileName = '';

  private previewAudio: HTMLAudioElement | null = null;
  private readonly notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
  });

  constructor(private dashboardSvc: DashboardService) {}

  ngOnInit(): void {
    this.loadMusicData();
  }

  ngOnDestroy(): void {
    this.stopPreview();
  }

  loadMusicData(): void {
    this.isLoadingMusic = true;
    this.loadError = '';

    forkJoin({
      options: this.dashboardSvc.getMusicOptions(),
      selection: this.dashboardSvc.getMusicSelection(),
    }).subscribe({
      next: ({ options, selection }: { options: any; selection: any }) => {
        this.musicOptions = this.normalizeMusicOptions(options);
        this.musicSelection = this.normalizeMusicSelection(selection);
        this.selectedMusicId = this.musicSelection?.selected_music_id ?? null;
        this.isLoadingMusic = false;
      },
      error: (err: any) => {
        this.loadError = err?.error?.message || 'Gagal memuat data musik undangan.';
        this.isLoadingMusic = false;
      },
    });
  }

  selectMusic(musicId: number | null): void {
    if (this.isSavingMusic || this.isLoadingMusic) return;
    this.selectedMusicId = musicId;
  }

  saveMusicSelection(): void {
    if (this.isSavingMusic || this.isLoadingMusic) return;

    this.isSavingMusic = true;
    this.dashboardSvc.updateMusicSelection(this.selectedMusicId).subscribe({
      next: (res: any) => {
        this.notyf.success(res?.message || 'Pilihan musik berhasil disimpan');
        this.isSavingMusic = false;
        this.loadMusicData();
      },
      error: (err: any) => {
        this.notyf.error(err?.error?.message || 'Gagal menyimpan pilihan musik');
        this.isSavingMusic = false;
      },
    });
  }

  onUploadFileSelected(event: Event): void {
    this.uploadError = '';
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.selectedUploadFile = null;
      this.selectedUploadFileName = '';
      return;
    }

    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
    const allowedExtensions = ['mp3', 'wav', 'ogg', 'm4a'];
    const maxSizeInBytes = 10 * 1024 * 1024;
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      this.uploadError = 'Jenis file tidak didukung. Gunakan MP3, WAV, OGG, atau M4A.';
      input.value = '';
      this.selectedUploadFile = null;
      this.selectedUploadFileName = '';
      return;
    }

    if (file.size > maxSizeInBytes) {
      this.uploadError = 'Ukuran file terlalu besar. Maksimal 10 MB.';
      input.value = '';
      this.selectedUploadFile = null;
      this.selectedUploadFileName = '';
      return;
    }

    this.selectedUploadFile = file;
    this.selectedUploadFileName = file.name;
  }

  uploadCustomMusic(): void {
    if (this.isUploadingMusic || !this.canUploadCustomMusic()) return;

    if (!this.selectedUploadFile) {
      this.uploadError = 'Pilih file musik terlebih dahulu.';
      return;
    }

    const formData = new FormData();
    formData.append('musik', this.selectedUploadFile, this.selectedUploadFile.name);

    console.log('[CustomMusic] selectedMusicFile', this.selectedUploadFile);
    console.log('[CustomMusic] name', this.selectedUploadFile.name);
    console.log('[CustomMusic] size', this.selectedUploadFile.size);
    console.log('[CustomMusic] type', this.selectedUploadFile.type);
    formData.forEach((value, key) => {
      console.log('[CustomMusic][FormData]', key, value);
    });

    this.isUploadingMusic = true;
    this.uploadError = '';
    this.dashboardSvc.uploadCustomMusic(formData).subscribe({
      next: (res: any) => {
        this.notyf.success(res?.message || 'Musik pribadi berhasil diunggah');
        this.isUploadingMusic = false;
        this.resetUploadInput();
        this.loadMusicData();
      },
      error: (err: any) => {
        this.uploadError = err?.error?.message || 'Gagal mengunggah musik pribadi.';
        this.isUploadingMusic = false;
      },
    });
  }

  deleteCustomMusic(): void {
    if (this.isUploadingMusic || !this.musicSelection?.custom_music_url) return;

    this.isUploadingMusic = true;
    this.dashboardSvc.deleteCustomMusic().subscribe({
      next: (res: any) => {
        this.stopPreview();
        this.notyf.success(res?.message || 'Musik pribadi berhasil dihapus');
        this.isUploadingMusic = false;
        this.loadMusicData();
      },
      error: (err: any) => {
        this.notyf.error(err?.error?.message || 'Gagal menghapus musik pribadi');
        this.isUploadingMusic = false;
      },
    });
  }

  playPreview(music: MusicTrack): void {
    const audioUrl = music.audio_url || '';
    if (!audioUrl) {
      this.notyf.error('Preview musik belum tersedia');
      return;
    }

    this.playAudio(audioUrl, music.id);
  }

  playDefaultPreview(): void {
    const defaultMusic = this.musicSelection?.default_music;
    const audioUrl = defaultMusic?.audio_url || this.musicSelection?.resolved_music_url || '';
    if (!audioUrl) {
      this.notyf.error('Musik default belum tersedia');
      return;
    }

    this.playAudio(audioUrl, 'default');
  }

  playCustomPreview(): void {
    const audioUrl = this.musicSelection?.custom_music_url || '';
    if (!audioUrl) {
      this.notyf.error('Musik pribadi belum tersedia');
      return;
    }

    this.playAudio(audioUrl, 'custom');
  }

  stopPreview(): void {
    if (!this.previewAudio) {
      this.previewingMusicId = null;
      return;
    }

    this.previewAudio.pause();
    this.previewAudio.currentTime = 0;
    this.previewAudio.src = '';
    this.previewAudio = null;
    this.previewingMusicId = null;
  }

  canUploadCustomMusic(): boolean {
    return this.musicSelection?.can_upload_custom_music === true;
  }

  getCurrentMusicLabel(): string {
    if (this.isCustomMusicActive()) return 'Musik pribadi';
    if (this.musicSelection?.selected_music?.title) return this.musicSelection.selected_music.title;
    if (this.musicSelection?.default_music?.title) return this.musicSelection.default_music.title;
    return this.musicSelection?.resolved_music_url ? 'Musik aktif tersedia' : 'Musik default';
  }

  getCustomMusicName(): string {
    const url = this.musicSelection?.custom_music_url || '';
    return this.extractFileNameFromUrl(url) || 'musik-pribadi.mp3';
  }

  isCustomMusicActive(): boolean {
    const customUrl = this.musicSelection?.custom_music_url;
    const resolvedUrl = this.musicSelection?.resolved_music_url;
    return Boolean(customUrl && resolvedUrl && customUrl === resolvedUrl);
  }

  trackMusicById(_index: number, music: MusicTrack): number {
    return music.id;
  }

  private playAudio(audioUrl: string, previewId: number | 'custom' | 'default'): void {
    this.stopPreview();

    this.previewAudio = new Audio(audioUrl);
    this.previewAudio.addEventListener('ended', () => {
      this.previewingMusicId = null;
    });
    this.previewAudio.addEventListener('error', () => {
      this.notyf.error('Gagal memuat preview musik');
      this.stopPreview();
    });
    this.previewingMusicId = previewId;
    this.previewAudio.play().catch(() => {
      this.previewingMusicId = null;
      this.notyf.error('Preview ditolak browser. Coba klik tombol play sekali lagi.');
    });
  }

  private normalizeMusicOptions(response: any): MusicTrack[] {
    const candidates = [
      response,
      response?.data,
      response?.music_options,
      response?.musics,
      response?.music_tracks,
      response?.tracks,
      response?.invitation_music,
      response?.invitation_musics,
      response?.data?.music_options,
      response?.data?.musics,
      response?.data?.music_tracks,
      response?.data?.tracks,
      response?.setting?.music_options,
    ];
    const rawOptions = candidates.find((candidate) => Array.isArray(candidate)) || [];

    return rawOptions
      .map((item: any) => this.normalizeMusicItem(item))
      .filter((item: MusicTrack | null): item is MusicTrack => item !== null)
      .sort((a: MusicTrack, b: MusicTrack) => {
        const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
  }

  private normalizeMusicSelection(response: any): UserMusicSelection {
    const source = response?.music_selection || response?.selection || response?.data?.music_selection || response?.data || response?.setting || {};
    const setting = response?.setting || response?.data?.setting || {};
    const selectedMusic = this.normalizeMusicItem(source?.selected_music);
    const defaultMusic = this.normalizeMusicItem(source?.default_music);

    return {
      selected_music_id: this.toNullableNumber(source?.selected_music_id ?? setting?.selected_music_id),
      selected_music: selectedMusic,
      default_music: defaultMusic,
      custom_music_url: this.firstString([source?.custom_music_url, source?.custom_music, setting?.custom_music_url]),
      resolved_music_url: this.firstString([
        source?.resolved_music_url,
        setting?.resolved_music_url,
        source?.music_stream_url,
        setting?.music_stream_url,
        setting?.musik,
      ]),
      can_upload_custom_music:
        source?.can_upload_custom_music === true ||
        response?.data?.can_upload_custom_music === true ||
        response?.can_upload_custom_music === true,
    };
  }

  private normalizeMusicItem(item: any): MusicTrack | null {
    if (!item || typeof item !== 'object') return null;

    const id = Number(item.id ?? item.music_id);
    if (!Number.isFinite(id)) return null;

    return {
      id,
      title: String(item.title ?? item.name ?? item.judul ?? `Musik ${id}`),
      artist: item.artist ?? item.penyanyi ?? null,
      audio_url: this.firstString([item.audio_url, item.url, item.music_url, item.musik_url]),
      thumbnail_url: this.firstString([item.thumbnail_url, item.cover_url, item.image_url, item.thumbnail]),
      is_active: this.toBoolean(item.is_active),
      is_default: this.toBoolean(item.is_default),
      sort_order: this.toNullableNumber(item.sort_order ?? item.order),
    };
  }

  private firstString(values: unknown[]): string | null {
    const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
    return typeof value === 'string' ? value : null;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toBoolean(value: unknown): boolean | undefined {
    if (value === null || value === undefined) return undefined;
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  private resetUploadInput(): void {
    this.selectedUploadFile = null;
    this.selectedUploadFileName = '';
    const input = document.getElementById('custom-music-upload') as HTMLInputElement | null;
    if (input) input.value = '';
  }

  private extractFileNameFromUrl(url: string): string {
    if (!url) return '';
    try {
      const fileName = url.split('/').pop() || '';
      return decodeURIComponent(fileName);
    } catch (_error) {
      return '';
    }
  }
}
