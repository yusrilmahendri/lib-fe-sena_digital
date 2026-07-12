import { AfterViewInit, Directive, ElementRef, Input, NgZone, OnDestroy, Renderer2 } from '@angular/core';
import { InvitationAnimationService } from './invitation-animation.service';

@Directive({
  selector: '[appParallax]',
})
export class ParallaxDirective implements AfterViewInit, OnDestroy {
  @Input('appParallax') strength = 10;

  private frameId: number | null = null;
  private listening = false;
  private readonly onScroll = () => this.requestTick();

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private zone: NgZone,
    private animationService: InvitationAnimationService
  ) {}

  ngAfterViewInit(): void {
    if (
      this.animationService.isReducedMotion() ||
      typeof window === 'undefined' ||
      window.innerWidth < 768
    ) {
      return;
    }

    this.renderer.addClass(this.el.nativeElement, 'ia-parallax');
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.listening = true;
      this.requestTick();
    });
  }

  ngOnDestroy(): void {
    if (this.listening) {
      window.removeEventListener('scroll', this.onScroll);
    }

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
  }

  private requestTick(): void {
    if (this.frameId !== null) {
      return;
    }

    this.frameId = requestAnimationFrame(() => {
      this.frameId = null;
      this.update();
    });
  }

  private update(): void {
    const rect = this.el.nativeElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;

    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return;
    }

    const progress = (rect.top - viewportHeight / 2) / viewportHeight;
    const offset = Math.max(-this.strength, Math.min(this.strength, progress * this.strength));
    this.renderer.setStyle(this.el.nativeElement, '--ia-parallax-y', `${offset}px`);
  }
}
