/**
 * Metadata Validator
 * 
 * Ensures all synced data includes complete metadata required for system functionality.
 * This is a CRITICAL component of the data import paradigm - incomplete data should
 * not be uploaded to S3.
 * 
 * LINK PRIORITY ORDER (use first available):
 * 1. Official state/park website URL (most authoritative)
 * 2. AllTrails URL (for trails)
 * 3. Recreation.gov URL (for campgrounds)
 * 4. Google Maps URL (LAST RESORT - fallback only)
 * 
 * Required Metadata by Type:
 * 
 * PARKS (State & National):
 * - id: Unique identifier
 * - name: Display name
 * - coordinates: { latitude, longitude } for mapping
 * - links.officialUrl: Official website (PRIMARY)
 * - links.googleMapsUrl: Navigation link (fallback)
 * - links.directionsUrl: Driving directions
 * - stateCode: State abbreviation
 * - parkType: Classification
 * 
 * TRAILS:
 * - id: Unique identifier
 * - name: Display name
 * - coordinates: Start point { latitude, longitude }
 * - officialUrl: State park website (PRIMARY)
 * - allTrailsUrl: AllTrails page (SECONDARY)
 * - googleMapsUrl: Navigation to trailhead (FALLBACK)
 * - parkName: Associated park name
 * - lengthMiles: Trail length
 * - dataSource: Origin of data
 * 
 * CAMPGROUNDS:
 * - id: Unique identifier
 * - name: Display name
 * - coordinates: { latitude, longitude }
 * - reservationUrl: Booking link (PRIMARY)
 * - recreationGovUrl: Recreation.gov page
 * - googleMapsUrl: Navigation link (FALLBACK)
 */

import { 
  generateGoogleMapsLink, 
  generateDirectionsLink,
  generateAllTrailsLink,
  generateRecreationGovLink,
} from '../../src/utils/linkUtils.js';

// ============================================================================
// STATE PARK OFFICIAL URL PATTERNS
// These are authoritative and should be used as PRIMARY links
// ============================================================================

const STATE_PARK_URL_PATTERNS: Record<string, {
  baseUrl: string;
  trailsPath?: string;
  generateParkUrl: (parkSlug: string) => string;
}> = {
  WI: {
    baseUrl: 'https://dnr.wisconsin.gov/topic/parks',
    generateParkUrl: (parkSlug: string) => `https://dnr.wisconsin.gov/topic/parks/${parkSlug}`,
  },
  FL: {
    baseUrl: 'https://www.floridastateparks.org/parks-and-trails',
    generateParkUrl: (parkSlug: string) => `https://www.floridastateparks.org/parks-and-trails/${parkSlug}`,
  },
  CA: {
    baseUrl: 'https://www.parks.ca.gov',
    generateParkUrl: (parkSlug: string) => `https://www.parks.ca.gov/?page_id=${parkSlug}`,
  },
  TX: {
    baseUrl: 'https://tpwd.texas.gov/state-parks',
    generateParkUrl: (parkSlug: string) => `https://tpwd.texas.gov/state-parks/${parkSlug}`,
  },
  CO: {
    baseUrl: 'https://cpw.state.co.us/placestogo/parks',
    generateParkUrl: (parkSlug: string) => `https://cpw.state.co.us/placestogo/parks/${parkSlug}`,
  },
  AZ: {
    baseUrl: 'https://azstateparks.com',
    generateParkUrl: (parkSlug: string) => `https://azstateparks.com/${parkSlug}`,
  },
  UT: {
    baseUrl: 'https://stateparks.utah.gov',
    generateParkUrl: (parkSlug: string) => `https://stateparks.utah.gov/parks/${parkSlug}`,
  },
  OR: {
    baseUrl: 'https://stateparks.oregon.gov',
    generateParkUrl: (parkSlug: string) => `https://stateparks.oregon.gov/index.cfm?do=park.profile&parkId=${parkSlug}`,
  },
  WA: {
    baseUrl: 'https://parks.wa.gov',
    generateParkUrl: (parkSlug: string) => `https://parks.wa.gov/${parkSlug}`,
  },
  MI: {
    baseUrl: 'https://www2.dnr.state.mi.us/parksandtrails',
    generateParkUrl: (parkSlug: string) => `https://www2.dnr.state.mi.us/parksandtrails/Details.aspx?id=${parkSlug}&type=SPRK`,
  },
};

