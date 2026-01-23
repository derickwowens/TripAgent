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

// Known-good NPS URL patterns (regex)
const VALID_NPS_PATTERNS = [
  // Main park page: /parkcode/index.htm or /parkcode/
  /^https:\/\/www\.nps\.gov\/([a-z]{4})\/(?:index\.htm)?$/i,
  // Plan your visit main page
  /^https:\/\/www\.nps\.gov\/([a-z]{4})\/planyourvisit\/index\.htm$/i,
  // Basic info pages (these generally exist)
  /^https:\/\/www\.nps\.gov\/([a-z]{4})\/planyourvisit\/basicinfo\.htm$/i,
  /^https:\/\/www\.nps\.gov\/([a-z]{4})\/planyourvisit\/fees\.htm$/i,
  /^https:\/\/www\.nps\.gov\/([a-z]{4})\/planyourvisit\/hours\.htm$/i,
  // Common uploads (photos)
  /^https:\/\/www\.nps\.gov\/common\/uploads\//i,
];

// NPS subpages that are known to NOT exist universally (will be stripped)
const INVALID_NPS_SUBPAGE_PATTERNS = [
  /\/stargazing/i,
  /\/climbing/i,
  /\/rock-climbing/i,
  /\/night-sky/i,
  /\/astronomy/i,
  /\/wildlife-viewing/i,
  /\/bird-watching/i,
  /\/fishing/i,
  /\/backpacking/i,
];

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
    /recreation\.gov/i,
  ];
  
  return safePatterns.some(pattern => pattern.test(url));
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
 * Validate a single link using pattern-based rules (fast, no HTTP requests)
 */
function validateLinkByPattern(url: string): { isValid: boolean; fixedUrl?: string; shouldRemove?: boolean } {
  // NPS URLs - use pattern validation
  if (url.includes('nps.gov')) {
    return isValidNpsUrl(url);
  }
  
  // Safe search URLs - always valid
  if (isSafeSearchUrl(url)) {
    return { isValid: true };
  }
  
  // Other URLs - assume valid (we can't check without HTTP request)
  return { isValid: true };
}

// Parse and validate links in a response text
export async function validateLinksInResponse(responseText: string): Promise<string> {
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
  
  let processedText = responseText;
  const seenUrls = new Set<string>();
  
  // Validate each link using pattern matching (no HTTP requests)
  for (const link of links) {
    const validation = validateLinkByPattern(link.url);
    
    if (!validation.isValid) {
      if (validation.fixedUrl) {
        // Check if we've already seen this fixed URL
        if (seenUrls.has(validation.fixedUrl)) {
          // Duplicate - remove the link entirely, keep just text
          console.log(`[LinkValidator] Removing duplicate link: ${link.url} (already have ${validation.fixedUrl})`);
          processedText = processedText.replace(link.match, link.text);
        } else {
          // Replace with fixed URL and track it
          console.log(`[LinkValidator] Fixing broken link: ${link.url} -> ${validation.fixedUrl}`);
          seenUrls.add(validation.fixedUrl);
          processedText = processedText.replace(
            link.match,
            `[${link.text}](${validation.fixedUrl})`
          );
        }
      } else if (validation.shouldRemove) {
        // Remove the entire link, keep just the text
        console.log(`[LinkValidator] Removing broken link: ${link.url}`);
        processedText = processedText.replace(link.match, link.text);
      } else {
        // Invalid but no fix available - convert to plain text
        console.log(`[LinkValidator] Converting broken link to text: ${link.url}`);
        processedText = processedText.replace(link.match, link.text);
      }
    } else {
      // Valid link - track it to prevent duplicates
      seenUrls.add(link.url);
    }
  }
  
  return processedText;
}

export {
  flightFormats,
  hotelFormats,
  carFormats,
  validateUrl,
};
