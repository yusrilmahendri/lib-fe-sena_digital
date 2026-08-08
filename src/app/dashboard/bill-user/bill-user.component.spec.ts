import { of } from 'rxjs';
import { DashboardServiceType } from 'src/app/dashboard.service';
import { BillUserComponent } from './bill-user.component';

describe('BillUserComponent', () => {
  let component: BillUserComponent;
  let router: any;

  beforeEach(() => {
    (window as any).snap = undefined;
    router = {
      navigate: jasmine.createSpy('navigate'),
      navigateByUrl: jasmine.createSpy('navigateByUrl'),
    };
    component = new BillUserComponent(
      {
        getProfile: jasmine.createSpy('getProfile').and.returnValue(of({ data: {} })),
        create: jasmine.createSpy('create'),
      } as any,
      { snapshot: { data: {} } } as any,
      router
    );
  });

  afterEach(() => {
    (window as any).snap = undefined;
  });

  it('routes renew to the current package renewal flow', () => {
    component.paymentState = {
      packageCode: 'sapphire',
      packageName: 'Sapphire',
    } as any;

    component.renewPackage();

    expect(router.navigate).toHaveBeenCalledWith(['/user/upgrade-account'], {
      queryParams: {
        mode: 'renew',
        package: 'sapphire',
        returnUrl: '/dashboard/account-expired',
      },
    });
  });

  it('routes upgrade to package selection, separate from renew', () => {
    component.upgradePackage();

    expect(router.navigate).toHaveBeenCalledWith(['/user/upgrade-account'], {
      queryParams: {
        mode: 'upgrade',
        returnUrl: '/dashboard/account-expired',
      },
    });
  });

  it('uses create payment CTA when initial payment has no transaction yet', () => {
    component.paymentState = {
      paymentAction: 'create_payment',
      packageName: 'Sapphire',
    } as any;

    expect(component.pendingPaymentTitle).toBe('Selesaikan Pembayaran');
    expect(component.pendingPaymentLead).toContain('Paket Sapphire');
    expect(component.pendingPaymentCtaLabel).toBe('Buat Pembayaran');
  });

  it('resumes Midtrans pending invoice with existing snap token without navigation or invoice creation', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    component.paymentState = {
      pendingInvoice: {
        id: 123,
        order_id: 'UPG-123',
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true },
        midtrans: { snap_token: 'snap-existing' },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(snapPay).toHaveBeenCalledWith('snap-existing', jasmine.any(Object));
    expect((component as any).dashboardService.create).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('refreshes Midtrans token through resume endpoint when pending invoice has no usable token', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      data: {
        reused: true,
        order_id: 'UPG-123',
        snap_token: 'snap-refreshed',
      },
    }));
    component.paymentState = {
      pendingInvoice: {
        id: 123,
        invoice_code: 'UPG-123',
        order_id: 'UPG-123',
        is_payable: true,
        payment_method: 'midtrans',
        resume: {
          type: 'midtrans_snap',
          available: true,
          endpoint: '/api/v1/midtrans/create-snap-token',
          method: 'POST',
          payload: { order_id: 'UPG-123' },
          reuses_existing_order: true,
        },
        midtrans: {},
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(dashboardService.create).toHaveBeenCalledWith(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      { order_id: 'UPG-123' }
    );
    expect(snapPay).toHaveBeenCalledWith('snap-refreshed', jasmine.any(Object));
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('opens manual payment modal from pending invoice without requesting config', () => {
    const dashboardService = (component as any).dashboardService;
    component.paymentState = {
      pendingInvoice: {
        id: 124,
        amount: '150000.00',
        is_payable: true,
        payment_method: 'manual',
        resume: { type: 'manual_payment', available: true },
        manual_payment: {
          bank_name: 'BCA',
          account_number: '1234567890',
          account_holder: 'Sena Digital',
          instructions: 'Transfer sesuai nominal tagihan.',
        },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(component.manualPaymentModalOpen).toBeTrue();
    expect(component.manualPaymentBankName).toBe('BCA');
    expect(component.manualPaymentAmountLabel.replace(/\s/g, '')).toBe('Rp150.000');
    expect(dashboardService.create).not.toHaveBeenCalled();
  });

  it('shows unavailable payment state when provider is unavailable', () => {
    component.paymentState = {
      pendingInvoice: {
        id: 125,
        is_payable: true,
        payment_method: null,
        provider: null,
        resume: { available: false },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(component.paymentUnavailableTitle).toBe('Metode Pembayaran Belum Tersedia');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('offers a new payment action for expired non-payable invoices', () => {
    component.paymentState = {
      pendingInvoice: {
        id: 125,
        is_payable: false,
        payment_status: 'expired',
      },
      paymentAction: 'create_new_payment',
    } as any;

    component.continuePayment();

    expect(component.paymentUnavailableTitle).toBe('Waktu Pembayaran Habis');
    expect(component.paymentUnavailablePrimaryLabel).toBe('Buat Pembayaran Baru');
  });

  it('prevents duplicate continue payment actions', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    component.paymentState = {
      pendingInvoice: {
        id: 126,
        is_payable: true,
        resume: { type: 'midtrans_snap', available: true },
        midtrans: { snap_token: 'snap-existing' },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();
    component.continuePayment();

    expect(snapPay).toHaveBeenCalledTimes(1);
  });

  it('keeps invoice pending and allows retry when Snap is closed', () => {
    let callbacks: any;
    (window as any).snap = {
      pay: jasmine.createSpy('pay').and.callFake((_token: string, options: any) => callbacks = options),
    };
    component.paymentState = {
      pendingInvoice: {
        id: 127,
        is_payable: true,
        resume: { type: 'midtrans_snap', available: true },
        midtrans: { snap_token: 'snap-existing' },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();
    callbacks.onClose();

    expect(component.isContinuingPayment).toBeFalse();
    expect(component.paymentState?.pendingInvoice?.id).toBe(127);
    expect(component.paymentStatusMessage).toContain('dapat melanjutkan pembayaran kapan saja');
  });

  it('checks backend status after Snap success without activating package locally', () => {
    let callbacks: any;
    spyOn(component, 'refreshStatus').and.stub();
    (window as any).snap = {
      pay: jasmine.createSpy('pay').and.callFake((_token: string, options: any) => callbacks = options),
    };
    component.paymentState = {
      pendingInvoice: {
        id: 128,
        is_payable: true,
        resume: { type: 'midtrans_snap', available: true },
        midtrans: { snap_token: 'snap-existing' },
      },
      paymentAction: 'continue_payment',
      isPaymentActive: false,
    } as any;

    component.continuePayment();
    callbacks.onSuccess();

    expect(component.refreshStatus).toHaveBeenCalled();
    expect(component.paymentState?.isPaymentActive).toBeFalse();
  });

  it('routes to dashboard when refreshed backend state is paid and active', () => {
    const dashboardService = (component as any).dashboardService;
    dashboardService.getProfile.and.returnValue(of({
      data: {
        is_verified: true,
        account_status: 'active',
        payment_status: 'paid',
      },
    }));

    component.refreshStatus();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard/overview');
  });
});
