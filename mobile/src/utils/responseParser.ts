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
import { validateLinks, generateGoogleMapsFallback } from './linkValidator';
import { PARK_DETECTION_PATTERNS, PARK_GATEWAYS } from '../data/nationalParks';

/**
 * Detect park from text (user message or response)
 */
export function detectParkFromText(text: string): CachedPark | null {
  for (const park of PARK_DETECTION_PATTERNS) {
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
 * Parse API response to extract cacheable data (synchronous)
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

/**
 * Parse API response and validate links asynchronously
 * Call this AFTER the response is displayed to avoid slowing down the UI
 */
export async function parseApiResponseWithValidation(response: string): Promise<{
  links: CachedLink[];
  restaurantMentions: string[];
}> {
  const rawLinks = extractLinks(response);
  const validatedLinks = await validateLinks(rawLinks);
  
  return {
    links: validatedLinks,
    restaurantMentions: extractRestaurantMentions(response),
  };
}
