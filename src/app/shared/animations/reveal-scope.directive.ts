import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Renderer2,
  RendererStyleFlags2,
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
  private lastScrollTop = 0;

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
    this.renderer.addClass(root, 'ia-motion-ready');
    this.renderer.addClass(root, `ia-package-${profile.package}`);
    this.renderer.addClass(root, profile.themeClass);
    this.renderer.setAttribute(root, 'data-ia-package', profile.package);
    this.renderer.setAttribute(root, 'data-ia-theme', profile.theme);
    this.renderer.setAttribute(root, 'data-ia-opening', profile.opening);

    if (!this.appRevealScopeActive) {
      return;
    }

    this.observer?.disconnect();

    const sections = Array.from(root.querySelectorAll<HTMLElement>('main section, .ruby-main > section, .ruby-two-main > section, .sapphire-content > section, .diamond-garden-main > section'));
    sections.forEach((section, index) => {
      const variant = this.animationService.getRevealVariant(profile.theme, index);
      this.renderer.addClass(section, 'ia-reveal');
      this.renderer.addClass(section, `ia-reveal--${variant}`);
      this.renderer.setStyle(
        section,
        '--ia-delay',
        `${profile.package === 'ruby' ? 0 : Math.min(index * 45, 220)}ms`,
        RendererStyleFlags2.DashCase
      );
      this.renderer.setStyle(section, '--ia-section-index', `${index}`, RendererStyleFlags2.DashCase);
      this.prepareStaggerChildren(section, profile);
    });

    if (this.animationService.isReducedMotion() || !('IntersectionObserver' in window)) {
      sections.forEach((section) => this.reveal(section));
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const section = entry.target as HTMLElement;
        const rootElement = root;
        const scrollRoot = this.animationService.getScrollRoot(rootElement);
        const scrollTop = scrollRoot ? scrollRoot.scrollTop : window.scrollY || document.documentElement.scrollTop || 0;
        const direction = scrollTop >= this.lastScrollTop ? 'down' : 'up';
        this.lastScrollTop = scrollTop;
        this.renderer.setAttribute(rootElement, 'data-ia-scroll-direction', direction);
        this.renderer.setAttribute(section, 'data-ia-scroll-direction', direction);

        if (entry.isIntersecting) {
          this.reveal(section);
          return;
        }

        const rootHeight = entry.rootBounds?.height || window.innerHeight || 0;
        if (entry.boundingClientRect.bottom < -160 || entry.boundingClientRect.top > rootHeight + 160) {
          this.reset(section);
        }
      });
    }, {
      root: this.animationService.getScrollRoot(root),
      rootMargin: this.animationService.getRevealRootMargin(profile.theme),
      threshold: this.animationService.getRevealThreshold(profile.theme),
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

  private prepareStaggerChildren(section: HTMLElement, profile: ReturnType<InvitationAnimationService['getProfile']>): void {
    const children = Array.from(section.querySelectorAll<HTMLElement>(profile.staggerSelector)).slice(0, 36);
    children.forEach((child, index) => {
      this.renderer.addClass(child, 'ia-stagger-item');
      const delay = profile.package === 'ruby'
        ? Math.min(80 + index * 120, 760)
        : Math.min(90 + index * 130, 820);
      const duration = this.getChildDuration(child, index);

      this.renderer.setStyle(child, '--ia-stagger-delay', `${delay}ms`, RendererStyleFlags2.DashCase);
      this.renderer.setStyle(child, '--ia-stagger-duration', `${duration}ms`, RendererStyleFlags2.DashCase);
    });
  }

  private getChildDuration(child: HTMLElement, index: number): number {
    const selector = child.className || child.tagName.toLowerCase();

    if (/caption|eyebrow|kicker|label/i.test(selector)) return 780 + (index % 2) * 80;
    if (/title|names|script|h1|h2|h3/i.test(selector)) return 940 + (index % 2) * 120;
    if (/photo|gallery|card|map|countdown|form|bank|gift|frame|floral|flower|leaf/i.test(selector)) return 1040 + (index % 2) * 140;
    if (/p|blockquote|small|strong/i.test(selector)) return 860 + (index % 2) * 90;

    return 900 + (index % 3) * 80;
  }

  private reveal(section: HTMLElement): void {
    this.renderer.addClass(section, 'ia-reveal--visible');
  }

  private reset(section: HTMLElement): void {
    this.renderer.removeClass(section, 'ia-reveal--visible');
  }
}
