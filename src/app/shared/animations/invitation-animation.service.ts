import { Injectable } from '@angular/core';

export type InvitationAnimationPackage = 'ruby' | 'sapphire' | 'diamond';
export type InvitationRevealVariant =
  | 'fade-up'
  | 'fade-left'
  | 'fade-right'
  | 'zoom-soft'
  | 'clip-reveal'
  | 'blur-reveal'
  | 'cinematic'
  | 'depth';

export interface InvitationAnimationProfile {
  package: InvitationAnimationPackage;
  theme: string;
  themeClass: string;
  opening: string;
  sectionPattern: InvitationRevealVariant[];
  staggerSelector: string;
}

@Injectable({
  providedIn: 'root',
})
export class InvitationAnimationService {
  private readonly profiles: Record<string, InvitationAnimationProfile> = {
    'soft-ivory': {
      package: 'ruby',
      theme: 'soft-ivory',
      themeClass: 'ia-theme-soft-ivory',
      opening: 'ruby-card',
      sectionPattern: ['fade-up', 'zoom-soft', 'fade-left', 'clip-reveal'],
      staggerSelector: 'h1, h2, h3, p, blockquote, .gallery-card, img, article, button, a',
    },
    'lavender-bloom': {
      package: 'ruby',
      theme: 'lavender-bloom',
      themeClass: 'ia-theme-lavender-bloom',
      opening: 'ruby-floral',
      sectionPattern: ['fade-up', 'fade-right', 'zoom-soft', 'clip-reveal'],
      staggerSelector: 'h1, h2, h3, p, blockquote, .gallery-card, img, article, button, a',
    },
    'garden-whisper': {
      package: 'sapphire',
      theme: 'garden-whisper',
      themeClass: 'ia-theme-garden-whisper',
      opening: 'sapphire-glass',
      sectionPattern: ['blur-reveal', 'clip-reveal', 'fade-left', 'zoom-soft'],
      staggerSelector: 'h1, h2, h3, p, .gallery-card, img, article, button, a',
    },
    'champagne-rose': {
      package: 'diamond',
      theme: 'champagne-rose',
      themeClass: 'ia-theme-champagne-rose',
      opening: 'diamond-curtain',
      sectionPattern: ['cinematic', 'clip-reveal', 'depth', 'blur-reveal'],
      staggerSelector: 'h1, h2, h3, p, .gallery-card, img, article, button, a, .diamond-countdown__box',
    },
    'diamond-garden': {
      package: 'diamond',
      theme: 'diamond-garden',
      themeClass: 'ia-theme-diamond-garden',
      opening: 'diamond-garden',
      sectionPattern: ['cinematic', 'depth', 'clip-reveal', 'fade-up'],
      staggerSelector: 'h1, h2, h3, p, .gallery-card, img, article, button, a, .diamond-garden-person',
    },
  };

  getProfile(theme: string | null | undefined): InvitationAnimationProfile {
    const key = String(theme || '').trim();
    return this.profiles[key] || this.profiles['soft-ivory'];
  }

  getRevealVariant(theme: string | null | undefined, index: number): InvitationRevealVariant {
    const profile = this.getProfile(theme);
    return profile.sectionPattern[index % profile.sectionPattern.length];
  }

  isReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  getRootMargin(): string {
    return '0px 0px -12% 0px';
  }
}
