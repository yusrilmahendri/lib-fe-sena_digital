import { TampilanComponent } from './tampilan.component';

describe('TampilanComponent', () => {
  let component: TampilanComponent;
  let router: any;

  beforeEach(() => {
    router = {
      navigate: jasmine.createSpy('navigate'),
      navigateByUrl: jasmine.createSpy('navigateByUrl'),
    };
    component = new TampilanComponent(
      {} as any,
      {} as any,
      {} as any,
      { showToast: jasmine.createSpy('showToast') } as any,
      router,
      { queryParams: { subscribe: jasmine.createSpy('subscribe') } } as any,
      { detectChanges: jasmine.createSpy('detectChanges') } as any
    );
  });

  it('allows Ruby users to use Ruby themes and upgrade for Sapphire/Diamond themes', () => {
    component.userPackageTier = 'ruby';

    expect((component as any).canUseThemeByTier('soft-ivory', 'ruby')).toBeTrue();
    expect((component as any).canUseThemeByTier('garden-whisper', 'sapphire')).toBeFalse();
    expect((component as any).canUseThemeByTier('diamond', 'diamond')).toBeFalse();
  });

  it('allows Sapphire users to use Ruby and Sapphire themes without downgrade', () => {
    component.userPackageTier = 'sapphire';

    expect((component as any).canUseThemeByTier('soft-ivory', 'ruby')).toBeTrue();
    expect((component as any).canUseThemeByTier('garden-whisper', 'sapphire')).toBeTrue();
    expect((component as any).canUseThemeByTier('diamond', 'diamond')).toBeFalse();
  });

  it('allows Diamond users to use all paid theme tiers', () => {
    component.userPackageTier = 'diamond';

    expect((component as any).canUseThemeByTier('soft-ivory', 'ruby')).toBeTrue();
    expect((component as any).canUseThemeByTier('garden-whisper', 'sapphire')).toBeTrue();
    expect((component as any).canUseThemeByTier('diamond', 'diamond')).toBeTrue();
  });

  it('navigates locked theme upgrades with target package and theme context', () => {
    const event = {
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
    } as any;
    const theme: any = {
      id: 15,
      backendThemeId: 15,
      slug: 'diamond',
      targetPackage: 'diamond',
      targetPackageLabel: 'Diamond',
      requiredPackageTier: 'diamond',
      isLegacy: false,
      category: 'Elegant',
    };

    component.onUpgradeClick(theme, event);
    component.goToUpgradePackage();

    expect(router.navigate).toHaveBeenCalledWith(['/user/upgrade-account'], {
      queryParams: {
        package: 'diamond',
        theme: 15,
        themeSlug: 'diamond',
        returnUrl: '/user/tampilan',
      },
    });
  });
});
