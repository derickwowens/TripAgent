// TripAgent - Domain Types

// ============================================
// FLIGHT TYPES
// ============================================
export interface FlightSearchParams {
  origin: string;           // IATA code (e.g., "LAX")
  destination: string;      // IATA code (e.g., "JFK")
  departureDate: string;    // YYYY-MM-DD
  returnDate?: string;      // YYYY-MM-DD (optional for one-way)
  adults: number;
  children?: number;
  infants?: number;
  cabinClass?: 'economy' | 'premium_economy' | 'business' | 'first';
  nonStop?: boolean;
  maxPrice?: number;
  currency?: string;
}

export interface FlightOffer {
  id: string;
  provider: string;
  price: {
    total: number;
    currency: string;
  };
  itineraries: FlightItinerary[];
  validatingAirline: string;
  bookingUrl?: string;
}

export interface FlightItinerary {
  duration: string;         // ISO 8601 duration (e.g., "PT2H30M")
  segments: FlightSegment[];
}

export interface FlightSegment {
  departure: {
    iataCode: string;
    terminal?: string;
    at: string;             // ISO datetime
  };
  arrival: {
    iataCode: string;
    terminal?: string;
    at: string;
  };
  carrierCode: string;
  carrierName?: string;
  flightNumber: string;
  aircraft?: string;
  duration: string;
  numberOfStops: number;
}

// ============================================
// HOTEL TYPES
// ============================================
export interface HotelSearchParams {
  location: string;         // City name or coordinates
  checkInDate: string;      // YYYY-MM-DD
  checkOutDate: string;     // YYYY-MM-DD
  adults: number;
  children?: number;
  rooms?: number;
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  starRating?: number[];    // e.g., [4, 5] for 4-5 star hotels
  amenities?: string[];
}

export interface HotelOffer {
  id: string;
  provider: string;
  name: string;
  address: {
    street?: string;
    city: string;
    country: string;
    postalCode?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  starRating?: number;
  rating?: {
    score: number;
    reviewCount: number;
  };
  amenities: string[];
  images: string[];
  price: {
    total: number;
    perNight: number;
    currency: string;
  };
  roomType?: string;
  bookingUrl?: string;
}

// ============================================
// VACATION RENTAL TYPES
// ============================================
export interface VacationRentalSearchParams {
  location: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: 'apartment' | 'house' | 'cabin' | 'villa' | 'any';
  priceMin?: number;
  priceMax?: number;
  currency?: string;
  amenities?: string[];
}

export interface VacationRentalOffer {
  id: string;
  provider: string;
  name: string;
  propertyType: string;
  address: {
    city: string;
    country: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities: string[];
  images: string[];
  rating?: {
    score: number;
    reviewCount: number;
  };
  price: {
    total: number;
    perNight: number;
    currency: string;
    cleaningFee?: number;
    serviceFee?: number;
  };
  hostInfo?: {
    name: string;
    isSuperhost?: boolean;
  };
  bookingUrl?: string;
}

// ============================================
// CAR RENTAL TYPES
// ============================================
export interface CarRentalSearchParams {
  pickupLocation: string;   // City or airport code
  dropoffLocation?: string; // Defaults to pickup location
  pickupDate: string;       // YYYY-MM-DD
  pickupTime?: string;      // HH:MM (24h format)
  dropoffDate: string;
  dropoffTime?: string;
  driverAge?: number;
  carType?: 'economy' | 'compact' | 'midsize' | 'fullsize' | 'suv' | 'luxury' | 'van';
  transmission?: 'automatic' | 'manual';
  currency?: string;
}

export interface CarRentalOffer {
  id: string;
  provider: string;
  vendor: string;           // e.g., "Hertz", "Enterprise"
  vehicle: {
    category: string;       // e.g., "Compact SUV"
    make?: string;
    model?: string;
    transmission: string;
    fuelType?: string;
    seats: number;
    doors?: number;
    bags?: number;
    airConditioning: boolean;
  };
  pickup: {
    location: string;
    address?: string;
    dateTime: string;
  };
  dropoff: {
    location: string;
    address?: string;
    dateTime: string;
  };
  price: {
    total: number;
    perDay: number;
    currency: string;
  };
  mileage?: {
    unlimited: boolean;
    included?: number;
    extraPerMile?: number;
  };
  insurance?: {
    included: boolean;
    options?: string[];
  };
  bookingUrl?: string;
}

// ============================================
// ACTIVITIES & EXPERIENCES TYPES
// ============================================
export interface ActivitySearchParams {
  latitude: number;
  longitude: number;
  radius?: number;          // km, default 1
}

export interface ActivitySearchByLocationParams {
  location: string;         // City name to geocode
  radius?: number;
}

export interface ActivityOffer {
  id: string;
  provider: string;
  name: string;
  shortDescription: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  reviewCount?: number;
  pictures: string[];
  price: {
    amount: number;
    currency: string;
  };
  bookingLink: string;      // Direct link to book with provider
  category?: string;
  duration?: string;
}

export interface ActivityProvider {
  name: string;
  searchActivities(params: ActivitySearchParams): Promise<ActivityOffer[]>;
  searchActivitiesByLocation(params: ActivitySearchByLocationParams): Promise<ActivityOffer[]>;
}

// ============================================
// AIRPORT & UTILITY TYPES
// ============================================
export interface Airport {
  iataCode: string;
  name: string;
  city: string;
  country: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  timezone?: string;
}

export interface CurrencyConversion {
  from: string;
  to: string;
  amount: number;
  converted: number;
  rate: number;
  timestamp: string;
}

// ============================================
// PROVIDER INTERFACES
// ============================================
export interface FlightProvider {
  name: string;
  searchFlights(params: FlightSearchParams): Promise<FlightOffer[]>;
}

export interface HotelProvider {
  name: string;
  searchHotels(params: HotelSearchParams): Promise<HotelOffer[]>;
}

export interface VacationRentalProvider {
  name: string;
  searchVacationRentals(params: VacationRentalSearchParams): Promise<VacationRentalOffer[]>;
}

export interface CarRentalProvider {
  name: string;
  searchCarRentals(params: CarRentalSearchParams): Promise<CarRentalOffer[]>;
}

// ============================================
// SEARCH RESULTS WRAPPER
// ============================================
export interface TravelSearchResults<T> {
  query: Record<string, any>;
  results: T[];
  totalResults: number;
  providers: string[];
  searchTimestamp: string;
}
