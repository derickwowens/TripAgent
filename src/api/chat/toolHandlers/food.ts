/**
 * Food Tool Handlers
 * 
 * Handles restaurant searches and reservation links
 */

import { YelpAdapter } from '../../../providers/YelpAdapter.js';
import { GoogleMapsAdapter } from '../../../providers/GoogleMapsAdapter.js';
import { ChatContext, PhotoReference } from '../types.js';
import { generateGoogleMapsLink, generateDirectionsLink } from '../../../utils/linkUtils.js';
import { resolveGatewayCity } from './shared.js';

/**
 * Validate OpenTable link before recommending it
 */
async function validateOpenTableLink(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TripAgent/1.0)',
      },
    });
    
    if (!response.ok) return false;
    
    const html = await response.text();
    
    const noResultsIndicators = [
      'No results found',
      'no restaurants matched',
      '0 results',
      'couldn\'t find any',
      'no matching restaurants',
    ];
    
    const htmlLower = html.toLowerCase();
    for (const indicator of noResultsIndicators) {
      if (htmlLower.includes(indicator.toLowerCase())) {
        return false;
      }
    }
    
    const hasResults = html.includes('data-test="restaurant-card"') || 
                       html.includes('RestaurantCard') ||
                       html.includes('restaurant-name');
    
    return hasResults || !noResultsIndicators.some(i => htmlLower.includes(i.toLowerCase()));
  } catch (error) {
    console.log('[OpenTable] Validation failed, defaulting to alternative links:', error);
    return false;
  }
}

/**
 * Handle restaurant search with context-aware defaults
 */
