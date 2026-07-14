export function getFriendlyErrorMessage(error: any): string {
  const code = String(error?.error?.code || error?.error?.error_code || '').trim().toUpperCase();
  const message = sanitizeApiMessage(error?.error?.message);

  if (code === 'PAYMENT_NOT_CONFIRMED') {
    return 'Pembayaran belum dikonfirmasi. Silakan lakukan pembayaran terlebih dahulu. Jika sudah membayar, hubungi admin Sena Digital.';
  }

  if (code === 'ACCOUNT_EXPIRED') {
    return 'Masa aktif paket Anda telah berakhir. Silakan perpanjang paket untuk melanjutkan.';
  }

  if (code === 'THEME_UPGRADE_REQUIRED') {
    return 'Tema ini membutuhkan upgrade paket.';
  }

  if (code === 'ACCOUNT_NOT_VERIFIED') {
    return 'Akun Anda belum diverifikasi. Silakan verifikasi email terlebih dahulu.';
  }

  if (error?.status === 401) {
    return 'Sesi login habis. Silakan masuk kembali.';
  }

  if (error?.status === 403) {
    return message || 'Akses belum tersedia untuk akun Anda.';
  }

  if (error?.status === 422) {
    return message || 'Beberapa data belum sesuai. Mohon periksa kembali input Anda.';
  }

  if (error?.status === 413) {
    return 'Ukuran file terlalu besar.';
  }

  if (error?.status >= 500) {
    return 'Terjadi gangguan pada server. Silakan coba beberapa saat lagi.';
  }

  return message || 'Terjadi kesalahan. Silakan coba lagi.';
}

function sanitizeApiMessage(value: unknown): string {
  const message = typeof value === 'string' ? value.trim() : '';

  if (!message) {
    return '';
  }

  if (/http failure response/i.test(message) || /^https?:\/\//i.test(message) || /\b\d{3}\s+OK\b/i.test(message)) {
    return '';
  }

  return message;
}
