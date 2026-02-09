import axios from 'axios';

// API URL is set by .env.development (local dev) or .env.production (deployed)
// Scripts update .env.development: Android uses 10.0.2.2:3001, iOS uses localhost:3001
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate instance for chat with longer timeout (Claude can take 2+ minutes with tool calls)
const chatApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes for complex chat requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface FlightOffer {
  id: string;
  provider: string;
  price: { total: number; currency: string };
  validatingAirline: string;
  itineraries: Array<{
    duration: string;
    segments: Array<{
      departure: { iataCode: string; at: string };
      arrival: { iataCode: string; at: string };
      flightNumber: string;
      duration: string;
    }>;
  }>;
  bookingUrl?: string;
}

export interface HotelOffer {
  id: string;
  name: string;
  address: { city: string; country: string };
  price: { perNight: number; total: number; currency: string };
  starRating?: number;
  amenities: string[];
}

export interface ParkHike {
  name: string;
  distance: string;
  elevationGain: string;
  difficulty: 'Easy' | 'Moderate' | 'Strenuous' | 'Very Strenuous';
  duration: string;
  description: string;
  highlights: string[];
}

export interface NationalPark {
  name: string;
  parkCode: string;
  states: string[];
  description: string;
  entranceFee: string;
  url: string;
}

export interface TripPlan {
  tripSummary: {
    park: string;
    dates: string;
    travelers: number;
    nearestAirport: string;
  };
  park: {
    name: string;
    description: string;
    entranceFee: string;
    states: string;
    url: string;
  };
  flights: {
    note: string;
    options?: Array<{
      price: string;
      airline: string;
      duration: string;
      stops: number;
    }>;
  };
  lodging: {
    campgrounds: Array<{
      name: string;
      sites: number;
      fees: string;
    }>;
    note: string;
  };
  hikes: ParkHike[];
  budgetTips: string[];
}

// API Functions
export const searchFlights = async (params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
}) => {
  const response = await api.get('/api/flights/search', { params });
  return response.data;
};

export const searchHotels = async (params: {
  location: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
}) => {
  const response = await api.get('/api/hotels/search', { params });
  return response.data;
};

export const searchParks = async (query: string) => {
  const response = await api.get('/api/parks/search', { params: { query } });
  return response.data;
};

export const getParkDetails = async (parkCode: string) => {
  const response = await api.get(`/api/parks/${parkCode}`);
  return response.data;
};

export const getParkHikes = async (parkCode: string) => {
  const response = await api.get(`/api/parks/${parkCode}/hikes`);
  return response.data;
};

export const planParkTrip = async (params: {
  parkCode: string;
  originAirport: string;
  arrivalDate: string;
  departureDate: string;
  adults?: number;
}): Promise<TripPlan> => {
  const response = await api.post('/api/trips/plan-park-trip', params);
  return response.data;
};

export const getAirportInfo = async (iataCode: string) => {
  const response = await api.get(`/api/airports/${iataCode}`);
  return response.data;
};

// Claude AI Chat
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  userLocation?: {
    city: string;
    state: string;
    nearestAirport: string;
  };
  tripContext?: {
    destination?: string;
    destinationType?: 'national_park' | 'city' | 'other';
    parkCode?: string;
    parkName?: string;
    numDays?: number;
    numTravelers?: number;
    travelDates?: {
      arrival?: string;
      departure?: string;
    };
    departingFrom?: string;
  };
  // Cached context from local storage (reduces redundant API calls)
  npsGatewayCity?: {
    city: string;
    state: string;
    parkCode?: string;
    parkName?: string;
  };
  knownRestaurants?: Array<{
    name: string;
    city: string;
    state: string;
    reservationLink?: string;
  }>;
  knownHikes?: string[];
  userProfile?: string;
  // Max travel distance preference (null = unlimited, number = miles)
  maxTravelDistance?: number;
  // Park codes that are outside the user's travel distance (blacklisted)
  blacklistedParkCodes?: string[];
  // Park mode: 'national' for 63 US National Parks, 'state' for state parks
  parkMode?: 'national' | 'state';
  // Travel dates for booking links (departure/return in YYYY-MM-DD format)
  travelDates?: {
    departure?: string;
    return?: string;
  };
  // Tool settings for controlling which API tools are enabled
  toolSettings?: {
    languageModel?: 'claude-sonnet-4-20250514' | 'claude-3-5-haiku-20241022';
    enabledTools?: string[];
  };
}

