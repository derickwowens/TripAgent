/**
 * LinkPrefillService
 * 
 * A SOLID-compliant service for generating prefilled booking/travel links.
 * Follows:
 * - Single Responsibility: Each link generator handles one provider
 * - Open/Closed: New providers can be added without modifying existing code
 * - Liskov Substitution: All generators implement the same interface
 * - Interface Segregation: Clean, focused interfaces
 * - Dependency Inversion: Depends on abstractions, not concretions
 */

/**
 * Travel context that can be used for prefilling links
 */
export interface TravelContext {
  // Dates
  departureDate?: string;  // YYYY-MM-DD format
  returnDate?: string;     // YYYY-MM-DD format
  
  // Location
  location?: string;       // City, airport code, or address
  origin?: string;         // Origin for flights/directions
  destination?: string;    // Destination
  
  // Travelers
  adults?: number;
  children?: number;
  rooms?: number;          // For hotels
  
  // User preferences
  userProfile?: string;    // Full user profile string for preference detection
}

/**
 * Generated link with metadata
 */
export interface PrefillableLink {
  url: string;
  provider: string;
  category: LinkCategory;
  isPrimary: boolean;      // Whether this is the user's preferred provider
  displayText?: string;    // Human-readable link text
}

/**
 * Categories of prefillable links
 */
export type LinkCategory = 'flights' | 'cars' | 'hotels' | 'activities' | 'camping';

/**
 * Interface for link generators - each provider implements this
 */
export interface ILinkGenerator {
  readonly provider: string;
  readonly category: LinkCategory;
  generate(context: TravelContext): string;
  getDisplayText(context: TravelContext): string;
}

/**
 * Date formatting utilities for different providers
 */
export class DateFormatter {
  /**
   * Format date as YYYY-MM-DD (ISO format, used by most providers)
   */
  static toISO(date: string): string {
    return date; // Already in correct format
  }
  
  /**
   * Format date as MM/DD/YYYY (used by Turo, some US providers)
   */
  static toUSFormat(date: string): string {
    const [year, month, day] = date.split('-');
    if (year && month && day) {
      return `${month}/${day}/${year}`;
    }
    return date;
  }
  
  /**
   * Format date as YYYYMMDD (compact, used by some APIs)
   */
  static toCompact(date: string): string {
    return date.replace(/-/g, '');
  }
}

// ============================================================================
// FLIGHT LINK GENERATORS
// ============================================================================

export class KayakFlightGenerator implements ILinkGenerator {
  readonly provider = 'Kayak';
  readonly category: LinkCategory = 'flights';
  
  generate(context: TravelContext): string {
    const { origin, destination, departureDate, returnDate } = context;
    if (!origin || !destination || !departureDate) {
      return `https://www.kayak.com/flights`;
    }
    
    return returnDate
      ? `https://www.kayak.com/flights/${origin}-${destination}/${departureDate}/${returnDate}`
      : `https://www.kayak.com/flights/${origin}-${destination}/${departureDate}`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search ${context.origin || ''} to ${context.destination || ''} flights on Kayak`;
  }
}

export class GoogleFlightsGenerator implements ILinkGenerator {
  readonly provider = 'Google Flights';
  readonly category: LinkCategory = 'flights';
  
  generate(context: TravelContext): string {
    const { origin, destination, departureDate, returnDate } = context;
    if (!origin || !destination || !departureDate) {
      return `https://www.google.com/travel/flights`;
    }
    
    const tfs = returnDate
      ? `${origin}.${destination}.${departureDate}*${destination}.${origin}.${returnDate}`
      : `${origin}.${destination}.${departureDate}`;
    
