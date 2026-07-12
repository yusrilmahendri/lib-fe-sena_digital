import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import { InvitationAnimationService } from './invitation-animation.service';

@Directive({
  selector: '[appRevealScope]',
})
export class RevealScopeDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input('appRevealScope') theme = 'soft-ivory';
  @Input() appRevealScopeActive = true;

  private observer?: IntersectionObserver;
  private mutationObserver?: MutationObserver;
  private refreshTimer: number | null = null;
  private initialized = false;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private animationService: InvitationAnimationService
  ) {}

  ngAfterViewInit(): void {
    this.initialized = true;
    this.applyScope();
    this.watchForLateSections();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.initialized && (changes['theme'] || changes['appRevealScopeActive'])) {
      this.applyScope();
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.refreshTimer !== null) {
      window.clearTimeout(this.refreshTimer);
    }
  }

  private applyScope(): void {
    const root = this.el.nativeElement;
    const profile = this.animationService.getProfile(this.theme);

    this.renderer.addClass(root, 'ia-scope');
    this.renderer.addClass(root, `ia-package-${profile.package}`);
    this.renderer.addClass(root, profile.themeClass);
    this.renderer.setAttribute(root, 'data-ia-package', profile.package);
    this.renderer.setAttribute(root, 'data-ia-theme', profile.theme);
    this.renderer.setAttribute(root, 'data-ia-opening', profile.opening);

    if (!this.appRevealScopeActive) {
      return;
    }

    this.observer?.disconnect();

    const sections = Array.from(root.querySelectorAll<HTMLElement>('main section, .ruby-main > section, .ruby-two-main > section, .diamond-garden-main > section'));
    sections.forEach((section, index) => {
      if (section.classList.contains('ia-reveal')) {
        return;
      }

      const variant = this.animationService.getRevealVariant(profile.theme, index);
      this.renderer.addClass(section, 'ia-reveal');
      this.renderer.addClass(section, `ia-reveal--${variant}`);
      this.renderer.setStyle(section, '--ia-delay', `${Math.min(index * 45, 220)}ms`);
      this.prepareStaggerChildren(section, profile.staggerSelector);
    });

    if (this.animationService.isReducedMotion() || !('IntersectionObserver' in window)) {
      sections.forEach((section) => this.reveal(section));
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.reveal(entry.target as HTMLElement);
          this.observer?.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: this.animationService.getRootMargin(),
      threshold: 0.12,
    });

    sections.forEach((section) => this.observer?.observe(section));
  }

  private watchForLateSections(): void {
    if (!('MutationObserver' in window)) {
      return;
    }

    this.mutationObserver?.disconnect();
    this.mutationObserver = new MutationObserver(() => {
      if (this.refreshTimer !== null) {
        return;
      }

      this.refreshTimer = window.setTimeout(() => {
        this.refreshTimer = null;
        this.applyScope();
      }, 80);
    });

    this.mutationObserver.observe(this.el.nativeElement, {
      childList: true,
      subtree: true,
    });
  }

  private prepareStaggerChildren(section: HTMLElement, selector: string): void {
    const children = Array.from(section.querySelectorAll<HTMLElement>(selector)).slice(0, 18);
    children.forEach((child, index) => {
      this.renderer.addClass(child, 'ia-stagger-item');
      this.renderer.setStyle(child, '--ia-stagger-delay', `${80 + index * 58}ms`);
    });
  }

  private reveal(section: HTMLElement): void {
    this.renderer.addClass(section, 'ia-reveal--visible');
  }
}