export interface PhotoReference {
  keyword: string;
  url: string;
  caption?: string;
}

export const sendChatMessage = async (
  messages: ChatMessage[],
  context: ChatContext,
  model?: string
): Promise<{ response: string; photos?: PhotoReference[]; segments?: string[]; fallback?: boolean }> => {
  const response = await chatApi.post('/api/chat', { messages, context, model });
  return response.data;
};

// Chat with real-time tool status updates via polling
// Uses /api/chat/start to initiate request, then polls /api/chat/status for updates
export const sendChatMessageWithStream = async (
  messages: ChatMessage[],
  context: ChatContext,
  model: string | undefined,
  onToolStatus: (message: string) => void,
  abortSignal?: AbortSignal
): Promise<{ response: string; photos?: PhotoReference[]; segments?: string[]; fallback?: boolean }> => {
  // Show initial status
  onToolStatus('Thinking...');
  
  try {
    // Start the chat request and get a request ID
    const startResponse = await chatApi.post('/api/chat/start', { messages, context, model }, {
      signal: abortSignal,
    });
    
    const { requestId } = startResponse.data;
    
    if (!requestId) {
      // Fallback to synchronous endpoint if no requestId returned
      const response = await chatApi.post('/api/chat', { messages, context, model }, {
        signal: abortSignal,
      });
      return response.data;
    }
    
    // Poll for status updates
    let lastToolName = '';
    
    while (true) {
      // Check if aborted
      if (abortSignal?.aborted) {
        const abortError = new Error('Request aborted');
        abortError.name = 'AbortError';
        throw abortError;
      }
      
      // Wait before polling (500ms for responsive updates)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        const statusResponse = await api.get(`/api/chat/status/${requestId}`, {
          signal: abortSignal,
        });
        
        const statusData = statusResponse.data;
        
        // Update tool status if it changed
        if (statusData.toolName && statusData.toolName !== lastToolName) {
          lastToolName = statusData.toolName;
          onToolStatus(statusData.toolName);
        }
        
        // Check if complete
        if (statusData.status === 'complete') {
          return {
            response: statusData.response,
            photos: statusData.photos,
            segments: statusData.segments,
            fallback: statusData.fallback,
          };
        }
        
        // Check if error
        if (statusData.status === 'error') {
          throw new Error(statusData.error || 'Chat request failed');
        }
        
      } catch (pollError: any) {
        // If polling fails with 404, the request may have completed and been cleaned up
        if (pollError?.response?.status === 404) {
          throw new Error('Request expired or not found');
        }
        // Re-throw abort errors
        if (pollError?.name === 'AbortError' || pollError?.name === 'CanceledError' || pollError?.code === 'ERR_CANCELED') {
          const abortError = new Error('Request aborted');
          abortError.name = 'AbortError';
          throw abortError;
        }
        // For other errors, continue polling (might be temporary network issue)
        console.warn('Polling error, retrying:', pollError.message);
      }
    }
  } catch (error: any) {
    // Re-throw abort errors with a specific type for handling upstream
    if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED' || abortSignal?.aborted) {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      throw abortError;
    }
    throw error;
  }
};