    return `https://www.google.com/travel/flights?tfs=${encodeURIComponent(tfs)}&tfu=EgYIAhAAGAA`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search ${context.origin || ''} to ${context.destination || ''} on Google Flights`;
  }
}

// ============================================================================
// CAR RENTAL LINK GENERATORS
// ============================================================================

export class KayakCarsGenerator implements ILinkGenerator {
  readonly provider = 'Kayak';
  readonly category: LinkCategory = 'cars';
  
  generate(context: TravelContext): string {
    const { location, departureDate, returnDate } = context;
    if (!location || !departureDate || !returnDate) {
      return `https://www.kayak.com/cars`;
    }
    
    return `https://www.kayak.com/cars/${encodeURIComponent(location)}/${departureDate}/${returnDate}`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search car rentals in ${context.location || 'your destination'} on Kayak`;
  }
}

export class TuroGenerator implements ILinkGenerator {
  readonly provider = 'Turo';
  readonly category: LinkCategory = 'cars';
  
  generate(context: TravelContext): string {
    const { location, departureDate, returnDate } = context;
    const params = new URLSearchParams();
    
    if (location) {
      params.set('location', location);
    }
    
    if (departureDate) {
      params.set('startDate', DateFormatter.toUSFormat(departureDate));
    }
    
    if (returnDate) {
      params.set('endDate', DateFormatter.toUSFormat(returnDate));
    }
    
    const queryString = params.toString();
    return queryString 
      ? `https://turo.com/search?${queryString}`
      : `https://turo.com`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search Turo cars in ${context.location || 'your destination'}`;
  }
}

// ============================================================================
// HOTEL LINK GENERATORS
// ============================================================================

export class BookingComGenerator implements ILinkGenerator {
  readonly provider = 'Booking.com';
  readonly category: LinkCategory = 'hotels';
  
  generate(context: TravelContext): string {
    const { location, departureDate, returnDate, adults = 2, rooms = 1 } = context;
    if (!location) {
      return `https://www.booking.com`;
    }
    
    const params = new URLSearchParams();
    params.set('ss', location);
    if (departureDate) params.set('checkin', departureDate);
    if (returnDate) params.set('checkout', returnDate);
    params.set('group_adults', adults.toString());
    params.set('no_rooms', rooms.toString());
    
    return `https://www.booking.com/searchresults.html?${params.toString()}`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search hotels in ${context.location || 'your destination'} on Booking.com`;
  }
}

export class HotelsComGenerator implements ILinkGenerator {
  readonly provider = 'Hotels.com';
  readonly category: LinkCategory = 'hotels';
  
  generate(context: TravelContext): string {
    const { location, departureDate, returnDate, adults = 2, rooms = 1 } = context;
    if (!location) {
      return `https://www.hotels.com`;
    }
    
    const params = new URLSearchParams();
    params.set('q-destination', location);
    if (departureDate) params.set('q-check-in', departureDate);
    if (returnDate) params.set('q-check-out', returnDate);
    params.set('q-rooms', rooms.toString());
    params.set('q-room-0-adults', adults.toString());
    
    return `https://www.hotels.com/search.do?${params.toString()}`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search hotels in ${context.location || 'your destination'} on Hotels.com`;
  }
}

export class AirbnbGenerator implements ILinkGenerator {
  readonly provider = 'Airbnb';
  readonly category: LinkCategory = 'hotels';
  
  generate(context: TravelContext): string {
    const { location, departureDate, returnDate, adults = 2 } = context;
    if (!location) {
      return `https://www.airbnb.com`;
    }
    
    const params = new URLSearchParams();
    params.set('query', location);
    if (departureDate) params.set('checkin', departureDate);
    if (returnDate) params.set('checkout', returnDate);
    params.set('adults', adults.toString());
    
    return `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes?${params.toString()}`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search Airbnb in ${context.location || 'your destination'}`;
  }
}

// ============================================================================
// CAMPING LINK GENERATORS
// ============================================================================

export class RecreationGovGenerator implements ILinkGenerator {
  readonly provider = 'Recreation.gov';
  readonly category: LinkCategory = 'camping';
  
  generate(context: TravelContext): string {
    const { location, departureDate } = context;
    if (!location) {
      return `https://www.recreation.gov`;
    }
    
    const params = new URLSearchParams();
    params.set('q', location);
    if (departureDate) {
      params.set('start_date', departureDate);
    }
    
    return `https://www.recreation.gov/search?${params.toString()}`;
  }
  
  getDisplayText(context: TravelContext): string {
    return `Search campgrounds near ${context.location || 'your destination'}`;
  }
}

// ============================================================================
// LINK PREFILL SERVICE - Main orchestrator
// ============================================================================

/**
 * User preferences for different categories
 */
interface UserPreferences {
  preferredCarRental?: string;
  preferredHotel?: string;
  preferredAirline?: string;
}

/**
 * Main service for generating prefilled links
 * Orchestrates all link generators and handles user preferences
 */
export class LinkPrefillService {
  private generators: Map<LinkCategory, ILinkGenerator[]> = new Map();
  
  constructor() {
    // Register all generators
    this.registerGenerator(new KayakFlightGenerator());
    this.registerGenerator(new GoogleFlightsGenerator());
    this.registerGenerator(new KayakCarsGenerator());
    this.registerGenerator(new TuroGenerator());
    this.registerGenerator(new BookingComGenerator());
    this.registerGenerator(new HotelsComGenerator());
    this.registerGenerator(new AirbnbGenerator());
    this.registerGenerator(new RecreationGovGenerator());
  }
  
