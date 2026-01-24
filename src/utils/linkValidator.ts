/**
 * Link Validator with Pattern-Based Validation
 * Validates links using URL patterns (not HTTP requests which often fail)
 * Removes or fixes broken links before they reach the user
 */

import { NATIONAL_PARKS } from './parkCodeLookup.js';
import { VALIDATED_NPS_LINKS, getParkLink, hasValidatedLinks } from '../data/validatedNpsLinks.js';

interface LinkValidationResult {
  originalUrl: string;
  validatedUrl: string;
  isValid: boolean;
  format: string;
}

// Valid NPS park codes for pattern validation
const VALID_PARK_CODES = new Set(Object.keys(NATIONAL_PARKS));

// Known-good NPS URL patterns (regex) - ONLY these are guaranteed to work
const VALID_NPS_PATTERNS = [
  // Main park page: /parkcode/index.htm or /parkcode/
  /^https:\/\/www\.nps\.gov\/([a-z]{4})\/(?:index\.htm)?$/i,
  // Common uploads (photos) - static assets always work
  /^https:\/\/www\.nps\.gov\/common\/uploads\//i,
];

// NPS subpages that RARELY exist - only block truly problematic patterns
// Less aggressive: many planyourvisit subpages DO exist (camping, fees, hours, etc.)
const INVALID_NPS_SUBPAGE_PATTERNS = [
  /\/getinvolved\//i,   // Usually doesn't exist
  /\/news\//i,          // Often broken
  /\/kids\//i,          // Rarely exists
  /\/teachers\//i,      // Rarely exists
  /\/stargazing/i,      // Very inconsistent
  /\/houseboats/i,      // Park-specific, usually doesn't exist
  /\/snowmobiling/i,    // Park-specific
  /\/scuba/i,           // Park-specific
];

// Note: We're NOT blocking /planyourvisit/, /learn/, /fishing/, /camping/, etc.
// because many of these DO exist and are useful links. Let them through and
// the user will see if they work or not. Better than removing valid links.

/**
 * Detect the type of NPS subpage from URL
 */
function detectNpsLinkType(url: string): string | null {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('/camping')) return 'camping';
  if (urlLower.includes('/hiking')) return 'hiking';
  if (urlLower.includes('/fees')) return 'fees';
  if (urlLower.includes('/hours')) return 'hours';
  if (urlLower.includes('/conditions') || urlLower.includes('/alerts')) return 'alerts';
  if (urlLower.includes('/planyourvisit') && !urlLower.includes('/planyourvisit/')) return 'planyourvisit';
  if (urlLower.includes('/basicinfo')) return 'other';
  if (urlLower.endsWith('/index.htm') || urlLower.match(/\/[a-z]{4}\/?$/)) return 'main';
  return null;
}

/**
 * Validate an NPS URL using validated links data or pattern matching
 */
function isValidNpsUrl(url: string): { isValid: boolean; fixedUrl?: string } {
  // Extract park code from URL
  const parkCodeMatch = url.match(/nps\.gov\/([a-z]{4})\//i);
  const parkCode = parkCodeMatch?.[1]?.toLowerCase();
  
  // If we have validated links data, use it for precise validation
  if (hasValidatedLinks() && parkCode) {
    const parkData = VALIDATED_NPS_LINKS[parkCode];
    if (parkData) {
      // Check if this exact URL is in our validated links
      const matchingLink = parkData.links.find(link => 
        url.toLowerCase().includes(link.url.toLowerCase().replace('https://www.nps.gov/', ''))
      );
      
      if (matchingLink?.isValid) {
        return { isValid: true };
      }
      
      // URL matches an invalid link - use alternate if available
      if (matchingLink && !matchingLink.isValid && matchingLink.alternateUrl) {
        console.log(`[LinkValidator] Using alternate for ${url}: ${matchingLink.alternateUrl} (${matchingLink.alternateSource})`);
        return { 
          isValid: false, 
          fixedUrl: matchingLink.alternateUrl 
        };
      }
      
      // Try to detect link type and find matching alternate
      const linkType = detectNpsLinkType(url);
      if (linkType) {
        const typedLink = parkData.links.find(l => l.type === linkType);
        if (typedLink?.alternateUrl) {
          console.log(`[LinkValidator] Using alternate for ${linkType}: ${typedLink.alternateUrl}`);
          return { 
            isValid: false, 
            fixedUrl: typedLink.alternateUrl 
          };
        }
      }
      
      // Fallback to main page
      return { 
        isValid: false, 
        fixedUrl: parkData.mainUrl 
      };
    }
  }
  
  // Fallback to pattern-based validation if no validated data
  
  // Check if it matches any known-invalid subpage patterns
  for (const pattern of INVALID_NPS_SUBPAGE_PATTERNS) {
    if (pattern.test(url)) {
      // Extract park code and return main page instead
      if (parkCode && VALID_PARK_CODES.has(parkCode)) {
        return { 
          isValid: false, 
          fixedUrl: `https://www.nps.gov/${parkCode}/index.htm` 
        };
      }
      return { isValid: false };
    }
  }
  
  // Check if it matches known-good patterns
  for (const pattern of VALID_NPS_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      // Verify the park code is valid
      const matchedCode = match[1]?.toLowerCase();
      if (!matchedCode || VALID_PARK_CODES.has(matchedCode)) {
        return { isValid: true };
      }
    }
  }
  
  // For other NPS URLs, check if park code is valid
  if (parkCode) {
    if (!VALID_PARK_CODES.has(parkCode)) {
      return { isValid: false };
    }
    // Unknown subpage - redirect to main page to be safe
    return { 
      isValid: false, 
      fixedUrl: `https://www.nps.gov/${parkCode}/index.htm` 
    };
  }
  
  // Not an NPS URL we recognize
  return { isValid: true };
}

