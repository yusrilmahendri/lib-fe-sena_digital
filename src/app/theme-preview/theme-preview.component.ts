import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { WeddingData } from '../services/wedding-data.service';
import { getThemePreviewDummyData } from '../shared/data/theme-preview-dummy.data';
import { PREVIEW_WEDDING_MUSIC } from '../shared/preview-wedding-music.config';
import {
  DEFAULT_THEME_SLUG,
  resolveThemeRenderKey,
  resolveThemeSlug,
  ThemeRenderKey,
  ThemeSlug,
} from '../theme-render.registry';

@Component({
  selector: 'wc-theme-preview',
  templateUrl: './theme-preview.component.html',
  styleUrls: ['./theme-preview.component.scss']
})
export class ThemePreviewComponent implements OnInit, OnDestroy {
  slug: ThemeSlug = DEFAULT_THEME_SLUG;
  activeThemeRenderKey: ThemeRenderKey = 'ruby-theme-one';
  previewData: WeddingData = getThemePreviewDummyData(DEFAULT_THEME_SLUG);
  isPreviewMode = true;
  isInvitationOpened = false;
  isMusicPlaying = false;
  isMusicPlayBlocked = false;
  previewMusicUrl = PREVIEW_WEDDING_MUSIC.url;
  isLoadingPreview = true;
  previewError = '';
  private previewAudio: HTMLAudioElement | null = null;
  private subscriptions = new Subscription();

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      this.isLoadingPreview = true;
      this.previewError = '';

      const rawSlug = params.get('slug') || DEFAULT_THEME_SLUG;
      const resolvedSlug = resolveThemeSlug(rawSlug);
      const previewMode = this.route.snapshot.queryParamMap.get('preview') === 'true'
        || this.route.snapshot.data['preview'] === true;
      console.log('[Preview Theme] slug:', rawSlug);
      console.log('[Preview Theme] preview mode:', previewMode);

      if (!resolvedSlug) {
        this.slug = DEFAULT_THEME_SLUG;
        this.activeThemeRenderKey = resolveThemeRenderKey(DEFAULT_THEME_SLUG);
        this.previewData = getThemePreviewDummyData(DEFAULT_THEME_SLUG);
        this.isInvitationOpened = false;
        this.previewError = `Tema "${rawSlug}" tidak ditemukan.`;
        this.isLoadingPreview = false;
        console.warn('[Preview Theme] unmapped slug:', rawSlug);
        return;
      }

      this.slug = resolvedSlug;
      this.activeThemeRenderKey = resolveThemeRenderKey(this.slug);
      this.previewData = getThemePreviewDummyData(this.slug);
      this.isInvitationOpened = false;
      this.isMusicPlayBlocked = false;
      document.body.classList.remove('theme-preview-invitation-opened');
      console.log('[Preview Theme] mapped component:', this.getResolvedComponentName(this.activeThemeRenderKey));
      if (this.slug === 'garden-whisper') {
        console.log('[Garden Whisper] preview data:', this.previewData);
        console.log('[Garden Whisper] mempelai:', this.previewData?.mempelai);
        console.log('[Garden Whisper] events:', this.previewData?.events);
        console.log('[Garden Whisper] gallery:', this.previewData?.gallery);
      }
      if (this.slug === 'lavender-bloom') {
        console.log('[Lavender Bloom] invitation data:', this.previewData);
      }
      this.preparePreviewMusic();
      this.isLoadingPreview = false;
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.destroyPreviewMusic();
    document.body.classList.remove('theme-preview-invitation-opened');
  }

  openInvitation(): void {
    console.log('[Preview Parent] open event received', {
      slug: this.slug,
      mappedTheme: this.activeThemeRenderKey,
      currentInvitationOpened: this.isInvitationOpened,
      musicUrl: this.previewMusicUrl,
      musicTitle: PREVIEW_WEDDING_MUSIC.title,
    });
    this.isInvitationOpened = true;
    this.playPreviewMusic();
  }

  togglePreviewMusic(): void {
    if (this.isMusicPlaying) {
      this.pausePreviewMusic();
      return;
    }

    this.playPreviewMusic();
  }

  private preparePreviewMusic(): void {
    this.destroyPreviewMusic();

    this.previewAudio = new Audio();
    this.previewAudio.loop = true;
    this.previewAudio.preload = 'auto';
    this.previewAudio.volume = 0.6;
    this.previewAudio.muted = false;
    this.previewAudio.onplay = () => {
      this.isMusicPlaying = true;
      this.isMusicPlayBlocked = false;
    };
    this.previewAudio.onpause = () => {
      this.isMusicPlaying = false;
    };
    this.previewAudio.onerror = () => {
      this.isMusicPlaying = false;
      this.isMusicPlayBlocked = true;
      console.error('[Preview Music] gagal memuat audio demo preview', {
        title: PREVIEW_WEDDING_MUSIC.title,
        src: this.previewAudio?.currentSrc || this.previewAudio?.src,
        error: this.previewAudio?.error,
      });
    };
  }

  private playPreviewMusic(): void {
    if (!this.previewAudio) {
      this.preparePreviewMusic();
    }

    if (!this.previewAudio) {
      return;
    }

    this.previewAudio.loop = true;
    this.previewAudio.volume = 0.6;
    this.previewAudio.muted = false;

    if (this.previewAudio.getAttribute('src') !== this.previewMusicUrl) {
      this.previewAudio.pause();
      this.previewAudio.currentTime = 0;
      this.previewAudio.src = this.previewMusicUrl;
      this.previewAudio.load();
    }

    this.previewAudio.play().then(() => {
      console.log('[Preview Music] play success');
    }).catch((error) => {
      this.isMusicPlaying = false;
      this.isMusicPlayBlocked = true;
      console.warn('[Preview Music] gagal diputar. Tampilkan tombol play manual.', {
        title: PREVIEW_WEDDING_MUSIC.title,
        src: this.previewMusicUrl,
        error,
      });
      // Browser audio policies can still block playback; the invitation stays usable.
    });
  }

  private pausePreviewMusic(): void {
    if (!this.previewAudio) {
      return;
    }

    this.previewAudio.pause();
    this.isMusicPlaying = false;
  }

  private destroyPreviewMusic(): void {
    if (!this.previewAudio) {
      return;
    }

    this.previewAudio.pause();
    this.previewAudio.currentTime = 0;
    this.previewAudio.onplay = null;
    this.previewAudio.onpause = null;
    this.previewAudio.onerror = null;
    this.previewAudio.src = '';
    this.previewAudio.load();
    this.previewAudio = null;
    this.isMusicPlaying = false;
    this.isMusicPlayBlocked = false;
  }

  private getResolvedComponentName(renderKey: ThemeRenderKey): string {
    const componentMap: Record<ThemeRenderKey, string> = {
      'ruby-theme-one': 'RubyThemeOneComponent',
      'ruby-theme-two': 'RubyThemeTwoComponent',
      'sapphire-theme-one': 'SapphireThemeOneComponent',
      'diamond-theme-one': 'DiamondThemeOneComponent',
      'diamond-theme-two': 'DiamondThemeTwoComponent',
      'lavender-bloom': 'LavenderBloomThemeComponent',
    };

    return componentMap[renderKey];
  }
}
