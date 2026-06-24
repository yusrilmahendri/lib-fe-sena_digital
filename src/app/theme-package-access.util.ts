export type ThemePackageTier = 'trial' | 'ruby' | 'sapphire' | 'diamond';

export type ThemeCategoryName =
  | 'Minimalis'
  | 'Floral'
  | 'Modern'
  | 'Elegant'
  | 'Luxury';

export interface PackageAccessSource {
  accessible_categories?: any[];
  jenis_paket?: string;
  name_paket?: string;
  name_paket_display?: string;
  package_tier?: string;
}

export const FALLBACK_THEME_ACCESS_MAP: Record<
  ThemePackageTier,
  ThemeCategoryName[]
> = {
  trial: [],
  ruby: ['Minimalis', 'Floral'],
  sapphire: ['Minimalis', 'Floral', 'Modern', 'Elegant'],
  diamond: ['Minimalis', 'Floral', 'Modern', 'Elegant', 'Luxury'],
};

export function resolvePackageTier(
  paket: Partial<PackageAccessSource> | null | undefined
): ThemePackageTier | null {
  const raw = `${paket?.package_tier || paket?.name_paket || paket?.name_paket_display || paket?.jenis_paket || ''}`.toLowerCase();

  if (raw.includes('trial')) return 'trial';
  if (/ruby|silver|standar/.test(raw)) return 'ruby';
  if (/sapphire|gold/.test(raw)) return 'sapphire';
  if (/diamond|platinum/.test(raw)) return 'diamond';
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
  if (raw.includes('modern')) return 'Modern';
  if (raw.includes('elegant')) return 'Elegant';
  if (raw.includes('luxury')) return 'Luxury';
  return null;
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
): Record<ThemePackageTier, ThemeCategoryName[]> {
  const result: Record<ThemePackageTier, ThemeCategoryName[]> = {
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
          .map((entry) => resolveThemeCategory(entry))
          .filter((category): category is ThemeCategoryName => !!category)
      )
    );

    if (tier === 'trial') {
      result.trial = mapped;
      return;
    }

    if (mapped.length) {
      // Merge API categories with the fallback so that a partial accessible_categories
      // list from the API never removes categories that should be accessible by default.
      const merged = Array.from(
        new Set([...(FALLBACK_THEME_ACCESS_MAP[tier] || []), ...mapped])
      );
      result[tier] = sortThemeCategories(merged as ThemeCategoryName[]);
    }
  });

  return result;
}

export function isCategoryAccessibleForTier(
  tier: ThemePackageTier,
  category: ThemeCategoryName,
  accessMap: Record<ThemePackageTier, ThemeCategoryName[]> = FALLBACK_THEME_ACCESS_MAP
): boolean {
  return (accessMap[tier] || []).includes(category);
}

export function getLowestPackageTierForCategory(
  category: ThemeCategoryName,
  accessMap: Record<ThemePackageTier, ThemeCategoryName[]> = FALLBACK_THEME_ACCESS_MAP
): Exclude<ThemePackageTier, 'trial'> {
  const order: Array<Exclude<ThemePackageTier, 'trial'>> = [
    'ruby',
    'sapphire',
    'diamond',
  ];

  return (
    order.find((tier) => (accessMap[tier] || []).includes(category)) || 'ruby'
  );
}

function sortThemeCategories(
  categories: ThemeCategoryName[]
): ThemeCategoryName[] {
  const order: ThemeCategoryName[] = [
    'Minimalis',
    'Floral',
    'Modern',
    'Elegant',
    'Luxury',
  ];

  return [...categories].sort((left, right) => order.indexOf(left) - order.indexOf(right));
}