/**
 * Check if a URL is a "safe" search URL that always works
 * (Search URLs show results pages even if no results found)
 */
function isSafeSearchUrl(url: string): boolean {
  const safePatterns = [
    /booking\.com\/searchresults/i,
    /expedia\.com\/Hotel-Search/i,
    /hotels\.com\/search/i,
    /kayak\.com\/flights/i,
    /kayak\.com\/cars/i,
    /kayak\.com\/hotels/i,
    /google\.com\/travel\/flights/i,
    /google\.com\/search/i,
    /skyscanner\.com\/transport/i,
    /yelp\.com\//i,
    /maps\.google\.com/i,
    /google\.com\/maps/i,
    /recreation\.gov\/search/i,
    /alltrails\.com\/search/i,  // AllTrails search URLs are safe
  ];
  
  return safePatterns.some(pattern => pattern.test(url));
}

/**
 * Fix AllTrails links - convert ALL non-search links to search URLs
 * Direct links are unreliable, search URLs always work
 */
function fixAllTrailsLink(url: string): { isValid: boolean; fixedUrl?: string } {
  // If it's already a search URL, it's valid
  if (url.includes('/search?q=') || url.includes('/search?')) {
    return { isValid: true };
  }
  
  // Extract trail name from direct links like /trail/us/california/yosemite-falls-trail
  const trailMatch = url.match(/alltrails\.com\/trail\/[^/]+\/[^/]+\/([^/?#]+)/i);
  if (trailMatch) {
    const trailSlug = trailMatch[1].replace(/-/g, ' ');
    const searchUrl = `https://www.alltrails.com/search?q=${encodeURIComponent(trailSlug)}`;
    console.log(`[LinkValidator] Converting AllTrails trail link to search: ${url} -> ${searchUrl}`);
    return { isValid: false, fixedUrl: searchUrl };
  }
  
  // For explore links, convert to search
  const exploreMatch = url.match(/alltrails\.com\/explore\/([^/?#]+)/i);
  if (exploreMatch) {
    const query = exploreMatch[1].replace(/-/g, ' ');
    const searchUrl = `https://www.alltrails.com/search?q=${encodeURIComponent(query)}`;
    console.log(`[LinkValidator] Converting AllTrails explore link to search: ${url}`);
    return { isValid: false, fixedUrl: searchUrl };
  }
  
  // For parks links like /parks/us/california/yosemite-national-park
  const parksMatch = url.match(/alltrails\.com\/parks\/[^/]+\/[^/]+\/([^/?#]+)/i);
  if (parksMatch) {
    const parkSlug = parksMatch[1].replace(/-/g, ' ');
    const searchUrl = `https://www.alltrails.com/search?q=${encodeURIComponent(parkSlug)}`;
    console.log(`[LinkValidator] Converting AllTrails parks link to search: ${url}`);
    return { isValid: false, fixedUrl: searchUrl };
  }
  
  // For any other AllTrails URL that's not search, try to extract something useful
  // and convert to search - better safe than broken
  const anyPathMatch = url.match(/alltrails\.com\/(?!search)([^/?#]+)/i);
  if (anyPathMatch) {
    const fallbackQuery = anyPathMatch[1].replace(/-/g, ' ');
    const searchUrl = `https://www.alltrails.com/search?q=${encodeURIComponent(fallbackQuery)}`;
    console.log(`[LinkValidator] Converting unknown AllTrails link to search: ${url}`);
    return { isValid: false, fixedUrl: searchUrl };
  }
  
  // Fallback - just go to AllTrails search
  return { isValid: false, fixedUrl: 'https://www.alltrails.com/search' };
}

/**
 * Fix Recreation.gov links - convert direct facility links to search URLs
 */
function fixRecreationGovLink(url: string): { isValid: boolean; fixedUrl?: string } {
  // Search URLs are always safe
  if (url.includes('/search?q=') || url.includes('/search?')) {
    return { isValid: true };
  }
  
  // Extract facility name from camping URLs like /camping/campgrounds/12345
  const campingMatch = url.match(/recreation\.gov\/camping\/campgrounds\/\d+/i);
  if (campingMatch) {
    // These direct IDs often work, but let's validate the format
    return { isValid: true };
  }
  
  // Permit URLs are usually valid
  if (url.includes('/permits/')) {
    return { isValid: true };
  }
  
  return { isValid: true };
}

// Flight link formats (in order of preference)
const flightFormats = [
  {
    name: 'kayak',
    generate: (origin: string, dest: string, depart: string, returnDate?: string) => {
      const base = `https://www.kayak.com/flights/${origin}-${dest}/${depart}`;
      return returnDate ? `${base}/${returnDate}` : base;
    },
  },
  {
    name: 'google',
    generate: (origin: string, dest: string, depart: string, returnDate?: string) => {
      return `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${dest}+on+${depart}`;
    },
  },
  {
    name: 'skyscanner',
    generate: (origin: string, dest: string, depart: string, returnDate?: string) => {
      const formattedDate = depart.replace(/-/g, '');
      return `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${formattedDate}/`;
    },
  },
];

// Hotel link formats (in order of preference)
const hotelFormats = [
  {
    name: 'booking',
    generate: (destination: string, checkin?: string, checkout?: string) => {
      let url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`;
      if (checkin) url += `&checkin=${checkin}`;
      if (checkout) url += `&checkout=${checkout}`;
      return url;
    },
  },
  {
    name: 'expedia',
    generate: (destination: string, checkin?: string, checkout?: string) => {
      let url = `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(destination)}`;
      if (checkin) url += `&startDate=${checkin}`;
      if (checkout) url += `&endDate=${checkout}`;
      return url;
    },
  },
  {
    name: 'hotels',
    generate: (destination: string) => {
      return `https://www.hotels.com/search.do?q-destination=${encodeURIComponent(destination)}`;
    },
  },
];

// Car rental link formats (in order of preference)
const carFormats = [
  {
    name: 'kayak',
    generate: (airport: string, pickup: string, dropoff: string) => {
      return `https://www.kayak.com/cars/${airport}/${pickup}/${dropoff}`;
    },
  },
  {
    name: 'expedia',
    generate: (airport: string, pickup: string, dropoff: string) => {
      return `https://www.expedia.com/Cars?pickupDate=${pickup}&dropoffDate=${dropoff}&pickupLocation=${airport}`;
    },
  },
  {
    name: 'rentalcars',
    generate: (airport: string, pickup: string, dropoff: string) => {
      return `https://www.rentalcars.com/search-results?location=${airport}&puDay=${pickup}&doDay=${dropoff}`;
    },
  },
];

// Validate a URL by checking if it returns a successful response
async function validateUrl(url: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; TripAgent/1.0)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Consider 2xx and 3xx as valid (redirects are fine for booking sites)
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    return false;
  }
}

// Get a validated flight link, trying multiple formats
export async function getValidatedFlightLink(
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): Promise<LinkValidationResult> {
  for (const format of flightFormats) {
    const url = format.generate(origin, destination, departDate, returnDate);
    const isValid = await validateUrl(url);
    
    if (isValid) {
      return {
        originalUrl: url,
        validatedUrl: url,
        isValid: true,
        format: format.name,
      };
    }
  }
  
  // If none valid, return the first format (Kayak) as fallback
  const fallbackUrl = flightFormats[0].generate(origin, destination, departDate, returnDate);
  return {
    originalUrl: fallbackUrl,
    validatedUrl: fallbackUrl,
    isValid: false,
    format: 'kayak-fallback',
  };
}

// Get a validated hotel link, trying multiple formats
export async function getValidatedHotelLink(
  destination: string,
  checkin?: string,
  checkout?: string
): Promise<LinkValidationResult> {
  for (const format of hotelFormats) {
    const url = format.generate(destination, checkin, checkout);
    const isValid = await validateUrl(url);
    
    if (isValid) {
      return {
        originalUrl: url,
        validatedUrl: url,
        isValid: true,
        format: format.name,
      };
    }
  }
  
  // If none valid, return Booking.com as fallback
  const fallbackUrl = hotelFormats[0].generate(destination, checkin, checkout);
  return {
    originalUrl: fallbackUrl,
    validatedUrl: fallbackUrl,
    isValid: false,
    format: 'booking-fallback',
  };
}

// Get a validated car rental link, trying multiple formats
export async function getValidatedCarLink(
  airport: string,
  pickupDate: string,
  dropoffDate: string
): Promise<LinkValidationResult> {
  for (const format of carFormats) {
    const url = format.generate(airport, pickupDate, dropoffDate);
    const isValid = await validateUrl(url);
    
    if (isValid) {
      return {
        originalUrl: url,
        validatedUrl: url,
        isValid: true,
        format: format.name,
      };
    }
  }
  
  // If none valid, return Kayak as fallback
  const fallbackUrl = carFormats[0].generate(airport, pickupDate, dropoffDate);
  return {
    originalUrl: fallbackUrl,
    validatedUrl: fallbackUrl,
    isValid: false,
    format: 'kayak-fallback',
  };
}

/**
 * Fix Wikipedia links - ensure they use valid article format
 */
function fixWikipediaLink(url: string): { isValid: boolean; fixedUrl?: string } {
  // Wikipedia article links are generally reliable
  if (url.match(/wikipedia\.org\/wiki\/[^/?#]+/i)) {
    return { isValid: true };
  }
  
  // Mobile Wikipedia - convert to desktop
  if (url.includes('m.wikipedia.org')) {
    const fixedUrl = url.replace('m.wikipedia.org', 'en.wikipedia.org');
    return { isValid: false, fixedUrl };
  }
  
  // Wikipedia search or other pages - assume valid
  return { isValid: true };
}

/**
 * Fix booking/travel links - ensure proper search format
 */
function fixBookingLink(url: string): { isValid: boolean; fixedUrl?: string } {
  // Booking.com - search results are always safe
  if (url.includes('booking.com')) {
    if (url.includes('/searchresults')) {
      return { isValid: true };
    }
    // Direct hotel links may 404 - try to extract hotel name for search
    const hotelMatch = url.match(/booking\.com\/hotel\/[^/]+\/([^/?#.]+)/i);
    if (hotelMatch) {
      const hotelName = hotelMatch[1].replace(/-/g, ' ');
      const searchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName)}`;
      console.log(`[LinkValidator] Converting Booking.com hotel link to search: ${url}`);
      return { isValid: false, fixedUrl: searchUrl };
    }
  }
  
  // Kayak - flights/cars/hotels search formats are safe
  if (url.includes('kayak.com')) {
    if (url.match(/kayak\.com\/(flights|cars|hotels)\//i)) {
      return { isValid: true };
    }
  }
  
  // Expedia - search URLs are safe
  if (url.includes('expedia.com')) {
    if (url.includes('Hotel-Search') || url.includes('Flights') || url.includes('Cars')) {
      return { isValid: true };
    }
  }
  
  return { isValid: true };
}

/**
 * Fix iNaturalist links - ensure valid observation/taxon format
 */
function fixINaturalistLink(url: string): { isValid: boolean; fixedUrl?: string } {
  // Observation and taxon pages are reliable
  if (url.match(/inaturalist\.org\/(observations|taxa)\/\d+/i)) {
    return { isValid: true };
  }
  
  // Search and explore pages are safe
  if (url.match(/inaturalist\.org\/(observations|explore)/i)) {
    return { isValid: true };
  }
  
  return { isValid: true };
}

/**
 * Validate a single link using pattern-based rules (fast, no HTTP requests)
 */
function validateLinkByPattern(url: string): { isValid: boolean; fixedUrl?: string; shouldRemove?: boolean } {
  // NPS URLs - aggressive validation, redirect most to main page
  if (url.includes('nps.gov')) {
    return isValidNpsUrl(url);
  }
  
  // AllTrails URLs - convert ALL non-search to search
  if (url.includes('alltrails.com')) {
    return fixAllTrailsLink(url);
  }
  
  // Recreation.gov URLs - validate format (these work well per user)
  if (url.includes('recreation.gov')) {
    return fixRecreationGovLink(url);
  }
  
  // Wikipedia links - ensure valid format
  if (url.includes('wikipedia.org')) {
    return fixWikipediaLink(url);
  }
  
  // Booking/travel links - ensure search format
  if (url.includes('booking.com') || url.includes('kayak.com') || url.includes('expedia.com')) {
    return fixBookingLink(url);
  }
  
  // iNaturalist links - validate format
  if (url.includes('inaturalist.org')) {
    return fixINaturalistLink(url);
  }
  
  // Unsplash URLs - REMOVE (tool is disabled, links are unreliable)
  if (url.includes('unsplash.com')) {
    console.log(`[LinkValidator] Removing Unsplash link (tool disabled): ${url}`);
    return { isValid: false, shouldRemove: true };
  }
  
  // Third-party campground URLs - Claude constructs these from memory, often outdated
  // Convert to Google search for reliability
  if (url.includes('koa.com/campgrounds/') || 
      url.includes('miamidade.gov/parks/') ||
      url.includes('reserveamerica.com') ||
      url.includes('hipcamp.com/')) {
    // Extract campground name from URL for search
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    const searchTerm = lastPart.replace(/[-_]/g, ' ').replace(/\.asp$|\.htm$|\.html$/i, '');
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm + ' campground')}`;
    console.log(`[LinkValidator] Converting third-party campground URL to search: ${url} -> ${googleSearchUrl}`);
    return { isValid: false, fixedUrl: googleSearchUrl };
  }
  
  // Yelp URLs - API-provided, generally reliable
  if (url.includes('yelp.com')) {
    return { isValid: true };
  }
  
  // Google Maps/Search URLs - always work
  if (url.includes('google.com/maps') || url.includes('maps.google.com') || url.includes('google.com/search')) {
    return { isValid: true };
  }
  
  // Safe search URLs - always valid
  if (isSafeSearchUrl(url)) {
    return { isValid: true };
  }
  
  // Unknown URLs - assume valid but log for monitoring
  console.log(`[LinkValidator] Unknown URL type (assuming valid): ${url}`);
  return { isValid: true };
}

// Parse and validate links in a response text
// conversationSeenUrls: optional Set to track URLs across the entire conversation
export async function validateLinksInResponse(
  responseText: string,
  conversationSeenUrls?: Set<string>
): Promise<string> {
  // Regex to find markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  
  const links: Array<{ match: string; text: string; url: string }> = [];
  let match;
  
  while ((match = linkRegex.exec(responseText)) !== null) {
    links.push({
      match: match[0],
      text: match[1],
      url: match[2],
    });
  }
  
  console.log(`[LinkValidator] Found ${links.length} markdown links to validate`);
  links.forEach((l, i) => console.log(`[LinkValidator]   ${i + 1}. "${l.text}" -> ${l.url}`));
  
  let processedText = responseText;
  // Use conversation-level tracking if provided, otherwise use local set
  const seenUrls = conversationSeenUrls || new Set<string>();
  
  // Validate each link using pattern matching (no HTTP requests)
  // Duplicate detection: only consider EXACT original URL matches as duplicates
  for (const link of links) {
    // Check for exact duplicate FIRST (before validation)
    if (seenUrls.has(link.url)) {
      console.log(`[LinkValidator] Removing duplicate link: ${link.url}`);
      processedText = processedText.replace(link.match, link.text);
      continue;
    }
    
    // Track this URL to detect future duplicates
    seenUrls.add(link.url);
    
    const validation = validateLinkByPattern(link.url);
    
    if (!validation.isValid) {
      if (validation.fixedUrl) {
        // Replace with fixed URL
        console.log(`[LinkValidator] Fixing broken link: ${link.url} -> ${validation.fixedUrl}`);
        processedText = processedText.replace(
          link.match,
          `[${link.text}](${validation.fixedUrl})`
        );
      } else if (validation.shouldRemove) {
        // Remove the entire link, keep just the text
        console.log(`[LinkValidator] Removing broken link: ${link.url}`);
        processedText = processedText.replace(link.match, link.text);
      } else {
        // Invalid but no fix available - convert to plain text
        console.log(`[LinkValidator] Converting broken link to text: ${link.url}`);
        processedText = processedText.replace(link.match, link.text);
      }
    }
    // Valid links just pass through (already tracked above)
  }
  
  return processedText;
}

export {
  flightFormats,
  hotelFormats,
  carFormats,
  validateUrl,
};
