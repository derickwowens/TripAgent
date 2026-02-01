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
  source?: 'nps' | 'other';
  photographerId?: string; // For deduplication
}

/**
 * Deduplicate photos by URL
 */
export function deduplicatePhotos(photos: PhotoReference[]): PhotoReference[] {
  const seenUrls = new Set<string>();
  
  return photos.filter(photo => {
    // Filter out duplicate URLs
    if (seenUrls.has(photo.url)) {
      return false;
    }
    seenUrls.add(photo.url);
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
  // Park mode: 'national' for National Parks, 'state' for State Parks
  parkMode?: 'national' | 'state';
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
  // Max travel distance preference (undefined = unlimited, number = miles)
  maxTravelDistance?: number;
  // Park codes that are outside the user's travel distance (blacklisted)
  blacklistedParkCodes?: string[];
  // Parsed defaults from userProfile for programmatic access
  defaults?: ContextDefaults;
  // NPS gateway city from park lookups - deterministic location for restaurant/reservation searches
  npsGatewayCity?: {
    city: string;
    state: string;
    parkCode?: string;
    parkName?: string;
  };
  // Track URLs used in this conversation to prevent duplicates
  seenUrls?: Set<string>;
  // Tool settings for controlling which API tools are enabled
  toolSettings?: {
    languageModel?: 'claude-sonnet-4-20250514' | 'claude-3-5-haiku-20241022';
    enabledTools?: string[];
  };
  // Travel dates for booking links (departure/return in YYYY-MM-DD format)
  travelDates?: {
    departure?: string;
    return?: string;
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
  segments?: string[];
  toolsUsed?: string[];  // List of tool names that were called during this request
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
// These messages are shown to end users in the chat UI during tool execution
export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // National Parks tools
  'search_national_parks': 'Searching for national parks...',
  'get_park_details': 'Loading park details...',
  'get_park_hikes': 'Finding hiking trails...',
  'search_hikes': 'Finding hiking trails...',
  'search_campgrounds': 'Searching for campgrounds...',
  'get_campgrounds': 'Finding campgrounds nearby...',
  'get_wildlife': 'Discovering local wildlife...',
  'plan_park_trip': 'Planning your park trip...',
  // State Parks tools
  'search_state_parks': 'Searching for state parks...',
  'get_state_park_details': 'Loading state park details...',
  'get_state_park_campgrounds': 'Finding campgrounds at this state park...',
  'get_state_park_hikes': 'Finding trails at this state park...',
  // Travel booking tools
  'search_flights': 'Searching for available flights...',
  'search_hotels': 'Finding hotels and lodging...',
  'search_restaurants': 'Finding nearby restaurants...',
  'search_car_rentals': 'Searching for rental cars...',
  'search_activities': 'Finding tours and activities...',
  'get_reservation_link': 'Generating your reservation link...',
  // Utility tools
  'get_driving_distance': 'Calculating driving distance...',
  'search_ev_charging_stations': 'Finding EV charging stations...',
  'search_ev_chargers': 'Finding EV charging stations...',
  'get_weather': 'Checking the weather forecast...',
  'search_attractions': 'Discovering local attractions...',
  'get_destination_photos': 'Loading photos of your destination...',
  'refresh_photos': 'Refreshing destination photos...',
};
