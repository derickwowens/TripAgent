/**
 * Link utilities for generating short, user-friendly URLs
 */

/**
 * Generate a Google Maps search link for a location
 * @param name - Name of the place (restaurant, trailhead, etc.)
 * @param city - City name (optional)
 * @param state - State abbreviation (optional)
 * @returns Google Maps search URL
 */
export function generateGoogleMapsLink(name: string, city?: string, state?: string): string {
  const query = city && state 
    ? `${name}, ${city}, ${state}`
    : city 
      ? `${name}, ${city}`
      : name;
  
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Generate a Google Maps directions link
 * @param destination - Destination name or address
 * @returns Google Maps directions URL
 */
export function generateDirectionsLink(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * Generate a PlugShare link for EV charging station search
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns PlugShare URL
 */
export function generatePlugShareLink(lat: number, lng: number): string {
  return `https://www.plugshare.com/map#/${lat}/${lng}`;
}

/**
 * Generate a Tesla Supercharger finder link
 * @param location - Location name or city
 * @returns Tesla find-us URL
 */
export function generateTeslaChargerLink(location: string): string {
  return `https://www.tesla.com/findus?search=${encodeURIComponent(location)}&type=supercharger`;
}

/**
 * Generate an AllTrails search link for a hike/trail
 * @param trailName - Name of the trail
 * @param parkName - Name of the park (optional)
 * @returns AllTrails search URL
 */
export function generateAllTrailsLink(trailName: string, parkName?: string): string {
  const query = parkName ? `${trailName} ${parkName}` : trailName;
  return `https://www.alltrails.com/search?q=${encodeURIComponent(query)}`;
}

/**
 * Generate an NPS campground link
 * @param parkCode - NPS park code (e.g., 'yell', 'grca')
 * @param campgroundName - Name of the campground (optional)
 * @returns NPS camping URL
 */
export function generateNPSCampgroundLink(parkCode: string, campgroundName?: string): string {
  if (campgroundName) {
    // Search for specific campground on recreation.gov
    return `https://www.recreation.gov/search?q=${encodeURIComponent(campgroundName)}`;
  }
  return `https://www.nps.gov/${parkCode}/planyourvisit/camping.htm`;
}

/**
 * Generate a recreation.gov search link
 * @param query - Search query (campground name, park, etc.)
 * @returns Recreation.gov search URL
 */
export function generateRecreationGovLink(query: string): string {
  return `https://www.recreation.gov/search?q=${encodeURIComponent(query)}`;
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
