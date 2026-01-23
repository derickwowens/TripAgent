/**
 * Response Parser - Extracts structured data from API responses and user messages
 * Used to dynamically update the trip context cache
 */

import { 
  CachedPark, 
  CachedHike, 
  CachedRestaurant, 
  CachedLink, 
  CachedEvCharger 
} from '../hooks/useTripContext';

// Park name patterns for detection
const NATIONAL_PARKS: Array<{ pattern: RegExp; name: string; code: string }> = [
  { pattern: /yellowstone/i, name: 'Yellowstone National Park', code: 'yell' },
  { pattern: /grand\s*canyon/i, name: 'Grand Canyon National Park', code: 'grca' },
  { pattern: /yosemite/i, name: 'Yosemite National Park', code: 'yose' },
  { pattern: /zion/i, name: 'Zion National Park', code: 'zion' },
  { pattern: /glacier(?!\s*bay)/i, name: 'Glacier National Park', code: 'glac' },
  { pattern: /grand\s*teton/i, name: 'Grand Teton National Park', code: 'grte' },
  { pattern: /acadia/i, name: 'Acadia National Park', code: 'acad' },
  { pattern: /rocky\s*mountain/i, name: 'Rocky Mountain National Park', code: 'romo' },
  { pattern: /great\s*smoky|smokies/i, name: 'Great Smoky Mountains National Park', code: 'grsm' },
  { pattern: /joshua\s*tree/i, name: 'Joshua Tree National Park', code: 'jotr' },
  { pattern: /bryce\s*canyon/i, name: 'Bryce Canyon National Park', code: 'brca' },
  { pattern: /arches/i, name: 'Arches National Park', code: 'arch' },
  { pattern: /canyonlands/i, name: 'Canyonlands National Park', code: 'cany' },
  { pattern: /olympic/i, name: 'Olympic National Park', code: 'olym' },
  { pattern: /mount\s*rainier|mt\.?\s*rainier/i, name: 'Mount Rainier National Park', code: 'mora' },
  { pattern: /death\s*valley/i, name: 'Death Valley National Park', code: 'deva' },
  { pattern: /sequoia/i, name: 'Sequoia National Park', code: 'sequ' },
  { pattern: /denali/i, name: 'Denali National Park', code: 'dena' },
  { pattern: /everglades/i, name: 'Everglades National Park', code: 'ever' },
  { pattern: /shenandoah/i, name: 'Shenandoah National Park', code: 'shen' },
  { pattern: /big\s*bend/i, name: 'Big Bend National Park', code: 'bibe' },
  { pattern: /crater\s*lake/i, name: 'Crater Lake National Park', code: 'crla' },
  { pattern: /badlands/i, name: 'Badlands National Park', code: 'badl' },
  { pattern: /redwood/i, name: 'Redwood National Park', code: 'redw' },
  { pattern: /capitol\s*reef/i, name: 'Capitol Reef National Park', code: 'care' },
];

// Gateway cities for parks
const PARK_GATEWAYS: Record<string, { city: string; state: string }> = {
  'yell': { city: 'West Yellowstone', state: 'MT' },
  'grca': { city: 'Tusayan', state: 'AZ' },
  'yose': { city: 'Mariposa', state: 'CA' },
  'zion': { city: 'Springdale', state: 'UT' },
  'glac': { city: 'West Glacier', state: 'MT' },
  'grte': { city: 'Jackson', state: 'WY' },
  'acad': { city: 'Bar Harbor', state: 'ME' },
  'romo': { city: 'Estes Park', state: 'CO' },
  'grsm': { city: 'Gatlinburg', state: 'TN' },
  'jotr': { city: 'Twentynine Palms', state: 'CA' },
  'brca': { city: 'Bryce Canyon City', state: 'UT' },
  'arch': { city: 'Moab', state: 'UT' },
  'cany': { city: 'Moab', state: 'UT' },
  'olym': { city: 'Port Angeles', state: 'WA' },
  'mora': { city: 'Ashford', state: 'WA' },
  'deva': { city: 'Furnace Creek', state: 'CA' },
  'sequ': { city: 'Three Rivers', state: 'CA' },
  'dena': { city: 'Denali Park', state: 'AK' },
  'ever': { city: 'Homestead', state: 'FL' },
  'shen': { city: 'Luray', state: 'VA' },
  'bibe': { city: 'Terlingua', state: 'TX' },
  'crla': { city: 'Prospect', state: 'OR' },
  'badl': { city: 'Wall', state: 'SD' },
  'redw': { city: 'Crescent City', state: 'CA' },
  'care': { city: 'Torrey', state: 'UT' },
};

/**
 * Detect park from text (user message or response)
 */
