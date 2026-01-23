/**
 * Type definitions for the chat module
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PhotoReference {
  keyword: string;
  url: string;
  caption?: string;
  confidence?: number;
  source?: 'nps' | 'unsplash' | 'other';
  photographerId?: string; // For deduplication (Unsplash username)
}

/**
 * Deduplicate photos by URL and photographer (one photo per Unsplash user)
 */
export function deduplicatePhotos(photos: PhotoReference[]): PhotoReference[] {
  const seenUrls = new Set<string>();
  const seenPhotographers = new Set<string>();
  
  return photos.filter(photo => {
    // Always filter out duplicate URLs
    if (seenUrls.has(photo.url)) {
      return false;
    }
    seenUrls.add(photo.url);
    
    // For Unsplash photos, only allow one per photographer
    if (photo.source === 'unsplash' && photo.photographerId) {
      if (seenPhotographers.has(photo.photographerId)) {
        return false;
      }
      seenPhotographers.add(photo.photographerId);
    }
    
    return true;
  });
}

// Trip leg for multi-segment trips
export interface TripLeg {
  type: 'flight' | 'drive' | 'stay' | 'activity';
  from?: string;
  to?: string;
  dates?: { start: string; end: string };
  overrides?: Record<string, any>;  // Leg-specific overrides
}

// Context defaults from user profile
export interface ContextDefaults {
  travelers?: number;
  budget?: 'frugal' | 'moderate' | 'luxury';
  vehicle?: 'ev' | 'tesla' | 'gas' | 'rental';
  homeAirport?: string;
  accessibility?: boolean;
  petFriendly?: boolean;
}

export interface ChatContext {
  userLocation?: {
    city: string;
    state: string;
    nearestAirport: string;
  };
  tripContext?: {
    destination?: string;
    parkCode?: string;
    numDays?: number;
    numTravelers?: number;
    // Dynamic overrides from conversation (takes priority over defaults)
    overrides?: Record<string, any>;
    // Trip legs for multi-segment trips
    legs?: TripLeg[];
    // Currently active leg being discussed (0-indexed)
    activeLeg?: number;
  };
  userProfile?: string;
  // Parsed defaults from userProfile for programmatic access
  defaults?: ContextDefaults;
  // NPS gateway city from park lookups - deterministic location for restaurant/reservation searches
  npsGatewayCity?: {
    city: string;
    state: string;
    parkCode?: string;
    parkName?: string;
  };
}

/**
 * Resolve a context value with override priority:
 * conversation override > trip context > profile defaults > null
 */
export function resolveContextValue<T>(
  key: string,
  context: ChatContext,
  legIndex?: number
): T | undefined {
  // Check leg-specific override first
  if (legIndex !== undefined && context.tripContext?.legs?.[legIndex]?.overrides?.[key] !== undefined) {
    return context.tripContext.legs[legIndex].overrides![key] as T;
  }
  
  // Check conversation-level override
  if (context.tripContext?.overrides?.[key] !== undefined) {
    return context.tripContext.overrides[key] as T;
  }
  
  // Check trip context direct values
  if (context.tripContext && key in context.tripContext) {
    const value = (context.tripContext as any)[key];
    if (value !== undefined) return value as T;
  }
  
  // Check parsed defaults
  if (context.defaults?.[key as keyof ContextDefaults] !== undefined) {
    return context.defaults[key as keyof ContextDefaults] as T;
  }
  
  return undefined;
}

export interface ChatResponse {
  response: string;
  photos?: PhotoReference[];
}

export interface ToolResult {
  result: any;
  photos?: PhotoReference[];
  destination?: string;
  searchQuery?: string;
}

// Tool status callback for streaming updates
export type ToolStatusCallback = (toolName: string, status: 'starting' | 'complete') => void;

// Human-readable tool names for loading states
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'search_national_parks': 'Searching national parks...',
  'get_park_details': 'Getting park details...',
  'get_park_hikes': 'Finding hiking trails...',
  'search_hikes': 'Finding hiking trails...',
  'search_campgrounds': 'Searching campgrounds...',
  'get_campgrounds': 'Finding campgrounds...',
  'get_wildlife': 'Looking up wildlife...',
  'search_flights': 'Searching flights...',
  'search_hotels': 'Finding hotels...',
  'search_restaurants': 'Finding restaurants...',
  'search_car_rentals': 'Searching car rentals...',
  'search_activities': 'Finding activities...',
  'get_driving_distance': 'Calculating distance...',
  'search_ev_charging_stations': 'Finding EV chargers...',
  'get_weather': 'Checking weather...',
  'search_ev_chargers': 'Finding EV chargers...',
  'search_attractions': 'Discovering attractions...',
  'get_destination_photos': 'Loading destination photos...',
  'refresh_photos': 'Refreshing photos...',
  'get_reservation_link': 'Generating reservation links...',
  'plan_park_trip': 'Planning your trip...',
};
