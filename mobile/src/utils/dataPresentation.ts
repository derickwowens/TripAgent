/**
 * Data Presentation Layer
 *
 * Transforms raw database values into user-friendly display strings.
 * Covers: amenities, site types, open season, trail type, surface type,
 * difficulty, estimated duration, and price formatting.
 */

// ============================================
// CAMPGROUND AMENITIES
// ============================================

const AMENITY_LABELS: Record<string, string> = {
  campfire: 'Campfire Rings',
  dump_station: 'Dump Station',
  electric: 'Electric Hookups',
  flush_toilets: 'Flush Toilets',
  picnic: 'Picnic Area',
  playground: 'Playground',
  ranger_programs: 'Ranger Programs',
  showers: 'Showers',
  store: 'Camp Store',
  vault_toilets: 'Vault Toilets',
  water: 'Potable Water',
  wifi: 'WiFi',
};

// Priority order for display (most useful first)
const AMENITY_PRIORITY: string[] = [
  'showers',
  'electric',
  'water',
  'flush_toilets',
  'wifi',
  'dump_station',
  'store',
  'campfire',
  'playground',
  'picnic',
  'ranger_programs',
  'vault_toilets',
];

export function formatAmenity(raw: string): string {
  return AMENITY_LABELS[raw] || raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function formatAmenities(raw: string[], maxItems: number = 4): string[] {
  const sorted = [...raw].sort((a, b) => {
    const ai = AMENITY_PRIORITY.indexOf(a);
    const bi = AMENITY_PRIORITY.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted.slice(0, maxItems).map(formatAmenity);
}

export function formatAmenitySummary(raw: string[], maxItems: number = 4): string {
  const formatted = formatAmenities(raw, maxItems);
  const remaining = raw.length - formatted.length;
  const summary = formatted.join('  |  ');
  return remaining > 0 ? `${summary}  +${remaining} more` : summary;
}

// ============================================
// CAMPGROUND SITE TYPES
// ============================================

const SITE_TYPE_LABELS: Record<string, string> = {
  tent: 'Tent Sites',
  rv: 'RV Sites',
  cabin: 'Cabins',
  group: 'Group Sites',
  equestrian: 'Equestrian',
  boat: 'Boat Access',
};

export function formatSiteType(raw: string): string {
  return SITE_TYPE_LABELS[raw] || raw.replace(/\b\w/g, c => c.toUpperCase());
}

export function formatSiteTypes(raw: string[]): string[] {
  return raw.map(formatSiteType);
}

export function formatSiteTypeSummary(raw: string[]): string {
  return formatSiteTypes(raw).join('  |  ');
}

// ============================================
// OPEN SEASON
// ============================================

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const MONTH_ABBR: Record<string, string> = {
  january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr',
  may: 'May', june: 'Jun', july: 'Jul', august: 'Aug',
  september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec',
};

// Values that are garbage parsed from descriptions — not real seasons
const SEASON_GARBAGE = [
  'areas to run', 'roads to travel', 'only to high', 'date to june',
  'may through the', 'monday through friday',
];

export function formatOpenSeason(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  // Filter out garbage values
  if (SEASON_GARBAGE.includes(lower)) return null;

  // Year-round
  if (lower === 'year-round' || lower === 'year round') return 'Year-round';

  // Seasonal (generic)
  if (lower === 'seasonal') return 'Seasonal';

  // Extract month range: "april through october", "may - september", "may to september"
  const rangeMatch = lower.match(
    /(\w+)\s*(?:through|thru|to|-|–)\s*(\w+)/
  );
  if (rangeMatch) {
    const startMonth = MONTH_ABBR[rangeMatch[1]];
    const endMonth = MONTH_ABBR[rangeMatch[2]];
    if (startMonth && endMonth) {
      return `${startMonth} - ${endMonth}`;
    }
  }

  // Single month match
  for (const month of MONTH_NAMES) {
    if (lower.includes(month)) {
      return MONTH_ABBR[month] || null;
    }
  }

  return null;
}

// ============================================
// TRAIL TYPE
// ============================================

const TRAIL_TYPE_MAP: Record<string, string> = {
  hiking: 'Hiking',
  biking: 'Biking',
  equestrian: 'Equestrian',
  paddling: 'Paddling',
  ohv: 'OHV',
  trail: 'Trail',
  road: 'Road',
  loop: 'Loop',
  out_and_back: 'Out & Back',
  point_to_point: 'Point to Point',
  'multi-use': 'Multi-Use',
  'hiking/biking': 'Hiking / Biking',
  'hiking/equestrian': 'Hiking / Equestrian',
  'hiking/biking/equestrian': 'Multi-Use',
  'interpretive trail': 'Interpretive',
};

// Raw values that should be suppressed (not useful to display)
const TRAIL_TYPE_SUPPRESS = new Set([
  '', '5', '7', 'aggregate', 'asphalt', 'chip seal', 'concrete',
  'native material', 'not determined', 'paved', 'unpaved',
  'vegetated', 'unknown',
]);

// USFS motorized prefixes
const MOTORIZED_PREFIX = 'motorized';

export function formatTrailType(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  if (TRAIL_TYPE_SUPPRESS.has(lower)) return null;

  // Direct map lookup
  const mapped = TRAIL_TYPE_MAP[lower];
  if (mapped) return mapped;

  // USFS motorized variants
  if (lower.startsWith(MOTORIZED_PREFIX)) return 'Motorized';

  // Fallback: title-case the raw value
  return raw.replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// SURFACE TYPE
// ============================================

const SURFACE_LABELS: Record<string, string> = {
  boardwalk: 'Boardwalk',
  dirt: 'Dirt',
  gravel: 'Gravel',
  mixed: 'Mixed Surface',
  paved: 'Paved',
  rock: 'Rock',
};

export function formatSurfaceType(raw: string): string {
  return SURFACE_LABELS[raw.toLowerCase()] || raw.replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================
// PRICE FORMATTING
// ============================================

export function formatPrice(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  if (min && max && min !== max) return `$${min} - $${max}/night`;
  if (min) return `$${min}/night`;
  if (max) return `$${max}/night`;
  return null;
}

// ============================================
// ESTIMATED DURATION
// ============================================

export function formatDuration(minutes?: number): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
}

// ============================================
// TRAIL LENGTH
// ============================================

export function formatTrailLength(miles?: number): string | null {
  if (!miles || miles <= 0) return null;
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

// ============================================
// PHONE NUMBER
// ============================================

export function formatPhone(raw: string): string {
  // Already formatted
  if (raw.includes('(') || raw.includes('-')) return raw;
  // 10-digit US number
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

// ============================================
// PET FRIENDLY
// ============================================

export function formatPetFriendly(value?: boolean): string | null {
  if (value === true) return 'Pet Friendly';
  if (value === false) return 'No Pets';
  return null;
}

// ============================================
// ELEVATION
// ============================================

export function formatElevation(feet?: number): string | null {
  if (!feet || feet <= 0) return null;
  return `${feet.toLocaleString()} ft gain`;
}

// ============================================
// TOTAL SITES
// ============================================

export function formatTotalSites(count?: number): string | null {
  if (!count || count <= 0) return null;
  return `${count} site${count !== 1 ? 's' : ''}`;
}

// ============================================
// RATING
// ============================================

export function formatRating(rating?: number): string | null {
  if (!rating || rating <= 0) return null;
  return rating.toFixed(1);
}
