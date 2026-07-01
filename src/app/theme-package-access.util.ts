export type ThemePackageTier = 'trial' | 'ruby' | 'sapphire' | 'diamond';
export type PaidThemePackageTier = Exclude<ThemePackageTier, 'trial'>;

export type ThemeCategoryName =
  | 'Minimalis'
  | 'Floral'
  | 'Elegant'
  | 'Luxury';

export type PublicThemeSlug =
  | 'soft-ivory'
  | 'lavender-bloom'
  | 'garden-whisper'
  | 'diamond'
  | 'diamond-garden';

export interface ThemePresetDefinition {
  slug: PublicThemeSlug;
  name: string;
  category: ThemeCategoryName;
  packageTier: PaidThemePackageTier;
  fallbackImage: string;
}

export interface PackageAccessSource {
  accessible_categories?: any[];
  jenis_paket?: string;
  name_paket?: string;
  name_paket_display?: string;
  package_tier?: string;
}

export type ThemeAccessMap = Record<ThemePackageTier, PublicThemeSlug[]>;

export const PUBLIC_THEME_PRESETS: ThemePresetDefinition[] = [
  {
    slug: 'soft-ivory',
    name: 'Soft Ivory',
    category: 'Minimalis',
    packageTier: 'ruby',
    fallbackImage: 'assets/landing/template-2.png',
  },
  {
    slug: 'lavender-bloom',
    name: 'Lavender Bloom',
    category: 'Floral',
    packageTier: 'ruby',
    fallbackImage: 'assets/landing/template-1.png',
  },
  {
    slug: 'garden-whisper',
    name: 'Garden Whisper',
    category: 'Floral',
    packageTier: 'sapphire',
    fallbackImage: 'assets/landing/template-6.png',
  },
  {
    slug: 'diamond',
    name: 'Champagne Rose',
    category: 'Elegant',
    packageTier: 'diamond',
    fallbackImage: 'assets/landing/template-5.png',
  },
  {
    slug: 'diamond-garden',
    name: 'Diamond Garden',
    category: 'Luxury',
    packageTier: 'diamond',
    fallbackImage: 'assets/landing/template-3.png',
  },
];

const THEME_PRESET_BY_SLUG: Record<PublicThemeSlug, ThemePresetDefinition> = {
  'soft-ivory': PUBLIC_THEME_PRESETS[0],
  'lavender-bloom': PUBLIC_THEME_PRESETS[1],
  'garden-whisper': PUBLIC_THEME_PRESETS[2],
  'diamond': PUBLIC_THEME_PRESETS[3],
  'diamond-garden': PUBLIC_THEME_PRESETS[4],
};

const THEME_SLUG_ALIASES: Record<string, PublicThemeSlug> = {
  sapphire: 'garden-whisper',
  'modern-vows': 'garden-whisper',
  'champagne-rose': 'diamond',
  'velvet-mauve': 'diamond-garden',
};

const THEME_SLUG_ORDER: PublicThemeSlug[] = PUBLIC_THEME_PRESETS.map(
  (preset) => preset.slug
);

export const FALLBACK_THEME_ACCESS_MAP: ThemeAccessMap = {
  trial: [],
  ruby: ['soft-ivory', 'lavender-bloom'],
  sapphire: ['garden-whisper'],
  diamond: ['diamond', 'diamond-garden'],
};

export function resolvePackageTier(
  paket: Partial<PackageAccessSource> | null | undefined
): ThemePackageTier | null {
  // Collect all candidate strings from all known field names and join them
  // so a value like "Ruby & Sapphire & Diamond" or "Paket Ruby" still matches.
  const candidates = [
    (paket as any)?.name,
    (paket as any)?.tier,
    (paket as any)?.package_name,
    paket?.package_tier,
    paket?.name_paket,
    paket?.name_paket_display,
    paket?.jenis_paket,
  ]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().trim());

  const raw = candidates.join(' ');

  if (!raw) return null;

  // Order matters: check more specific tiers first (diamond > sapphire > ruby)
  if (/diamond|platinum/.test(raw)) return 'diamond';
  if (/sapphire|gold/.test(raw)) return 'sapphire';
  if (/ruby|silver|standar/.test(raw)) return 'ruby';
  if (raw.includes('trial')) return 'trial';
  return null;
}

export function resolveThemeCategory(
  value: any
): ThemeCategoryName | null {
  const raw = normalizeStableKey(
    typeof value === 'string'
      ? value
      : value?.slug || value?.name || value?.nama_kategori || value?.category || ''
  );

  if (raw.includes('minimal')) return 'Minimalis';
  if (raw.includes('floral')) return 'Floral';
  if (raw.includes('elegant')) return 'Elegant';
  if (raw.includes('luxury')) return 'Luxury';
  return null;
}

export function resolvePublicThemeSlug(
  value: any
): PublicThemeSlug | null {
  const raw = normalizeStableKey(
    typeof value === 'string'
      ? value
      : value?.slug || value?.theme_slug || value?.key || value?.name || value?.tema || ''
  );

  if (!raw) {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(THEME_SLUG_ALIASES, raw)) {
    return THEME_SLUG_ALIASES[raw];
  }

  return Object.prototype.hasOwnProperty.call(THEME_PRESET_BY_SLUG, raw)
    ? (raw as PublicThemeSlug)
    : null;
}

export function getThemePresetBySlug(
  value: string | null | undefined
): ThemePresetDefinition | null {
  const slug = resolvePublicThemeSlug(value);
  return slug ? THEME_PRESET_BY_SLUG[slug] : null;
}

