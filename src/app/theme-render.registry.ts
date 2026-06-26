export type ThemeSlug =
  | 'soft-ivory'
  | 'lavender-bloom'
  | 'garden-whisper'
  | 'modern-vows'
  | 'champagne-rose'
  | 'velvet-mauve';

export type ThemeRenderKey = 'ruby-theme-one' | 'ruby-theme-two' | 'lavender-bloom';

export const DEFAULT_THEME_SLUG: ThemeSlug = 'soft-ivory';

export const THEME_RENDER_MAP: Record<ThemeSlug, ThemeRenderKey> = {
  'soft-ivory': 'ruby-theme-one',
  'lavender-bloom': 'ruby-theme-two',
  'garden-whisper': 'ruby-theme-two',
  'modern-vows': 'ruby-theme-two',
  'champagne-rose': 'ruby-theme-two',
  'velvet-mauve': 'ruby-theme-two',
};

export function normalizeThemeSlug(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function isThemeSlug(value: string): value is ThemeSlug {
  return Object.prototype.hasOwnProperty.call(THEME_RENDER_MAP, value);
}

export function resolveThemeSlug(value?: string | null): ThemeSlug | null {
  const normalized = normalizeThemeSlug(value);
  return isThemeSlug(normalized) ? normalized : null;
}

export function resolveThemeSlugFromCandidates(values: any[]): ThemeSlug | null {
  for (const entry of values) {
    if (entry == null) {
      continue;
    }

    if (typeof entry === 'string') {
      const slug = resolveThemeSlug(entry);
      if (slug) {
        return slug;
      }
      continue;
    }

    if (typeof entry === 'object') {
      const nestedCandidates = [
        entry.slug,
        entry.theme_slug,
        entry.jenis_thema,
        entry.tema,
        entry.name,
      ];
      for (const nested of nestedCandidates) {
        const slug = resolveThemeSlug(nested);
        if (slug) {
          return slug;
        }
      }
    }
  }

  return null;
}

export function resolveThemeRenderKey(slug: ThemeSlug | null | undefined): ThemeRenderKey {
  if (!slug) {
    return THEME_RENDER_MAP[DEFAULT_THEME_SLUG];
  }
  return THEME_RENDER_MAP[slug] || THEME_RENDER_MAP[DEFAULT_THEME_SLUG];
}
