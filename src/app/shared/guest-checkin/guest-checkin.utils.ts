export interface GuestInvitationRecord {
  name: string;
  url: string;
  guest_name: string;
  invitation_url: string;
  checkin_url: string;
  guest_token: string;
  checked_in_at: string | null;
  checkin_count: number;
  createdAt: string;
}

export interface CurrentGuestContext {
  guest_name: string;
  guest_token: string;
  checkin_url: string;
  invitation_url?: string;
  checked_in_at?: string | null;
  checkin_count?: number;
}

export function generateGuestToken(): string {
  const random = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function slugifyGuestName(name: string): string {
  const slug = String(name || 'tamu')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'tamu';
}

export function extractTokenFromInvitationUrl(url?: string): string {
  if (!url) {
    return '';
  }

  try {
    return String(new URL(url).searchParams.get('token') || '').trim();
  } catch {
    const match = String(url).match(/[?&]token=([^&]+)/i);
    return match ? decodeURIComponent(match[1]).trim() : '';
  }
}

export function buildGuestInvitationUrl(
  origin: string,
  domain: string,
  guestName: string,
  guestToken?: string
): string {
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  const cleanDomain = String(domain || '').trim();
  const cleanGuestName = String(guestName || 'Tamu Undangan').trim();
  const token = String(guestToken || '').trim() || generateGuestToken();

  if (!cleanDomain) {
    return '';
  }

  const params = new URLSearchParams();
  params.set('to', slugifyGuestName(cleanGuestName));
  params.set('token', token);

  return `${cleanOrigin}/wedding/${encodeURIComponent(cleanDomain)}?${params.toString()}`;
}

/** @deprecated Use buildGuestInvitationUrl — single QR/link for share and check-in. */
export function buildGuestCheckinUrl(origin: string, domain: string, guestToken: string): string {
  return buildGuestInvitationUrl(origin, domain, 'Tamu Undangan', guestToken);
}

export function normalizeGuestRecord(
  raw: Partial<GuestInvitationRecord> & { name?: string; url?: string },
  origin: string,
  domain: string
): GuestInvitationRecord {
  const guestName = String(raw.guest_name || raw.name || '').trim();
  const existingUrl = String(raw.invitation_url || raw.url || '').trim();
  const guestToken =
    String(raw.guest_token || '').trim() ||
    extractTokenFromInvitationUrl(existingUrl) ||
    generateGuestToken();
  const invitationUrl =
    existingUrl && extractTokenFromInvitationUrl(existingUrl)
      ? existingUrl
      : buildGuestInvitationUrl(origin, domain, guestName, guestToken);

  return {
    name: guestName,
    url: invitationUrl,
    guest_name: guestName,
    invitation_url: invitationUrl,
    checkin_url: invitationUrl,
    guest_token: guestToken,
    checked_in_at: raw.checked_in_at ?? null,
    checkin_count: Number(raw.checkin_count || 0),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}
