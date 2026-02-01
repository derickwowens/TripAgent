import axios from 'axios';

// Use your deployed API URL in production, localhost for development
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.109:3000'; // Your local IP for emulator access

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
