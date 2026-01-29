/**
 * Utility to calculate which national parks are within a user's travel distance
 * Pre-calculates a blacklist of parks outside the user's range to avoid runtime overhead
 */

// Park coordinates (approximate center points for each park)
// Coordinates sourced from NPS data
export const PARK_COORDINATES: Record<string, { lat: number; lng: number; code: string }> = {
  'Acadia National Park': { lat: 44.35, lng: -68.21, code: 'acad' },
  'Arches National Park': { lat: 38.73, lng: -109.59, code: 'arch' },
  'Badlands National Park': { lat: 43.75, lng: -102.50, code: 'badl' },
  'Big Bend National Park': { lat: 29.25, lng: -103.25, code: 'bibe' },
  'Biscayne National Park': { lat: 25.65, lng: -80.08, code: 'bisc' },
  'Black Canyon of the Gunnison National Park': { lat: 38.57, lng: -107.72, code: 'blca' },
  'Bryce Canyon National Park': { lat: 37.57, lng: -112.18, code: 'brca' },
  'Canyonlands National Park': { lat: 38.20, lng: -109.93, code: 'cany' },
  'Capitol Reef National Park': { lat: 38.20, lng: -111.17, code: 'care' },
  'Carlsbad Caverns National Park': { lat: 32.17, lng: -104.44, code: 'cave' },
  'Channel Islands National Park': { lat: 34.01, lng: -119.42, code: 'chis' },
  'Congaree National Park': { lat: 33.78, lng: -80.78, code: 'cong' },
  'Crater Lake National Park': { lat: 42.94, lng: -122.10, code: 'crla' },
  'Cuyahoga Valley National Park': { lat: 41.24, lng: -81.55, code: 'cuva' },
  'Death Valley National Park': { lat: 36.51, lng: -117.08, code: 'deva' },
  'Denali National Park': { lat: 63.33, lng: -150.50, code: 'dena' },
  'Dry Tortugas National Park': { lat: 24.63, lng: -82.87, code: 'drto' },
  'Everglades National Park': { lat: 25.29, lng: -80.90, code: 'ever' },
  'Gates of the Arctic National Park': { lat: 67.78, lng: -153.30, code: 'gaar' },
  'Gateway Arch National Park': { lat: 38.62, lng: -90.19, code: 'jeff' },
  'Glacier National Park': { lat: 48.80, lng: -114.00, code: 'glac' },
  'Glacier Bay National Park': { lat: 58.50, lng: -137.00, code: 'glba' },
  'Grand Canyon National Park': { lat: 36.06, lng: -112.14, code: 'grca' },
  'Grand Teton National Park': { lat: 43.73, lng: -110.80, code: 'grte' },
  'Great Basin National Park': { lat: 38.98, lng: -114.30, code: 'grba' },
  'Great Sand Dunes National Park': { lat: 37.73, lng: -105.51, code: 'grsa' },
  'Great Smoky Mountains National Park': { lat: 35.68, lng: -83.53, code: 'grsm' },
  'Guadalupe Mountains National Park': { lat: 31.92, lng: -104.87, code: 'gumo' },
  'Haleakalā National Park': { lat: 20.72, lng: -156.17, code: 'hale' },
  'Hawaiʻi Volcanoes National Park': { lat: 19.38, lng: -155.20, code: 'havo' },
  'Hot Springs National Park': { lat: 34.51, lng: -93.05, code: 'hosp' },
  'Indiana Dunes National Park': { lat: 41.65, lng: -87.05, code: 'indu' },
  'Isle Royale National Park': { lat: 48.10, lng: -88.55, code: 'isro' },
  'Joshua Tree National Park': { lat: 33.87, lng: -115.90, code: 'jotr' },
  'Katmai National Park': { lat: 58.50, lng: -155.00, code: 'katm' },
  'Kenai Fjords National Park': { lat: 59.92, lng: -149.65, code: 'kefj' },
  'Kobuk Valley National Park': { lat: 67.55, lng: -159.28, code: 'kova' },
  'Lake Clark National Park': { lat: 60.97, lng: -153.42, code: 'lacl' },
  'Lassen Volcanic National Park': { lat: 40.49, lng: -121.51, code: 'lavo' },
  'Mammoth Cave National Park': { lat: 37.19, lng: -86.10, code: 'maca' },
  'Mesa Verde National Park': { lat: 37.18, lng: -108.49, code: 'meve' },
  'Mount Rainier National Park': { lat: 46.88, lng: -121.73, code: 'mora' },
  'New River Gorge National Park': { lat: 38.07, lng: -81.08, code: 'neri' },
  'North Cascades National Park': { lat: 48.77, lng: -121.21, code: 'noca' },
  'Olympic National Park': { lat: 47.80, lng: -123.60, code: 'olym' },
  'Petrified Forest National Park': { lat: 35.07, lng: -109.78, code: 'pefo' },
  'Pinnacles National Park': { lat: 36.49, lng: -121.16, code: 'pinn' },
  'Redwood National and State Parks': { lat: 41.21, lng: -124.00, code: 'redw' },
  'Rocky Mountain National Park': { lat: 40.34, lng: -105.68, code: 'romo' },
  'Saguaro National Park': { lat: 32.18, lng: -110.74, code: 'sagu' },
  'Sequoia & Kings Canyon National Parks': { lat: 36.49, lng: -118.57, code: 'seki' },
  'Shenandoah National Park': { lat: 38.53, lng: -78.35, code: 'shen' },
  'Theodore Roosevelt National Park': { lat: 46.97, lng: -103.45, code: 'thro' },
  'Virgin Islands National Park': { lat: 18.33, lng: -64.73, code: 'viis' },
  'Voyageurs National Park': { lat: 48.50, lng: -92.88, code: 'voya' },
  'White Sands National Park': { lat: 32.78, lng: -106.17, code: 'whsa' },
  'Wind Cave National Park': { lat: 43.57, lng: -103.48, code: 'wica' },
  'Wrangell-St. Elias National Park': { lat: 61.00, lng: -142.00, code: 'wrst' },
  'Yellowstone National Park': { lat: 44.43, lng: -110.59, code: 'yell' },
  'Yosemite National Park': { lat: 37.87, lng: -119.54, code: 'yose' },
  'Zion National Park': { lat: 37.30, lng: -113.05, code: 'zion' },
};

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get list of parks within a given distance from user's location
 * @param userLat User's latitude
 * @param userLng User's longitude
 * @param maxDistanceMiles Maximum distance in miles (null = unlimited)
 * @returns Object with parks within range and parks outside range (blacklisted)
 */
