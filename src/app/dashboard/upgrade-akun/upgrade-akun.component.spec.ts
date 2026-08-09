import { of, Subject, throwError } from 'rxjs';
import { UpgradeAkunComponent } from './upgrade-akun.component';
import { fakeAsync, flushMicrotasks } from '@angular/core/testing';

describe('UpgradeAkunComponent payment flow', () => {
  let component: UpgradeAkunComponent;
  let dashboardService: any;
  let router: any;
  let windowOpenSpy: jasmine.Spy;
  const sapphirePackage: any = {
    id: 2,
    code: 'sapphire',
    name: 'Sapphire',
    price: 150000,
    priceLabel: 'Rp150.000',
    originalPrice: 150000,
    originalPriceLabel: 'Rp150.000',
    discountPercentage: 40,
    discountAmount: 60000,
    discountAmountLabel: 'Rp60.000',
    upgradePrice: 90000,
    upgradePriceLabel: 'Rp90.000',
    description: 'Paket Sapphire',
    thumbnail: '',
    badge: '',
    statusLabel: '',
    features: ['Tema Sapphire'],
    isCurrent: false,
    isLastPackage: false,
    subscriptionStatus: '',
    canSelect: true,
    canUpgrade: true,
    canDowngrade: false,
    action: 'upgrade',
    disabledReason: '',
    pendingMessage: '',
    raw: { package_code: 'sapphire' },
  };
  const rubyPackage: any = {
    ...sapphirePackage,
    id: 1,
    code: 'ruby',
    name: 'Ruby',
    priceLabel: 'Rp100.000',
    raw: { package_code: 'ruby' },
  };
  const diamondPackage: any = {
    ...sapphirePackage,
    id: 3,
    code: 'diamond',
    name: 'Diamond',
    price: 300000,
    priceLabel: 'Rp300.000',
    originalPrice: 300000,
    originalPriceLabel: 'Rp300.000',
    discountPercentage: 40,
    discountAmount: 120000,
    discountAmountLabel: 'Rp120.000',
    upgradePrice: 180000,
    upgradePriceLabel: 'Rp180.000',
    raw: { package_code: 'diamond' },
  };

  beforeEach(() => {
    dashboardService = {
      create: jasmine.createSpy('create'),
      getProfile: jasmine.createSpy('getProfile').and.returnValue(of({ data: { package_info: { is_active: false } } })),
      list: jasmine.createSpy('list').and.returnValue(of({ data: [] })),
      getUserPaymentConfig: jasmine.createSpy('getUserPaymentConfig').and.returnValue(of({ data: { midtrans: { enabled: true } } })),
    };
    router = {
      navigateByUrl: jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true)),
    };
    windowOpenSpy = spyOn(window, 'open');

    component = new UpgradeAkunComponent(
      dashboardService,
      { queryParams: of({}) } as any,
      router
    );
    component.selectedPackage = sapphirePackage;
    component.paymentMethods = [{ type: 'midtrans', label: 'Bayar Online', details: {} }];
  });

  it('opens online payment after payment creation succeeds', () => {
    dashboardService.create.and.returnValue(of({
      data: {
        payment_method: 'midtrans',
        payment_url: 'https://pay.example.test/checkout',
        package_code: 'sapphire',
        payment_status: 'pending',
      },
    }));

    component.startPayment('midtrans');

    expect(dashboardService.create).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).toHaveBeenCalledWith('https://pay.example.test/checkout', '_blank', 'noopener,noreferrer');
    expect(component.checkoutState).toBe('pending');
  });

  it('shows a creation error without a created transaction when payment creation fails', () => {
    dashboardService.create.and.returnValue(throwError(() => ({ error: { message: 'Server sibuk' } })));

    component.startPayment('midtrans');

    expect(component.checkoutState).toBe('creation_error');
    expect(component.hasCreatedTransaction).toBeFalse();
    expect(component.checkoutStatusTitle).toBe('Pembayaran Belum Dapat Diproses');
    expect(component.checkoutStatusMessage).toContain('Tidak ada pembayaran yang terpotong');
  });

  it('keeps pending transaction state with continue and status-check actions available', () => {
    component.invoiceData = { payment_method: 'midtrans', payment_status: 'pending' };
    component.checkoutState = (component as any).resolveCheckoutState(component.invoiceData);

    expect(component.checkoutState).toBe('pending');
    expect(component.checkoutStatusTitle).toBe('Menunggu Pembayaran');
    expect(component.hasCreatedTransaction).toBeTrue();
  });

  it('keeps paid transaction in processing until backend marks selected package current', () => {
    component.invoiceData = { payment_method: 'midtrans', payment_status: 'settlement' };
    component.checkoutState = (component as any).resolveCheckoutState(component.invoiceData);

    expect(component.checkoutState).toBe('processing');
    expect(component.checkoutStatusTitle).toBe('Pembayaran Sedang Diproses');
  });

  it('maps failed payment status to retry payment state', () => {
    component.invoiceData = { payment_method: 'midtrans', payment_status: 'failed' };
    component.checkoutState = (component as any).resolveCheckoutState(component.invoiceData);

    expect(component.checkoutState).toBe('failed');
    expect(component.checkoutStatusTitle).toBe('Pembayaran Gagal');
  });

  it('maps expired payment status to create-new-payment state', () => {
    component.invoiceData = { payment_method: 'midtrans', payment_status: 'expired' };
    component.checkoutState = (component as any).resolveCheckoutState(component.invoiceData);

    expect(component.checkoutState).toBe('expired');
    expect(component.checkoutStatusTitle).toBe('Waktu Pembayaran Habis');
  });

  it('prevents duplicate transaction creation while a request is running', () => {
    const pendingCreate$ = new Subject<any>();
    dashboardService.create.and.returnValue(pendingCreate$);

    component.startPayment('midtrans');
    component.startPayment('midtrans');

    expect(dashboardService.create).toHaveBeenCalledTimes(1);
    pendingCreate$.complete();
  });

  it('restores pending state from an existing transaction after reload', () => {
    (component as any).latestTransaction = {
      payment_method: 'midtrans',
      payment_status: 'pending',
      package_code: 'sapphire',
    };

    component.openUpgradeModal(sapphirePackage);

    expect(component.invoiceData).toEqual((component as any).latestTransaction);
    expect(component.checkoutState).toBe('pending');
  });

  it('uses refreshed backend package data as source of truth for success state', () => {
    component.isModalOpen = true;
    component.invoiceData = { payment_method: 'midtrans', payment_status: 'pending', package_code: 'sapphire' };
    component.selectedPackage = sapphirePackage;

    (component as any).applyDashboardState(
      { data: { package_info: { is_active: true, package_code: 'sapphire', name: 'Sapphire' } } },
      { data: [{ ...sapphirePackage, is_current: true }] },
      { data: { midtrans: { enabled: true } } }
    );

    expect(component.checkoutState).toBe('success');
    expect(component.checkoutStatusTitle).toBe('Pembayaran Berhasil');
  });

  it('keeps Sapphire as current when query target is Diamond', () => {
    component.requestedPackage = 'diamond';

    (component as any).applyDashboardState(
      { data: { package_info: { is_active: true, package_code: 'sapphire', name: 'Sapphire' } } },
      { data: [
        { ...rubyPackage, is_current: false },
        { ...sapphirePackage, is_current: true },
        { ...diamondPackage, is_current: false },
      ] },
      { data: { midtrans: { enabled: true } } }
    );

    expect(component.currentPackage?.code).toBe('sapphire');
    expect(component.isCurrentPackage(sapphirePackage)).toBeTrue();
    expect(component.isCurrentPackage(diamondPackage)).toBeFalse();
    expect(component.highestPackageMessage).toBe('');
  });

  it('does not trust package-list is_current when profile current is Sapphire', () => {
    (component as any).applyDashboardState(
      { data: { package_info: { is_active: true, package_code: 'sapphire', name: 'Sapphire' } } },
      { data: [
        { ...sapphirePackage, is_current: false },
        { ...diamondPackage, is_current: true },
      ] },
      { data: { midtrans: { enabled: true } } }
    );

    expect(component.currentPackage?.code).toBe('sapphire');
    expect(component.isCurrentPackage(sapphirePackage)).toBeTrue();
    expect(component.isCurrentPackage(diamondPackage)).toBeFalse();
    expect(component.highestPackageMessage).toBe('');
  });

  it('maps backend upgrade pricing to normal price, discount, and payable amount', () => {
    const pkg = (component as any).mapPackage({
      id: 3,
      package_code: 'diamond',
      name: 'Diamond',
      price: 300000,
      original_price: 300000,
      discount_percentage: 40,
      discount_amount: 120000,
      upgrade_price: 180000,
      can_select: true,
      can_upgrade: true,
      action: 'upgrade',
    }, 0);

    component.selectedPackage = pkg;

    expect(pkg.originalPriceLabel.replace(/\s/g, '')).toBe('Rp300.000');
    expect(pkg.discountAmountLabel.replace(/\s/g, '')).toBe('Rp120.000');
    expect(pkg.upgradePriceLabel.replace(/\s/g, '')).toBe('Rp180.000');
    expect(component.modalPackagePrice.replace(/\s/g, '')).toBe('Rp180.000');
    expect(component.primaryPaymentCtaLabel.replace(/\s/g, '')).toBe('BayarRp180.000');
    expect(component.selectedPackageDiscountLabel).toBe('Diskon Upgrade 40%');
  });

  it('maps nested backend upgrade pricing without falling back to normal price', () => {
    const pkg = (component as any).mapPackage({
      id: 3,
      package_code: 'diamond',
      name: 'Diamond',
      price: 15000,
      pricing: {
        original_price: 15000,
        discount_percentage: 40,
        discount_amount: 6000,
        payable_amount: 9000,
      },
      can_select: true,
      can_upgrade: true,
      action: 'upgrade',
    }, 0);

    component.currentPackage = sapphirePackage;
    component.selectedPackage = pkg;

    expect(pkg.originalPriceLabel.replace(/\s/g, '')).toBe('Rp15.000');
    expect(pkg.discountAmountLabel.replace(/\s/g, '')).toBe('Rp6.000');
    expect(pkg.upgradePriceLabel.replace(/\s/g, '')).toBe('Rp9.000');
    expect(component.modalPackagePrice.replace(/\s/g, '')).toBe('Rp9.000');
  });

  it('allows Ruby users to upgrade to Sapphire and Diamond', () => {
    component.currentPackage = rubyPackage;

    expect(component.getPackageAction(sapphirePackage)).toBe('upgrade');
    expect(component.canShowPackageUpgradePricing(sapphirePackage)).toBeTrue();
    expect(component.getPackageAction(diamondPackage)).toBe('upgrade');
    expect(component.canShowPackageUpgradePricing(diamondPackage)).toBeTrue();
  });

  it('disables Sapphire to Ruby downgrade and keeps Diamond upgrade available', () => {
    component.currentPackage = sapphirePackage;

    expect(component.getPackageAction(rubyPackage)).toBe('unavailable');
    expect(component.getActionLabel(rubyPackage)).toBe('Downgrade tidak tersedia');
    expect(component.isPackageDisabled(rubyPackage)).toBeTrue();
    expect(component.getPackageAction(diamondPackage)).toBe('upgrade');
    expect(component.canShowPackageUpgradePricing(rubyPackage)).toBeFalse();
  });

  it('disables Diamond downgrades and shows highest package message', () => {
    component.currentPackage = diamondPackage;
    component.packages = [rubyPackage, sapphirePackage, { ...diamondPackage, isCurrent: true }];

    expect(component.getPackageAction(rubyPackage)).toBe('unavailable');
    expect(component.getPackageAction(sapphirePackage)).toBe('unavailable');
    expect(component.highestPackageMessage).toBe('Anda sudah menggunakan paket tertinggi.');
  });

  it('shows business error when backend rejects downgrade', () => {
    dashboardService.create.and.returnValue(throwError(() => ({ error: { code: 'PACKAGE_DOWNGRADE_NOT_ALLOWED' } })));
    component.selectedPackage = rubyPackage;

    component.startPayment('midtrans');

    expect(component.checkoutState).toBe('creation_error');
    expect(component.paymentError).toBe('Downgrade paket tidak tersedia.');
  });

  it('keeps upgrade CTA as retry when backend does not provide valid upgrade pricing', () => {
    const packageWithoutPricing = {
      ...diamondPackage,
      upgradePrice: null,
      upgradePriceLabel: '',
      discountAmount: null,
      discountAmountLabel: '',
    };
    component.isLoading = false;
    component.currentPackage = sapphirePackage;

    expect(component.getPackageAction(packageWithoutPricing)).toBe('upgrade');
    expect(component.getActionLabel(packageWithoutPricing)).toBe('Coba Lagi');
    expect(component.isPackageDisabled(packageWithoutPricing)).toBeFalse();
    expect(component.canShowPackageUpgradePricing(packageWithoutPricing)).toBeFalse();
  });

  it('shows loading while upgrade pricing is being refreshed', () => {
    const packageWithoutPricing = {
      ...diamondPackage,
      price: 10000,
      priceLabel: 'Rp10.000',
      upgradePrice: null,
      upgradePriceLabel: '',
      discountAmount: null,
      discountAmountLabel: '',
    };
    component.currentPackage = sapphirePackage;
    component.selectedPackage = packageWithoutPricing;
    component.isRefreshingPackagePricing = true;

    expect(component.modalPackagePrice).toBe('');
    expect(component.primaryPaymentCtaLabel).toBe('Memuat harga...');
    expect(component.selectedPackageUpgradePricingMessage).toBe('Memuat harga upgrade...');
    expect(component.selectedPackageRequiresUpgradePricing).toBeTrue();
  });

  it('does not show normal price as upgrade price while upgrade pricing fails', () => {
    const packageWithoutPricing = {
      ...diamondPackage,
      price: 10000,
      priceLabel: 'Rp10.000',
      upgradePrice: null,
      upgradePriceLabel: '',
      discountAmount: null,
      discountAmountLabel: '',
    };
    component.isLoading = false;
    component.currentPackage = sapphirePackage;
    component.selectedPackage = packageWithoutPricing;

    expect(component.modalPackagePrice).toBe('');
    expect(component.primaryPaymentCtaLabel).toBe('Coba Lagi');
    expect(component.selectedPackageUpgradePricingMessage).toBe('Harga upgrade gagal dimuat.');
    expect(component.selectedPackageRequiresUpgradePricing).toBeTrue();
  });

  it('retries package pricing from backend and updates selected Diamond pricing', () => {
    const packageWithoutPricing = {
      ...diamondPackage,
      upgradePrice: null,
      upgradePriceLabel: '',
      discountAmount: null,
      discountAmountLabel: '',
    };
    component.isLoading = false;
    component.currentPackage = sapphirePackage;
    component.selectedPackage = packageWithoutPricing;
    component.targetPackage = packageWithoutPricing;
    dashboardService.getProfile.and.returnValue(of({ data: { package_info: { is_active: true, package_code: 'sapphire', name: 'Sapphire' } } }));
    dashboardService.list.and.returnValue(of({ data: [
      { ...sapphirePackage, is_current: true },
      {
        ...diamondPackage,
        is_current: false,
        pricing: {
          original_price: 15000,
          discount_percentage: 40,
          discount_amount: 6000,
          payable_amount: 9000,
        },
      },
    ] }));

    component.retryUpgradePricing();

    expect(component.selectedPackage?.code).toBe('diamond');
    expect(component.selectedPackage?.originalPriceLabel.replace(/\s/g, '')).toBe('Rp15.000');
    expect(component.selectedPackage?.discountAmountLabel.replace(/\s/g, '')).toBe('Rp6.000');
    expect(component.selectedPackage?.upgradePriceLabel.replace(/\s/g, '')).toBe('Rp9.000');
    expect(component.selectedPackageRequiresUpgradePricing).toBeFalse();
  });

  it('prioritizes payable amount over normal or legacy upgrade price fields', () => {
    const pkg = (component as any).mapPackage({
      id: 3,
      package_code: 'diamond',
      name: 'Diamond',
      price: 15000,
      pricing: {
        original_price: 15000,
        discount_percentage: 40,
        discount_amount: 6000,
        upgrade_price: 15000,
        payable_amount: 9000,
      },
      can_select: true,
      can_upgrade: true,
      action: 'upgrade',
    }, 0);

    component.currentPackage = sapphirePackage;
    component.selectedPackage = pkg;

    expect(pkg.originalPriceLabel.replace(/\s/g, '')).toBe('Rp15.000');
    expect(pkg.discountAmountLabel.replace(/\s/g, '')).toBe('Rp6.000');
    expect(pkg.upgradePriceLabel.replace(/\s/g, '')).toBe('Rp9.000');
    expect(component.modalPackagePrice.replace(/\s/g, '')).toBe('Rp9.000');
  });

  it('shows retry error when package pricing request fails', () => {
    const packageWithoutPricing = {
      ...diamondPackage,
      upgradePrice: null,
      upgradePriceLabel: '',
      discountAmount: null,
      discountAmountLabel: '',
    };
    component.isLoading = false;
    component.currentPackage = sapphirePackage;
    component.selectedPackage = packageWithoutPricing;
    dashboardService.list.and.returnValue(throwError(() => ({ error: { message: 'Server error' } })));

    component.retryUpgradePricing();

    expect(component.packagePricingError).toBe('Harga upgrade gagal dimuat.');
    expect(component.paymentError).toBe('Harga upgrade gagal dimuat.');
  });

  it('keeps current package unchanged when modal is closed or invoice is created', () => {
    dashboardService.create.and.returnValue(of({
      data: {
        payment_method: 'midtrans',
        payment_url: 'https://pay.example.test/checkout',
        package_code: 'diamond',
        payment_status: 'pending',
      },
    }));
    dashboardService.getProfile.and.returnValue(of({ data: { package_info: { is_active: true, package_code: 'sapphire', name: 'Sapphire' } } }));
    dashboardService.list.and.returnValue(of({ data: [
      { ...sapphirePackage, is_current: true },
      { ...diamondPackage, is_current: false },
    ] }));
    component.currentPackage = sapphirePackage;
    component.openUpgradeModal(diamondPackage);
    component.closeUpgradeModal();

    expect(component.currentPackage?.code).toBe('sapphire');

    component.selectedPackage = diamondPackage;
    component.startPayment('midtrans');

    expect(component.currentPackage?.code).toBe('sapphire');
    expect(component.checkoutState).toBe('pending');
  });

  it('marks Diamond active only after refreshed backend current package is Diamond', () => {
    component.isModalOpen = true;
    component.invoiceData = { payment_method: 'midtrans', payment_status: 'settlement', package_code: 'diamond' };
    component.selectedPackage = diamondPackage;

    (component as any).applyDashboardState(
      { data: { package_info: { is_active: true, package_code: 'diamond', name: 'Diamond' } } },
      { data: [
        { ...sapphirePackage, is_current: false },
        { ...diamondPackage, is_current: true },
      ] },
      { data: { midtrans: { enabled: true } } }
    );

    expect(component.currentPackage?.code).toBe('diamond');
    expect(component.checkoutState).toBe('success');
  });


  it('keeps theme context in return URL after requested package becomes active', () => {
    component.requestedPackage = 'diamond';
    component.requestedTheme = '15';
    component.requestedThemeSlug = 'champagne-rose';
    component.returnUrl = '/user/tampilan';
    component.currentPackage = { ...diamondPackage, isCurrent: true };

    expect((component as any).buildReturnUrlWithSuccess()).toBe('/user/tampilan?upgradeSuccess=1&package=diamond&theme=15&themeSlug=champagne-rose');
  });

  it('navigates internally to the return URL only after refreshed backend package is active', () => {
    component.requestedPackage = 'diamond';
    component.requestedTheme = '15';
    component.requestedThemeSlug = 'champagne-rose';
    component.returnUrl = '/user/tampilan';
    component.currentPackage = { ...diamondPackage, isCurrent: true };
    component.checkoutState = 'success';

    (component as any).redirectBackWhenUpgradeIsActive();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/user/tampilan?upgradeSuccess=1&package=diamond&theme=15&themeSlug=champagne-rose');
    expect(component.checkoutState).toBe('success');
    expect(component.paymentInfoMessage).toBe('Upgrade berhasil. Paket Anda sudah aktif.');
  });

  it('does not navigate after Snap success while backend still reports the old package', () => {
    component.requestedPackage = 'diamond';
    component.returnUrl = '/user/tampilan';
    component.currentPackage = sapphirePackage;
    component.checkoutState = 'processing';

    (component as any).redirectBackWhenUpgradeIsActive();

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(component.checkoutState).toBe('processing');
  });

  it('falls back to dashboard when return URL is missing or external', () => {
    component.requestedPackage = 'diamond';
    component.returnUrl = 'https://evil.example.test/user/tampilan';
    component.currentPackage = { ...diamondPackage, isCurrent: true };
    component.checkoutState = 'success';

    (component as any).redirectBackWhenUpgradeIsActive();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard/overview?upgradeSuccess=1&package=diamond');
  });

  it('keeps success UI visible when post-payment navigation fails', fakeAsync(() => {
    router.navigateByUrl.and.returnValue(Promise.reject(new Error('Cannot match any routes')));
    component.requestedPackage = 'diamond';
    component.returnUrl = '/route-yang-rusak';
    component.currentPackage = { ...diamondPackage, isCurrent: true };
    component.checkoutState = 'success';

    (component as any).redirectBackWhenUpgradeIsActive();
    flushMicrotasks();

    expect(component.checkoutState).toBe('success');
    expect(component.paymentInfoMessage).toBe('Upgrade berhasil. Paket Anda sudah aktif.');
  }));
});
