import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { WeddingData } from '../services/wedding-data.service';
import { getThemePreviewDummyData } from '../shared/data/theme-preview-dummy.data';
import { resolveInvitationMusicUrl } from '../shared/invitation-music.model';
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
  invitationOpened = false;
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
        this.invitationOpened = false;
        this.previewError = `Tema "${rawSlug}" tidak ditemukan.`;
        this.isLoadingPreview = false;
        console.warn('[Preview Theme] unmapped slug:', rawSlug);
        return;
      }

      this.slug = resolvedSlug;
      this.activeThemeRenderKey = resolveThemeRenderKey(this.slug);
      this.previewData = getThemePreviewDummyData(this.slug);
      this.invitationOpened = false;
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
      currentInvitationOpened: this.invitationOpened,
      musicUrl: resolveInvitationMusicUrl(this.previewData),
    });
    this.playPreviewMusic();
  }

  private preparePreviewMusic(): void {
    this.destroyPreviewMusic();

    const musicUrl = resolveInvitationMusicUrl(this.previewData);
    if (!musicUrl) {
      return;
    }

    this.previewAudio = new Audio(musicUrl);
    this.previewAudio.loop = true;
    this.previewAudio.preload = 'auto';
    this.previewAudio.volume = 0.72;
  }

  private playPreviewMusic(): void {
    if (!this.previewAudio) {
      this.preparePreviewMusic();
    }

    if (!this.previewAudio) {
      return;
    }

    this.previewAudio.play().then(() => {
      console.log('[Preview Music] play success');
    }).catch((error) => {
      console.warn('[Preview Music] gagal diputar', error);
      // Browser audio policies can still block playback; the invitation stays usable.
    });
  }

  private destroyPreviewMusic(): void {
    if (!this.previewAudio) {
      return;
    }

    this.previewAudio.pause();
    this.previewAudio.currentTime = 0;
    this.previewAudio.src = '';
    this.previewAudio.load();
    this.previewAudio = null;
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
