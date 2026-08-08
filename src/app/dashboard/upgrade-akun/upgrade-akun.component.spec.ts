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
});
