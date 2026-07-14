import { Component, OnDestroy, OnInit } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { Notyf } from 'notyf';
import { DashboardService, ProfileData, ProfileResponse } from 'src/app/dashboard.service';
import { resolvePackageTier } from 'src/app/theme-package-access.util';
import {
  CustomMusicInfo,
  MusicSourceType,
  MusicTrack,
  UserMusicSelection,
} from 'src/app/shared/invitation-music.model';

@Component({
  selector: 'wc-musik-undangan',
  templateUrl: './musik-undangan.component.html',
  styleUrls: ['./musik-undangan.component.scss'],
})
export class MusikUndanganComponent implements OnInit, OnDestroy {
  private readonly allowedMusicExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg'];
  private readonly maxMusicUploadSizeInBytes = 20 * 1024 * 1024;

  isLoadingMusic = false;
  isSavingMusic = false;
  isUploadingMusic = false;
  previewingMusicId: number | 'custom' | 'default' | null = null;
  selectedMusicId: number | null = null;
  selectedMusicSourceHint: MusicSourceType = 'default';
  musicOptions: MusicTrack[] = [];
  userUploadTracks: MusicTrack[] = [];
  adminCatalogTracks: MusicTrack[] = [];
  globalCatalogTracks: MusicTrack[] = [];
  musicSelection: UserMusicSelection | null = null;
  uploadError = '';
  loadError = '';
  selectedMusicFile: File | null = null;
  selectedMusicFileName = '';
  userData: ProfileData | null = null;

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
      profile: this.dashboardSvc.getProfile().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ options, selection, profile }: { options: any; selection: any; profile: ProfileResponse | null }) => {
        const normalizedSelection = this.normalizeMusicSelection(selection);
        const catalogSections = this.extractCatalogSections(options, selection);
        const optionsFromMusicOptions = this.normalizeMusicOptions(options);
        const optionsFromMusicSelection = this.normalizeMusicOptions(selection);
        const fallbackCatalogTracks = this.mergeMusicOptions(optionsFromMusicOptions, optionsFromMusicSelection);

        this.userData = profile?.data ?? null;
        this.userUploadTracks = catalogSections.userUploads;
        this.adminCatalogTracks = catalogSections.hasCatalogSections
          ? catalogSections.adminCatalog
          : fallbackCatalogTracks;
        // Musik Global sementara dinonaktifkan
        this.globalCatalogTracks = [];
        this.musicOptions = this.adminCatalogTracks;
        this.musicSelection = normalizedSelection;
        this.selectedMusicId = normalizedSelection?.selected_music_id ?? null;
        this.selectedMusicSourceHint = this.resolveSourceTypeByTrackId(this.selectedMusicId);
        this.isLoadingMusic = false;
      },
      error: (err: any) => {
        this.logHttpError('Gagal memuat data musik undangan', err);
        this.loadError = err?.error?.message || 'Gagal memuat data musik undangan.';
        this.isLoadingMusic = false;
      },
    });
  }

  selectMusic(musicId: number | null, sourceType?: MusicSourceType): void {
    if (this.isSavingMusic || this.isLoadingMusic) return;
    this.selectedMusicId = musicId;
    this.selectedMusicSourceHint = sourceType ?? this.resolveSourceTypeByTrackId(musicId);
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
        this.logHttpError('Gagal menyimpan pilihan musik', err);
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
      this.selectedMusicFile = null;
      this.selectedMusicFileName = '';
      return;
    }

    const fileExtension = this.getMusicFileExtension(file);

    if (!this.allowedMusicExtensions.includes(fileExtension)) {
      this.uploadError = 'Format file tidak didukung. Gunakan MP3, WAV, M4A, AAC, atau OGG.';
      input.value = '';
      this.selectedMusicFile = null;
      this.selectedMusicFileName = '';
      return;
    }

    if (file.size > this.maxMusicUploadSizeInBytes) {
      this.uploadError = 'Ukuran file maksimal 20 MB.';
      input.value = '';
      this.selectedMusicFile = null;
      this.selectedMusicFileName = '';
      return;
    }

    this.selectedMusicFile = file;
    this.selectedMusicFileName = file.name;
  }

  uploadCustomMusic(): void {
    if (this.isUploadingMusic || !this.canUploadCustomMusic()) return;

    if (!this.selectedMusicFile) {
      this.uploadError = 'File musik wajib dipilih.';
      return;
    }

    const formData = new FormData();
    formData.append('musik', this.selectedMusicFile, this.selectedMusicFile.name);

    this.isUploadingMusic = true;
    this.uploadError = '';
    this.dashboardSvc.uploadCustomMusic(formData).subscribe({
      next: (res: any) => {
        this.notyf.success(this.resolveUploadMessage(res, 'Musik pribadi berhasil diunggah.'));
        this.isUploadingMusic = false;
        this.resetUploadInput();
        this.loadMusicData();
      },
      error: (err: any) => {
        this.logHttpError('Gagal mengunggah musik pribadi', err);
        this.uploadError = this.resolveUploadMessage(err?.error, 'Gagal mengunggah file musik.');
        this.notyf.error(this.uploadError);
        this.isUploadingMusic = false;
      },
    });
  }

  deleteCustomMusic(): void {
    if (this.isUploadingMusic || !this.getCustomMusicUrl()) return;

    this.isUploadingMusic = true;
    this.dashboardSvc.deleteCustomMusic().subscribe({
      next: (res: any) => {
        this.stopPreview();
        this.notyf.success(res?.message || 'Musik pribadi berhasil dihapus');
        this.isUploadingMusic = false;
        this.loadMusicData();
      },
      error: (err: any) => {
        this.logHttpError('Gagal menghapus musik pribadi', err);
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
    const audioUrl = defaultMusic?.audio_url || (this.getActiveSourceType() === 'default' ? this.musicSelection?.resolved_music_url : '') || '';
    if (!audioUrl) {
      this.notyf.error('Musik default belum tersedia');
      return;
    }

    this.playAudio(audioUrl, 'default');
  }

  playCustomPreview(): void {
    const audioUrl =
      this.getCustomMusicUrl() ||
      (this.getActiveSourceType() === 'custom' ? this.musicSelection?.resolved_music_url || '' : '');
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
    if (this.musicSelection?.can_upload_custom_music !== undefined) {
      return this.musicSelection.can_upload_custom_music === true;
    }

    const tier = resolvePackageTier(this.userData?.package_info ?? null);
    return tier === 'diamond';
  }

  getCurrentMusicLabel(): string {
    const activeMusic = this.musicSelection?.active_music as any;
    const activeTitle = this.firstString([
      activeMusic?.title,
      activeMusic?.name,
      activeMusic?.file_name,
      activeMusic?.original_name,
    ]);
    if (activeTitle) return activeTitle;
    if (this.getActiveSourceType() === 'custom') return this.getCustomMusicName();
    const selectedCatalogMusic = this.getSelectedCatalogMusic();
    if (selectedCatalogMusic?.title) return selectedCatalogMusic.title;
    if (this.musicSelection?.selected_music?.title) return this.musicSelection.selected_music.title;
    if (this.musicSelection?.default_music?.title) return this.musicSelection.default_music.title;
    return this.musicSelection?.resolved_music_url ? 'Musik aktif tersedia' : 'Musik default';
  }

  getCustomMusicName(): string {
    const customMusic = this.musicSelection?.custom_music;
    const explicitName = this.firstString([
      customMusic?.original_name,
      customMusic?.file_name,
      customMusic?.name,
    ]);
    if (explicitName) return explicitName;
    const url = this.getCustomMusicUrl();
    return this.extractFileNameFromUrl(url) || 'musik-pribadi.mp3';
  }

  isCustomMusicActive(): boolean {
    if (this.getActiveSourceType() === 'custom') return true;
    if (this.musicSelection?.custom_music?.is_active === true) return true;

    const customUrl = this.getCustomMusicUrl();
    const resolvedUrl = this.musicSelection?.resolved_music_url;
    return Boolean(customUrl && resolvedUrl && customUrl === resolvedUrl);
  }

  getActiveSourceType(): MusicSourceType {
    const rawSource = this.firstString([
      this.musicSelection?.music_source_type,
      (this.musicSelection?.active_music as any)?.source_type,
      (this.musicSelection?.active_music as any)?.music_source_type,
      (this.musicSelection as any)?.active_source_type,
      (this.musicSelection as any)?.source_type,
    ]);
    return this.normalizeSourceType(rawSource);
  }

  getPendingSourceType(): MusicSourceType {
    if (this.selectedMusicId === null) return 'default';
    return this.selectedMusicSourceHint;
  }

  getSourceTypeLabel(sourceType: MusicSourceType): string {
    switch (sourceType) {
      case 'custom':
        return 'Custom';
      case 'catalog':
        return 'Katalog';
      case 'global_catalog':
        return 'Global';
      default:
        return 'Default';
    }
  }

  getTrackDurationLabel(music: MusicTrack): string | null {
    const explicitLabel = this.firstString([
      music.duration_label,
      typeof music.duration === 'string' ? music.duration : null,
    ]);
    if (explicitLabel) return explicitLabel;

    const durationInSeconds = Number(music.duration);
    if (!Number.isFinite(durationInSeconds) || durationInSeconds <= 0) return null;

    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = Math.floor(durationInSeconds % 60);
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  isMusicSaved(track: MusicTrack, sourceType: MusicSourceType): boolean {
    return this.musicSelection?.selected_music_id === track.id && this.getActiveSourceType() === sourceType;
  }

  getCustomMusicSizeLabel(): string | null {
    const customMusic = this.musicSelection?.custom_music;
    const sizeLabel = this.firstString([customMusic?.size_label]);
    if (sizeLabel) return sizeLabel;

    const rawSize = customMusic?.size ?? customMusic?.file_size;
    if (rawSize === null || rawSize === undefined || rawSize === '') return null;

    const size = Number(rawSize);
    if (!Number.isFinite(size) || size <= 0) return String(rawSize);
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${size} B`;
  }

  getCustomMusicUploadedAt(): string | null {
    return this.firstString([
      this.musicSelection?.custom_music?.uploaded_at,
      this.musicSelection?.custom_music?.created_at,
      this.musicSelection?.custom_music?.updated_at,
    ]);
  }

  getCustomMusicUrl(): string {
    const fallbackResolvedUrl = this.getActiveSourceType() === 'custom' ? this.musicSelection?.resolved_music_url : null;
    return this.firstString([
      this.musicSelection?.custom_music?.audio_url,
      this.musicSelection?.custom_music?.url,
      (this.musicSelection?.active_music as any)?.audio_url,
      (this.musicSelection?.active_music as any)?.url,
      this.musicSelection?.custom_music_url,
      fallbackResolvedUrl,
    ]) || '';
  }

  trackMusicById(_index: number, music: MusicTrack): number {
    return music.id;
  }

  getMusicMeta(music: MusicTrack): string | null {
    return this.firstString([music.artist, music.description]);
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
    const rawOptions = this.findMusicArray(response);

    return rawOptions
      .map((item: any) => this.normalizeMusicItem(item))
      .filter((item: MusicTrack | null): item is MusicTrack => item !== null)
      .sort((a: MusicTrack, b: MusicTrack) => {
        const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
  }

  private extractCatalogSections(optionsResponse: any, selectionResponse: any): {
    userUploads: MusicTrack[];
    adminCatalog: MusicTrack[];
    globalCatalog: MusicTrack[];
    hasCatalogSections: boolean;
  } {
    const sectionRoots = [
      ...this.findCatalogSectionRoots(optionsResponse),
      ...this.findCatalogSectionRoots(selectionResponse),
    ];

    const userUploads = this.mergeMusicOptions(
      ...sectionRoots.map((section) => this.normalizeMusicOptions(section?.user_uploads))
    );
    const adminCatalog = this.mergeMusicOptions(
      ...sectionRoots.map((section) => this.normalizeMusicOptions(section?.admin_catalog))
    );
    const globalCatalog = this.mergeMusicOptions(
      ...sectionRoots.map((section) => this.normalizeMusicOptions(section?.global_catalog))
    );

    return {
      userUploads,
      adminCatalog,
      globalCatalog,
      hasCatalogSections: sectionRoots.length > 0,
    };
  }

  private findCatalogSectionRoots(response: any): any[] {
    const candidates = [
      response?.catalog_sections,
      response?.data?.catalog_sections,
      response?.setting?.catalog_sections,
      response?.data?.setting?.catalog_sections,
      response?.music_selection?.catalog_sections,
      response?.selection?.catalog_sections,
      response?.user_music_selection?.catalog_sections,
      response?.data?.music_selection?.catalog_sections,
      response?.data?.selection?.catalog_sections,
      response?.data?.user_music_selection?.catalog_sections,
    ];

    return candidates.filter((candidate) => candidate && typeof candidate === 'object');
  }

  private findMusicArray(source: any): any[] {
    if (Array.isArray(source)) return source;
    if (!source || typeof source !== 'object') return [];

    const keys = [
      'music_options',
      'catalog',
      'catalogs',
      'catalog_music',
      'catalog_music_tracks',
      'musics',
      'music',
      'music_tracks',
      'tracks',
      'invitation_music',
      'invitation_musics',
      'data',
      'items',
      'records',
      'results',
      'list',
      'options',
      'settings',
      'setting',
    ];

    for (const key of keys) {
      const found = this.findMusicArray(source[key]);
      if (found.length) return found;
    }

    return [];
  }

  private normalizeMusicSelection(response: any): UserMusicSelection {
    const source =
      response?.music_selection ||
      response?.selection ||
      response?.user_music_selection ||
      response?.data?.music_selection ||
      response?.data?.selection ||
      response?.data?.user_music_selection ||
      response?.data ||
      response?.setting ||
      {};
    const setting = response?.setting || response?.data?.setting || {};
    const selectedMusic = this.normalizeMusicItem(source?.selected_music ?? source?.selected_catalog_music ?? source?.catalog_music);
    const defaultMusic = this.normalizeMusicItem(source?.default_music);
    const customMusic = this.normalizeCustomMusic(source?.custom_music ?? source?.custom ?? setting?.custom_music);
    const activeMusic = source?.active_music ?? source?.active_music_summary ?? source?.current_music ?? null;

    return {
      selected_music_id: this.toNullableNumber(source?.selected_music_id ?? source?.selected_catalog_music_id ?? source?.music_id ?? setting?.selected_music_id),
      selected_music: selectedMusic,
      default_music: defaultMusic,
      custom_music: customMusic,
      active_music: activeMusic,
      music_source_type: this.firstString([
        source?.music_source_type,
        source?.source_type,
        source?.active_source_type,
        activeMusic?.source_type,
        activeMusic?.music_source_type,
      ]),
      custom_music_url: this.firstString([
        source?.custom_music_url,
        source?.custom_music_url_public,
        customMusic?.audio_url,
        customMusic?.url,
        setting?.custom_music_url,
      ]),
      resolved_music_url: this.firstString([
        source?.resolved_music_url,
        source?.active_music_url,
        activeMusic?.audio_url,
        activeMusic?.url,
        setting?.resolved_music_url,
        source?.music_stream_url,
        setting?.music_stream_url,
        setting?.musik,
      ]),
      can_upload_custom_music: this.toOptionalBoolean(
        source?.can_upload_custom_music ??
        source?.permissions?.can_upload_custom_music ??
        source?.access?.can_upload_custom_music ??
        source?.can_upload_custom ??
        source?.can_upload ??
        response?.data?.selection?.can_upload_custom_music ??
        response?.data?.user_music_selection?.can_upload_custom_music ??
        response?.data?.permissions?.can_upload_custom_music ??
        response?.data?.access?.can_upload_custom_music ??
        response?.data?.can_upload_custom_music ??
        response?.can_upload_custom_music
      ),
    };
  }

  private normalizeMusicItem(item: any): MusicTrack | null {
    if (!item || typeof item !== 'object') return null;

    const id = Number(item.id ?? item.music_id);
    if (!Number.isFinite(id)) return null;

    return {
      id,
      title: String(this.firstString([item.title, item.name, item.judul]) || `Musik ${id}`),
      artist: item.artist ?? item.penyanyi ?? null,
      description: this.firstString([item.description, item.deskripsi, item.caption, item.keterangan]),
      duration: item.duration ?? item.length ?? item.duration_seconds ?? item.seconds ?? null,
      duration_label: this.firstString([item.duration_label, item.duration_text, item.formatted_duration, item.duration_human]),
      source_type: this.firstString([item.source_type, item.music_source_type, item.section_type, item.catalog_type]),
      audio_url: this.firstString([item.audio_url, item.url, item.music_url, item.musik_url, item.file_url, item.path]),
      thumbnail_url: this.firstString([item.thumbnail_url, item.cover_url, item.image_url, item.thumbnail, item.cover]),
      is_active: this.toBoolean(item.is_active),
      is_default: this.toBoolean(item.is_default),
      sort_order: this.toNullableNumber(item.sort_order ?? item.order),
    };
  }

  private normalizeCustomMusic(item: any): CustomMusicInfo | null {
    if (!item || typeof item !== 'object') return null;

    return {
      id: this.toNullableNumber(item.id ?? item.custom_music_id),
      file_name: this.firstString([item.file_name, item.filename, item.name]),
      original_name: this.firstString([item.original_name, item.original_filename, item.client_name]),
      name: this.firstString([item.name, item.title]),
      size: item.size ?? item.file_size ?? null,
      file_size: item.file_size ?? item.size ?? null,
      size_label: this.firstString([item.size_label, item.file_size_label, item.human_size]),
      url: this.firstString([item.url, item.music_url, item.file_url, item.path]),
      audio_url: this.firstString([item.audio_url, item.url, item.music_url, item.file_url, item.path]),
      uploaded_at: this.firstString([item.uploaded_at, item.created_at]),
      created_at: this.firstString([item.created_at]),
      updated_at: this.firstString([item.updated_at]),
      is_active: this.toBoolean(item.is_active ?? item.active),
    };
  }

  private mergeMusicOptions(...collections: MusicTrack[][]): MusicTrack[] {
    const merged = new Map<number, MusicTrack>();

    for (const collection of collections) {
      for (const track of collection) {
        const existing = merged.get(track.id);
        if (!existing) {
          merged.set(track.id, track);
          continue;
        }

        merged.set(track.id, {
          ...existing,
          ...track,
          title: track.title || existing.title,
          artist: track.artist ?? existing.artist,
          description: track.description ?? existing.description,
          audio_url: track.audio_url ?? existing.audio_url,
          thumbnail_url: track.thumbnail_url ?? existing.thumbnail_url,
          is_active: track.is_active ?? existing.is_active,
          is_default: track.is_default ?? existing.is_default,
          sort_order: track.sort_order ?? existing.sort_order,
        });
      }
    }

    return Array.from(merged.values()).sort((a, b) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
  }

  private getSelectedCatalogMusic(): MusicTrack | null {
    if (this.selectedMusicId === null) return null;
    return this.musicOptions.find((music) => music.id === this.selectedMusicId) || null;
  }

  private resolveSourceTypeByTrackId(musicId: number | null): MusicSourceType {
    if (musicId === null) return 'default';

    const inGlobalCatalog = this.globalCatalogTracks.some((music) => music.id === musicId);
    const inAdminCatalog = this.adminCatalogTracks.some((music) => music.id === musicId);
    const activeSourceType = this.getActiveSourceType();

    if (inGlobalCatalog && inAdminCatalog) {
      if (activeSourceType === 'global_catalog' || activeSourceType === 'catalog') return activeSourceType;
      return this.selectedMusicSourceHint === 'global_catalog' ? 'global_catalog' : 'catalog';
    }

    if (inGlobalCatalog) {
      return 'global_catalog';
    }

    if (inAdminCatalog) {
      return 'catalog';
    }

    if (activeSourceType === 'global_catalog') return 'global_catalog';
    if (activeSourceType === 'catalog') return 'catalog';
    return 'catalog';
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

  private toOptionalBoolean(value: unknown): boolean | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    return this.toBoolean(value) === true;
  }

  private resolveUploadMessage(response: any, fallback: string): string {
    return this.firstString([
      response?.errors?.musik?.[0],
      response?.message,
    ]) || fallback;
  }

  private getMusicFileExtension(file: File): string {
    const fileName = String(file?.name || '').trim();
    return fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : '';
  }

  private normalizeSourceType(value: string | null): MusicSourceType {
    const normalized = String(value || '').toLowerCase().trim();
    if (normalized === 'custom' || normalized === 'custom_music' || normalized === 'personal') return 'custom';
    if (normalized === 'global_catalog' || normalized === 'global' || normalized === 'global_music') return 'global_catalog';
    if (normalized === 'catalog' || normalized === 'catalog_music' || normalized === 'admin' || normalized === 'music') return 'catalog';
    return 'default';
  }

  private resetUploadInput(): void {
    this.selectedMusicFile = null;
    this.selectedMusicFileName = '';
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

  private logHttpError(context: string, error: any): void {
    console.error('[MusikUndangan]', context, {
      status: error?.status,
      url: error?.url,
      error: error?.error,
    });
  }
}