// State Parks API
export interface StateParkSummary {
  id: string;
  name: string;
  state: string;
  stateFullName: string;
  designationLabel: string;
  acres: number;
  acresFormatted: string;
  publicAccess: 'Open' | 'Restricted' | 'Closed' | 'Unknown';
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

export const fetchStateParks = async (stateCode: string, limit: number = 20): Promise<StateParkSummary[]> => {
  try {
    const response = await api.get(`/api/state-parks/search`, {
      params: { state: stateCode, limit }
    });
    return response.data.parks || [];
  } catch (error) {
    console.error('Failed to fetch state parks:', error);
    return [];
  }
};

// Trail map data
export interface TrailMapMarker {
  id: string;
  name: string;
  parkId: string;
  parkName: string;
  latitude: number;
  longitude: number;
  lengthMiles?: number;
  difficulty?: string;
  difficultySource?: string;
  trailType?: string;
  googleMapsUrl?: string;
  allTrailsUrl?: string;
  geometry?: Array<{ latitude: number; longitude: number }>;
}

export interface TrailMapResponse {
  stateCode: string;
  totalTrails: number;
  trails: TrailMapMarker[];
}

export const fetchTrailsForMap = async (stateCode: string, parkId?: string): Promise<TrailMapResponse> => {
  try {
    const params: Record<string, string> = { includeGeometry: 'true' };
    if (parkId) params.parkId = parkId;
    const response = await api.get(`/api/trails/map/${stateCode.toUpperCase()}`, { params });
    return response.data;
  } catch (error) {
    console.error('Failed to fetch trail map data:', error);
    return { stateCode: stateCode.toUpperCase(), totalTrails: 0, trails: [] };
  }
};

export interface ParkMapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stateCode?: string;
  category?: string;
  designation?: string;
  stateName?: string;
}

export interface CampgroundMapMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  parkName?: string;
  totalSites?: number;
  reservationUrl?: string;
  googleMapsUrl?: string;
  description?: string;
  amenities?: string[];
  siteTypes?: string[];
  phone?: string;
  petFriendly?: boolean;
  openSeason?: string;
  rating?: number;
  priceMin?: number;
  priceMax?: number;
}

export const fetchParksForMap = async (stateCode: string): Promise<ParkMapMarker[]> => {
  try {
    const response = await api.get(`/api/map/parks/${stateCode.toUpperCase()}`);
    return response.data.parks || [];
  } catch (error) {
    console.error('Failed to fetch parks for map:', error);
    return [];
  }
};

export const fetchCampgroundsForMap = async (stateCode: string): Promise<CampgroundMapMarker[]> => {
  try {
    const response = await api.get(`/api/map/campgrounds/${stateCode.toUpperCase()}`);
    return response.data.campgrounds || [];
  } catch (error) {
    console.error('Failed to fetch campgrounds for map:', error);
    return [];
  }
};

// Spatial: fetch trails by map bounding box (Postgres-powered)
export const fetchTrailsByBoundingBox = async (
  minLat: number, minLng: number, maxLat: number, maxLng: number,
  options?: { limit?: number; difficulty?: string }
): Promise<TrailMapMarker[]> => {
  try {
    const params: Record<string, string> = {
      minLat: String(minLat), minLng: String(minLng),
      maxLat: String(maxLat), maxLng: String(maxLng),
    };
    if (options?.limit) params.limit = String(options.limit);
    if (options?.difficulty) params.difficulty = options.difficulty;
    const response = await api.get('/api/trails/bbox', { params });
    return response.data.trails || [];
  } catch (error) {
    console.error('Failed to fetch trails by bounding box:', error);
    return [];
  }
};

// Spatial: fetch campgrounds near a point (Postgres-powered)
export const fetchCampgroundsNearby = async (
  latitude: number, longitude: number, radiusMiles: number = 50
): Promise<(CampgroundMapMarker & { distanceMiles: number })[]> => {
  try {
    const params = {
      latitude: String(latitude), longitude: String(longitude),
      radius: String(radiusMiles),
    };
    const response = await api.get('/api/campgrounds/nearby', { params });
    return response.data.campgrounds || [];
  } catch (error) {
    console.error('Failed to fetch nearby campgrounds:', error);
    return [];
  }
};

// Error logging
export const logErrorToServer = async (error: {
  message: string;
  stack?: string;
  endpoint?: string;
  context?: Record<string, any>;
}): Promise<void> => {
  try {
    await api.post('/api/log-error', error);
  } catch (e) {
    // Silently fail - don't cause more errors trying to log errors
    console.error('Failed to log error to server:', e);
  }
};

// Create HTML itinerary
export interface CreateItineraryParams {
  content: string;
  destination?: string;
  photos?: Array<{ url: string; caption?: string; keyword?: string }>;
  links?: Array<{ text: string; url: string }>;
}

export const createHtmlItinerary = async (params: CreateItineraryParams): Promise<{ id: string; url: string }> => {
  const response = await api.post('/api/itinerary/create', params);
  return response.data;
};

export default api;
