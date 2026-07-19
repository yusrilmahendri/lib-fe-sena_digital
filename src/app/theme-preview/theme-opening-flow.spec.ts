import { CommonModule } from '@angular/common';
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

describe('theme preview opening flow', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        RubyThemeOneComponent,
        RubyThemeTwoComponent,
        SapphireThemeOneComponent,
        DiamondThemeOneComponent,
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

  it('opens Champagne Rose from its rendered button', () => {
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
    fixture.detectChanges();

    expect(component.invitationOpened).toBeTrue();
    expect(component.isInvitationOpened).toBeTrue();
    expect(openRequest).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('.diamond-opening').length).toBe(0);
    expect(host.querySelector('.diamond-opening')).toBeNull();
    expect(host.querySelectorAll('.diamond-main').length).toBe(1);
    expect(host.querySelector('.diamond-main')).not.toBeNull();

    fixture.destroy();
  });
});
