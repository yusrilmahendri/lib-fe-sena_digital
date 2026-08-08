import { BillUserComponent } from './bill-user.component';

describe('BillUserComponent', () => {
  let component: BillUserComponent;
  let router: any;

  beforeEach(() => {
    router = {
      navigate: jasmine.createSpy('navigate'),
      navigateByUrl: jasmine.createSpy('navigateByUrl'),
    };
    component = new BillUserComponent(
      { getProfile: jasmine.createSpy('getProfile') } as any,
      { snapshot: { data: {} } } as any,
      router
    );
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
});
