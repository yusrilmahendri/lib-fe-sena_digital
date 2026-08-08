import { of, Subject, throwError } from 'rxjs';
import { UpgradeAkunComponent } from './upgrade-akun.component';

describe('UpgradeAkunComponent payment flow', () => {
  let component: UpgradeAkunComponent;
  let dashboardService: any;
  let router: any;
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
      navigateByUrl: jasmine.createSpy('navigateByUrl'),
    };

    component = new UpgradeAkunComponent(
      dashboardService,
      { queryParams: of({}) } as any,
      router
    );
    component.selectedPackage = sapphirePackage;
    component.paymentMethods = [{ type: 'midtrans', label: 'Bayar Online', details: {} }];
  });

  it('opens online payment after payment creation succeeds', () => {
    spyOn(window, 'open');
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
    expect(window.open).toHaveBeenCalledWith('https://pay.example.test/checkout', '_blank', 'noopener,noreferrer');
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

  it('maps successful backend status to active package success copy', () => {
    component.invoiceData = { payment_method: 'midtrans', payment_status: 'settlement' };
    component.checkoutState = (component as any).resolveCheckoutState(component.invoiceData);

    expect(component.checkoutState).toBe('success');
    expect(component.checkoutStatusTitle).toBe('Pembayaran Berhasil');
    expect(component.checkoutStatusMessage).toContain('Paket Sapphire Anda sudah aktif');
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

    (component as any).applyDashboardState(
      { data: { package_info: { is_active: true, package_code: 'sapphire', name: 'Sapphire' } } },
      { data: [{ ...sapphirePackage, is_current: true }] },
      { data: { midtrans: { enabled: true } } }
    );

    expect(component.checkoutState).toBe('success');
    expect(component.checkoutStatusTitle).toBe('Pembayaran Berhasil');
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

  it('does not expose upgrade CTA when backend does not provide valid upgrade pricing', () => {
    const packageWithoutPricing = {
      ...diamondPackage,
      upgradePrice: null,
      upgradePriceLabel: '',
      discountAmount: null,
      discountAmountLabel: '',
    };
    component.currentPackage = sapphirePackage;

    expect(component.getPackageAction(packageWithoutPricing)).toBe('unavailable');
    expect(component.getActionLabel(packageWithoutPricing)).toBe('Harga upgrade belum tersedia');
    expect(component.canShowPackageUpgradePricing(packageWithoutPricing)).toBeFalse();
  });

  it('keeps theme context in return URL after requested package becomes active', () => {
    component.requestedPackage = 'diamond';
    component.requestedTheme = '15';
    component.requestedThemeSlug = 'champagne-rose';
    component.returnUrl = '/user/tampilan';
    component.currentPackage = { ...diamondPackage, isCurrent: true };

    expect((component as any).buildReturnUrlWithSuccess()).toBe('/user/tampilan?upgradeSuccess=1&package=diamond&theme=15&themeSlug=champagne-rose');
  });
});
