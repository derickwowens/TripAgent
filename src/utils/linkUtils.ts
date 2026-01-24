/**
 * Utility functions for generating various types of links for locations
 */

/**
 * Validate a URL by making a HEAD request to check if it returns a valid response
 * Returns the URL if valid, or undefined if invalid (404, timeout, etc.)
 */
export async function validateUrl(url: string, timeoutMs: number = 3000): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TripAgent/1.0)',
      },
    });
    
    clearTimeout(timeoutId);
    
    // Accept 2xx and 3xx status codes as valid
    if (response.ok || (response.status >= 300 && response.status < 400)) {
      return url;
    }
    
    console.log(`[LinkValidation] URL returned ${response.status}: ${url}`);
    return undefined;
  } catch (error: any) {
    // Don't log aborted requests (timeouts) at error level
    if (error.name === 'AbortError') {
      console.log(`[LinkValidation] URL timeout: ${url}`);
    } else {
      console.log(`[LinkValidation] URL validation failed: ${url}`, error.message);
    }
    return undefined;
  }
}

/**
 * Validate a URL and return fallback if invalid
 */
export async function validateUrlWithFallback(
  primaryUrl: string | undefined,
  fallbackUrl: string,
  timeoutMs: number = 3000
): Promise<string> {
  if (!primaryUrl) {
    return fallbackUrl;
  }
  
  const validatedUrl = await validateUrl(primaryUrl, timeoutMs);
  return validatedUrl || fallbackUrl;
}

/**
 * Batch validate multiple URLs in parallel with a concurrency limit
 * Returns a map of original URL -> validated URL (or undefined if invalid)
 */
export async function validateUrlsBatch(
  urls: string[],
  timeoutMs: number = 3000,
  concurrency: number = 5
): Promise<Map<string, string | undefined>> {
  const results = new Map<string, string | undefined>();
  
  // Process in batches to avoid overwhelming the network
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const validated = await validateUrl(url, timeoutMs);
        return { url, validated };
      })
    );
    
    batchResults.forEach(({ url, validated }) => {
      results.set(url, validated);
    });
  }
  
  return results;
}

/**
 * Generate a Google Maps search link for a location
 * @param name - Name of the place (restaurant, trailhead, etc.)
 * @param city - City name (optional)
 * @param state - State abbreviation (optional)
 * @returns Google Maps search URL
 */
export function generateGoogleMapsLink(name: string, city?: string, state?: string): string {
  const query = [name, city, state].filter(Boolean).join(' ');
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  console.log(`[LinkGen] Google Maps: name="${name}", city="${city || 'none'}", state="${state || 'none'}" -> ${url}`);
  return url;
}

/**
 * Generate a Google Maps directions link
 * @param destination - Destination name or address
 * @returns Google Maps directions URL
 */
export function generateDirectionsLink(destination: string): string {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  console.log(`[LinkGen] Directions: destination="${destination}" -> ${url}`);
  return url;
}

/**
 * Generate a PlugShare link for EV charging station search
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns PlugShare URL
 */
export function generatePlugShareLink(lat: number, lng: number): string {
  const url = `https://www.plugshare.com/map#/${lat}/${lng}`;
  console.log(`[LinkGen] PlugShare: lat=${lat}, lng=${lng} -> ${url}`);
  return url;
}

/**
 * Generate a Tesla Supercharger finder link
 * @param location - Location name or city
 * @returns Tesla find-us URL
 */
export function generateTeslaChargerLink(location: string): string {
  const url = `https://www.tesla.com/findus?search=${encodeURIComponent(location)}&type=supercharger`;
  console.log(`[LinkGen] Tesla Charger: location="${location}" -> ${url}`);
  return url;
}

/**
 * Generate an AllTrails search link for a hike/trail
 * @param trailName - Name of the trail
 * @param parkName - Name of the park (optional)
 * @returns AllTrails search URL
 */
export function generateAllTrailsLink(trailName: string, parkName?: string): string {
  const query = parkName ? `${trailName} ${parkName}` : trailName;
  const url = `https://www.alltrails.com/search?q=${encodeURIComponent(query)}`;
  console.log(`[LinkGen] AllTrails: trail="${trailName}", park="${parkName || 'none'}" -> ${url}`);
  return url;
}

/**
 * Generate an NPS campground link
 * @param parkCode - NPS park code (e.g., 'yell', 'grca')
 * @param campgroundName - Name of the campground (optional)
 * @returns NPS camping URL
 */
export function generateNPSCampgroundLink(parkCode: string, campgroundName?: string): string {
  let url: string;
  if (campgroundName) {
    // Search for specific campground on recreation.gov
    url = `https://www.recreation.gov/search?q=${encodeURIComponent(campgroundName)}`;
  } else {
    url = `https://www.nps.gov/${parkCode}/planyourvisit/camping.htm`;
  }
  console.log(`[LinkGen] NPS Campground: parkCode="${parkCode}", campground="${campgroundName || 'none'}" -> ${url}`);
  return url;
}

/**
 * Generate a recreation.gov search link
 * @param query - Search query (campground name, park, etc.)
 * @returns Recreation.gov search URL
 */
export function generateRecreationGovLink(query: string): string {
  const url = `https://www.recreation.gov/search?q=${encodeURIComponent(query)}`;
  console.log(`[LinkGen] Recreation.gov: query="${query}" -> ${url}`);
  return url;
}

/**
 * Shorten a URL for display (extracts domain)
 * Note: This is just for display, the actual link should still use the full URL
 * @param url - Full URL
 * @returns Shortened display version
 */
export function shortenUrlForDisplay(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}
