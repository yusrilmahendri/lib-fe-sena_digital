import { AfterViewInit, Directive, ElementRef, Input, Renderer2 } from '@angular/core';
import { InvitationAnimationService } from './invitation-animation.service';

@Directive({
  selector: '[appFloatingDecoration]',
})
export class FloatingDecorationDirective implements AfterViewInit {
  @Input('appFloatingDecoration') tone: 'floral' | 'light' | 'glint' | '' = '';

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    private animationService: InvitationAnimationService
  ) {}

  ngAfterViewInit(): void {
    const element = this.el.nativeElement;
    this.renderer.addClass(element, 'ia-floating-decoration');

    if (this.tone) {
      this.renderer.addClass(element, `ia-floating-decoration--${this.tone}`);
    }

    if (this.animationService.isReducedMotion()) {
      this.renderer.addClass(element, 'ia-motion-reduced');
    }
  }
}
