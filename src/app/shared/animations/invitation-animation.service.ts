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
  revealRootMargin?: string;
  revealThreshold?: number;
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
      sectionPattern: ['fade-up', 'zoom-soft', 'fade-right', 'fade-up', 'zoom-soft', 'fade-up'],
      staggerSelector: 'h1, h2, h3, p, blockquote, button, a, .ruby-quote-line, .ruby-couple-line, .ruby-gallery-line, .ruby-wish-line, .ruby-gift-line, .ruby-couple-card, .ruby-event-card, .ruby-map-card, .ruby-countdown, .ruby-countdown-box, .gallery-card, .ruby-gallery-feature, .ruby-gallery-thumb, .ruby-wish-form, .ruby-wish-card, .ruby-bank-card, .ruby-footer-content',
      revealRootMargin: '0px 0px -8% 0px',
      revealThreshold: 0.16,
    },
    'lavender-bloom': {
      package: 'ruby',
      theme: 'lavender-bloom',
      themeClass: 'ia-theme-lavender-bloom',
      opening: 'ruby-floral',
      sectionPattern: ['fade-up', 'fade-right', 'zoom-soft', 'clip-reveal', 'fade-left'],
      staggerSelector: 'h1, h2, h3, p, blockquote, button, a, small, time, label, input, textarea, .gallery-card, img, article, .ruby-two-section__eyebrow, .ruby-two-title, .ruby-two-script, .ruby-two-person-card__frame, .ruby-two-event-card__label, .ruby-two-map-preview, .ruby-two-countdown__card, .ruby-two-gallery-featured, .ruby-two-gallery-item, .ruby-two-gallery-featured__play, .ruby-two-form, .ruby-two-input, .ruby-two-textarea, .ruby-two-chip, .ruby-two-wish-card, .ruby-two-bank-card, .ruby-two-bank-icon',
      revealRootMargin: '0px 0px -8% 0px',
      revealThreshold: 0.16,
    },
    'garden-whisper': {
      package: 'sapphire',
      theme: 'garden-whisper',
      themeClass: 'ia-theme-garden-whisper',
      opening: 'sapphire-glass',
      sectionPattern: ['blur-reveal', 'clip-reveal', 'fade-left', 'zoom-soft', 'fade-right'],
      staggerSelector: 'h1, h2, h3, p, small, time, label, input, textarea, .gallery-card, img, article, button, a, .sapphire-kicker, .sapphire-title, .sapphire-gallery-divider, .sapphire-gallery-date, .sapphire-couple-photo-wrap, .sapphire-couple-name, .sapphire-couple-parent, .sapphire-countdown__box, .sapphire-event-block__title, .sapphire-event-date-row, .sapphire-event-time, .sapphire-event-venue, .sapphire-event-address, .sapphire-map-preview, .sapphire-wish-form, .sapphire-wish-input, .sapphire-wish-textarea, .sapphire-wish-chip, .sapphire-wish-item, .sapphire-gift-card, .sapphire-btn, .sapphire-gallery-play',
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

  getRevealRootMargin(theme?: string | null): string {
    return this.getProfile(theme).revealRootMargin || this.getRootMargin();
  }

  getRevealThreshold(theme?: string | null): number {
    return this.getProfile(theme).revealThreshold ?? 0.16;
  }

  getScrollRoot(element: HTMLElement): HTMLElement | null {
    if (typeof window === 'undefined') {
      return null;
    }

    let parent = element.parentElement;

    while (parent && parent !== document.body && parent !== document.documentElement) {
      const style = window.getComputedStyle(parent);
      const overflowY = style.overflowY;
      const overflow = style.overflow;
      const canScroll = /(auto|scroll|overlay)/.test(`${overflowY} ${overflow}`);

      if (canScroll && parent.scrollHeight > parent.clientHeight + 1) {
        return parent;
      }

      parent = parent.parentElement;
    }

    return null;
  }
}
