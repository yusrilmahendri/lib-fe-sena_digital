export interface AdminInvoiceRow {
  id: number;
  invoice: string;
  invoicePayload: string;
  hasInvoice: boolean;
  pengguna: string;
  domain: string;
  statusCode: string | null;
  normalizedStatus: string;
  statusData: {
    text: string;
    class: string;
    ariaLabel: string;
  };
  konfirmasiAktif: boolean;
  originalData: any;
}

export const ADMIN_MISSING_INVOICE_MESSAGE = 'Invoice/tagihan pengguna belum tersedia.';

export interface AdminDashboardMetrics {
  totalUsers: number;
  pendingRequests: number;
  totalRevenue: number;
  pagination: any;
}

export interface AdminDashboardNormalizedResponse {
  records: any[];
  rows: AdminInvoiceRow[];
  metrics: AdminDashboardMetrics;
}

export function normalizeAdminDashboardResponse(response: any, paketList: any[] = []): AdminDashboardNormalizedResponse {
  const records = findAdminArray(response);
  const pagination = response?.pagination ?? response?.data?.pagination ?? null;
  const rows = records.map((item) => mapAdminInvoiceRow(item));
  const metrics = buildAdminMetrics(response, records, rows, paketList, pagination);

  return {
    records,
    rows,
    metrics,
  };
}

export function findAdminArray(response: any): any[] {
  const candidates = [
    response,
    response?.data,
    response?.data?.data,
    response?.result,
    response?.payments,
    response?.tagihan,
    response?.data?.result,
    response?.data?.payments,
    response?.data?.tagihan,
    response?.users,
    response?.users?.data,
    response?.data?.users,
    response?.data?.users?.data,
  ];

  const direct = candidates.find((candidate) => Array.isArray(candidate));
  return direct || [];
}

export function mapAdminInvoiceRow(item: any): AdminInvoiceRow {
  const rawStatus = firstValue([
    item?.status,
    item?.status_bayar,
    item?.payment_status,
    item?.transaction_status,
    item?.kd_status,
  ]);
  const normalizedStatus = normalizePaymentStatus(rawStatus);
  const invoicePayload = normalizeInvoicePayload(firstString([
    item?.no_invoice,
    item?.invoice_number,
    item?.kode_invoice,
    item?.kode_pemesanan,
    item?.invoice,
    item?.order_id,
    item?.tagihan?.kode_pemesanan,
    item?.tagihan?.kode_invoice,
    item?.tagihan?.no_invoice,
    item?.tagihan?.invoice_number,
    item?.tagihan?.order_id,
    item?.invoice_data?.kode_pemesanan,
    item?.invoice_data?.kode_invoice,
    item?.invoice_data?.no_invoice,
    item?.invoice_data?.invoice_number,
    item?.invoice_data?.order_id,
    item?.invoice?.kode_pemesanan,
    item?.invoice?.kode_invoice,
    item?.invoice?.no_invoice,
    item?.invoice?.invoice_number,
    item?.invoice?.order_id,
    item?.user?.kode_pemesanan,
    item?.user?.kode_invoice,
    item?.user?.no_invoice,
    item?.user?.invoice_number,
    item?.user?.order_id,
    item?.transaksi_id,
  ]));
  const invoice = invoicePayload ? formatInvoiceDisplay(invoicePayload) : ADMIN_MISSING_INVOICE_MESSAGE;

  return {
    id: toNumber(item?.id ?? item?.user_id ?? item?.user?.id),
    invoice,
    invoicePayload,
    hasInvoice: !!invoicePayload,
    pengguna: firstString([
      item?.nama,
      item?.user_name,
      item?.user?.name,
      item?.name,
      item?.email,
      item?.user?.email,
    ]) || '–',
    domain: firstString([
      item?.domain,
      item?.user?.domain,
      item?.website_domain,
    ]) || '–',
    statusCode: rawStatus === null || rawStatus === undefined ? null : String(rawStatus),
    normalizedStatus,
    statusData: getStatusDataFromNormalized(normalizedStatus),
    konfirmasiAktif: !!invoicePayload && !isPaidStatus(normalizedStatus),
    originalData: item,
  };
}

