import { AfterViewInit, Directive, ElementRef, Input, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appRevealStagger]',
})
export class RevealStaggerDirective implements AfterViewInit {
  @Input('appRevealStagger') childSelector = ':scope > *';
  @Input() appRevealStaggerStep = 64;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2
  ) {}

  ngAfterViewInit(): void {
    this.renderer.addClass(this.el.nativeElement, 'ia-stagger-group');

    const children = Array.from(
      this.el.nativeElement.querySelectorAll<HTMLElement>(this.childSelector || ':scope > *')
    );

    children.forEach((child, index) => {
      this.renderer.addClass(child, 'ia-stagger-item');
      this.renderer.setStyle(child, '--ia-stagger-delay', `${80 + index * this.appRevealStaggerStep}ms`);
    });
  }
}
