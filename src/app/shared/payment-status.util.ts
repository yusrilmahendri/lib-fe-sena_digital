export interface PaymentState {
  isVerified: boolean;
  isPaymentActive: boolean;
  accountStatus: AccountAccessStatus;
  accountStatusLabel: string;
  paymentStatus: string;
  packageName: string;
  packageCode: string;
  activeUntil: string;
  remainingDays: number | null;
  isPaymentConfirmed: boolean;
  isExpired: boolean;
  featureAccess: any;
  domain: string;
  invoiceCode: string;
  transactionDate: string;
  hasInvoice: boolean;
  hasSelectedPaymentMethod: boolean;
  initialPaymentRequired: boolean;
  paymentAction: 'create_payment' | 'continue_payment' | 'retry_payment' | 'create_new_payment' | 'check_status';
  paymentUrl: string;
  amountLabel: string;
  pendingInvoice: any | null;
  resume: any | null;
  activePaymentMethods: PaymentMethodSummary[];
  isPayable: boolean;
}

export type AccountAccessStatus = 'unverified' | 'onboarding' | 'pending_payment' | 'expired' | 'active';

export interface PaymentMethodSummary {
  type: 'midtrans' | 'manual' | 'unknown';
  label: string;
  details: any;
}

const PAID_STATUSES = [
  'sb',
  'paid',
  'settlement',
  'capture',
  'success',
  'sukses',
  'lunas',
  'aktif',
  'active',
  'confirmed',
  'terkonfirmasi',
];

const PENDING_STATUSES = [
  'pending_payment',
  'pending',
  'waiting_payment',
  'menunggu',
  'menunggu konfirmasi',
  'menunggu pembayaran',
  'menunggu_pembayaran',
  'waiting',
  'belum selesai',
  'mk',
];

const DRAFT_PAYMENT_STATUSES = [
  'draft',
  'unselected',
  'no_payment_method',
  'belum pilih metode',
  'belum_pilih_metode',
  'not_paid',
  'unpaid',
  'belum lunas',
  'belum_lunas',
  'bl',
  '',
];

const EXPIRED_STATUSES = [
  'expired',
  'expire',
  'kedaluwarsa',
  'account_expired',
  'package_expired',
  'ex',
];

export function isAccountVerified(profile: any): boolean {
  const data = profile?.data || profile || {};
  const accountStatus = normalizeStatus(data.account_status);

  return !!(
    data.is_verified ||
    data.account_verified ||
    data.email_verified_at ||
    data.whatsapp_verified_at ||
    ['verified', 'verified_no_invoice', 'onboarding', 'active', 'pending_payment', 'expired'].includes(accountStatus)
  );
}

