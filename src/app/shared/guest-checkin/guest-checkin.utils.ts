export interface GuestInvitationRecord {
  id: string;
  name: string;
  slug: string;
  token: string;
  url: string;
  checkedInAt: string | null;
  checkinCount: number;
  createdAt: string;
}

export interface CurrentGuestContext {
  guest_name: string;
  guest_token: string;
  invitation_url?: string;
  checked_in_at?: string | null;
  checkin_count?: number;
}

export const GUEST_INVITATIONS_STORAGE_PREFIX = 'guest_invitations';
export const LEGACY_GUEST_INVITATIONS_STORAGE_PREFIX = 'generated_guest_invitations';

export function getGuestInvitationsStorageKey(domain: string): string {
  return `${GUEST_INVITATIONS_STORAGE_PREFIX}_${String(domain || 'unknown').trim() || 'unknown'}`;
}

export function getLegacyGuestInvitationsStorageKey(domain: string): string {
  return `${LEGACY_GUEST_INVITATIONS_STORAGE_PREFIX}_${String(domain || 'unknown').trim() || 'unknown'}`;
}

function createRandomUuid(): string {
  const cryptoRef = globalThis.crypto as Crypto & { randomUUID?: () => string };

  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }

  if (cryptoRef?.getRandomValues) {
    const random = cryptoRef.getRandomValues(new Uint8Array(16));
    return Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
}

export function generateGuestId(): string {
  return createRandomUuid();
}

export function generateGuestToken(): string {
  return createRandomUuid().replace(/-/g, '');
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

export function normalizeGuestRecord(
  raw: Partial<GuestInvitationRecord> & {
    name?: string;
    url?: string;
    guest_name?: string;
    guest_token?: string;
    invitation_url?: string;
    checked_in_at?: string | null;
    checkin_count?: number;
  },
  origin: string,
  domain: string
): GuestInvitationRecord {
  const guestName = String(raw.name || raw.guest_name || '').trim();
  const existingUrl = String(raw.url || raw.invitation_url || '').trim();
  const guestToken =
    String(raw.token || raw.guest_token || '').trim() ||
    extractTokenFromInvitationUrl(existingUrl) ||
    generateGuestToken();
  const invitationUrl =
    existingUrl && extractTokenFromInvitationUrl(existingUrl)
      ? existingUrl
      : buildGuestInvitationUrl(origin, domain, guestName, guestToken);
  const slug = slugifyGuestName(guestName || extractSlugFromInvitationUrl(invitationUrl));

  return {
    id: String(raw.id || '').trim() || generateGuestId(),
    name: guestName,
    slug,
    token: guestToken,
    url: invitationUrl,
    checkedInAt: raw.checkedInAt ?? raw.checked_in_at ?? null,
    checkinCount: Number(raw.checkinCount ?? raw.checkin_count ?? 0),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

function extractSlugFromInvitationUrl(url?: string): string {
  if (!url) {
    return '';
  }

  try {
    return decodeURIComponent(new URL(url).searchParams.get('to') || '').trim();
  } catch {
    const match = String(url).match(/[?&]to=([^&]+)/i);
    return match ? decodeURIComponent(match[1]).trim() : '';
  }
}

export function loadGuestInvitations(domain: string, origin: string): GuestInvitationRecord[] {
  const storageKey = getGuestInvitationsStorageKey(domain);
  const legacyKey = getLegacyGuestInvitationsStorageKey(domain);

  try {
    const raw = localStorage.getItem(storageKey) || localStorage.getItem(legacyKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const records = Array.isArray(parsed) ? parsed : [];
    const normalized = records
      .map((record) => normalizeGuestRecord(record, origin, domain))
      .filter((record) => !!String(record.name || '').trim());

    if (normalized.length) {
      saveGuestInvitations(domain, normalized);
    }

    if (localStorage.getItem(legacyKey) && storageKey !== legacyKey) {
      localStorage.removeItem(legacyKey);
    }

    return normalized;
  } catch {
    return [];
  }
}

export function saveGuestInvitations(domain: string, records: GuestInvitationRecord[]): void {
  try {
    localStorage.setItem(getGuestInvitationsStorageKey(domain), JSON.stringify(records));
  } catch {
    // Local history is optional; invitation rendering should still work.
  }
}

/**
 * TEMPORARY: Records guest attendance in localStorage only.
 * This must be replaced with a backend check-in endpoint once available.
 */
export function recordGuestCheckin(domain: string, token: string, origin: string): GuestInvitationRecord | null {
  const cleanDomain = String(domain || '').trim();
  const cleanToken = String(token || '').trim();

  if (!cleanDomain || !cleanToken) {
    return null;
  }

  const guests = loadGuestInvitations(cleanDomain, origin);
  const guestIndex = guests.findIndex((guest) => guest.token === cleanToken);

  if (guestIndex < 0) {
    return null;
  }

  const guest = guests[guestIndex];

  if (!guest.checkedInAt) {
    guest.checkedInAt = new Date().toISOString();
    guest.checkinCount = 1;
  } else {
    guest.checkinCount = Number(guest.checkinCount || 0) + 1;
  }

  guests[guestIndex] = guest;
  saveGuestInvitations(cleanDomain, guests);

  return guest;
}
