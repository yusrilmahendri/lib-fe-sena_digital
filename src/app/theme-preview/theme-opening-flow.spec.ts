import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { DashboardService } from '../dashboard.service';
import { RubyThemeOneComponent } from '../dashboard/wedding-view/templates/ruby-theme-one/ruby-theme-one.component';
import { RubyThemeTwoComponent } from '../dashboard/wedding-view/templates/ruby-theme-two/ruby-theme-two.component';
import { SapphireThemeOneComponent } from '../dashboard/wedding-view/templates/sapphire-theme-one/sapphire-theme-one.component';
import { DiamondThemeOneComponent } from '../dashboard/wedding-view/templates/diamond-theme-one/diamond-theme-one.component';
import { getThemePreviewDummyData } from '../shared/data/theme-preview-dummy.data';
import { FloatingDecorationDirective } from '../shared/animations/floating-decoration.directive';
import { ParallaxDirective } from '../shared/animations/parallax.directive';
import { RevealScopeDirective } from '../shared/animations/reveal-scope.directive';
import { RevealStaggerDirective } from '../shared/animations/reveal-stagger.directive';
import { ToastService } from '../toast.service';

/** Mirrors how wedding-view hosts the theme: sticky parent flag + recreatable child. */
@Component({
  template: `
    <ng-container *ngIf="renderChild">
      <wc-diamond-theme-one
        [weddingData]="weddingData"
        [invitationOpened]="invitationOpened"
        (openInvitationRequested)="onOpenRequested()">
      </wc-diamond-theme-one>
    </ng-container>
  `,
})
class DiamondHostComponent {
  weddingData = getThemePreviewDummyData('champagne-rose');
  invitationOpened = false;
  renderChild = true;

  onOpenRequested(): void {
    this.invitationOpened = true;
  }
}

