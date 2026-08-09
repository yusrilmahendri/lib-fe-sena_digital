import { of } from 'rxjs';
import { fakeAsync, flushMicrotasks } from '@angular/core/testing';
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
        getUserPaymentConfig: jasmine.createSpy('getUserPaymentConfig').and.returnValue(of(null)),
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
      { order_id: 'UPG-123', invoice_id: 123 }
    );
    expect(snapPay).toHaveBeenCalledWith('snap-refreshed', jasmine.any(Object));
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('creates Snap token using invoice id when initial pending invoice has null order id', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      data: {
        order_id: 'MID-22',
        snap_token: 'snap-initial',
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        invoice_code: '#5692979581',
        kode_pemesanan: '#5692979581',
        order_id: null,
        payment_status: 'pending',
        is_payable: true,
        payment_method: 'midtrans',
        resume: {
          type: 'midtrans_snap',
          available: true,
          payload: { order_id: null },
        },
        midtrans: {},
      },
      activePaymentMethods: [
        {
          type: 'midtrans',
          label: 'Bayar Online',
          details: { enabled: true, configured: true },
        },
      ],
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(dashboardService.create).toHaveBeenCalledWith(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      { invoice_id: 22 }
    );
    expect(snapPay).toHaveBeenCalledWith('snap-initial', jasmine.any(Object));
    expect(component.paymentUnavailableTitle).toBe('');
  });

  it('does not require resume data when Midtrans config is valid', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      success: true,
      data: {
        reused: true,
        snap_token: 'snap-from-config',
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        order_id: null,
        payment_status: 'pending',
        is_payable: true,
        resume: null,
      },
      activePaymentMethods: [
        {
          type: 'midtrans',
          label: 'Bayar Online',
          details: { enabled: true, configured: true },
        },
      ],
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(dashboardService.create).toHaveBeenCalledWith(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      { invoice_id: 22 }
    );
    expect(snapPay).toHaveBeenCalledWith('snap-from-config', jasmine.any(Object));
    expect(component.errorMessage).toBe('');
  });

  it('refreshes Snap token instead of failing locally when existing token has no client key', fakeAsync(() => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = undefined;
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      success: true,
      data: {
        snap_token: 'snap-refreshed',
        midtrans: { client_key: 'client-key' },
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        order_id: null,
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true },
        midtrans: { snap_token: 'snap-stale' },
      },
      paymentAction: 'continue_payment',
    } as any;
    spyOn<any>(component, 'loadSnapScript').and.callFake(() => {
      (window as any).snap = { pay: snapPay };
      return Promise.resolve();
    });

    component.continuePayment();
    flushMicrotasks();

    expect(dashboardService.create).toHaveBeenCalledWith(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      { invoice_id: 22 }
    );
    expect(snapPay).toHaveBeenCalledWith('snap-refreshed', jasmine.any(Object));
    expect(component.errorMessage).toBe('');
  }));

  it('opens Snap after create-snap-token returns reused token with null redirect url', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      success: true,
      data: {
        reused: true,
        invoice_id: 22,
        invitation_id: 22,
        order_id: '5692979581',
        payment_status: 'pending',
        redirect_url: null,
        snap_token: 'snap-reused',
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        order_id: null,
        payment_status: 'pending',
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true, payload: { invoice_id: 22 } },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(dashboardService.create).toHaveBeenCalledWith(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      { invoice_id: 22 }
    );
    expect(snapPay).toHaveBeenCalledWith('snap-reused', jasmine.any(Object));
    expect(component.paymentUnavailableTitle).toBe('');
    expect(component.errorMessage).toBe('');
  });

  it('waits for Snap script before calling snap.pay when window.snap is not ready', fakeAsync(() => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = undefined;
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      success: true,
      data: {
        reused: true,
        invoice_id: 22,
        redirect_url: null,
        snap_token: 'snap-after-load',
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true },
      },
      activePaymentMethods: [
        {
          type: 'midtrans',
          label: 'Bayar Online',
          details: { enabled: true, configured: true, client_key: 'client-key' },
        },
      ],
      paymentAction: 'continue_payment',
    } as any;
    spyOn<any>(component, 'loadSnapScript').and.callFake((clientKey: string) => {
      expect(clientKey).toBe('client-key');
      (window as any).snap = { pay: snapPay };
      return Promise.resolve();
    });

    component.continuePayment();
    flushMicrotasks();

    expect(snapPay).toHaveBeenCalledWith('snap-after-load', jasmine.any(Object));
    expect(component.paymentUnavailableTitle).toBe('');
    expect(component.errorMessage).toBe('');
  }));

  it('keeps one payment action while Snap script is still loading', fakeAsync(() => {
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      success: true,
      data: {
        invoice_id: 22,
        snap_token: 'snap-loading',
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true },
      },
      paymentAction: 'continue_payment',
    } as any;
    spyOn<any>(component, 'loadSnapScript').and.returnValue(new Promise<void>(() => undefined));

    component.continuePayment();
    component.continuePayment();
    flushMicrotasks();

    expect(dashboardService.create).toHaveBeenCalledTimes(1);
    expect(component.isContinuingPayment).toBeTrue();
  }));

  it('shows Snap open error when Snap script cannot be loaded', fakeAsync(() => {
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      success: true,
      data: {
        invoice_id: 22,
        snap_token: 'snap-script-fail',
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true },
      },
      paymentAction: 'continue_payment',
    } as any;
    spyOn<any>(component, 'loadSnapScript').and.returnValue(Promise.reject('SNAP_SCRIPT_NOT_LOADED'));

    component.continuePayment();
    flushMicrotasks();

    expect(dashboardService.create).toHaveBeenCalledTimes(1);
    expect(component.paymentUnavailableTitle).toBe('');
    expect(component.errorMessage).toBe('Pembayaran belum dapat dibuka. Silakan coba lagi.');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  }));

  it('keeps Midtrans available when manual payment is null', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      data: {
        order_id: 'MID-22',
        snap_token: 'snap-initial',
      },
    }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        order_id: null,
        payment_status: 'pending',
        is_payable: true,
        resume: {},
      },
      activePaymentMethods: [
        {
          type: 'midtrans',
          label: 'Bayar Online',
          details: { enabled: true, configured: true },
        },
      ],
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(dashboardService.create).toHaveBeenCalledWith(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      { invoice_id: 22 }
    );
    expect(component.paymentUnavailableTitle).toBe('');
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

  it('uses configured Midtrans when pending invoice has no provider', () => {
    const snapPay = jasmine.createSpy('pay');
    (window as any).snap = { pay: snapPay };
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({
      data: {
        reused: true,
        order_id: 'INV-125',
        snap_token: 'snap-configured',
      },
    }));
    component.paymentState = {
      pendingInvoice: {
        id: 125,
        invoice_code: 'INV-125',
        order_id: 'INV-125',
        is_payable: true,
        payment_method: null,
        provider: null,
        resume: {},
      },
      activePaymentMethods: [
        {
          type: 'midtrans',
          label: 'Bayar Online',
          details: { enabled: true, configured: true },
        },
      ],
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(dashboardService.create).toHaveBeenCalledWith(
      DashboardServiceType.MIDTRANS_CREATE_SNAP_TOKEN,
      { order_id: 'INV-125', invoice_id: 125 }
    );
    expect(snapPay).toHaveBeenCalledWith('snap-configured', jasmine.any(Object));
    expect(component.paymentUnavailableTitle).toBe('');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('shows unavailable only when neither Midtrans nor manual payment is available', () => {
    component.paymentState = {
      pendingInvoice: {
        id: 125,
        is_payable: true,
        payment_method: null,
        provider: null,
        resume: {},
      },
      activePaymentMethods: [],
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(component.paymentUnavailableTitle).toBe('Metode Pembayaran Belum Tersedia');
    expect((component as any).dashboardService.create).not.toHaveBeenCalled();
  });

  it('does not mask Snap token failures as unavailable payment method', () => {
    const dashboardService = (component as any).dashboardService;
    dashboardService.create.and.returnValue(of({ data: { order_id: 'MID-22' } }));
    component.paymentState = {
      invoiceId: 22,
      pendingInvoice: {
        id: 22,
        order_id: null,
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(component.paymentUnavailableTitle).toBe('');
    expect(component.errorMessage).toBe('Pembayaran belum dapat dibuka. Silakan coba lagi.');
  });

  it('does not show Snap failure before create-snap-token is called when invoice id is missing', () => {
    component.paymentState = {
      pendingInvoice: {
        order_id: null,
        is_payable: true,
        payment_method: 'midtrans',
        resume: { type: 'midtrans_snap', available: true },
      },
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect((component as any).dashboardService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Data tagihan tidak ditemukan. Silakan coba muat ulang.');
    expect(component.paymentUnavailableTitle).toBe('');
  });

  it('uses configured manual payment when Midtrans is unavailable', () => {
    component.paymentState = {
      pendingInvoice: {
        id: 125,
        amount: 150000,
        is_payable: true,
        payment_method: null,
        provider: null,
        resume: {},
      },
      activePaymentMethods: [
        {
          type: 'manual',
          label: 'Transfer Manual',
          details: {
            bank_name: 'BCA',
            account_number: '1234567890',
            account_name: 'Sena Digital',
          },
        },
      ],
      paymentAction: 'continue_payment',
    } as any;

    component.continuePayment();

    expect(component.manualPaymentModalOpen).toBeTrue();
    expect(component.manualPaymentBankName).toBe('BCA');
    expect((component as any).dashboardService.create).not.toHaveBeenCalled();
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