export function detectParkFromText(text: string): CachedPark | null {
  for (const park of NATIONAL_PARKS) {
    if (park.pattern.test(text)) {
      const gateway = PARK_GATEWAYS[park.code];
      return {
        name: park.name,
        parkCode: park.code,
        gatewayCity: gateway?.city,
        gatewayState: gateway?.state,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
  return null;
}

/**
 * Extract travel dates from user message
 */
export function extractTravelDates(text: string): { arrival?: string; departure?: string } | null {
  const result: { arrival?: string; departure?: string } = {};
  
  // Match patterns like "March 15-20", "March 15 to March 20", "from March 15 to 20"
  const dateRangePattern = /(?:from\s+)?(\w+\s+\d{1,2})(?:\s*[-–to]+\s*)(\w+\s+\d{1,2}|\d{1,2})/i;
  const rangeMatch = text.match(dateRangePattern);
  
  if (rangeMatch) {
    result.arrival = rangeMatch[1];
    // If second part is just a number, assume same month
    if (/^\d{1,2}$/.test(rangeMatch[2])) {
      const month = rangeMatch[1].split(' ')[0];
      result.departure = `${month} ${rangeMatch[2]}`;
    } else {
      result.departure = rangeMatch[2];
    }
    return result;
  }
  
  // Match single date mentions
  const monthNames = 'january|february|march|april|may|june|july|august|september|october|november|december';
  const singleDatePattern = new RegExp(`(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'gi');
  const dates: string[] = [];
  let match;
  
  while ((match = singleDatePattern.exec(text)) !== null) {
    dates.push(`${match[1]} ${match[2]}`);
  }
  
  if (dates.length >= 2) {
    result.arrival = dates[0];
    result.departure = dates[1];
    return result;
  } else if (dates.length === 1) {
    result.arrival = dates[0];
    return result;
  }
  
  return null;
}

/**
 * Extract number of travelers from user message
 */
export function extractTravelers(text: string): number | null {
  const textLower = text.toLowerCase();
  
  // Explicit number patterns
  const numPattern = /(\d+)\s*(?:people|travelers|persons|adults|of us|guests)/i;
  const numMatch = text.match(numPattern);
  if (numMatch) {
    return parseInt(numMatch[1]);
  }
  
  // Word patterns
  if (textLower.includes('solo') || textLower.includes('just me') || textLower.includes('myself') || textLower.includes('alone')) {
    return 1;
  }
  if (textLower.includes('couple') || textLower.includes('two of us') || textLower.includes('my partner and i') || textLower.includes('both of us')) {
    return 2;
  }
  if (textLower.includes('family of')) {
    const familyMatch = text.match(/family of (\d+)/i);
    if (familyMatch) return parseInt(familyMatch[1]);
    return 4; // Default family size
  }
  if (textLower.includes('family')) {
    return 4;
  }
  
  return null;
}

/**
 * Extract departure airport from user message
 */
export function extractDepartureAirport(text: string): string | null {
  // Match airport codes
  const airportCodePattern = /\b(flying|departing|leaving|from)\s+(?:from\s+)?([A-Z]{3})\b/i;
  const codeMatch = text.match(airportCodePattern);
  if (codeMatch) {
    return codeMatch[2].toUpperCase();
  }
  
  // Match "from [city]" patterns
  const cityPattern = /(?:flying|departing|leaving|from)\s+(?:from\s+)?([\w\s]+?)(?:\s+to|\s+airport|,|\.|\?|$)/i;
  const cityMatch = text.match(cityPattern);
  if (cityMatch && cityMatch[1].length < 30) {
    return cityMatch[1].trim();
  }
  
  return null;
}

/**
 * Extract links from response text
 */
export function extractLinks(text: string): CachedLink[] {
  const links: CachedLink[] = [];
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let match;
  
  while ((match = linkPattern.exec(text)) !== null) {
    const linkText = match[1];
    const url = match[2];
    
    // Categorize link
    let category: CachedLink['category'] = 'general';
    
    if (url.includes('opentable.com') || url.includes('resy.com') || 
        linkText.toLowerCase().includes('reserv') || linkText.toLowerCase().includes('book')) {
      category = 'reservation';
    } else if (url.includes('yelp.com') || url.includes('google.com/maps') || 
               linkText.toLowerCase().includes('review')) {
      category = 'review';
    } else if (url.includes('nps.gov')) {
      category = 'park';
    } else if (url.includes('booking.com') || url.includes('hotels.com') || 
               url.includes('airbnb.com') || linkText.toLowerCase().includes('hotel') ||
               linkText.toLowerCase().includes('lodge') || linkText.toLowerCase().includes('cabin')) {
      category = 'lodging';
    }
    
    // Avoid duplicates
    if (!links.some(l => l.url === url)) {
      links.push({ text: linkText, url, category });
    }
  }
  
  return links;
}

/**
 * Extract restaurants from response text (basic pattern matching)
 * For full restaurant data, use the API response directly
 */
export function extractRestaurantMentions(text: string): string[] {
  const restaurants: string[] = [];
  
  // Match patterns like "**Restaurant Name**" or "1. Restaurant Name"
  const boldPattern = /\*\*([^*]+)\*\*/g;
  const listPattern = /^\d+\.\s+\*?\*?([^*\n]+)/gm;
  
  let match;
  while ((match = boldPattern.exec(text)) !== null) {
    const name = match[1].trim();
    // Filter out non-restaurant entries
    if (name.length < 50 && !name.match(/day|morning|afternoon|evening|tip|note|warning/i)) {
      restaurants.push(name);
    }
  }
  
  return [...new Set(restaurants)].slice(0, 10);
}

/**
 * Parse user message to extract all relevant context
 */
export function parseUserMessage(message: string): {
  park?: CachedPark;
  travelDates?: { arrival?: string; departure?: string };
  travelers?: number;
  departingFrom?: string;
} {
  const result: ReturnType<typeof parseUserMessage> = {};
  
  const park = detectParkFromText(message);
  if (park) result.park = park;
  
  const dates = extractTravelDates(message);
  if (dates) result.travelDates = dates;
  
  const travelers = extractTravelers(message);
  if (travelers) result.travelers = travelers;
  
  const airport = extractDepartureAirport(message);
  if (airport) result.departingFrom = airport;
  
  return result;
}

/**
 * Parse API response to extract cacheable data
 */
export function parseApiResponse(response: string): {
  links: CachedLink[];
  restaurantMentions: string[];
} {
  return {
    links: extractLinks(response),
    restaurantMentions: extractRestaurantMentions(response),
  };
}
