/**
 * Client-side link validation utility
 * Validates links AFTER responses are received, during data mapping
 */

import { CachedLink } from '../hooks/useTripContext';

/**
 * Validate a single URL with a HEAD request
 * Returns true if valid (2xx/3xx), false otherwise
 */
export async function isValidUrl(url: string, timeoutMs: number = 2000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Accept 2xx and 3xx status codes as valid
    return response.ok || (response.status >= 300 && response.status < 400);
  } catch {
    return false;
  }
}

/**
 * Validate links and filter out invalid ones
 * Returns only valid links, with fallbacks applied
 */
export async function validateLinks(
  links: CachedLink[],
  concurrency: number = 3
): Promise<CachedLink[]> {
  const validLinks: CachedLink[] = [];
  
  // Process in batches to avoid overwhelming the network
  for (let i = 0; i < links.length; i += concurrency) {
    const batch = links.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (link) => {
        // Skip validation for known-good URLs (Google Maps, NPS)
        if (isKnownGoodUrl(link.url)) {
          return { link, isValid: true };
        }
        
        const isValid = await isValidUrl(link.url);
        return { link, isValid };
      })
    );
    
    results.forEach(({ link, isValid }) => {
      if (isValid) {
        validLinks.push(link);
      }
    });
  }
  
  return validLinks;
}

/**
 * Check if URL is from a known-reliable source (skip validation)
 * Note: Only skip validation for domains where the URL structure guarantees validity
 * API data sources (NPS, recreation.gov) can have outdated links - always validate
 */
function isKnownGoodUrl(url: string): boolean {
  const knownGoodDomains = [
    'google.com/maps',
    'maps.google.com',
    'yelp.com',
  ];
  
  // nps.gov removed - NPS API can have outdated links
  // recreation.gov removed - specific campground pages can 404
  // Always validate external API links to catch broken URLs
  
  return knownGoodDomains.some(domain => url.includes(domain));
}

/**
 * Generate a Google Maps fallback URL for a location
 */
export function generateGoogleMapsFallback(name: string, city?: string, state?: string): string {
  const query = [name, city, state].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Validate a link and return fallback if invalid
 */
export async function validateLinkWithFallback(
  link: CachedLink,
  fallbackName: string,
  fallbackCity?: string,
  fallbackState?: string
): Promise<CachedLink> {
  // Skip validation for known-good URLs
  if (isKnownGoodUrl(link.url)) {
    return link;
  }
  
  const isValid = await isValidUrl(link.url);
  
  if (isValid) {
    return link;
  }
  
  // Return fallback Google Maps link
  return {
    ...link,
    url: generateGoogleMapsFallback(fallbackName, fallbackCity, fallbackState),
  };
}