  /**
   * Register a new link generator (Open/Closed principle)
   */
  registerGenerator(generator: ILinkGenerator): void {
    const existing = this.generators.get(generator.category) || [];
    existing.push(generator);
    this.generators.set(generator.category, existing);
  }
  
  /**
   * Parse user profile to extract preferences
   */
  private parsePreferences(userProfile?: string): UserPreferences {
    const profile = userProfile?.toLowerCase() || '';
    
    return {
      preferredCarRental: this.detectCarPreference(profile),
      preferredHotel: this.detectHotelPreference(profile),
      preferredAirline: this.detectAirlinePreference(profile),
    };
  }
  
  private detectCarPreference(profile: string): string | undefined {
    if (profile.includes('turo')) return 'Turo';
    if (profile.includes('hertz')) return 'Hertz';
    if (profile.includes('enterprise')) return 'Enterprise';
    if (profile.includes('national')) return 'National';
    if (profile.includes('budget')) return 'Budget';
    return undefined;
  }
  
  private detectHotelPreference(profile: string): string | undefined {
    if (profile.includes('airbnb') || profile.includes('vrbo')) return 'Airbnb';
    if (profile.includes('marriott')) return 'Marriott';
    if (profile.includes('hilton')) return 'Hilton';
    if (profile.includes('ihg')) return 'IHG';
    if (profile.includes('hyatt')) return 'Hyatt';
    return undefined;
  }
  
  private detectAirlinePreference(profile: string): string | undefined {
    if (profile.includes('delta')) return 'Delta';
    if (profile.includes('southwest')) return 'Southwest';
    if (profile.includes('united')) return 'United';
    if (profile.includes('american')) return 'American';
    if (profile.includes('jetblue')) return 'JetBlue';
    if (profile.includes('alaska')) return 'Alaska';
    return undefined;
  }
  
  /**
   * Generate all links for a category, sorted by user preference
   */
  generateLinks(category: LinkCategory, context: TravelContext): PrefillableLink[] {
    const generators = this.generators.get(category) || [];
    const preferences = this.parsePreferences(context.userProfile);
    
    const links: PrefillableLink[] = generators.map(gen => ({
      url: gen.generate(context),
      provider: gen.provider,
      category: gen.category,
      isPrimary: this.isPreferred(gen, preferences),
      displayText: gen.getDisplayText(context),
    }));
    
    // Sort so preferred provider comes first
    return links.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return 0;
    });
  }
  
  /**
   * Generate a single link for a specific provider
   */
  generateLink(provider: string, context: TravelContext): PrefillableLink | null {
    for (const generators of this.generators.values()) {
      const gen = generators.find(g => g.provider.toLowerCase() === provider.toLowerCase());
      if (gen) {
        const preferences = this.parsePreferences(context.userProfile);
        return {
          url: gen.generate(context),
          provider: gen.provider,
          category: gen.category,
          isPrimary: this.isPreferred(gen, preferences),
          displayText: gen.getDisplayText(context),
        };
      }
    }
    return null;
  }
  
  /**
   * Generate booking links object (for backward compatibility)
   */
  generateBookingLinks(category: LinkCategory, context: TravelContext): Record<string, string> {
    const links = this.generateLinks(category, context);
    const result: Record<string, string> = {};
    
    for (const link of links) {
      const key = link.provider.toLowerCase().replace(/[.\s]/g, '');
      result[key] = link.url;
    }
    
    return result;
  }
  
  /**
   * Get the preferred provider for a category based on user profile
   */
  getPreferredProvider(category: LinkCategory, context: TravelContext): string | undefined {
    const preferences = this.parsePreferences(context.userProfile);
    
    switch (category) {
      case 'cars':
        return preferences.preferredCarRental;
      case 'hotels':
        return preferences.preferredHotel;
      case 'flights':
        return preferences.preferredAirline;
      default:
        return undefined;
    }
  }
  
  private isPreferred(generator: ILinkGenerator, preferences: UserPreferences): boolean {
    switch (generator.category) {
      case 'cars':
        return generator.provider === preferences.preferredCarRental;
      case 'hotels':
        return generator.provider === preferences.preferredHotel || 
               (preferences.preferredHotel === 'Airbnb' && generator.provider === 'Airbnb');
      default:
        return false;
    }
  }
}

// Export singleton instance for convenience
export const linkPrefillService = new LinkPrefillService();
