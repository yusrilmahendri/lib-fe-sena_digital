import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  Renderer2,
  RendererStyleFlags2,
} from '@angular/core';
import {
  InvitationAnimationService,
  InvitationRevealVariant,
} from './invitation-animation.service';

@Directive({
  selector: '[appReveal]',
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  @Input('appReveal') variant: InvitationRevealVariant | '' = 'fade-up';
  @Input() appRevealDelay = 0;

  private observer?: IntersectionObserver;
  private lastScrollTop = 0;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private animationService: InvitationAnimationService
  ) {}

  ngAfterViewInit(): void {
    const element = this.el.nativeElement;
    const revealVariant = this.variant || 'fade-up';

    this.renderer.addClass(element, 'ia-reveal');
    this.renderer.addClass(element, 'ia-motion-ready');
    this.renderer.addClass(element, `ia-reveal--${revealVariant}`);
    this.renderer.setStyle(element, '--ia-delay', `${this.appRevealDelay}ms`, RendererStyleFlags2.DashCase);

    if (this.animationService.isReducedMotion() || !('IntersectionObserver' in window)) {
      this.reveal(element);
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const scrollRoot = this.animationService.getScrollRoot(element);
        const scrollTop = scrollRoot ? scrollRoot.scrollTop : window.scrollY || document.documentElement.scrollTop || 0;
        const direction = scrollTop >= this.lastScrollTop ? 'down' : 'up';
        this.lastScrollTop = scrollTop;
        this.renderer.setAttribute(element, 'data-ia-scroll-direction', direction);

        if (entry.isIntersecting) {
          this.reveal(element);
          return;
        }

        const rootHeight = entry.rootBounds?.height || window.innerHeight || 0;
        if (entry.boundingClientRect.bottom < -160 || entry.boundingClientRect.top > rootHeight + 160) {
          this.reset(element);
        }
      });
    }, {
      root: this.animationService.getScrollRoot(element),
      rootMargin: this.animationService.getRootMargin(),
      threshold: 0.16,
    });

    this.observer.observe(element);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private reveal(element: HTMLElement): void {
    this.renderer.addClass(element, 'ia-reveal--visible');
  }

  private reset(element: HTMLElement): void {
    this.renderer.removeClass(element, 'ia-reveal--visible');
  }
}
