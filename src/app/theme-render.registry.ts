export type ThemeSlug =
  | 'soft-ivory'
  | 'lavender-bloom'
  | 'garden-whisper'
  | 'modern-vows'
  | 'sapphire'
  | 'champagne-rose'
  | 'velvet-mauve'
  | 'diamond';

export type ThemeRenderKey =
  | 'ruby-theme-one'
  | 'ruby-theme-two'
  | 'sapphire-theme-one'
  | 'diamond-theme-one'
  | 'lavender-bloom';

export const DEFAULT_THEME_SLUG: ThemeSlug = 'soft-ivory';

export const THEME_RENDER_MAP: Record<ThemeSlug, ThemeRenderKey> = {
  'soft-ivory': 'ruby-theme-one',
  'lavender-bloom': 'ruby-theme-two',
  'garden-whisper': 'ruby-theme-two',
  // Sapphire-tier (Modern category) themes render the dedicated Sapphire design.
  'modern-vows': 'sapphire-theme-one',
  'sapphire': 'sapphire-theme-one',
  'champagne-rose': 'ruby-theme-two',
  // Diamond-tier (Luxury category) themes render the dedicated Diamond design.
  'velvet-mauve': 'diamond-theme-one',
  'diamond': 'diamond-theme-one',
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