export async function handleSearchRestaurants(
  input: {
    location: string;
    cuisine?: string;
    price_level?: number;
    radius?: number;
  },
  collectedPhotos: PhotoReference[],
  context: ChatContext
): Promise<any> {
  console.log('[Restaurant] === handleSearchRestaurants called ===');
  console.log('[Restaurant] Input location from Claude:', input.location);
  
  const staticGateway = resolveGatewayCity(input.location);
  console.log('[Restaurant] Static gateway lookup result:', staticGateway);
  
  let searchLocation: string;
  let locationSource: string;
  
  if (staticGateway) {
    searchLocation = `${staticGateway.city}, ${staticGateway.state}`;
    locationSource = 'static-gateway-lookup';
  } else {
    searchLocation = input.location;
    locationSource = 'claude-input-fallback';
    console.warn('[Restaurant] WARNING: Using Claude input as fallback - may be incorrect');
  }
  
  console.log(`[Restaurant] Final search location: "${searchLocation}" (source: ${locationSource})`);
  
  const yelpAdapter = new YelpAdapter();
  
  let priceLevel = input.price_level;
  if (!priceLevel && context.defaults?.budget) {
    const budgetToPrice: Record<string, number> = {
      'frugal': 1,
      'moderate': 2,
      'luxury': 4,
    };
    priceLevel = budgetToPrice[context.defaults.budget];
  }
  
  let yelpPrice: string | undefined;
  if (priceLevel) {
    yelpPrice = Array.from({ length: priceLevel }, (_, i) => i + 1).join(',');
  }

  const parkName = input.location.replace(/\s*(National Park|Valley|Village|Area)\s*/gi, '').trim();

  const yelpResults = await yelpAdapter.searchRestaurants(searchLocation, {
    term: input.cuisine,
    price: yelpPrice,
    radius: input.radius || 8000,
    sortBy: 'best_match',
    limit: 10,
  });

  if (yelpResults.status === 'OK' && yelpResults.businesses.length > 0) {
    yelpResults.businesses.forEach(r => {
      if (r.imageUrl) {
        const distanceMiles = r.distance ? (r.distance / 1609.34).toFixed(1) : null;
        const caption = distanceMiles 
          ? `${r.name} • ${distanceMiles} miles to ${parkName}`
          : `${r.name} near ${parkName}`;
        
        collectedPhotos.push({
          keyword: r.name,
          url: r.imageUrl,
          caption: caption,
          source: 'other' as const,
        });
      }
    });

    return {
      restaurants: yelpResults.businesses.map(r => {
        const googleMapsUrl = generateGoogleMapsLink(r.name, r.location.city, r.location.state);
        const reservationLink = r.transactions.includes('restaurant_reservation') 
          ? YelpAdapter.generateReservationLink(r) 
          : undefined;
        
        const officialUrl = r.url;
        console.log(`[LinkGen] Restaurant "${r.name}": officialUrl=${officialUrl}`);
        
        return {
          name: r.name,
          address: r.location.displayAddress.join(', '),
          city: r.location.city,
          state: r.location.state,
          rating: `${r.rating}/5`,
          reviewCount: r.reviewCount,
          reviewsUrl: r.url,
          reviewSource: 'Yelp',
          priceLevel: r.price || 'Price unknown',
          cuisine: YelpAdapter.formatCategories(r.categories),
          phone: r.displayPhone || 'No phone',
          distanceMiles: r.distance ? (r.distance / 1609.34).toFixed(1) : null,
          supportsReservation: r.transactions.includes('restaurant_reservation'),
          reservationLink: reservationLink,
          officialUrl: officialUrl,
          yelpUrl: r.url,
          googleMapsUrl: googleMapsUrl,
          directionsUrl: generateDirectionsLink(`${r.name}, ${r.location.city}, ${r.location.state}`),
          imageUrl: r.imageUrl,
          _linkNote: 'USE officialUrl/yelpUrl for restaurant info - from Yelp API',
        };
      }),
      totalFound: yelpResults.total,
      searchLocation: input.location,
      cuisineFilter: input.cuisine || 'all types',
      source: 'yelp',
      photosAdded: yelpResults.businesses.filter(r => r.imageUrl).length,
      linkNote: 'Use yelpUrl or googleMapsUrl for restaurant links.',
    };
  }

  console.log('[Restaurant] Yelp returned no results, falling back to Google Places');
  const mapsAdapter = new GoogleMapsAdapter();
  const results = await mapsAdapter.searchRestaurants(
    searchLocation,
    input.cuisine,
    input.price_level,
    input.radius || 5000
  );

  if (results.status !== 'OK' || results.results.length === 0) {
    return {
      restaurants: [],
      message: `No restaurants found near ${input.location}. Try expanding your search or checking nearby towns.`,
    };
  }

  const locationName = input.location.split(',')[0].trim();
  results.results.forEach(r => {
    if (r.photoUrl) {
      collectedPhotos.push({
        keyword: r.name,
        url: r.photoUrl,
        caption: `${r.name} near ${locationName}`,
        source: 'other' as const,
      });
    }
  });

  const resolvedCity = staticGateway?.city || searchLocation.split(',')[0].trim();
  const resolvedState = staticGateway?.state || searchLocation.split(',')[1]?.trim() || '';

  return {
    restaurants: results.results.map(r => {
      const googleMapsUrl = generateGoogleMapsLink(r.name, resolvedCity, resolvedState);
      const directionsUrl = generateDirectionsLink(`${r.name}, ${resolvedCity}, ${resolvedState}`);
      return {
        name: r.name,
        address: r.address,
        city: resolvedCity,
        state: resolvedState,
        rating: r.rating ? `${r.rating}/5` : 'No rating',
        reviewCount: r.userRatingsTotal || 0,
        reviewsUrl: googleMapsUrl,
        reviewSource: 'Google',
        priceLevel: GoogleMapsAdapter.formatPriceLevel(r.priceLevel),
        cuisine: r.types?.slice(0, 3).join(', ') || 'Restaurant',
        openNow: r.openNow !== undefined ? (r.openNow ? 'Open now' : 'Closed') : 'Hours unknown',
        googleMapsUrl: googleMapsUrl,
        directionsUrl: directionsUrl,
        imageUrl: r.photoUrl,
      };
    }),
    totalFound: results.results.length,
    searchLocation: input.location,
    cuisineFilter: input.cuisine || 'all types',
    source: 'google',
    photosAdded: results.results.filter(r => r.photoUrl).length,
  };
}

