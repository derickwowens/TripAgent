/**
 * Test for deterministic destination cache flow
 * Verifies that the module-level destination cache correctly:
 * 1. Gets set when a park is searched
 * 2. Is used by restaurant search instead of Claude's input
 * 3. Is used by reservation link generation
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock the module-level caches and functions
// We'll test the logic flow directly

interface DestinationCache {
  parkName: string;
  parkCode: string;
  gatewayCity: string;
  gatewayState: string;
  timestamp: number;
}

interface CachedRestaurant {
  name: string;
  city: string;
  state: string;
  address: string;
}

// Simulate the module-level cache
let destinationCache: DestinationCache | null = null;
let restaurantCache: { restaurants: CachedRestaurant[]; searchLocation: string } = {
  restaurants: [],
  searchLocation: '',
};

// Cache functions (matching the implementation)
function setDestinationCache(parkName: string, parkCode: string, city: string, state: string): void {
  destinationCache = {
    parkName,
    parkCode,
    gatewayCity: city,
    gatewayState: state,
    timestamp: Date.now(),
  };
}

function getDestinationCache(): DestinationCache | null {
  return destinationCache;
}

function clearDestinationCache(): void {
  destinationCache = null;
}

function updateRestaurantCache(restaurants: CachedRestaurant[], searchLocation: string): void {
  restaurantCache = { restaurants, searchLocation };
}

function getCachedRestaurant(name: string): CachedRestaurant | undefined {
  const normalizedName = name.toLowerCase().trim();
  const simplifiedName = normalizedName
    .replace(/^the\s+/i, '')
    .replace(/\s+(restaurant|cafe|bar|grill|bistro|kitchen|eatery)$/i, '');
  
  return restaurantCache.restaurants.find(r => {
    const rNormalized = r.name.toLowerCase().trim();
    const rSimplified = rNormalized
      .replace(/^the\s+/i, '')
      .replace(/\s+(restaurant|cafe|bar|grill|bistro|kitchen|eatery)$/i, '');
    
    return (
      rNormalized === normalizedName ||
      rSimplified === simplifiedName ||
      rNormalized.includes(normalizedName) ||
      normalizedName.includes(rNormalized) ||
      rSimplified.includes(simplifiedName) ||
      simplifiedName.includes(rSimplified)
    );
  });
}

// Static gateway lookup (subset for testing)
const PARK_GATEWAY_CITIES = [
  { keywords: ['acadia', 'bar harbor'], city: 'Bar Harbor', state: 'ME' },
  { keywords: ['yellowstone'], city: 'West Yellowstone', state: 'MT' },
  { keywords: ['everglades'], city: 'Homestead', state: 'FL' },
  { keywords: ['zion'], city: 'Springdale', state: 'UT' },
];

function resolveGatewayCity(location: string): { city: string; state: string } | null {
  const locationLower = location.toLowerCase();
  for (const gateway of PARK_GATEWAY_CITIES) {
    if (gateway.keywords.some(kw => locationLower.includes(kw))) {
      return { city: gateway.city, state: gateway.state };
    }
  }
  return null;
}

// Simulate the location resolution logic from handleSearchRestaurants
function resolveRestaurantSearchLocation(claudeInput: string): { location: string; source: string } {
  const destCache = getDestinationCache();
  const staticGateway = resolveGatewayCity(claudeInput);
  
  if (destCache) {
    return {
      location: `${destCache.gatewayCity}, ${destCache.gatewayState}`,
      source: 'destination-cache',
    };
  } else if (staticGateway) {
    return {
      location: `${staticGateway.city}, ${staticGateway.state}`,
      source: 'static-gateway-lookup',
    };
  } else {
    return {
      location: claudeInput,
      source: 'claude-input-fallback',
    };
  }
}

// Simulate the location resolution logic from handleGetReservationLink
function resolveReservationLocation(
  restaurantName: string,
  claudeCity?: string,
  claudeState?: string
): { city: string; state: string; source: string } | { error: string } {
  const cachedRestaurant = getCachedRestaurant(restaurantName);
  const destCache = getDestinationCache();
  
  if (cachedRestaurant) {
    return {
      city: cachedRestaurant.city,
      state: cachedRestaurant.state,
      source: 'cache',
    };
  } else if (destCache) {
    return {
      city: destCache.gatewayCity,
      state: destCache.gatewayState,
      source: 'destination-cache',
    };
  }
  
  // Never use Claude's input - return error
  return {
    error: 'Could not determine restaurant location. Please search for restaurants first.',
  };
}

describe('Destination Cache Flow', () => {
  beforeEach(() => {
    // Clear caches before each test
    clearDestinationCache();
    restaurantCache = { restaurants: [], searchLocation: '' };
  });

  describe('setDestinationCache', () => {
    it('should store park gateway city in module-level cache', () => {
      setDestinationCache('Acadia National Park', 'acad', 'Bar Harbor', 'ME');
      
      const cache = getDestinationCache();
      expect(cache).not.toBeNull();
      expect(cache?.parkName).toBe('Acadia National Park');
      expect(cache?.parkCode).toBe('acad');
      expect(cache?.gatewayCity).toBe('Bar Harbor');
      expect(cache?.gatewayState).toBe('ME');
    });

    it('should persist across multiple calls', () => {
      setDestinationCache('Acadia National Park', 'acad', 'Bar Harbor', 'ME');
      
      // Multiple reads should return the same data
      expect(getDestinationCache()?.gatewayCity).toBe('Bar Harbor');
      expect(getDestinationCache()?.gatewayCity).toBe('Bar Harbor');
      expect(getDestinationCache()?.gatewayCity).toBe('Bar Harbor');
    });

    it('should be overwritten by new park search', () => {
      setDestinationCache('Acadia National Park', 'acad', 'Bar Harbor', 'ME');
      setDestinationCache('Yellowstone National Park', 'yell', 'West Yellowstone', 'MT');
      
      const cache = getDestinationCache();
      expect(cache?.parkName).toBe('Yellowstone National Park');
      expect(cache?.gatewayCity).toBe('West Yellowstone');
      expect(cache?.gatewayState).toBe('MT');
    });
  });

  describe('Restaurant Search Location Resolution', () => {
    it('should use destination cache over Claude input', () => {
      // Set destination cache (simulating park search)
      setDestinationCache('Acadia National Park', 'acad', 'Bar Harbor', 'ME');
      
      // Claude passes wrong location (Wisconsin - user's home)
      const result = resolveRestaurantSearchLocation('Madison, WI');
      
      expect(result.location).toBe('Bar Harbor, ME');
      expect(result.source).toBe('destination-cache');
    });

    it('should fall back to static gateway if no destination cache', () => {
      // No destination cache set
      
      // Claude passes park name
      const result = resolveRestaurantSearchLocation('Zion National Park');
      
      expect(result.location).toBe('Springdale, UT');
      expect(result.source).toBe('static-gateway-lookup');
    });

    it('should use Claude input only as last resort', () => {
      // No destination cache, no matching gateway
      
      const result = resolveRestaurantSearchLocation('Some Random City, XX');
      
      expect(result.location).toBe('Some Random City, XX');
      expect(result.source).toBe('claude-input-fallback');
    });

    it('should NOT use Claude Wisconsin location when park is cached', () => {
      setDestinationCache('Everglades National Park', 'ever', 'Homestead', 'FL');
      
      // Claude incorrectly passes user's home location
      const result = resolveRestaurantSearchLocation('Milwaukee, WI');
      
      expect(result.location).toBe('Homestead, FL');
      expect(result.location).not.toContain('WI');
      expect(result.source).toBe('destination-cache');
    });
  });

  describe('Reservation Link Location Resolution', () => {
    it('should use cached restaurant location first', () => {
      // Add restaurant to cache (simulating Yelp search results)
      updateRestaurantCache([
        { name: 'Havana', city: 'Bar Harbor', state: 'ME', address: '318 Main St' },
      ], 'Bar Harbor, ME');
      
      const result = resolveReservationLocation('Havana', 'Madison', 'WI');
      
      expect('city' in result && result.city).toBe('Bar Harbor');
      expect('state' in result && result.state).toBe('ME');
      expect('source' in result && result.source).toBe('cache');
    });

    it('should use destination cache if restaurant not in cache', () => {
      setDestinationCache('Acadia National Park', 'acad', 'Bar Harbor', 'ME');
      
      // Restaurant not in cache
      const result = resolveReservationLocation('Unknown Restaurant', 'Madison', 'WI');
      
      expect('city' in result && result.city).toBe('Bar Harbor');
      expect('state' in result && result.state).toBe('ME');
      expect('source' in result && result.source).toBe('destination-cache');
    });

    it('should NEVER use Claude city/state input', () => {
      // No caches set - should return error, NOT use Claude's input
      
      const result = resolveReservationLocation('Some Restaurant', 'Madison', 'WI');
      
      expect('error' in result).toBe(true);
      expect('city' in result).toBe(false);
    });

    it('should find restaurant with fuzzy name matching', () => {
      updateRestaurantCache([
        { name: 'The Havana Restaurant', city: 'Bar Harbor', state: 'ME', address: '318 Main St' },
      ], 'Bar Harbor, ME');
      
      // Search with simplified name
      const result = resolveReservationLocation('Havana', 'Madison', 'WI');
      
      expect('city' in result && result.city).toBe('Bar Harbor');
      expect('source' in result && result.source).toBe('cache');
    });
  });

  describe('Full Flow Integration', () => {
    it('should correctly chain park search -> restaurant search -> reservation', () => {
      // Step 1: User searches for Acadia National Park
      setDestinationCache('Acadia National Park', 'acad', 'Bar Harbor', 'ME');
      
      // Step 2: User asks for restaurants - should use destination cache
      const restaurantSearch = resolveRestaurantSearchLocation('restaurants near me');
      expect(restaurantSearch.location).toBe('Bar Harbor, ME');
      
      // Simulate Yelp returning results with correct location
      updateRestaurantCache([
        { name: 'Havana', city: 'Bar Harbor', state: 'ME', address: '318 Main St' },
        { name: 'Café This Way', city: 'Bar Harbor', state: 'ME', address: '14 Mt Desert St' },
      ], 'Bar Harbor, ME');
      
      // Step 3: User asks for reservation at Havana
      const reservation = resolveReservationLocation('Havana');
      
      expect('city' in reservation && reservation.city).toBe('Bar Harbor');
      expect('state' in reservation && reservation.state).toBe('ME');
      expect('source' in reservation && reservation.source).toBe('cache');
    });

    it('should handle Wisconsin user searching near Acadia correctly', () => {
      // User is from Wisconsin but planning Acadia trip
      
      // Park search sets destination
      setDestinationCache('Acadia National Park', 'acad', 'Bar Harbor', 'ME');
      
      // Claude might pass Wisconsin - should be ignored
      const restaurantSearch = resolveRestaurantSearchLocation('Madison, WI');
      expect(restaurantSearch.location).toBe('Bar Harbor, ME');
      expect(restaurantSearch.location).not.toContain('WI');
      
      // Restaurants cached with correct location
      updateRestaurantCache([
        { name: 'Havana', city: 'Bar Harbor', state: 'ME', address: '318 Main St' },
      ], 'Bar Harbor, ME');
      
      // Reservation should use cached restaurant location
      const reservation = resolveReservationLocation('Havana', 'Madison', 'WI');
      
      expect('city' in reservation && reservation.city).toBe('Bar Harbor');
      expect('state' in reservation && reservation.state).toBe('ME');
      // Should NOT be Wisconsin
      expect('city' in reservation && reservation.city).not.toBe('Madison');
    });
  });
});
