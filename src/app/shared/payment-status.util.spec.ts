import { resolvePaymentState } from './payment-status.util';

describe('payment-status util', () => {
  it('maps verified users without invoice to onboarding', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'onboarding',
        is_verified: true,
        has_invoice: false,
      },
    });

    expect(state.accountStatus).toBe('onboarding');
    expect(state.hasInvoice).toBeFalse();
  });

  it('does not map verified users without invoice to pending payment', () => {
    const state = resolvePaymentState({
      data: {
        is_verified: true,
        payment_status: '',
      },
    });

    expect(state.accountStatus).toBe('onboarding');
  });

  it('maps pending payment only when an invoice exists', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'pending_payment',
        is_verified: true,
        has_invoice: true,
        payment_status: 'pending',
      },
    });

    expect(state.accountStatus).toBe('pending_payment');
    expect(state.hasInvoice).toBeTrue();
  });

  it('keeps active users active', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'active',
        is_verified: true,
      },
    });

    expect(state.accountStatus).toBe('active');
  });
});
