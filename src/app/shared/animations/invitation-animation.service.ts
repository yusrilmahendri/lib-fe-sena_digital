import { Injectable } from '@angular/core';

export type InvitationAnimationPackage = 'ruby' | 'sapphire' | 'diamond';
export type InvitationRevealVariant =
  | 'fade-up'
  | 'fade-down'
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
      sectionPattern: ['fade-up', 'zoom-soft', 'fade-right', 'fade-up', 'blur-reveal', 'fade-left', 'zoom-soft'],
      staggerSelector: 'h1, h2, h3, p, blockquote, button, a, strong, small, iframe, .ruby-caption, .ruby-caption__eyebrow, .ruby-caption__title, .ruby-quote-line, .ruby-couple-line, .ruby-gallery-line, .ruby-wish-line, .ruby-gift-line, .ruby-cover__names, .ruby-cover__date, .ruby-cover__guest, .ruby-couple-card, .ruby-couple-photo, .ruby-event-card, .ruby-map-card, .ruby-map-preview, .ruby-countdown, .ruby-countdown-box, .gallery-card, .ruby-gallery-carousel, .ruby-gallery-slide, .ruby-video-card, .ruby-gallery-feature, .ruby-gallery-thumb, .ruby-wish-form, .ruby-wish-card, .ruby-bank-card, .ruby-footer-content, .ruby-cover-frame, .ruby-quote-frame, .ruby-location-frame, .ruby-wish-frame, .ruby-gift-frame, .ruby-footer-frame, .ruby-floral',
      revealRootMargin: '0px 0px -6% 0px',
      revealThreshold: 0.12,
    },
    'lavender-bloom': {
      package: 'ruby',
      theme: 'lavender-bloom',
      themeClass: 'ia-theme-lavender-bloom',
      opening: 'ruby-floral',
      sectionPattern: ['fade-up', 'blur-reveal', 'zoom-soft', 'fade-right', 'clip-reveal', 'fade-left'],
      staggerSelector: 'h1, h2, h3, p, blockquote, button, a, small, time, label, input, textarea, strong, iframe, .opening-divider, .divider-line, .divider-mark, .gallery-card, img, article, .ruby-two-section-heading, .ruby-two-section__eyebrow, .ruby-two-title, .ruby-two-script, .ruby-two-copy, .ruby-two-quote, .ruby-two-person-card, .ruby-two-person-card__frame, .ruby-two-separator, .ruby-two-event-card, .ruby-two-event-card__label, .ruby-two-map-preview, .ruby-two-countdown, .ruby-two-countdown__card, .ruby-two-journey-item, .ruby-two-gallery-featured, .ruby-two-gallery-grid, .ruby-two-gallery-item, .ruby-two-video-card, .ruby-two-video-card__play, .ruby-two-video-card__label, .ruby-two-gallery-featured__play, .ruby-two-form, .ruby-two-input, .ruby-two-textarea, .ruby-two-chip, .ruby-two-wish-card, .ruby-two-bank-card, .ruby-two-bank-icon, .ruby-two-footer',
      revealRootMargin: '0px 0px -6% 0px',
      revealThreshold: 0.12,
    },
    'garden-whisper': {
      package: 'sapphire',
      theme: 'garden-whisper',
      themeClass: 'ia-theme-garden-whisper',
      opening: 'sapphire-glass',
      sectionPattern: ['blur-reveal', 'fade-up', 'clip-reveal', 'fade-left', 'zoom-soft', 'fade-right'],
      staggerSelector: 'h1, h2, h3, p, small, time, label, input, textarea, strong, iframe, .gallery-card, img, article, button, a, .sapphire-section-head, .sapphire-kicker, .sapphire-title, .sapphire-divider, .sapphire-divider__line, .sapphire-divider__icon, .sapphire-gallery-divider, .sapphire-gallery-date, .sapphire-gallery-grid, .sapphire-gallery-item, .sapphire-couple-card, .sapphire-couple-photo-wrap, .sapphire-couple-name, .sapphire-couple-parent, .sapphire-countdown__content, .sapphire-countdown__box, .sapphire-event-block, .sapphire-event-block__title, .sapphire-event-date-row, .sapphire-event-time, .sapphire-event-venue, .sapphire-event-address, .sapphire-map-preview, .sapphire-wishes__content, .sapphire-wish-form, .sapphire-wish-input, .sapphire-wish-textarea, .sapphire-wish-chip, .sapphire-wish-item, .sapphire-gift-card, .sapphire-btn, .sapphire-gallery-play, .sapphire-footer',
      revealRootMargin: '0px 0px -6% 0px',
      revealThreshold: 0.12,
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
