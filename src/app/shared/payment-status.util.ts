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
}

export type AccountAccessStatus = 'unverified' | 'onboarding' | 'pending_payment' | 'expired' | 'active';

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
  'menunggu',
  'menunggu konfirmasi',
  'waiting',
  'unpaid',
  'belum lunas',
  'belum_lunas',
  'not_paid',
  'bl',
  'mk',
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
    ['onboarding', 'active', 'pending_payment', 'expired'].includes(accountStatus)
  );
}

export function normalizeStatus(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isPaymentActive(profile: any): boolean {
  return resolvePaymentState(profile).accountStatus === 'active';
}

export function resolveAccountAccessStatus(profile: any): AccountAccessStatus {
  return resolvePaymentState(profile).accountStatus;
}

export function resolvePaymentState(profile: any): PaymentState {
  const data = profile?.data || profile || {};
  const isVerified = isAccountVerified(data);
  const accountStatusRaw = normalizeStatus(data.account_status);
  const paymentStatus = firstText([
    data.payment_status,
    data.status_bayar,
    data.paket_status,
    data.status_tagihan,
    data.package_info?.payment_status,
    data.invitation_package?.payment_status,
    data.tagihan?.status_bayar,
    data.tagihan?.payment_status,
    data.invoice?.status_bayar,
    data.invoice?.payment_status,
  ]);
  const paymentStatusRaw = normalizeStatus(paymentStatus);
  const invoiceCode = firstText([
    data.no_invoice,
    data.invoice_number,
    data.kode_invoice,
    data.kode_pemesanan,
    data.order_id,
    data.transaksi_id,
    data.tagihan?.no_invoice,
    data.tagihan?.kode_invoice,
    data.tagihan?.kode_pemesanan,
    data.invoice?.no_invoice,
    data.invoice?.kode_invoice,
    data.invoice?.kode_pemesanan,
  ]);
  const transactionDate = firstText([
    data.tanggal_transaksi,
    data.transaction_date,
    data.created_at,
    data.tagihan?.tanggal_transaksi,
    data.tagihan?.created_at,
    data.invoice?.tanggal_transaksi,
    data.invoice?.created_at,
  ]);
  const hasInvoice = resolveHasInvoice(data, invoiceCode);
  const activeUntil = firstText([
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
  const isPaymentConfirmed = !!(
    data.is_payment_confirmed === true ||
    data.is_paid === true ||
    data.payment_confirmed_at ||
    data.domain_info?.payment_confirmed_at ||
    data.package_info?.is_active === true ||
    PAID_STATUSES.includes(paymentStatusRaw)
  );
  const accountStatus = resolveStatus({
    isVerified,
    isExpired,
    isPaymentConfirmed,
    accountStatusRaw,
    paymentStatusRaw,
    hasInvoice,
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
    activeUntil,
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
    transactionDate,
    hasInvoice,
  };
}

function resolveStatus(state: {
  isVerified: boolean;
  isExpired: boolean;
  isPaymentConfirmed: boolean;
  accountStatusRaw: string;
  paymentStatusRaw: string;
  hasInvoice: boolean;
}): AccountAccessStatus {
  if (!state.isVerified) return 'unverified';
  if (state.isExpired) return 'expired';
  if (state.accountStatusRaw === 'active') return 'active';
  if (state.accountStatusRaw === 'onboarding') return 'onboarding';
  if (state.isPaymentConfirmed) return 'active';
  if (
    state.hasInvoice &&
    (state.accountStatusRaw === 'pending_payment' ||
      PENDING_STATUSES.includes(state.accountStatusRaw) ||
      PENDING_STATUSES.includes(state.paymentStatusRaw))
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
  if (invoiceCode) return true;
  if (hasObjectValue(data.invoice) || hasObjectValue(data.tagihan)) return true;

  return false;
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
