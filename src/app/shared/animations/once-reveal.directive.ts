import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  Renderer2,
} from '@angular/core';

export type OnceRevealVariant =
  | 'fade-up'
  | 'fade-left'
  | 'fade-right'
  | 'zoom'
  | 'card';

@Directive({
  selector: '[appOnceReveal]',
})
export class OnceRevealDirective implements AfterViewInit, OnDestroy {
  @Input('appOnceReveal') variant: OnceRevealVariant = 'fade-up';
  @Input() orDelay = 0;
  @Input() orDuration = 0;
  @Input() orStagger = 0;
  @Input() orThreshold = 0.12;

  private observer?: IntersectionObserver;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit(): void {
    const host = this.el.nativeElement;

    this.renderer.addClass(host, 'or');
    this.renderer.addClass(host, `or--${this.variant || 'fade-up'}`);

    if (this.orDelay > 0) {
      this.renderer.setStyle(host, '--or-delay', `${this.orDelay}ms`);
    }
    if (this.orDuration > 0) {
      this.renderer.setStyle(host, '--or-duration', `${this.orDuration}ms`);
    }
    if (this.orStagger > 0) {
      this.renderer.setStyle(host, '--or-stagger', `${this.orStagger}ms`);
    }

    if (!('IntersectionObserver' in window)) {
      this.reveal(host);
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              this.reveal(entry.target as HTMLElement);
              this.observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: this.orThreshold }
      );

      this.observer.observe(host);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private reveal(element: HTMLElement): void {
    this.renderer.addClass(element, 'or--visible');
  }
}
