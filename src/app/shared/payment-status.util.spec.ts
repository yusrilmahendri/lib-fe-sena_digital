import { resolvePaymentRedirect, resolvePaymentState, resolvePostVerificationPaymentRedirect } from './payment-status.util';

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

  it('maps initial unpaid account to pending payment even before a transaction exists', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'pending_payment',
        is_verified: true,
        initial_payment_required: true,
        has_invoice: false,
        package_info: {
          name: 'Sapphire',
          price: 150000,
        },
      },
    });

    expect(state.accountStatus).toBe('pending_payment');
    expect(state.isExpired).toBeFalse();
    expect(state.paymentAction).toBe('create_payment');
    expect(state.packageName).toBe('Sapphire');
    expect(state.amountLabel.replace(/\s/g, '')).toBe('Rp150.000');
  });

  it('prioritizes initial unpaid over expired account state', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'expired',
        is_verified: true,
        initial_payment_required: true,
        is_expired: true,
      },
    });

    expect(state.accountStatus).toBe('pending_payment');
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

  it('keeps initial unpaid Diamond users pending even when package info looks active', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'active',
        is_verified: true,
        payment_required: true,
        package_info: {
          name: 'Diamond',
          package_code: 'diamond',
          is_active: true,
          payment_status: 'pending',
          price: 10000,
        },
      },
    });

    expect(state.accountStatus).toBe('pending_payment');
    expect(state.isPaymentActive).toBeFalse();
    expect(state.packageName).toBe('Diamond');
    expect(state.accountStatusLabel).toBe('Menunggu Pembayaran');
  });

  it('does not activate from paid transaction status before backend entitlement is active', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'pending_payment',
        is_verified: true,
        initial_payment_required: true,
        pending_invoice: {
          payment_status: 'settlement',
          package_code: 'diamond',
        },
        package_info: {
          name: 'Diamond',
          payment_status: 'pending',
        },
      },
    });

    expect(state.accountStatus).toBe('pending_payment');
    expect(state.isPaymentActive).toBeFalse();
  });

  it('activates only when backend returns active entitlement without payment requirement', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'active',
        is_verified: true,
        subscription_status: 'active',
        current_package: {
          name: 'Diamond',
          package_code: 'diamond',
          is_active: true,
        },
      },
    });

    expect(state.accountStatus).toBe('active');
    expect(state.isPaymentActive).toBeTrue();
  });

  it('exposes active payment methods when no pending invoice exists', () => {
    const state = resolvePaymentState({
      data: {
        account_status: 'pending_payment',
        is_verified: true,
        payment_required: true,
        payment_config: {
          midtrans: { enabled: true },
          manual_payment: { enabled: true, bank_name: 'BCA' },
        },
      },
    });

    expect(state.paymentAction).toBe('create_payment');
    expect(state.activePaymentMethods.map((method) => method.type)).toEqual(['midtrans', 'manual']);
  });

  it('keeps login resume pending-payment users on the dashboard payment page', () => {
    const route = resolvePaymentRedirect({
      data: {
        account_status: 'pending_payment',
        is_verified: true,
        initial_payment_required: true,
        pending_invoice: { id: 12, payment_status: 'pending' },
      },
    });

    expect(route).toBe('/dashboard/payment-pending');
  });

  it('sends post-verification pending-payment users to the payment wizard', () => {
    const route = resolvePostVerificationPaymentRedirect({
      data: {
        account_status: 'pending_payment',
        is_verified: true,
        initial_payment_required: true,
        pending_invoice: { id: 12, payment_status: 'pending' },
      },
    });

    expect(route).toBe('/pilih-paket');
  });
});
