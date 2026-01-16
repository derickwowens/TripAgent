import {
  FlightProvider,
  FlightSearchParams,
  FlightOffer,
  HotelProvider,
  HotelSearchParams,
  HotelOffer,
  CarRentalProvider,
  CarRentalSearchParams,
  CarRentalOffer,
  ActivityProvider,
  ActivitySearchByLocationParams,
  ActivityOffer,
  TravelSearchResults,
  Airport,
} from '../types/index.js';
import { 
  NationalParksAdapter, 
  NationalPark, 
  ParkHike 
} from '../../providers/parks/NationalParksAdapter.js';

export interface ParkTripPlanParams {
  parkCode: string;
  originAirport: string;
  arrivalDate: string;
  departureDate: string;
  adults: number;
}

export class TravelFacade {
  private flightProviders: FlightProvider[];
  private hotelProviders: HotelProvider[];
  private carProviders: CarRentalProvider[];
  private activityProviders: ActivityProvider[];
  private parksAdapter: NationalParksAdapter | null = null;

  constructor(
    flightProviders: FlightProvider[] = [],
    hotelProviders: HotelProvider[] = [],
    carProviders: CarRentalProvider[] = [],
    activityProviders: ActivityProvider[] = [],
    parksAdapter?: NationalParksAdapter
  ) {
    this.flightProviders = flightProviders;
    this.hotelProviders = hotelProviders;
    this.carProviders = carProviders;
    this.activityProviders = activityProviders;
    this.parksAdapter = parksAdapter || null;
  }