export function filterParksByDistance(
  userLat: number,
  userLng: number,
  maxDistanceMiles: number | null
): {
  parksInRange: string[];
  blacklistedParks: string[];
  parkDistances: Record<string, number>;
} {
  if (maxDistanceMiles === null) {
    // Unlimited - all parks are in range
    return {
      parksInRange: Object.keys(PARK_COORDINATES),
      blacklistedParks: [],
      parkDistances: {},
    };
  }

  const parksInRange: string[] = [];
  const blacklistedParks: string[] = [];
  const parkDistances: Record<string, number> = {};

  for (const [parkName, coords] of Object.entries(PARK_COORDINATES)) {
    const distance = calculateDistanceMiles(userLat, userLng, coords.lat, coords.lng);
    parkDistances[parkName] = Math.round(distance);

    if (distance <= maxDistanceMiles) {
      parksInRange.push(parkName);
    } else {
      blacklistedParks.push(parkName);
    }
  }

  return { parksInRange, blacklistedParks, parkDistances };
}

/**
 * Get park codes for blacklisted parks (for API filtering)
 */
export function getBlacklistedParkCodes(
  userLat: number,
  userLng: number,
  maxDistanceMiles: number | null
): string[] {
  const { blacklistedParks } = filterParksByDistance(userLat, userLng, maxDistanceMiles);
  return blacklistedParks
    .map(name => PARK_COORDINATES[name]?.code)
    .filter((code): code is string => !!code);
}

/**
 * Check if a specific park is within the user's travel range
 */
export function isParkInRange(
  parkName: string,
  userLat: number,
  userLng: number,
  maxDistanceMiles: number | null
): boolean {
  if (maxDistanceMiles === null) return true;
  
  const coords = PARK_COORDINATES[parkName];
  if (!coords) return true; // Unknown park, don't filter
  
  const distance = calculateDistanceMiles(userLat, userLng, coords.lat, coords.lng);
  return distance <= maxDistanceMiles;
}

/**
 * Get distance to a specific park from user's location
 */
export function getDistanceToPark(
  parkName: string,
  userLat: number,
  userLng: number
): number | null {
  const coords = PARK_COORDINATES[parkName];
  if (!coords) return null;
  
  return Math.round(calculateDistanceMiles(userLat, userLng, coords.lat, coords.lng));
}

/**
 * Get list of whitelisted (in-range) park display names for UI use
 * Returns short names like "Yellowstone", "Grand Canyon" instead of full names
 */
export function getWhitelistedParkNames(
  userLat: number | undefined,
  userLng: number | undefined,
  maxDistanceMiles: number | null
): string[] {
  // If no location or unlimited distance, return all parks
  if (userLat === undefined || userLng === undefined || maxDistanceMiles === null) {
    return Object.keys(PARK_COORDINATES).map(name => 
      name.replace(/ National Park$/, '')
          .replace(/ National and State Parks$/, '')
    );
  }
  
  const { parksInRange } = filterParksByDistance(userLat, userLng, maxDistanceMiles);
  return parksInRange.map(name => 
    name.replace(/ National Park$/, '')
        .replace(/ National and State Parks$/, '')
  );
}