/**
 * Cumulative package hierarchy. A higher tier includes access to every lower
 * tier's themes (Diamond ⊇ Sapphire ⊇ Ruby ⊇ Trial).
 */
export const PACKAGE_TIER_ORDER: Record<string, number> = {
  trial: 0,
  ruby: 1,
  sapphire: 2,
  diamond: 3,
};

function normalizeTierKey(value: string | null | undefined): string {
  return String(value || '').toLowerCase().trim();
}

/**
 * Returns true when a user on `userTier` may access content that requires
 * `themeTier` — i.e. the theme's tier is at or below the user's tier.
 */
export function isTierAllowed(
  userTier: string | null | undefined,
  themeTier: string | null | undefined
): boolean {
  const userLevel = PACKAGE_TIER_ORDER[normalizeTierKey(userTier)] ?? 0;
  const themeLevel = PACKAGE_TIER_ORDER[normalizeTierKey(themeTier)] ?? 0;
  return themeLevel <= userLevel;
}

/**
 * Resolve a theme's own package tier from its slug (handles slug aliases such
 * as `modern-vows` → sapphire, `champagne-rose`/`velvet-mauve` → diamond).
 * Falls back to `ruby` when the slug is unknown so it stays accessible.
 */
export function getThemeTierForSlug(
  slug: string | null | undefined
): PaidThemePackageTier {
  const preset = getThemePresetBySlug(slug);
  return preset?.packageTier ?? 'ruby';
}

export function normalizeStableKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildThemeAccessMap(
  packages: PackageAccessSource[] | null | undefined
): ThemeAccessMap {
  const result: ThemeAccessMap = {
    trial: [...FALLBACK_THEME_ACCESS_MAP.trial],
    ruby: [...FALLBACK_THEME_ACCESS_MAP.ruby],
    sapphire: [...FALLBACK_THEME_ACCESS_MAP.sapphire],
    diamond: [...FALLBACK_THEME_ACCESS_MAP.diamond],
  };

  if (!Array.isArray(packages) || !packages.length) {
    return result;
  }

  packages.forEach((paket) => {
    const tier = resolvePackageTier(paket);
    if (!tier) {
      return;
    }

    const accessibleCategories = Array.isArray(paket?.accessible_categories)
      ? paket.accessible_categories
      : null;

    if (!accessibleCategories) {
      return;
    }

    const mapped = Array.from(
      new Set(
        accessibleCategories
          .flatMap((entry) => resolveThemeAccessEntry(entry, tier))
      )
    );

    if (tier === 'trial') {
      result.trial = sortThemeSlugs(mapped);
      return;
    }

    if (mapped.length) {
      const merged = Array.from(
        new Set([...(FALLBACK_THEME_ACCESS_MAP[tier] || []), ...mapped])
      );
      result[tier] = sortThemeSlugs(merged);
    }
  });

  return result;
}

export function getThemeSlugsForTier(
  tier: ThemePackageTier,
  accessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP
): PublicThemeSlug[] {
  return [...(accessMap[tier] || [])];
}

export function isThemeAccessibleForTier(
  tier: ThemePackageTier,
  slug: string | null | undefined,
  accessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP
): boolean {
  const normalizedSlug = resolvePublicThemeSlug(slug);
  if (!normalizedSlug) {
    return false;
  }

  return getThemeSlugsForTier(tier, accessMap).includes(normalizedSlug);
}

export function getLowestPackageTierForTheme(
  slug: string | null | undefined,
  accessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP
): PaidThemePackageTier {
  const normalizedSlug = resolvePublicThemeSlug(slug);
  if (!normalizedSlug) {
    return 'ruby';
  }

  const order: PaidThemePackageTier[] = ['ruby', 'sapphire', 'diamond'];
  return (
    order.find((tier) => isThemeAccessibleForTier(tier, normalizedSlug, accessMap)) ||
    THEME_PRESET_BY_SLUG[normalizedSlug].packageTier
  );
}

export function isCategoryAccessibleForTier(
  tier: ThemePackageTier,
  category: ThemeCategoryName,
  accessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP
): boolean {
  const normalizedCategory = (category || '').toLowerCase().trim();
  return getThemeSlugsForTier(tier, accessMap).some((slug) => {
    const preset = THEME_PRESET_BY_SLUG[slug];
    return preset?.category.toLowerCase().trim() === normalizedCategory;
  });
}

export function getLowestPackageTierForCategory(
  category: ThemeCategoryName,
  accessMap: ThemeAccessMap = FALLBACK_THEME_ACCESS_MAP
): PaidThemePackageTier {
  const order: PaidThemePackageTier[] = ['ruby', 'sapphire', 'diamond'];
  const matchedTier =
    order.find((tier) => isCategoryAccessibleForTier(tier, category, accessMap)) ||
    PUBLIC_THEME_PRESETS.find((preset) => preset.category === category)?.packageTier;

  return matchedTier || 'ruby';
}

function resolveThemeAccessEntry(
  entry: any,
  tier: ThemePackageTier
): PublicThemeSlug[] {
  const directSlug = resolvePublicThemeSlug(entry);
  if (directSlug) {
    return [directSlug];
  }

  if (tier === 'trial') {
    return [];
  }

  const category = resolveThemeCategory(entry);
  if (!category) {
    return [];
  }

  return PUBLIC_THEME_PRESETS
    .filter((preset) => preset.category === category && preset.packageTier === tier)
    .map((preset) => preset.slug);
}

function sortThemeSlugs(
  slugs: PublicThemeSlug[]
): PublicThemeSlug[] {
  return [...slugs].sort(
    (left, right) => THEME_SLUG_ORDER.indexOf(left) - THEME_SLUG_ORDER.indexOf(right)
  );
}
