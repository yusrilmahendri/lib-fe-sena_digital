export interface GuestInvitationRecord {
  name: string;
  url: string;
  guest_name: string;
  invitation_url: string;
  checkin_url: string;
  guest_token: string;
  token: string;
  guestSlug: string;
  checked_in_at: string | null;
  checkedInAt: string | null;
  lastScannedAt: string | null;
  checkin_count: number;
  checkinCount: number;
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

export function buildGuestInvitationUrl(origin: string, domain: string, guestName: string, guestToken = ''): string {
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  const cleanDomain = String(domain || '').trim();
  const cleanGuestName = String(guestName || 'Tamu Undangan').trim();
  const cleanGuestToken = String(guestToken || '').trim();

  if (!cleanDomain) {
    return '';
  }

  const guestSlug = slugifyGuestName(cleanGuestName);
  const params = new URLSearchParams({ to: guestSlug });

  if (cleanGuestToken) {
    params.set('token', cleanGuestToken);
  }

  return `${cleanOrigin}/wedding/${encodeURIComponent(cleanDomain)}?${params.toString()}`;
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
  const guestToken = String(raw.guest_token || raw.token || '').trim() || generateGuestToken();
  const guestSlug = String(raw.guestSlug || '').trim() || slugifyGuestName(guestName);
  const invitationUrl =
    buildGuestInvitationUrl(origin, domain, guestName, guestToken) ||
    String(raw.invitation_url || raw.url || '').trim();
  const checkedInAt = raw.checkedInAt ?? raw.checked_in_at ?? null;
  const checkinCount = Number(raw.checkinCount ?? raw.checkin_count ?? 0);

  return {
    name: guestName,
    url: invitationUrl,
    guest_name: guestName,
    invitation_url: invitationUrl,
    checkin_url: '',
    guest_token: guestToken,
    token: guestToken,
    guestSlug,
    checked_in_at: checkedInAt,
    checkedInAt,
    lastScannedAt: raw.lastScannedAt ?? null,
    checkin_count: checkinCount,
    checkinCount,
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}
