export interface GuestInvitationRecord {
  id: string;
  name: string;
  guestToken?: string;
  slug: string;
  url: string;
  attendanceStatus?: string;
  checkedInAt: string | null;
  lastScannedAt: string | null;
  checkinCount: number;
  createdAt: string;
}

export function generateGuestId(): string {
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
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugifyGuestName(name: string): string {
  const slug = createGuestSlug(name);

  return slug || 'tamu';
}

export function generateUniqueSlug(name: string, existingGuests: Array<Partial<GuestInvitationRecord>> = []): string {
  const baseSlug = slugifyGuestName(name);
  const usedSlugs = new Set(
    existingGuests
      .map((guest) => String(guest.slug || '').trim())
      .filter(Boolean)
  );

  if (!usedSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;

  while (usedSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

export function buildGuestInvitationUrl(origin: string, domain: string, guestSlug: string): string {
  const cleanOrigin = String(origin || '').replace(/\/$/, '');
  const cleanDomain = String(domain || '').trim();
  const cleanGuestSlug = String(guestSlug || '').trim();

  if (!cleanDomain || !cleanGuestSlug) {
    return '';
  }

  return `${cleanOrigin}/wedding/${encodeURIComponent(cleanDomain)}?to=${encodeURIComponent(cleanGuestSlug)}`;
}

export function normalizeGuestRecord(
  raw: Partial<GuestInvitationRecord> & { name?: string; url?: string },
  origin: string,
  domain: string,
  existingGuests: Array<Partial<GuestInvitationRecord>> = []
): GuestInvitationRecord {
  const guestName = String((raw as any).guest_name || raw.name || '').trim();
  const rawSlug = String(raw.slug || (raw as any).guestSlug || '').trim();
  const guestSlug = rawSlug && !existingGuests.some((guest) => guest.slug === rawSlug)
    ? rawSlug
    : generateUniqueSlug(rawSlug || guestName, existingGuests);
  const checkedInAt = raw.checkedInAt ?? (raw as any).checked_in_at ?? null;
  const checkinCount = Number(raw.checkinCount ?? (raw as any).checkin_count ?? 0);
  const id = String(raw.id || guestSlug || generateGuestId());

  return {
    id,
    name: guestName,
    slug: guestSlug,
    url: buildGuestInvitationUrl(origin, domain, guestSlug),
    checkedInAt,
    lastScannedAt: raw.lastScannedAt ?? null,
    checkinCount,
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}