/**
 * Handle reservation link generation
 */
export async function handleGetReservationLink(
  input: {
    restaurant_name: string;
    city?: string;
    state?: string;
    date?: string;
    time?: string;
    party_size?: number;
  },
  context: ChatContext
): Promise<any> {
  console.log('[Reservation] === handleGetReservationLink called ===');
  console.log('[Reservation] Input:', JSON.stringify(input, null, 2));
  
  let city: string | undefined;
  let state: string | undefined;
  let locationSource = 'unknown';
  
  if (input.city) {
    const staticGateway = resolveGatewayCity(input.city);
    if (staticGateway) {
      city = staticGateway.city;
      state = staticGateway.state;
      locationSource = 'static-gateway';
      console.log(`[Reservation] Using static gateway for "${input.city}": ${city}, ${state}`);
    }
  }
  
  if (!city && input.city) {
    city = input.city;
    state = input.state;
    locationSource = 'input';
    console.log(`[Reservation] Using input location: ${city}, ${state}`);
  }
  
  if (!city || !state) {
    console.error(`[Reservation] ERROR: No location provided for "${input.restaurant_name}"`);
    return {
      error: 'City and state are required for reservation links. Please provide the restaurant location.',
      suggestion: 'Include the city and state where the restaurant is located.',
    };
  }

  console.log('[Reservation] Final location resolution:', {
    restaurant: input.restaurant_name,
    city,
    state,
    locationSource,
    date: input.date,
    time: input.time,
    partySize: input.party_size || 2,
  });

  const links = YelpAdapter.generateReservationLinks(
    input.restaurant_name,
    city,
    state,
    input.date,
    input.time,
    input.party_size || 2
  );

  let openTableValid = false;
  try {
    openTableValid = await Promise.race([
      validateOpenTableLink(links.openTable),
      new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('OpenTable validation timeout')), 5000)
      )
    ]) as boolean;
  } catch (error) {
    console.log('[Reservation] OpenTable validation skipped due to timeout or error');
    openTableValid = false;
  }
  
  const reservationDetails = {
    restaurant: input.restaurant_name,
    location: `${city}, ${state}`,
    date: input.date || 'Not specified',
    time: input.time || '7:00 PM',
    partySize: input.party_size || 2,
  };

  const formattedLinks: Array<{ label: string; url: string; platform: string }> = [];
  
  if (openTableValid) {
    formattedLinks.push({
      label: 'Book on OpenTable',
      url: links.openTable,
      platform: 'OpenTable',
    });
  }
  
  formattedLinks.push({
    label: 'Find on Google',
    url: links.google,
    platform: 'Google',
  });
  
  formattedLinks.push({
    label: 'View on Yelp',
    url: links.yelp,
    platform: 'Yelp',
  });
  
  formattedLinks.push({
    label: 'Check Resy',
    url: links.resy,
    platform: 'Resy',
  });

  const primaryLink = openTableValid ? links.openTable : links.google;
  const primaryPlatform = openTableValid ? 'OpenTable' : 'Google';
  const primaryLabel = openTableValid ? 'Book on OpenTable' : 'Find on Google';

  return {
    reservationDetails,
    links: formattedLinks,
    primaryLink: {
      label: primaryLabel,
      url: primaryLink,
      platform: primaryPlatform,
    },
    openTableAvailable: openTableValid,
    message: openTableValid 
      ? `Here are reservation options for ${input.restaurant_name}:`
      : `${input.restaurant_name} may not be on OpenTable. Here are other ways to make a reservation:`,
  };
}
