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
  private previewAudio: HTMLAudioElement | null = null;
  private subscriptions = new Subscription();

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const sub = this.route.paramMap.subscribe((params) => {
      const rawSlug = params.get('slug') || DEFAULT_THEME_SLUG;
      this.slug = resolveThemeSlug(rawSlug) || DEFAULT_THEME_SLUG;
      this.activeThemeRenderKey = resolveThemeRenderKey(this.slug);
      this.previewData = getThemePreviewDummyData(this.slug);
      this.invitationOpened = false;
      document.body.classList.remove('theme-preview-invitation-opened');
      this.preparePreviewMusic();
    });
    this.subscriptions.add(sub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.destroyPreviewMusic();
    document.body.classList.remove('theme-preview-invitation-opened');
  }

  openInvitation(): void {
    this.invitationOpened = true;
    this.playPreviewMusic();
    this.startAnimations();
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

    this.previewAudio.play().catch(() => {
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

  private startAnimations(): void {
    requestAnimationFrame(() => {
      document.body.classList.add('theme-preview-invitation-opened');
    });
  }
}
