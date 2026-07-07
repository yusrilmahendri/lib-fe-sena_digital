export interface GuestInvitationRecord {
  id: string;
  name: string;
  slug: string;
  token: string;
  url: string;
  checkedInAt: string | null;
  checkinCount: number;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface CurrentGuestContext {
  guest_name: string;
  guest_token: string;
  invitation_url?: string;
  checked_in_at?: string | null;
  checkin_count?: number;
}

export type ScanAttendanceStatus = 'Berhasil' | 'Sudah Pernah Scan';

export interface ParsedGuestScanUrl {
  domain: string;
  token: string;
  to: string;
  url: string;
}

export interface GuestScanProcessResult {
  ok: boolean;
  status: ScanAttendanceStatus | 'Tidak Ditemukan' | 'Error';
  message: string;
  guest?: GuestInvitationRecord;
  scannedAt?: string;
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

export function extractDomainFromInvitationUrl(url?: string): string {
  if (!url) {
    return '';
  }

  try {
    const match = new URL(url).pathname.match(/\/wedding\/([^/?#]+)/i);
    return match ? decodeURIComponent(match[1]).trim() : '';
  } catch {
    const match = String(url).match(/\/wedding\/([^/?#]+)/i);
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
    last_scanned_at?: string | null;
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
    lastScannedAt: raw.lastScannedAt ?? raw.last_scanned_at ?? null,
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

export function getCheckedInGuests(domain: string, origin: string): GuestInvitationRecord[] {
  return loadGuestInvitations(domain, origin)
    .filter((guest) => !!guest.checkedInAt)
    .sort((left, right) => {
      const leftTime = new Date(left.lastScannedAt || left.checkedInAt || 0).getTime();
      const rightTime = new Date(right.lastScannedAt || right.checkedInAt || 0).getTime();
      return rightTime - leftTime;
    });
}

export function parseGuestScanUrl(decodedText: string): ParsedGuestScanUrl | null {
  try {
    const url = new URL(String(decodedText || '').trim());
    const token = String(url.searchParams.get('token') || '').trim();
    const to = String(url.searchParams.get('to') || '').trim();
    const domain = extractDomainFromInvitationUrl(url.toString());

    if (!domain) {
      return null;
    }

    return {
      domain,
      token,
      to,
      url: url.toString(),
    };
  } catch {
    return null;
  }
}

/**
 * TEMPORARY: Processes QR scan results and stores attendance in localStorage only.
 * Replace with backend check-in once the API is available.
 */
export function processGuestQrScan(
  decodedText: string,
  activeDomain: string,
  origin: string
): GuestScanProcessResult {
  const trimmed = String(decodedText || '').trim();

  if (!trimmed) {
    return {
      ok: false,
      status: 'Error',
      message: 'QR kosong atau tidak valid.',
    };
  }

  try {
    new URL(trimmed);
  } catch {
    return {
      ok: false,
      status: 'Error',
      message: 'QR bukan URL undangan yang valid.',
    };
  }

  const parsed = parseGuestScanUrl(trimmed);

  if (!parsed) {
    return {
      ok: false,
      status: 'Error',
      message: 'URL undangan tidak valid. Pastikan QR berasal dari undangan personal.',
    };
  }

  if (!parsed.token) {
    return {
      ok: false,
      status: 'Error',
      message: 'QR tidak memiliki token tamu. Pastikan QR berasal dari undangan personal.',
    };
  }

  const domain = String(parsed.domain || activeDomain || '').trim();

  if (!domain) {
    return {
      ok: false,
      status: 'Error',
      message: 'Domain undangan tidak ditemukan pada QR.',
    };
  }

  const guests = loadGuestInvitations(domain, origin);
  const guestIndex = guests.findIndex((guest) => guest.token === parsed.token);

  if (guestIndex < 0) {
    return {
      ok: false,
      status: 'Tidak Ditemukan',
      message:
        'Data tamu tidak ditemukan di browser ini. Pastikan daftar tamu dibuat/import di perangkat ini.',
    };
  }

  const guest = guests[guestIndex];
  const now = new Date().toISOString();
  let status: ScanAttendanceStatus;

  if (!guest.checkedInAt) {
    guest.checkedInAt = now;
    guest.checkinCount = 1;
    status = 'Berhasil';
  } else {
    guest.checkinCount = Number(guest.checkinCount || 0) + 1;
    status = 'Sudah Pernah Scan';
  }

  guest.lastScannedAt = now;
  guests[guestIndex] = guest;
  saveGuestInvitations(domain, guests);

  return {
    ok: true,
    status,
    message:
      status === 'Berhasil'
        ? 'Kehadiran tamu berhasil dicatat.'
        : 'Tamu sudah pernah scan sebelumnya.',
    guest,
    scannedAt: now,
  };
}

export function resetGuestAttendance(
  domain: string,
  guestId: string,
  origin: string
): boolean {
  const guests = loadGuestInvitations(domain, origin);
  const guestIndex = guests.findIndex((guest) => guest.id === guestId);

  if (guestIndex < 0) {
    return false;
  }

  guests[guestIndex] = {
    ...guests[guestIndex],
    checkedInAt: null,
    checkinCount: 0,
    lastScannedAt: null,
  };

  saveGuestInvitations(domain, guests);
  return true;
}

export function resetAllGuestAttendance(domain: string, origin: string): void {
  const guests = loadGuestInvitations(domain, origin).map((guest) => ({
    ...guest,
    checkedInAt: null,
    checkinCount: 0,
    lastScannedAt: null,
  }));

  saveGuestInvitations(domain, guests);
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
  const now = new Date().toISOString();

  if (!guest.checkedInAt) {
    guest.checkedInAt = now;
    guest.checkinCount = 1;
  } else {
    guest.checkinCount = Number(guest.checkinCount || 0) + 1;
  }

  guest.lastScannedAt = now;
  guests[guestIndex] = guest;
  saveGuestInvitations(cleanDomain, guests);

  return guest;
}