/**
 * Generate official state park URL from park name and state code
 */
export function generateOfficialParkUrl(parkName: string, stateCode: string): string | undefined {
  const pattern = STATE_PARK_URL_PATTERNS[stateCode.toUpperCase()];
  if (!pattern) return undefined;
  
  // Generate slug from park name
  const parkSlug = parkName
    .toLowerCase()
    .replace(/state\s*(park|beach|forest|recreation\s*area|historic\s*site)/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return pattern.generateParkUrl(parkSlug);
}

/**
 * Generate AllTrails search URL for a trail
 */
export function generateAllTrailsSearchUrl(trailName: string, parkName?: string, stateName?: string): string {
  const query = [trailName, parkName, stateName].filter(Boolean).join(' ');
  return `https://www.alltrails.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Generate coordinate-based Google Maps URL (more reliable than search)
 */
export function generateCoordinateGoogleMapsUrl(
  lat: number, 
  lng: number, 
  label?: string
): string {
  if (label) {
    const query = encodeURIComponent(label);
    return `https://www.google.com/maps/search/${query}/@${lat},${lng},15z`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Required fields for park metadata
 */
export interface ParkMetadataRequirements {
  id: string;
  name: string;
  stateCode: string;
  coordinates?: { latitude: number; longitude: number };
  links: {
    googleMapsUrl?: string;
    officialUrl?: string;
    directionsUrl?: string;
    reservationUrl?: string;
    npsUrl?: string;
  };
}

/**
 * Required fields for trail metadata
 * 
 * Link Priority:
 * 1. officialUrl - State park website (PRIMARY)
 * 2. allTrailsUrl - AllTrails page (SECONDARY)
 * 3. googleMapsUrl - Navigation (FALLBACK)
 */
export interface TrailMetadataRequirements {
  id: string;
  name: string;
  stateCode?: string;
  parkName?: string;
  coordinates?: { latitude: number; longitude: number };
  officialUrl?: string;      // PRIMARY - state park website
  allTrailsUrl?: string;     // SECONDARY - trail discovery
  googleMapsUrl?: string;    // FALLBACK - navigation only
  lengthMiles?: number;
  dataSource: string;
}

/**
 * Required fields for campground metadata
 */
export interface CampgroundMetadataRequirements {
  id: string;
  name: string;
  coordinates?: { latitude: number; longitude: number };
  googleMapsUrl?: string;
  reservationUrl?: string;
  recreationGovUrl?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
  generatedFields: string[];
  warnings: string[];
}

/**
 * Validate and enrich park metadata
 * Generates missing links where possible
 */
export function validateAndEnrichParkMetadata(park: Partial<ParkMetadataRequirements>): {
  enriched: ParkMetadataRequirements;
  validation: ValidationResult;
} {
  const missingFields: string[] = [];
  const generatedFields: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!park.id) missingFields.push('id');
  if (!park.name) missingFields.push('name');
  if (!park.stateCode) missingFields.push('stateCode');

  // Initialize links object
  const links = park.links || {};

  // Generate Google Maps URL if we have coordinates or name
  if (!links.googleMapsUrl) {
    if (park.coordinates) {
      links.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${park.coordinates.latitude},${park.coordinates.longitude}`;
      generatedFields.push('links.googleMapsUrl (from coordinates)');
    } else if (park.name && park.stateCode) {
      links.googleMapsUrl = generateGoogleMapsLink(park.name, undefined, park.stateCode);
      generatedFields.push('links.googleMapsUrl (from name)');
    } else {
      warnings.push('Cannot generate googleMapsUrl - missing coordinates and name');
    }
  }

  // Generate directions URL if we have name
  if (!links.directionsUrl && park.name) {
    const destination = park.stateCode ? `${park.name}, ${park.stateCode}` : park.name;
    links.directionsUrl = generateDirectionsLink(destination);
    generatedFields.push('links.directionsUrl');
  }

  // Warn if no official URL
  if (!links.officialUrl) {
    warnings.push('No official website URL provided');
  }

  // Warn if no coordinates
  if (!park.coordinates) {
    warnings.push('No coordinates provided - mapping features may be limited');
  }

  const enriched: ParkMetadataRequirements = {
    id: park.id || '',
    name: park.name || '',
    stateCode: park.stateCode || '',
    coordinates: park.coordinates,
    links,
  };

  return {
    enriched,
    validation: {
      isValid: missingFields.length === 0,
      missingFields,
      generatedFields,
      warnings,
    },
  };
}

/**
 * Validate and enrich trail metadata
 * Generates missing links following priority order:
 * 1. Official URL (state park website) - PRIMARY
 * 2. AllTrails URL - SECONDARY
 * 3. Google Maps URL - FALLBACK (last resort)
 */
export function validateAndEnrichTrailMetadata(trail: Partial<TrailMetadataRequirements>): {
  enriched: TrailMetadataRequirements;
  validation: ValidationResult;
} {
  const missingFields: string[] = [];
  const generatedFields: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!trail.id) missingFields.push('id');
  if (!trail.name) missingFields.push('name');
  if (!trail.dataSource) missingFields.push('dataSource');

  // PRIORITY 1: Generate Official URL if we have state code and park name
  let officialUrl = trail.officialUrl;
  if (!officialUrl && trail.stateCode && trail.parkName) {
    officialUrl = generateOfficialParkUrl(trail.parkName, trail.stateCode);
    if (officialUrl) {
      generatedFields.push('officialUrl (from state park pattern)');
    }
  }
  if (!officialUrl) {
    warnings.push('No official URL - state park website link not available');
  }

  // PRIORITY 2: Generate AllTrails URL if we have trail name
  let allTrailsUrl = trail.allTrailsUrl;
  if (!allTrailsUrl && trail.name) {
    allTrailsUrl = generateAllTrailsSearchUrl(trail.name, trail.parkName, trail.stateCode);
    generatedFields.push('allTrailsUrl (search)');
  }

  // PRIORITY 3 (FALLBACK): Generate Google Maps URL if we have coordinates
  let googleMapsUrl = trail.googleMapsUrl;
  if (!googleMapsUrl) {
    if (trail.coordinates) {
      googleMapsUrl = generateCoordinateGoogleMapsUrl(
        trail.coordinates.latitude,
        trail.coordinates.longitude,
        `${trail.name} trail`
      );
      generatedFields.push('googleMapsUrl (from coordinates - FALLBACK)');
    } else if (trail.name && trail.parkName) {
      googleMapsUrl = generateGoogleMapsLink(`${trail.name} Trailhead`, trail.parkName);
      generatedFields.push('googleMapsUrl (from name - FALLBACK)');
    } else {
      warnings.push('Cannot generate googleMapsUrl - missing coordinates');
    }
  }

  // Warn if no coordinates
  if (!trail.coordinates) {
    warnings.push('No coordinates provided - navigation features may be limited');
  }

  // Warn if no length
  if (!trail.lengthMiles) {
    warnings.push('No trail length provided');
  }

  const enriched: TrailMetadataRequirements = {
    id: trail.id || '',
    name: trail.name || '',
    stateCode: trail.stateCode,
    parkName: trail.parkName,
    coordinates: trail.coordinates,
    officialUrl,
    allTrailsUrl,
    googleMapsUrl,
    lengthMiles: trail.lengthMiles,
    dataSource: trail.dataSource || '',
  };

  return {
    enriched,
    validation: {
      isValid: missingFields.length === 0,
      missingFields,
      generatedFields,
      warnings,
    },
  };
}

/**
 * Validate and enrich campground metadata
 */
export function validateAndEnrichCampgroundMetadata(campground: Partial<CampgroundMetadataRequirements>): {
  enriched: CampgroundMetadataRequirements;
  validation: ValidationResult;
} {
  const missingFields: string[] = [];
  const generatedFields: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!campground.id) missingFields.push('id');
  if (!campground.name) missingFields.push('name');

  // Generate Google Maps URL if we have coordinates
  let googleMapsUrl = campground.googleMapsUrl;
  if (!googleMapsUrl) {
    if (campground.coordinates) {
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${campground.coordinates.latitude},${campground.coordinates.longitude}`;
      generatedFields.push('googleMapsUrl (from coordinates)');
    } else if (campground.name) {
      googleMapsUrl = generateGoogleMapsLink(campground.name + ' Campground');
      generatedFields.push('googleMapsUrl (from name)');
    }
  }

  // Generate Recreation.gov URL if we have name
  let recreationGovUrl = campground.recreationGovUrl;
  if (!recreationGovUrl && campground.name) {
    recreationGovUrl = generateRecreationGovLink(campground.name);
    generatedFields.push('recreationGovUrl');
  }

  // Warn if no reservation URL
  if (!campground.reservationUrl) {
    warnings.push('No reservation URL provided');
  }

  // Warn if no coordinates
  if (!campground.coordinates) {
    warnings.push('No coordinates provided - mapping features may be limited');
  }

  const enriched: CampgroundMetadataRequirements = {
    id: campground.id || '',
    name: campground.name || '',
    coordinates: campground.coordinates,
    googleMapsUrl,
    reservationUrl: campground.reservationUrl,
    recreationGovUrl,
  };

  return {
    enriched,
    validation: {
      isValid: missingFields.length === 0,
      missingFields,
      generatedFields,
      warnings,
    },
  };
}

/**
 * Batch validate parks and report statistics
 */
export function validateParkBatch(parks: Partial<ParkMetadataRequirements>[]): {
  validCount: number;
  invalidCount: number;
  enrichedParks: ParkMetadataRequirements[];
  allWarnings: string[];
  allGeneratedFields: string[];
} {
  let validCount = 0;
  let invalidCount = 0;
  const enrichedParks: ParkMetadataRequirements[] = [];
  const allWarnings: string[] = [];
  const allGeneratedFields: string[] = [];

  for (const park of parks) {
    const { enriched, validation } = validateAndEnrichParkMetadata(park);
    enrichedParks.push(enriched);

    if (validation.isValid) {
      validCount++;
    } else {
      invalidCount++;
      validation.missingFields.forEach(f => {
        allWarnings.push(`[${park.name || 'Unknown'}] Missing: ${f}`);
      });
    }

    validation.generatedFields.forEach(f => {
      if (!allGeneratedFields.includes(f)) {
        allGeneratedFields.push(f);
      }
    });

    validation.warnings.forEach(w => {
      allWarnings.push(`[${park.name || 'Unknown'}] ${w}`);
    });
  }

  return {
    validCount,
    invalidCount,
    enrichedParks,
    allWarnings,
    allGeneratedFields,
  };
}

/**
 * Batch validate trails and report statistics
 */
export function validateTrailBatch(trails: Partial<TrailMetadataRequirements>[]): {
  validCount: number;
  invalidCount: number;
  enrichedTrails: TrailMetadataRequirements[];
  allWarnings: string[];
  allGeneratedFields: string[];
} {
  let validCount = 0;
  let invalidCount = 0;
  const enrichedTrails: TrailMetadataRequirements[] = [];
  const allWarnings: string[] = [];
  const allGeneratedFields: string[] = [];

  for (const trail of trails) {
    const { enriched, validation } = validateAndEnrichTrailMetadata(trail);
    enrichedTrails.push(enriched);

    if (validation.isValid) {
      validCount++;
    } else {
      invalidCount++;
      validation.missingFields.forEach(f => {
        allWarnings.push(`[${trail.name || 'Unknown'}] Missing: ${f}`);
      });
    }

    validation.generatedFields.forEach(f => {
      if (!allGeneratedFields.includes(f)) {
        allGeneratedFields.push(f);
      }
    });
  }

  return {
    validCount,
    invalidCount,
    enrichedTrails,
    allWarnings,
    allGeneratedFields,
  };
}

/**
 * Log validation summary
 */
export function logValidationSummary(
  type: 'parks' | 'trails' | 'campgrounds',
  validCount: number,
  invalidCount: number,
  generatedFields: string[],
  warnings: string[],
  verbose: boolean = false
): void {
  const total = validCount + invalidCount;
  console.log(`\n[Metadata Validation] ${type.toUpperCase()}`);
  console.log(`  Total: ${total}`);
  console.log(`  Valid: ${validCount} (${((validCount / total) * 100).toFixed(1)}%)`);
  console.log(`  Invalid: ${invalidCount}`);
  
  if (generatedFields.length > 0) {
    console.log(`  Auto-generated fields:`);
    generatedFields.forEach(f => console.log(`    - ${f}`));
  }

  if (verbose && warnings.length > 0) {
    console.log(`  Warnings (${warnings.length}):`);
    warnings.slice(0, 10).forEach(w => console.log(`    - ${w}`));
    if (warnings.length > 10) {
      console.log(`    ... and ${warnings.length - 10} more`);
    }
  }
}
