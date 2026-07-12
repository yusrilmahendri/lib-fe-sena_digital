import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  Renderer2,
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

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private animationService: InvitationAnimationService
  ) {}

  ngAfterViewInit(): void {
    const element = this.el.nativeElement;
    const revealVariant = this.variant || 'fade-up';

    this.renderer.addClass(element, 'ia-reveal');
    this.renderer.addClass(element, `ia-reveal--${revealVariant}`);
    this.renderer.setStyle(element, '--ia-delay', `${this.appRevealDelay}ms`);

    if (this.animationService.isReducedMotion() || !('IntersectionObserver' in window)) {
      this.reveal(element);
      return;
    }

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          this.reveal(element);
          this.observer?.unobserve(element);
        }
      });
    }, {
      root: null,
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
}
