import { environment } from '../../environments/environment';

/**
 * Single source of truth for theme cover preview URLs.
 * API preview fields always win; static assets are last-resort fallback only.
 */
export function resolveThemePreview(theme: any, fallback = ''): string {
  const picked = pickThemePreviewRaw(theme) || String(fallback || '').trim();
  const absolute = toAbsoluteThemePreviewUrl(picked);
  if (!absolute) {
    return String(fallback || '').trim();
  }

  return withStableThemePreviewCacheBuster(absolute, getThemePreviewVersion(theme));
}

export function copyThemePreviewFields(source: any): Record<string, any> {
  if (!source || typeof source !== 'object') {
    return {};
  }

  return {
    preview_url: source.preview_url ?? null,
    preview_image: source.preview_image ?? null,
    preview: source.preview ?? null,
    thumbnail_image: source.thumbnail_image ?? null,
    image_url: source.image_url ?? null,
    thumbnail_url: source.thumbnail_url ?? null,
    updated_at: source.updated_at || source.updatedAt || null,
  };
}

export function pickThemePreviewRaw(theme: any): string {
  if (!theme || typeof theme !== 'object') {
    return '';
  }

  const candidates = [
    theme.preview_url,
    theme.preview_image,
    theme.preview,
    theme.thumbnail_image,
    theme.image,
    theme.image_url,
    theme.thumbnail_url,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value && isLikelyThemePreviewImage(value)) {
      return value;
    }
  }

  return '';
}

export function getThemePreviewVersion(theme: any): string {
  if (!theme || typeof theme !== 'object') {
    return '';
  }

  const cacheBuster = theme['__preview_cache_buster'];
  if (cacheBuster != null && String(cacheBuster).trim()) {
    return String(cacheBuster).trim();
  }

  const updated = theme.updated_at || theme.updatedAt;
  if (!updated) {
    return '';
  }

  const parsed = Date.parse(String(updated));
  if (!Number.isNaN(parsed)) {
    return String(parsed);
  }

  return String(updated).trim();
}

export function withStableThemePreviewCacheBuster(url: string, version: string): string {
  const raw = String(url || '').trim();
  const v = String(version || '').trim();
  if (!raw || !v) {
    return raw;
  }

  if (
    raw.startsWith('assets/') ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }

  if (/[?&]v=/.test(raw)) {
    return raw;
  }

  return `${raw}${raw.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}`;
}

export function toAbsoluteThemePreviewUrl(path: string | null | undefined): string {
  const raw = String(path || '').trim();
  if (!raw) {
    return '';
  }

  if (
    raw.startsWith('blob:') ||
    raw.startsWith('data:') ||
    raw.startsWith('assets/')
  ) {
    return raw;
  }

  if (/^(https?:)?\/\//i.test(raw)) {
    return raw.startsWith('//') ? `https:${raw}` : raw;
  }

  const apiOrigin = environment.apiBaseUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  if (raw.startsWith('/')) {
    return `${apiOrigin}${raw}`;
  }

  if (/^(storage|uploads|upload)\//i.test(raw)) {
    return `${apiOrigin}/${raw}`;
  }

  return `${apiOrigin}/storage/${raw.replace(/^\/+/, '')}`;
}

export function isLikelyThemePreviewImage(value: string): boolean {
  const raw = String(value || '').trim();
  if (!raw) {
    return false;
  }

  if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('assets/')) {
    return true;
  }

  if (raw.startsWith('<') || raw.includes('</')) {
    return false;
  }

  if (/\/preview-theme\//i.test(raw)) {
    return false;
  }

  if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?.*)?$/i.test(raw)) {
    return true;
  }

  if (/\/(storage|uploads?|images?)\//i.test(raw)) {
    return true;
  }

  if (/^https?:\/\//i.test(raw) && /\/themes\/[a-z0-9-]+\/?(\?|$)/i.test(raw)) {
    return false;
  }

  return raw.length < 500;
}