describe('theme preview opening flow', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        RubyThemeOneComponent,
        RubyThemeTwoComponent,
        SapphireThemeOneComponent,
        DiamondThemeOneComponent,
        DiamondHostComponent,
        FloatingDecorationDirective,
        ParallaxDirective,
        RevealScopeDirective,
        RevealStaggerDirective,
      ],
      imports: [CommonModule, FormsModule],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            create: () => of({}),
          },
        },
        {
          provide: ToastService,
          useValue: {},
        },
      ],
    }).compileComponents();
  });

  it('opens Lavender Bloom from its rendered button', () => {
    const fixture = TestBed.createComponent(RubyThemeTwoComponent);
    const component = fixture.componentInstance;
    const openRequest = spyOn(component.openInvitationRequested, 'emit');
    spyOn(component, 'getSafeMapUrl').and.returnValue(null);
    component.weddingData = getThemePreviewDummyData('lavender-bloom');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector<HTMLButtonElement>('.ruby-two-cover button');
    expect(button).withContext('Lavender opening button should render').not.toBeNull();

    button?.click();
    fixture.detectChanges();

    expect(component.hasOpened).toBeTrue();
    expect(component.isInvitationOpened).toBeTrue();
    expect(component.isCoverVisible).toBeFalse();
    expect(openRequest).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.ruby-two-cover')).toBeNull();
    expect(host.querySelector('.ruby-two-main')).not.toBeNull();

    fixture.destroy();
  });

  it('opens Garden Whisper from its rendered button', () => {
    const fixture = TestBed.createComponent(SapphireThemeOneComponent);
    const component = fixture.componentInstance;
    const openRequest = spyOn(component.openInvitationRequested, 'emit');
    spyOn(component, 'getSafeMapUrl').and.returnValue(null);
    component.weddingData = getThemePreviewDummyData('garden-whisper');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector<HTMLButtonElement>('.sapphire-opening button');
    expect(button).withContext('Garden opening button should render').not.toBeNull();

    button?.click();
    fixture.detectChanges();

    expect(component.hasOpened).toBeTrue();
    expect(component.isInvitationOpened).toBeTrue();
    expect(component.isCoverVisible).toBeFalse();
    expect(openRequest).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.sapphire-opening')).toBeNull();
    expect(host.querySelector('.sapphire-content')).not.toBeNull();

    fixture.destroy();
  });

  it('keeps the Soft Ivory opening flow working', () => {
    const fixture = TestBed.createComponent(RubyThemeOneComponent);
    const component = fixture.componentInstance;
    const openRequest = spyOn(component.openInvitationRequested, 'emit');
    component.weddingData = getThemePreviewDummyData('soft-ivory');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector<HTMLButtonElement>('.ruby-cover button');
    expect(button).withContext('Soft Ivory opening button should render').not.toBeNull();

    component.safeMapEmbedUrl = undefined;
    button?.click();
    fixture.detectChanges();

    expect(component.hasOpened).toBeTrue();
    expect(component.isInvitationOpened).toBeTrue();
    expect(openRequest).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.ruby-cover button')).toBeNull();
    expect(host.querySelector('.ruby-main')).not.toBeNull();

    fixture.destroy();
  });

  it('opens Champagne Rose from its rendered button', async () => {
    const fixture = TestBed.createComponent(DiamondThemeOneComponent);
    const component = fixture.componentInstance;
    const openRequest = spyOn(component.openInvitationRequested, 'emit');
    spyOn(component, 'getMapEmbedUrl').and.returnValue(null);
    component.weddingData = getThemePreviewDummyData('champagne-rose');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const button = host.querySelector<HTMLButtonElement>('.diamond-opening button');
    expect(button).withContext('Champagne Rose opening button should render').not.toBeNull();

    button?.click();

    // Diamond opens itself synchronously; the cover is gone before the
    // parent is even notified (diamondOpened is the only source of truth).
    expect(component.diamondOpened).toBeTrue();
    expect(host.querySelector('.diamond-opening')).toBeNull();
    expect(openRequest).not.toHaveBeenCalled();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(openRequest).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('.diamond-opening').length).toBe(0);
    expect(host.querySelector('.diamond-opening')).toBeNull();
    expect(host.querySelectorAll('.diamond-main').length).toBe(1);
    expect(host.querySelector('.diamond-main')).not.toBeNull();

    fixture.destroy();
  });

  it('leaves no Champagne Rose cover in the DOM after a click through its host', async () => {
    const fixture = TestBed.createComponent(DiamondHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.diamond-opening').length).toBe(1);
    expect(host.querySelectorAll('.diamond-main').length).toBe(0);

    host.querySelector<HTMLButtonElement>('.diamond-opening__button')?.click();

    // Same tick, parent not yet informed: cover already gone, main already there.
    expect(fixture.componentInstance.invitationOpened).toBeFalse();
    expect(host.querySelectorAll('.diamond-opening').length).toBe(0);
    expect(host.querySelectorAll('.diamond-main').length).toBe(1);

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(fixture.componentInstance.invitationOpened).toBeTrue();
    expect(host.querySelectorAll('.diamond-opening').length).toBe(0);
    expect(host.querySelectorAll('.diamond-cover').length).toBe(0);
    expect(host.querySelectorAll('.diamond-main').length).toBe(1);
    expect(host.querySelectorAll('.diamond-theme-one--opened').length).toBe(1);

    const main = host.querySelector<HTMLElement>('.diamond-main')!;
    const mainStyle = getComputedStyle(main);
    expect(mainStyle.display).not.toBe('none');
    expect(mainStyle.visibility).toBe('visible');
    expect(mainStyle.opacity).toBe('1');
    expect(mainStyle.pointerEvents).toBe('auto');

    // Force the child to be destroyed and rebuilt, as a parent re-render would.
    fixture.componentInstance.renderChild = false;
    fixture.detectChanges();
    fixture.componentInstance.renderChild = true;
    fixture.detectChanges();

    expect(host.querySelectorAll('.diamond-opening').length).toBe(0);
    expect(host.querySelectorAll('.diamond-main').length).toBe(1);

    fixture.destroy();
  });

  it('never opens Champagne Rose from the parent invitationOpened input alone', () => {
    const fixture = TestBed.createComponent(DiamondThemeOneComponent);
    const component = fixture.componentInstance;
    spyOn(component, 'getMapEmbedUrl').and.returnValue(null);
    component.weddingData = getThemePreviewDummyData('champagne-rose');
    component.invitationOpened = true;
    fixture.detectChanges();

    // diamondOpened is the ONLY source of truth for Diamond's own opening
    // state; flipping the parent input must never open the cover by itself.
    const host = fixture.nativeElement as HTMLElement;
    expect(component.diamondOpened).toBeFalse();
    expect(host.querySelector('.diamond-opening')).not.toBeNull();
    expect(host.querySelector('.diamond-main')).toBeNull();

    host.querySelector<HTMLButtonElement>('.diamond-opening__button')?.click();

    expect(component.diamondOpened).toBeTrue();
    expect(host.querySelector('.diamond-opening')).toBeNull();
    expect(host.querySelector('.diamond-main')).not.toBeNull();

    fixture.destroy();
  });
});