  // ============================================
  // FLIGHT SEARCH
  // ============================================
  async searchFlights(params: FlightSearchParams): Promise<TravelSearchResults<FlightOffer>> {
    const allResults: FlightOffer[] = [];
    const usedProviders: string[] = [];
    const errors: string[] = [];

    for (const provider of this.flightProviders) {
      try {
        const results = await provider.searchFlights(params);
        allResults.push(...results);
        usedProviders.push(provider.name);
      } catch (error: any) {
        errors.push(`${provider.name}: ${error.message}`);
        console.error(`Flight provider ${provider.name} failed:`, error.message);
      }
    }

    // Sort by price (lowest first)
    allResults.sort((a, b) => a.price.total - b.price.total);

    return {
      query: params,
      results: allResults,
      totalResults: allResults.length,
      providers: usedProviders,
      searchTimestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // HOTEL SEARCH
  // ============================================
  async searchHotels(params: HotelSearchParams): Promise<TravelSearchResults<HotelOffer>> {
    const allResults: HotelOffer[] = [];
    const usedProviders: string[] = [];

    for (const provider of this.hotelProviders) {
      try {
        const results = await provider.searchHotels(params);
        allResults.push(...results);
        usedProviders.push(provider.name);
      } catch (error: any) {
        console.error(`Hotel provider ${provider.name} failed:`, error.message);
      }
    }

    // Sort by price per night (lowest first)
    allResults.sort((a, b) => a.price.perNight - b.price.perNight);

    return {
      query: params,
      results: allResults,
      totalResults: allResults.length,
      providers: usedProviders,
      searchTimestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // CAR RENTAL SEARCH
  // ============================================
  async searchCarRentals(params: CarRentalSearchParams): Promise<TravelSearchResults<CarRentalOffer>> {
    const allResults: CarRentalOffer[] = [];
    const usedProviders: string[] = [];

    for (const provider of this.carProviders) {
      try {
        const results = await provider.searchCarRentals(params);
        allResults.push(...results);
        usedProviders.push(provider.name);
      } catch (error: any) {
        console.error(`Car provider ${provider.name} failed:`, error.message);
      }
    }

    // Sort by total price (lowest first)
    allResults.sort((a, b) => a.price.total - b.price.total);

    return {
      query: params,
      results: allResults,
      totalResults: allResults.length,
      providers: usedProviders,
      searchTimestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // ACTIVITIES & EXPERIENCES SEARCH
  // ============================================
  async searchActivities(params: ActivitySearchByLocationParams): Promise<TravelSearchResults<ActivityOffer>> {
    const allResults: ActivityOffer[] = [];
    const usedProviders: string[] = [];

    for (const provider of this.activityProviders) {
      try {
        const results = await provider.searchActivitiesByLocation(params);
        allResults.push(...results);
        usedProviders.push(provider.name);
      } catch (error: any) {
        console.error(`Activity provider ${provider.name} failed:`, error.message);
      }
    }

    // Sort by rating (highest first)
    allResults.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return {
      query: params,
      results: allResults,
      totalResults: allResults.length,
      providers: usedProviders,
      searchTimestamp: new Date().toISOString(),
    };
  }

  // ============================================
  // NATIONAL PARKS
  // ============================================
  async searchNationalParks(query: string): Promise<NationalPark[]> {
    if (!this.parksAdapter) {
      throw new Error('National Parks adapter not configured. Set NPS_API_KEY environment variable.');
    }
    return this.parksAdapter.searchParks(query);
  }

  async getParkDetails(parkCode: string): Promise<{
    park: NationalPark;
    thingsToDo: any[];
    campgrounds: any[];
    hikes: ParkHike[];
  } | null> {
    if (!this.parksAdapter) {
      throw new Error('National Parks adapter not configured.');
    }

    const park = await this.parksAdapter.getParkByCode(parkCode);
    if (!park) return null;

    const [thingsToDo, campgrounds] = await Promise.all([
      this.parksAdapter.getThingsToDo(parkCode).catch(() => []),
      this.parksAdapter.getCampgrounds(parkCode).catch(() => []),
    ]);

    const hikes = this.parksAdapter.getHikes(parkCode);

    return {
      park,
      thingsToDo: thingsToDo.slice(0, 10),
      campgrounds: campgrounds.slice(0, 5),
      hikes,
    };
  }

  getParkHikes(parkCode: string): ParkHike[] {
    if (!this.parksAdapter) {
      return [];
    }
    return this.parksAdapter.getHikes(parkCode);
  }

  async getParkActivities(parkCode: string): Promise<any[]> {
    if (!this.parksAdapter) {
      return [];
    }
    try {
      return await this.parksAdapter.getThingsToDo(parkCode);
    } catch {
      return [];
    }
  }

  async planParkTrip(params: ParkTripPlanParams): Promise<any> {
    if (!this.parksAdapter) {
      throw new Error('National Parks adapter not configured.');
    }

    // Get park info (may fail if no API key)
    let park: NationalPark | null = null;
    let thingsToDo: any[] = [];
    let campgrounds: any[] = [];
    
    try {
      park = await this.parksAdapter.getParkByCode(params.parkCode);
      if (park) {
        [thingsToDo, campgrounds] = await Promise.all([
          this.parksAdapter.getThingsToDo(params.parkCode).catch(() => []),
          this.parksAdapter.getCampgrounds(params.parkCode).catch(() => []),
        ]);
      }
    } catch (error: any) {
      // API key not configured - continue with limited data
      console.error('NPS API unavailable:', error.message);
    }

    // Get nearest airport
    const nearestAirport = this.parksAdapter.getNearestAirport(params.parkCode);
    const destinationAirport = nearestAirport?.code || 'N/A';

    // Search for flights (if we have flight providers)
    let flights: any[] = [];
    if (this.flightProviders.length > 0 && destinationAirport !== 'N/A') {
      try {
        const flightResults = await this.searchFlights({
          origin: params.originAirport,
          destination: destinationAirport,
          departureDate: params.arrivalDate,
          returnDate: params.departureDate,
          adults: params.adults,
        });
        flights = flightResults.results.slice(0, 5).map(f => ({
          price: this.formatPrice(f.price.total, f.price.currency),
          airline: f.validatingAirline,
          duration: this.formatDuration(f.itineraries[0]?.duration || ''),
          stops: f.itineraries[0]?.segments.length - 1 || 0,
        }));
      } catch (error: any) {
        console.error('Flight search failed:', error.message);
      }
    }

    // Get hikes (works without API key)
    const hikes = this.parksAdapter.getHikes(params.parkCode);

    // Search for hotels near the park
    let hotels: any[] = [];
    if (this.hotelProviders.length > 0 && park?.name) {
      try {
        const hotelResults = await this.searchHotels({
          location: park.name,
          checkInDate: params.arrivalDate,
          checkOutDate: params.departureDate,
          adults: params.adults,
          rooms: 1,
        });
        hotels = hotelResults.results.slice(0, 5).map(h => ({
          name: h.name,
          price: this.formatPrice(h.price.total, h.price.currency),
          pricePerNight: this.formatPrice(h.price.perNight, h.price.currency),
          rating: h.rating,
          address: h.address,
        }));
      } catch (error: any) {
        console.error('Hotel search failed:', error.message);
      }
    }

    // Search for car rentals at the destination airport
    let cars: any[] = [];
    if (this.carProviders.length > 0 && destinationAirport !== 'N/A') {
      try {
        const carResults = await this.searchCarRentals({
          pickupLocation: destinationAirport,
          pickupDate: params.arrivalDate,
          dropoffDate: params.departureDate,
          pickupTime: '10:00',
          dropoffTime: '10:00',
        });
        cars = carResults.results.slice(0, 5).map(c => ({
          vendor: c.vendor,
          vehicle: `${c.vehicle.category} (${c.vehicle.transmission})`,
          pricePerDay: this.formatPrice(c.price.perDay, c.price.currency),
          totalPrice: this.formatPrice(c.price.total, c.price.currency),
          features: c.mileage?.unlimited ? 'Unlimited miles' : undefined,
        }));
      } catch (error: any) {
        console.error('Car rental search failed:', error.message);
      }
    }

    // Park name fallback
    const parkName = park?.name || params.parkCode.toUpperCase();
    const parkStates = park?.states.join(', ') || 'USA';

    return {
      tripSummary: {
        park: parkName,
        dates: `${params.arrivalDate} to ${params.departureDate}`,
        travelers: params.adults,
        nearestAirport: nearestAirport 
          ? `${nearestAirport.code} - ${nearestAirport.name} (${nearestAirport.distance} from park)`
          : 'No nearby airport data',
      },
      park: park ? {
        name: park.name,
        description: park.description.substring(0, 300) + '...',
        entranceFee: park.entranceFee,
        states: park.states.join(', '),
        url: park.url,
        images: park.images?.slice(0, 3) || [],
      } : {
        name: parkName,
        description: 'Park details unavailable - set NPS_API_KEY for full details',
        entranceFee: 'See nps.gov',
        states: parkStates,
        url: `https://www.nps.gov/${params.parkCode}/index.htm`,
      },
      flights: flights.length > 0 ? {
        note: `Flights from ${params.originAirport} to ${destinationAirport}`,
        options: flights,
      } : {
        note: 'No flight data available. Consider searching manually.',
      },
      lodging: {
        hotels: hotels.length > 0 ? {
          note: `Hotels near ${parkName}`,
          options: hotels,
        } : {
          note: 'No hotel data available. Search booking sites for lodging options.',
        },
        campgrounds: campgrounds.slice(0, 3).map((c: any) => ({
          name: c.name,
          sites: c.totalSites,
          fees: c.fees,
          reservationUrl: c.reservationUrl,
          images: c.images?.slice(0, 2) || [],
        })),
      },
      carRentals: cars.length > 0 ? {
        note: `Car rentals at ${destinationAirport}`,
        options: cars,
      } : {
        note: 'No car rental data available. Search rental sites for options.',
      },
      activities: thingsToDo.slice(0, 5).map((a: any) => ({
        title: a.title,
        duration: a.duration,
        requiresReservation: a.requiresReservation,
        images: a.images?.slice(0, 2) || [],
      })),
      hikes: hikes.map(h => ({
        name: h.name,
        difficulty: h.difficulty,
        distance: h.distance,
        elevationGain: h.elevationGain,
        duration: h.duration,
        highlights: h.highlights,
      })),
      budgetTips: [
        'Book campgrounds early - popular sites fill up months in advance',
        'Consider visiting during shoulder season (spring/fall) for lower prices',
        'Bring your own food - park concessions are expensive',
        'Annual America the Beautiful pass ($80) covers entrance to all national parks',
      ],
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================
  
  getAirportInfo(iataCode: string): Airport | null {
    // Common airports lookup (stateless, in-memory)
    const airports: Record<string, Airport> = {
      LAX: { iataCode: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'USA' },
      JFK: { iataCode: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA' },
      SFO: { iataCode: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'USA' },
      ORD: { iataCode: 'ORD', name: "O'Hare International", city: 'Chicago', country: 'USA' },
      DFW: { iataCode: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'USA' },
      DEN: { iataCode: 'DEN', name: 'Denver International', city: 'Denver', country: 'USA' },
      ATL: { iataCode: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', country: 'USA' },
      MIA: { iataCode: 'MIA', name: 'Miami International', city: 'Miami', country: 'USA' },
      SEA: { iataCode: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', country: 'USA' },
      BOS: { iataCode: 'BOS', name: 'Boston Logan International', city: 'Boston', country: 'USA' },
      LHR: { iataCode: 'LHR', name: 'Heathrow', city: 'London', country: 'UK' },
      CDG: { iataCode: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France' },
      FRA: { iataCode: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany' },
      AMS: { iataCode: 'AMS', name: 'Amsterdam Schiphol', city: 'Amsterdam', country: 'Netherlands' },
      NRT: { iataCode: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'Japan' },
      HND: { iataCode: 'HND', name: 'Haneda Airport', city: 'Tokyo', country: 'Japan' },
      SYD: { iataCode: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia' },
      SIN: { iataCode: 'SIN', name: 'Changi Airport', city: 'Singapore', country: 'Singapore' },
      DXB: { iataCode: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE' },
      HKG: { iataCode: 'HKG', name: 'Hong Kong International', city: 'Hong Kong', country: 'Hong Kong' },
    };

    return airports[iataCode.toUpperCase()] || null;
  }

  formatDuration(isoDuration: string): string {
    // Convert ISO 8601 duration (PT2H30M) to human readable (2h 30m)
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return isoDuration;

    const hours = match[1] ? `${match[1]}h` : '';
    const minutes = match[2] ? `${match[2]}m` : '';
    return `${hours} ${minutes}`.trim();
  }

  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }
}
