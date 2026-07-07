export const DEFAULT_SALAM_PEMBUKA = `Assalamu'alaikum Warahmatullahi Wabarakatuh.

Dengan memohon Rahmat dan Ridho Allah SWT, Kami akan menyelenggarakan resepsi pernikahan Putra-Putri kami :`;

export const DEFAULT_SALAM_ATAS = `Assalamualaikum Wr Wb.
Dengan segala kerendahan hati dan syukur atas Karunia Allah SWT.
Kami bermaksud mengundang Bapak/Ibu/Saudara/i, teman sekaligus sahabat, untuk menghadiri acara pernikahan kami :`;

export const DEFAULT_SALAM_BAWAH = `Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.
Wassalamualaikum Wr Wb.`;

export function normalizeSalamValue(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function resolveSalamPembuka(value: unknown): string {
  return normalizeSalamValue(value, DEFAULT_SALAM_PEMBUKA).replace(/\r\n/g, '\n');
}

export function resolveSalamAtas(value: unknown): string {
  return normalizeSalamValue(value, DEFAULT_SALAM_ATAS).replace(/\r\n/g, '\n');
}

export function resolveSalamBawah(value: unknown): string {
  return normalizeSalamValue(value, DEFAULT_SALAM_BAWAH).replace(/\r\n/g, '\n');
}