export function normalizeInvoicePayload(value: unknown): string {
  const invoice = String(value ?? '').trim();

  if (!invoice || invoice === '-' || invoice === '–') {
    return '';
  }

  return invoice.replace(/^#+/, '');
}

export function formatInvoiceDisplay(value: unknown): string {
  const invoice = normalizeInvoicePayload(value);
  return invoice ? `#${invoice}` : ADMIN_MISSING_INVOICE_MESSAGE;
}

export function normalizePaymentStatus(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (['sb', 'paid', 'settlement', 'capture', 'success', 'sukses', 'lunas', 'aktif'].includes(normalized)) {
    return 'paid';
  }
  if (['mk', 'pending', 'menunggu', 'menunggu konfirmasi', 'challenge', 'process', 'processing'].includes(normalized)) {
    return 'pending';
  }
  if (['bl', 'unpaid', 'belum lunas', 'belum_lunas', 'not_paid'].includes(normalized)) {
    return 'unpaid';
  }
  if (['ex', 'expired', 'expire', 'kedaluwarsa', 'cancel', 'cancelled', 'canceled', 'deny', 'failure', 'failed'].includes(normalized)) {
    return 'expired';
  }

  return normalized || 'unknown';
}

export function getStatusDataFromNormalized(status: string): { text: string; class: string; ariaLabel: string } {
  switch (status) {
    case 'paid':
      return {
        text: 'Aktif',
        class: 'aktif',
        ariaLabel: 'Status Aktif',
      };
    case 'pending':
      return {
        text: 'Menunggu Konfirmasi',
        class: 'waiting',
        ariaLabel: 'Status Menunggu Konfirmasi',
      };
    case 'unpaid':
      return {
        text: 'Belum Lunas',
        class: 'unpaid',
        ariaLabel: 'Status Belum Lunas',
      };
    case 'expired':
      return {
        text: 'Expired',
        class: 'expired',
        ariaLabel: 'Status Expired',
      };
    default:
      return {
        text: 'Belum selesai',
        class: 'pending',
        ariaLabel: 'Status Belum selesai',
      };
  }
}

function buildAdminMetrics(
  response: any,
  records: any[],
  rows: AdminInvoiceRow[],
  paketList: any[],
  pagination: any
): AdminDashboardMetrics {
  const explicitTotalUsers = toOptionalNumber(firstValue([
    response?.total_users,
    response?.total_pengguna,
    response?.data?.total_users,
    response?.data?.total_pengguna,
    response?.filters?.total_users,
    pagination?.total,
  ]));
  const explicitPending = toOptionalNumber(firstValue([
    response?.pending_req,
    response?.pending_request,
    response?.pending_requests,
    response?.data?.pending_req,
    response?.data?.pending_request,
    response?.data?.pending_requests,
  ]));
  const pendingByLegacyBucket =
    toOptionalNumber(response?.jumlah_belum_lunas_dan_pending?.BL) ??
    toOptionalNumber(response?.data?.jumlah_belum_lunas_dan_pending?.BL);
  const waitingByLegacyBucket =
    toOptionalNumber(response?.jumlah_belum_lunas_dan_pending?.MK) ??
    toOptionalNumber(response?.data?.jumlah_belum_lunas_dan_pending?.MK);
  const explicitRevenue = toOptionalNumber(firstValue([
    response?.total_keuntungan,
    response?.total_profit,
    response?.total_revenue,
    response?.salary,
    response?.data?.total_keuntungan,
    response?.data?.total_profit,
    response?.data?.total_revenue,
    response?.data?.salary,
  ]));
  const pendingFromLegacyBuckets = (pendingByLegacyBucket ?? 0) + (waitingByLegacyBucket ?? 0);
  const pendingFromRows = rows.filter((row) => row.normalizedStatus === 'pending' || row.normalizedStatus === 'unpaid').length;

  return {
    totalUsers: explicitTotalUsers ?? records.length,
    pendingRequests: explicitPending ?? (pendingFromLegacyBuckets > 0 ? pendingFromLegacyBuckets : pendingFromRows),
    totalRevenue: explicitRevenue ?? computeRevenue(records, rows, paketList),
    pagination,
  };
}

function computeRevenue(records: any[], rows: AdminInvoiceRow[], paketList: any[]): number {
  return records.reduce((total, item, index) => {
    if (!isPaidStatus(rows[index]?.normalizedStatus)) {
      return total;
    }

    const directAmount = toOptionalNumber(firstValue([
      item?.total,
      item?.amount,
      item?.gross_amount,
      item?.price,
      item?.harga,
      item?.nominal,
      item?.tagihan,
      item?.payment?.amount,
    ]));
    if (directAmount !== null) {
      return total + directAmount;
    }

    const paketId = String(item?.paket_undangan_id ?? item?.package_id ?? item?.paket?.id ?? '');
    const paket = paketList.find((candidate) => String(candidate?.id ?? '') === paketId);
    const paketPrice = toOptionalNumber(paket?.price ?? paket?.harga ?? paket?.amount);
    return total + (paketPrice ?? 0);
  }, 0);
}

function isPaidStatus(status: string): boolean {
  return status === 'paid';
}

function firstValue(values: unknown[]): unknown {
  return values.find((value) => value !== null && value !== undefined && value !== '');
}

function firstString(values: unknown[]): string | null {
  const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
  if (typeof value === 'string') return value.trim();
  const numeric = values.find((item) => typeof item === 'number' && Number.isFinite(item));
  return typeof numeric === 'number' ? String(numeric) : null;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
