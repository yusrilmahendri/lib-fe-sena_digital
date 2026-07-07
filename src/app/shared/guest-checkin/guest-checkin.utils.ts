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

export function buildGuestInvitationUrl(origin: string, domain: string, guestName: string): string {
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  const cleanDomain = String(domain || '').trim();
  const cleanGuestName = String(guestName || 'Tamu Undangan').trim();

  if (!cleanDomain) {
    return '';
  }

  return `${cleanOrigin}/wedding/${encodeURIComponent(cleanDomain)}?to=${encodeURIComponent(cleanGuestName)}`;
}

export function buildGuestCheckinUrl(origin: string, domain: string, guestToken: string): string {
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  const cleanDomain = String(domain || '').trim();
  const cleanToken = String(guestToken || '').trim();

  if (!cleanDomain || !cleanToken) {
    return '';
  }

  return `${cleanOrigin}/wedding/${encodeURIComponent(cleanDomain)}/checkin?token=${encodeURIComponent(cleanToken)}`;
}

export function normalizeGuestRecord(
  raw: Partial<GuestInvitationRecord> & { name?: string; url?: string },
  origin: string,
  domain: string
): GuestInvitationRecord {
  const guestName = String(raw.guest_name || raw.name || '').trim();
  const guestToken = String(raw.guest_token || '').trim() || generateGuestToken();
  const invitationUrl =
    String(raw.invitation_url || raw.url || '').trim() ||
    buildGuestInvitationUrl(origin, domain, guestName);
  const checkinUrl =
    String(raw.checkin_url || '').trim() ||
    buildGuestCheckinUrl(origin, domain, guestToken);

  return {
    name: guestName,
    url: invitationUrl,
    guest_name: guestName,
    invitation_url: invitationUrl,
    checkin_url: checkinUrl,
    guest_token: guestToken,
    checked_in_at: raw.checked_in_at ?? null,
    checkin_count: Number(raw.checkin_count || 0),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}
