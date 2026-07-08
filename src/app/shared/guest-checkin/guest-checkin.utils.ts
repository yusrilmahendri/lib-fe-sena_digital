export interface GuestInvitationRecord {
  id: string;
  name: string;
  slug: string;
  url: string;
  guest_name?: string;
  invitation_url?: string;
  checkin_url?: string;
  guest_token?: string;
  token?: string;
  guestSlug?: string;
  checked_in_at?: string | null;
  checkedInAt: string | null;
  lastScannedAt: string | null;
  checkin_count?: number;
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

export function normalizeGuestName(value: string): string {
  return decodeURIComponent(value || '')
    .replace(/\+/g, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function createGuestSlug(name: string): string {
  return normalizeGuestName(name)
    .replace(/&/g, 'dan')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugifyGuestName(name: string): string {
  const slug = createGuestSlug(name);

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
  const guestToken = String(raw.guest_token || raw.token || '').trim();
  const guestSlug = String(raw.slug || raw.guestSlug || '').trim() || createGuestSlug(guestName);
  const existingUrl = String(raw.invitation_url || raw.url || '').trim();
  const invitationUrl =
    existingUrl ||
    buildGuestInvitationUrl(origin, domain, guestName);
  const checkedInAt = raw.checkedInAt ?? raw.checked_in_at ?? null;
  const checkinCount = Number(raw.checkinCount ?? raw.checkin_count ?? 0);
  const id = String(raw.id || guestToken || guestSlug || generateGuestToken());

  return {
    id,
    name: guestName,
    slug: guestSlug,
    url: invitationUrl,
    guest_name: guestName,
    invitation_url: invitationUrl,
    checkin_url: '',
    guest_token: guestToken || undefined,
    token: guestToken || undefined,
    guestSlug,
    checked_in_at: checkedInAt,
    checkedInAt,
    lastScannedAt: raw.lastScannedAt ?? null,
    checkin_count: checkinCount,
    checkinCount,
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}
