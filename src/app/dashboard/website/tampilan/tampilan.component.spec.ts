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
      upgradeRequired: true,
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

  it('shows upgrade CTA for Sapphire users choosing a Diamond theme', () => {
    const theme: any = {
      id: 15,
      backendThemeId: 15,
      name: 'Champagne Rose',
      slug: 'diamond',
      targetPackage: 'diamond',
      targetPackageLabel: 'Diamond',
      requiredPackageTier: 'diamond',
      targetPackagePrice: 300000,
      targetPackageOriginalPrice: 300000,
      targetPackageOriginalPriceLabel: 'Rp300.000',
      targetPackageDiscountPercentage: 40,
      targetPackageDiscountAmount: 120000,
      targetPackageDiscountAmountLabel: 'Rp120.000',
      targetPackageUpgradePrice: 180000,
      targetPackageUpgradePriceLabel: 'Rp180.000',
      upgradeRequired: true,
      inactiveByAdmin: false,
      adminIsActive: true,
    };

    component.userPackageTier = 'sapphire';
    component.onUpgradeClick(theme);

    expect(component.canShowUpgradeCta).toBeTrue();
    expect(component.upgradeModalTitle).toBe('Upgrade paket diperlukan');
    expect(component.upgradeTargetPackageLabel).toBe('Diamond');
    expect(component.upgradeTargetPackageOriginalPriceLabel.replace(/\s/g, '')).toBe('Rp300.000');
    expect(component.upgradeTargetPackageDiscountLabel).toBe('Diskon Upgrade 40%');
    expect(component.upgradeTargetPackageDiscountAmountLabel.replace(/\s/g, '')).toBe('Rp120.000');
    expect(component.upgradeTargetPackagePriceLabel.replace(/\s/g, '')).toBe('Rp180.000');
  });

  it('maps backend payable amount as the upgrade price for theme upgrade summary', () => {
    const pricing = (component as any).resolveTargetPackagePriceInfo({
      name: 'Diamond',
      price: 15000,
      upgrade_pricing: {
        original_price: 15000,
        discount_percentage: 40,
        discount_amount: 6000,
        upgrade_price: 15000,
        payable_amount: 9000,
      },
    }, 'diamond');

    expect(pricing.originalPriceLabel.replace(/\s/g, '')).toBe('Rp15.000');
    expect(pricing.discountAmountLabel.replace(/\s/g, '')).toBe('Rp6.000');
    expect(pricing.upgradePriceLabel.replace(/\s/g, '')).toBe('Rp9.000');
  });

  it('shows upgrade CTA for Ruby users choosing a Sapphire theme', () => {
    const theme: any = {
      id: 8,
      backendThemeId: 8,
      slug: 'garden-whisper',
      targetPackage: 'sapphire',
      targetPackageLabel: 'Sapphire',
      requiredPackageTier: 'sapphire',
      upgradeRequired: true,
    };

    component.userPackageTier = 'ruby';
    component.onUpgradeClick(theme);

    expect(component.canShowUpgradeCta).toBeTrue();
    expect(component.upgradeTargetPackageLabel).toBe('Sapphire');
  });

  it('does not show upgrade CTA for admin-inactive themes', () => {
    const theme: any = {
      id: 15,
      backendThemeId: 15,
      name: 'Champagne Rose',
      slug: 'diamond',
      targetPackage: null,
      targetPackageLabel: '',
      requiredPackageTier: 'diamond',
      upgradeRequired: false,
      inactiveByAdmin: true,
      adminIsActive: false,
    };

    component.onUpgradeClick(theme);

    expect(component.canShowUpgradeCta).toBeFalse();
    expect(component.upgradeModalTitle).toBe('Tema Tidak Tersedia');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('prevents duplicate navigation after upgrade CTA is clicked', () => {
    const theme: any = {
      id: 15,
      backendThemeId: 15,
      slug: 'diamond',
      targetPackage: 'diamond',
      targetPackageLabel: 'Diamond',
      requiredPackageTier: 'diamond',
      upgradeRequired: true,
    };

    component.onUpgradeClick(theme);
    component.goToUpgradePackage();
    component.goToUpgradePackage();

    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('closes the upgrade modal when user clicks back', () => {
    const theme: any = {
      id: 15,
      backendThemeId: 15,
      slug: 'diamond',
      targetPackage: 'diamond',
      targetPackageLabel: 'Diamond',
      requiredPackageTier: 'diamond',
      upgradeRequired: true,
    };

    component.onUpgradeClick(theme);
    component.closeUpgradeModal();

    expect(component.showUpgradeModal).toBeFalse();
    expect((component as any).pendingThemeForUpgrade).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