export function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function formatDateDisplay(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function isPaymentActive(profile: any): boolean {
  return resolvePaymentState(profile).accountStatus === 'active';
}

export function resolveAccountAccessStatus(profile: any): AccountAccessStatus {
  return resolvePaymentState(profile).accountStatus;
}

export function resolvePaymentState(profile: any): PaymentState {
  const data = profile?.data || profile || {};
  const pendingInvoice = data.pending_invoice || data.pendingInvoice || null;
  const isVerified = isAccountVerified(data);
  const accountStatusRaw = normalizeStatus(data.account_status);
  const subscriptionStatusRaw = normalizeStatus(firstText([
    data.subscription_status,
    data.current_subscription?.status,
    data.active_subscription?.status,
    data.subscription?.status,
    data.package_info?.subscription_status,
    data.package_info?.status,
    data.invitation_package?.subscription_status,
  ]));
  const paymentStatus = firstText([
    pendingInvoice?.payment_status,
    data.payment_status,
    data.invoice_status,
    data.status_bayar,
    data.status_pembayaran,
    data.paket_status,
    data.status_tagihan,
    data.transaction_status,
    data.package_info?.payment_status,
    data.package_info?.invoice_status,
    data.package_info?.status_pembayaran,
    data.invitation_package?.payment_status,
    data.invitation_package?.invoice_status,
    data.invitation_package?.status_pembayaran,
    data.tagihan?.status_bayar,
    data.tagihan?.payment_status,
    data.tagihan?.invoice_status,
    data.tagihan?.status_pembayaran,
    data.tagihan?.transaction_status,
    data.invoice?.status_bayar,
    data.invoice?.payment_status,
    data.invoice?.invoice_status,
    data.invoice?.status_pembayaran,
    data.invoice?.transaction_status,
    data.transaction?.status,
    data.transaction?.payment_status,
    data.transaction?.transaction_status,
  ]);
  const paymentStatusRaw = normalizeStatus(paymentStatus);
  const hasSelectedPaymentMethod = resolveHasSelectedPaymentMethod(data);
  const invoiceCode = firstText([
    pendingInvoice?.invoice_code,
    pendingInvoice?.order_id,
    data.no_invoice,
    data.invoice_number,
    data.invoice_code,
    data.kode_invoice,
    data.kode_pemesanan,
    data.order_id,
    data.transaksi_id,
    data.tagihan?.no_invoice,
    data.tagihan?.invoice_code,
    data.tagihan?.kode_invoice,
    data.tagihan?.kode_pemesanan,
    data.invoice?.no_invoice,
    data.invoice?.invoice_code,
    data.invoice?.kode_invoice,
    data.invoice?.kode_pemesanan,
  ]);
  const transactionDate = firstText([
    pendingInvoice?.created_at_formatted,
    data.tanggal_transaksi_formatted,
    data.transaction_date_formatted,
    data.created_at_formatted,
    data.tagihan?.tanggal_transaksi_formatted,
    data.tagihan?.created_at_formatted,
    data.invoice?.tanggal_transaksi_formatted,
    data.invoice?.created_at_formatted,
    data.tanggal_transaksi,
    data.transaction_date,
    data.created_at,
    data.tagihan?.tanggal_transaksi,
    data.tagihan?.created_at,
    data.invoice?.tanggal_transaksi,
    data.invoice?.created_at,
  ]);
  const hasInvoice = resolveHasInvoice(data, invoiceCode);
  const initialPaymentRequired = resolveInitialPaymentRequired(data, accountStatusRaw, paymentStatusRaw);
  const activePaymentMethods = resolveActivePaymentMethods(data);
  const paymentUrl = firstText([
    pendingInvoice?.payment_url,
    pendingInvoice?.redirect_url,
    pendingInvoice?.midtrans?.redirect_url,
    data.payment_url,
    data.invoice_url,
    data.redirect_url,
    data.checkout_url,
    data.snap_redirect_url,
    data.tagihan?.payment_url,
    data.tagihan?.invoice_url,
    data.tagihan?.redirect_url,
    data.invoice?.payment_url,
    data.invoice?.invoice_url,
    data.invoice?.redirect_url,
    data.transaction?.payment_url,
    data.transaction?.redirect_url,
  ]);
  const amountLabel = firstText([
    pendingInvoice?.amount_label,
    pendingInvoice?.total_label,
    data.amount_label,
    data.total_label,
    data.price_label,
    data.package_info?.price_label,
    data.invitation_package?.price_label,
    data.tagihan?.amount_label,
    data.tagihan?.total_label,
    data.invoice?.amount_label,
    data.invoice?.total_label,
  ]) || formatCurrency(firstNumber([
    pendingInvoice?.amount,
    pendingInvoice?.total,
    data.amount,
    data.total,
    data.price,
    data.package_info?.price,
    data.package_info?.harga,
    data.invitation_package?.price,
    data.invitation_package?.harga,
    data.tagihan?.amount,
    data.tagihan?.total,
    data.invoice?.amount,
    data.invoice?.total,
  ]));
  const activeUntil = firstText([
    data.active_until_formatted,
    data.domain_info?.expires_at_formatted,
    data.domain_end_date_formatted,
    data.expired_at_formatted,
    data.expires_at_formatted,
    data.package_info?.active_until_formatted,
    data.package_info?.expires_at_formatted,
    data.invitation_package?.active_until_formatted,
    data.invitation_package?.expires_at_formatted,
    data.active_until,
    data.domain_info?.expires_at,
    data.domain_end_date,
    data.expired_at,
    data.expires_at,
    data.package_info?.active_until,
    data.package_info?.expires_at,
    data.invitation_package?.active_until,
    data.invitation_package?.expires_at,
  ]);
  const remainingDays = firstNumber([
    data.remaining_days,
    data.domain_info?.days_until_expiry,
    data.package_info?.remaining_days,
    data.invitation_package?.remaining_days,
  ]);
  const isExpired = !!(
    data.is_expired === true ||
    EXPIRED_STATUSES.includes(accountStatusRaw) ||
    EXPIRED_STATUSES.includes(paymentStatusRaw) ||
    (remainingDays !== null && remainingDays < 1 && !!activeUntil)
  );
  const hasActiveEntitlement = resolveHasActiveEntitlement(data, accountStatusRaw, subscriptionStatusRaw, initialPaymentRequired);
  const isPaymentConfirmed = hasActiveEntitlement;
  const accountStatus = resolveStatus({
    isVerified,
    isExpired,
    isPaymentConfirmed,
    accountStatusRaw,
    subscriptionStatusRaw,
    paymentStatusRaw,
    hasInvoice,
    hasSelectedPaymentMethod,
    initialPaymentRequired,
  });

  return {
    isVerified,
    isPaymentActive: accountStatus === 'active',
    accountStatus,
    accountStatusLabel: accountStatusLabel(accountStatus),
    paymentStatus,
    packageName: firstText([
      data.package_name,
      data.package_info?.name,
      data.package_info?.jenis_paket,
      data.package_info?.name_paket,
      data.package_info?.name_paket_display,
      data.invitation_package?.name,
      data.invitation_package?.name_paket,
      data.invitation_package?.jenis_paket,
      data.paket?.name,
      data.paket_undangan?.name,
    ]),
    packageCode: firstText([
      data.package_code,
      data.package_info?.package_code,
      data.package_info?.package_tier,
      data.package_info?.kode_paket,
      data.invitation_package?.package_code,
      data.invitation_package?.package_tier,
      data.paket?.package_code,
      data.paket_undangan?.package_code,
    ]),
    activeUntil: formatDateDisplay(activeUntil),
    remainingDays,
    isPaymentConfirmed,
    isExpired,
    featureAccess: data.feature_access ?? data.package_info?.feature_access ?? data.invitation_package?.feature_access ?? null,
    domain: firstText([
      data.domain_info?.domain,
      data.domain,
      data.website_domain,
      data.wedding_profile?.domain,
    ]),
    invoiceCode,
    transactionDate: formatDateDisplay(transactionDate),
    hasInvoice,
    hasSelectedPaymentMethod,
    initialPaymentRequired,
    paymentAction: resolvePaymentAction({ paymentStatusRaw, hasInvoice, hasSelectedPaymentMethod, initialPaymentRequired, paymentUrl }),
    paymentUrl,
    amountLabel,
    pendingInvoice,
    resume: pendingInvoice?.resume || null,
    activePaymentMethods,
    isPayable: pendingInvoice?.is_payable !== false,
  };
}

export function resolvePaymentRedirect(profile: any, paymentRoute = '/pilih-paket'): string {
  const data = profile?.data || profile || {};
  const backendRedirectUrl = firstText([
    data.redirect_url,
    data.next_url,
    data.redirect,
  ]);
  const state = resolvePaymentState(data);

  if (state.accountStatus === 'pending_payment') return '/dashboard/payment-pending';
  if (state.accountStatus === 'expired') return '/dashboard/account-expired';

  if (backendRedirectUrl) {
    if (normalizePath(backendRedirectUrl) === '/dashboard/payment-pending') {
      return paymentRoute;
    }
    return backendRedirectUrl;
  }

  if (state.accountStatus === 'unverified') return '/verify-account';
  if (state.accountStatus === 'active') return '/dashboard/overview';
  return paymentRoute;
}

export function resolvePostVerificationPaymentRedirect(profile: any, paymentRoute = '/pilih-paket'): string {
  const data = profile?.data || profile || {};
  const backendRedirectUrl = firstText([
    data.redirect_url,
    data.next_url,
    data.redirect,
  ]);
  const state = resolvePaymentState(data);

  if (state.accountStatus === 'unverified') return '/verify-account';
  if (state.accountStatus === 'active') return '/dashboard/overview';
  if (state.accountStatus === 'expired') return '/dashboard/account-expired';

  if (backendRedirectUrl && normalizePath(backendRedirectUrl) !== '/dashboard/payment-pending') {
    return backendRedirectUrl;
  }

  return paymentRoute;
}

function resolveStatus(state: {
  isVerified: boolean;
  isExpired: boolean;
  isPaymentConfirmed: boolean;
  accountStatusRaw: string;
  subscriptionStatusRaw: string;
  paymentStatusRaw: string;
  hasInvoice: boolean;
  hasSelectedPaymentMethod: boolean;
  initialPaymentRequired: boolean;
}): AccountAccessStatus {
  if (!state.isVerified) return 'unverified';
  if (state.initialPaymentRequired && !state.isPaymentConfirmed) return 'pending_payment';
  if (state.isExpired) return 'expired';
  if (state.accountStatusRaw === 'active' && state.isPaymentConfirmed) return 'active';
  if (state.subscriptionStatusRaw === 'active' && state.isPaymentConfirmed) return 'active';
  if (state.accountStatusRaw === 'onboarding') return 'onboarding';
  if (state.isPaymentConfirmed) return 'active';
  if (DRAFT_PAYMENT_STATUSES.includes(state.paymentStatusRaw)) return 'onboarding';
  if (
    (state.hasInvoice || state.hasSelectedPaymentMethod) &&
    (
      state.accountStatusRaw === 'pending_payment' ||
      PENDING_STATUSES.includes(state.accountStatusRaw) ||
      PENDING_STATUSES.includes(state.paymentStatusRaw)
    )
  ) {
    return 'pending_payment';
  }

  return 'onboarding';
}

function accountStatusLabel(status: AccountAccessStatus): string {
  switch (status) {
    case 'active':
      return 'Aktif';
    case 'expired':
      return 'Expired';
    case 'pending_payment':
      return 'Menunggu Pembayaran';
    case 'onboarding':
      return 'Onboarding';
    default:
      return 'Belum Verifikasi';
  }
}

function resolveHasInvoice(data: any, invoiceCode: string): boolean {
  if (data.has_invoice === false || data.invoice_exists === false || data.has_tagihan === false) return false;
  if (data.has_invoice === true || data.invoice_exists === true || data.has_tagihan === true) return true;
  if (hasObjectValue(data.pending_invoice) || hasObjectValue(data.pendingInvoice)) return true;
  if (invoiceCode) return true;
  if (hasObjectValue(data.invoice) || hasObjectValue(data.tagihan)) return true;

  return false;
}

function resolveHasSelectedPaymentMethod(data: any): boolean {
  const pendingInvoice = data.pending_invoice || data.pendingInvoice || null;
  return !!firstText([
    pendingInvoice?.payment_method,
    pendingInvoice?.provider,
    pendingInvoice?.payment_provider,
    pendingInvoice?.resume?.type,
    pendingInvoice?.midtrans?.snap_token,
    data.payment_method,
    data.payment_method_id,
    data.payment_gateway,
    data.metode_pembayaran,
    data.metode_pembayaran_id,
    data.id_methode_pembayaran,
    data.manual_payment_selected === true ? 'manual' : '',
    data.midtrans_order_id,
    data.snap_token,
    data.snap_redirect_url,
    data.transaction?.payment_method,
    data.transaction?.payment_method_id,
    data.transaction?.payment_gateway,
    data.transaction?.midtrans_order_id,
    data.tagihan?.payment_method,
    data.tagihan?.payment_method_id,
    data.tagihan?.payment_gateway,
    data.tagihan?.metode_pembayaran,
    data.tagihan?.metode_pembayaran_id,
    data.tagihan?.id_methode_pembayaran,
    data.tagihan?.metode_transaction?.id,
    data.tagihan?.metode_transaction?.name,
    data.tagihan?.midtrans_order_id,
    data.tagihan?.snap_token,
    data.invoice?.payment_method,
    data.invoice?.payment_method_id,
    data.invoice?.payment_gateway,
    data.invoice?.metode_pembayaran,
    data.invoice?.metode_pembayaran_id,
    data.invoice?.id_methode_pembayaran,
    data.invoice?.metode_transaction?.id,
    data.invoice?.metode_transaction?.name,
    data.invoice?.midtrans_order_id,
    data.invoice?.snap_token,
  ]);
}

function resolveInitialPaymentRequired(data: any, accountStatusRaw: string, paymentStatusRaw: string): boolean {
  if (
    data.initial_payment_required === true ||
    data.payment_required === true ||
    data.payment_requirement === 'required' ||
    data.payment_requirement?.required === true ||
    data.requires_initial_payment === true ||
    data.needs_initial_payment === true ||
    data.package_info?.initial_payment_required === true ||
    data.package_info?.payment_required === true ||
    data.package_info?.payment_requirement === 'required' ||
    data.invitation_package?.initial_payment_required === true ||
    data.invitation_package?.payment_required === true
  ) {
    return true;
  }

  return (
    accountStatusRaw === 'pending_payment' ||
    accountStatusRaw === 'waiting_payment' ||
    accountStatusRaw === 'unpaid' ||
    paymentStatusRaw === 'pending_payment'
  );
}

function resolveHasActiveEntitlement(data: any, accountStatusRaw: string, subscriptionStatusRaw: string, initialPaymentRequired: boolean): boolean {
  if (initialPaymentRequired) return false;

  const explicitActiveStatus = accountStatusRaw === 'active' || subscriptionStatusRaw === 'active';
  const explicitlyPending =
    PENDING_STATUSES.includes(accountStatusRaw) ||
    PENDING_STATUSES.includes(subscriptionStatusRaw) ||
    PENDING_STATUSES.includes(normalizeStatus(data.package_info?.payment_status)) ||
    PENDING_STATUSES.includes(normalizeStatus(data.invitation_package?.payment_status));

  if (explicitlyPending) return false;

  return !!(
    explicitActiveStatus ||
    data.current_package?.is_active === true ||
    data.active_subscription?.status === 'active' ||
    data.current_subscription?.status === 'active' ||
    data.subscription?.status === 'active' ||
    data.entitlement?.is_active === true ||
    data.feature_access?.is_active === true
  );
}

function resolveActivePaymentMethods(data: any): PaymentMethodSummary[] {
  const methods: PaymentMethodSummary[] = [];
  const addMethod = (rawType: unknown, details: any) => {
    const type = normalizePaymentMethodType(rawType);
    if (!type || !isPaymentMethodEnabled(details)) return;
    if (methods.some((method) => method.type === type)) return;
    methods.push({
      type,
      label: type === 'manual' ? 'Transfer Manual' : type === 'midtrans' ? 'Bayar Online' : 'Metode Pembayaran',
      details,
    });
  };

  const sources = [
    data.payment_methods,
    data.available_payment_methods,
    data.active_payment_methods,
    data.payment_config?.payment_methods,
    data.payment_config?.methods,
  ];

  sources.forEach((source) => {
    if (!Array.isArray(source)) return;
    source.forEach((item) => addMethod(item?.payment_method || item?.method || item?.code || item?.type || item?.name, item));
  });

  const config = data.payment_config || data.paymentConfig || data;
  addMethod(config?.payment_method, config);
  if (config?.midtrans || config?.midtrans_payment || config?.snap) {
    addMethod('midtrans', config.midtrans || config.midtrans_payment || config.snap);
  }
  if (config?.manual_payment || config?.manual || config?.rekening || config?.bank_account) {
    addMethod('manual', config.manual_payment || config.manual || config.rekening || config.bank_account);
  }

  return methods;
}

function normalizePaymentMethodType(value: unknown): PaymentMethodSummary['type'] | null {
  const normalized = normalizeStatus(value).replace(/[-\s]+/g, '_');
  if (!normalized) return null;
  if (normalized.includes('midtrans') || normalized.includes('snap') || normalized.includes('online')) return 'midtrans';
  if (normalized.includes('manual') || normalized.includes('bank') || normalized.includes('transfer')) return 'manual';
  return 'unknown';
}

function isPaymentMethodEnabled(value: any): boolean {
  if (value === false || value === null || value === undefined) return false;
  if (value === true) return true;
  const status = normalizeStatus(value?.status || value?.is_active || value?.enabled || value?.active);
  if (!status) return true;
  return !['0', 'false', 'inactive', 'disabled', 'off', 'nonaktif'].includes(status);
}

function resolvePaymentAction(state: {
  paymentStatusRaw: string;
  hasInvoice: boolean;
  hasSelectedPaymentMethod: boolean;
  initialPaymentRequired: boolean;
  paymentUrl: string;
}): PaymentState['paymentAction'] {
  if (EXPIRED_STATUSES.includes(state.paymentStatusRaw)) return 'create_new_payment';
  if (['failed', 'failure', 'gagal', 'deny', 'denied', 'cancel', 'cancelled'].includes(state.paymentStatusRaw)) return 'retry_payment';
  if (state.hasInvoice || state.hasSelectedPaymentMethod || state.paymentUrl) return 'continue_payment';
  if (state.initialPaymentRequired) return 'create_payment';
  return 'check_status';
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizePath(url: string): string {
  return (url || '').split('?')[0].split('#')[0].replace(/\/+$/, '');
}

function hasObjectValue(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value as Record<string, unknown>).length > 0;
}

function firstNumber(values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const numberValue = Number(value);
    if (!Number.isNaN(numberValue)) return numberValue;
  }

  return null;
}

function firstText(values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && text !== '-' && text !== '–') {
      return text;
    }
  }

  return '';
}
