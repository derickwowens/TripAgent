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
    parkCode?: string;
    numDays?: number;
    numTravelers?: number;
  };
  userProfile?: string;
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
): Promise<{ response: string; photos?: PhotoReference[]; fallback?: boolean }> => {
  const response = await chatApi.post('/api/chat', { messages, context, model });
  return response.data;
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
