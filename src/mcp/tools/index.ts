import { TravelFacade } from '../../domain/facade/TravelFacade.js';

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
};

export const tools: ToolDefinition[] = [
  // ============================================
  // FLIGHT SEARCH TOOLS
  // ============================================
  {
    name: 'search_flights',
    description: 'Search for flights between two airports. Returns flight offers with prices, times, and airline information.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: { 
          type: 'string', 
          description: 'Origin airport IATA code (e.g., "LAX", "JFK", "SFO")' 
        },
        destination: { 
          type: 'string', 
          description: 'Destination airport IATA code (e.g., "LHR", "CDG", "NRT")' 
        },
        departure_date: { 
          type: 'string', 
          description: 'Departure date in YYYY-MM-DD format' 
        },
        return_date: { 
          type: 'string', 
          description: 'Return date in YYYY-MM-DD format (optional for one-way)' 
        },
        adults: { 
          type: 'number', 
          minimum: 1, 
          maximum: 9,
          description: 'Number of adult passengers (default: 1)' 
        },
        cabin_class: { 
          type: 'string', 
          enum: ['economy', 'premium_economy', 'business', 'first'],
          description: 'Cabin class preference (default: economy)' 
        },
        non_stop: { 
          type: 'boolean', 
          description: 'Only show non-stop flights (default: false)' 
        },
        max_price: { 
          type: 'number', 
          description: 'Maximum price per person in USD' 
        },
        currency: { 
          type: 'string', 
          description: 'Currency for prices (default: USD)' 
        },
      },
      required: ['origin', 'destination', 'departure_date'],
    },
  },

  // ============================================
  // HOTEL SEARCH TOOLS
  // ============================================
  {
    name: 'search_hotels',
    description: 'Search for hotels in a city. Returns hotel offers with prices, ratings, and amenities.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { 
          type: 'string', 
          description: 'City name or IATA city code (e.g., "Paris", "NYC", "London")' 
        },
        check_in_date: { 
          type: 'string', 
          description: 'Check-in date in YYYY-MM-DD format' 
        },
        check_out_date: { 
          type: 'string', 
          description: 'Check-out date in YYYY-MM-DD format' 
        },
        adults: { 
          type: 'number', 
          minimum: 1,
          description: 'Number of adult guests (default: 1)' 
        },
        rooms: { 
          type: 'number', 
          minimum: 1,
          description: 'Number of rooms needed (default: 1)' 
        },
        star_rating: { 
          type: 'array', 
          items: { type: 'number' },
          description: 'Filter by star ratings (e.g., [4, 5] for 4-5 star hotels)' 
        },
        price_max: { 
          type: 'number', 
          description: 'Maximum total price for the stay' 
        },
        currency: { 
          type: 'string', 
          description: 'Currency for prices (default: USD)' 
        },
      },
      required: ['location', 'check_in_date', 'check_out_date'],
    },
  },

  // ============================================
  // CAR RENTAL SEARCH TOOLS
  // ============================================
  {
    name: 'search_car_rentals',
    description: 'Search for rental cars at a location. Returns car options with prices and vehicle details.',
    inputSchema: {
      type: 'object',
      properties: {
        pickup_location: { 
          type: 'string', 
          description: 'Pickup city or airport code (e.g., "LAX", "Miami", "Denver Airport")' 
        },
        dropoff_location: { 
          type: 'string', 
          description: 'Dropoff location (optional, defaults to pickup location)' 
        },
        pickup_date: { 
          type: 'string', 
          description: 'Pickup date in YYYY-MM-DD format' 
        },
        pickup_time: { 
          type: 'string', 
          description: 'Pickup time in HH:MM format (default: 10:00)' 
        },
        dropoff_date: { 
          type: 'string', 
          description: 'Dropoff date in YYYY-MM-DD format' 
        },
        dropoff_time: { 
          type: 'string', 
          description: 'Dropoff time in HH:MM format (default: 10:00)' 
        },
        car_type: { 
          type: 'string', 
          enum: ['economy', 'compact', 'midsize', 'fullsize', 'suv', 'luxury', 'van'],
          description: 'Preferred car type' 
        },
        transmission: { 
          type: 'string', 
          enum: ['automatic', 'manual'],
          description: 'Transmission preference' 
        },
        currency: { 
          type: 'string', 
          description: 'Currency for prices (default: USD)' 
        },
      },
      required: ['pickup_location', 'pickup_date', 'dropoff_date'],
    },
  },

  // ============================================
  // ACTIVITIES & EXPERIENCES TOOLS
  // ============================================
  {
    name: 'search_activities',
    description: 'Search for tours, activities, and things to do in a destination. Returns experiences with ratings, prices, and direct booking links. Aggregates from Viator, GetYourGuide, Klook, Musement and 40+ providers.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { 
          type: 'string', 
          description: 'City or destination name (e.g., "Paris", "Tokyo", "New York", "Barcelona")' 
        },
        radius: { 
          type: 'number', 
          description: 'Search radius in km (default: 20)' 
        },
      },
      required: ['location'],
    },
  },

  // ============================================
  // NATIONAL PARKS TOOLS
  // ============================================
  {
    name: 'search_national_parks',
    description: 'Search for US National Parks by name or location. Returns park info, nearest airport, entrance fees, and activities.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string', 
          description: 'Park name or location to search (e.g., "Yosemite", "Grand Canyon", "Utah")' 
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_park_details',
    description: 'Get detailed information about a specific National Park including things to do, campgrounds, and popular hikes with difficulty ratings.',
    inputSchema: {
      type: 'object',
      properties: {
        park_code: { 
          type: 'string', 
          description: 'Park code (e.g., "yose" for Yosemite, "grca" for Grand Canyon, "zion" for Zion)' 
        },
      },
      required: ['park_code'],
    },
  },
  {
    name: 'get_park_hikes',
    description: 'Get popular hiking trails for a National Park with difficulty ratings, distance, elevation gain, and highlights.',
    inputSchema: {
      type: 'object',
      properties: {
        park_code: { 
          type: 'string', 
          description: 'Park code (e.g., "yose", "grca", "zion", "yell", "romo", "glac", "acad")' 
        },
      },
      required: ['park_code'],
    },
  },
  {
    name: 'plan_park_trip',
    description: 'Plan a budget-friendly trip to a National Park. Returns flights to nearest airport, lodging options, park activities, and popular hikes.',
    inputSchema: {
      type: 'object',
      properties: {
        park_code: { 
          type: 'string', 
          description: 'Park code (e.g., "yose", "grca", "zion")' 
        },
        origin_airport: { 
          type: 'string', 
          description: 'Your departure airport IATA code (e.g., "LAX", "JFK", "ORD")' 
        },
        arrival_date: { 
          type: 'string', 
          description: 'Arrival date in YYYY-MM-DD format' 
        },
        departure_date: { 
          type: 'string', 
          description: 'Departure date in YYYY-MM-DD format' 
        },
        adults: { 
          type: 'number', 
          description: 'Number of adults (default: 1)' 
        },
      },
      required: ['park_code', 'origin_airport', 'arrival_date', 'departure_date'],
    },
  },

  // ============================================
  // UTILITY TOOLS
  // ============================================
  {
    name: 'get_airport_info',
    description: 'Get information about an airport by its IATA code',
    inputSchema: {
      type: 'object',
      properties: {
        iata_code: { 
          type: 'string', 
          description: 'Airport IATA code (e.g., "LAX", "JFK", "LHR")' 
        },
      },
      required: ['iata_code'],
    },
  },
];

export async function executeTool(
  facade: TravelFacade,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  switch (toolName) {
    // ============================================
    // FLIGHT TOOLS
    // ============================================
    case 'search_flights': {
      const results = await facade.searchFlights({
        origin: args.origin,
        destination: args.destination,
        departureDate: args.departure_date,
        returnDate: args.return_date,
        adults: args.adults || 1,
        cabinClass: args.cabin_class,
        nonStop: args.non_stop,
        maxPrice: args.max_price,
        currency: args.currency || 'USD',
      });

      // Format results for better readability
      return {
        summary: `Found ${results.totalResults} flight(s) from ${args.origin} to ${args.destination}`,
        searchTimestamp: results.searchTimestamp,
        providers: results.providers,
        flights: results.results.slice(0, 10).map(flight => ({
          id: flight.id,
          price: facade.formatPrice(flight.price.total, flight.price.currency),
          airline: flight.validatingAirline,
          itineraries: flight.itineraries.map(itin => ({
            duration: facade.formatDuration(itin.duration),
            segments: itin.segments.map(seg => ({
              flight: seg.flightNumber,
              departure: `${seg.departure.iataCode} at ${seg.departure.at}`,
              arrival: `${seg.arrival.iataCode} at ${seg.arrival.at}`,
              duration: facade.formatDuration(seg.duration),
              stops: seg.numberOfStops,
            })),
          })),
        })),
      };
    }

    // ============================================
    // HOTEL TOOLS
    // ============================================
    case 'search_hotels': {
      const results = await facade.searchHotels({
        location: args.location,
        checkInDate: args.check_in_date,
        checkOutDate: args.check_out_date,
        adults: args.adults || 1,
        rooms: args.rooms || 1,
        starRating: args.star_rating,
        priceMax: args.price_max,
        currency: args.currency || 'USD',
      });

      return {
        summary: `Found ${results.totalResults} hotel(s) in ${args.location}`,
        searchTimestamp: results.searchTimestamp,
        providers: results.providers,
        hotels: results.results.slice(0, 10).map(hotel => ({
          id: hotel.id,
          name: hotel.name,
          stars: hotel.starRating ? `${hotel.starRating}⭐` : 'N/A',
          location: `${hotel.address.city}, ${hotel.address.country}`,
          pricePerNight: facade.formatPrice(hotel.price.perNight, hotel.price.currency),
          totalPrice: facade.formatPrice(hotel.price.total, hotel.price.currency),
          roomType: hotel.roomType || 'Standard Room',
          amenities: hotel.amenities.slice(0, 5),
          rating: hotel.rating ? `${hotel.rating.score}/5 (${hotel.rating.reviewCount} reviews)` : 'No reviews',
        })),
      };
    }

    // ============================================
    // CAR RENTAL TOOLS
    // ============================================
    case 'search_car_rentals': {
      const results = await facade.searchCarRentals({
        pickupLocation: args.pickup_location,
        dropoffLocation: args.dropoff_location,
        pickupDate: args.pickup_date,
        pickupTime: args.pickup_time,
        dropoffDate: args.dropoff_date,
        dropoffTime: args.dropoff_time,
        carType: args.car_type,
        transmission: args.transmission,
        currency: args.currency || 'USD',
      });

      return {
        summary: `Found ${results.totalResults} car rental(s) at ${args.pickup_location}`,
        searchTimestamp: results.searchTimestamp,
        providers: results.providers,
        cars: results.results.slice(0, 10).map(car => ({
          id: car.id,
          vendor: car.vendor,
          vehicle: `${car.vehicle.category} (${car.vehicle.transmission})`,
          seats: car.vehicle.seats,
          pricePerDay: facade.formatPrice(car.price.perDay, car.price.currency),
          totalPrice: facade.formatPrice(car.price.total, car.price.currency),
          pickup: car.pickup.location,
          dropoff: car.dropoff.location,
          mileage: car.mileage?.unlimited ? 'Unlimited' : `${car.mileage?.included || 0} miles included`,
          features: [
            car.vehicle.airConditioning ? 'A/C' : null,
            car.vehicle.transmission,
          ].filter(Boolean),
        })),
      };
    }

    // ============================================
    // ACTIVITIES TOOLS
    // ============================================
    case 'search_activities': {
      const results = await facade.searchActivities({
        location: args.location,
        radius: args.radius,
      });

      return {
        summary: `Found ${results.totalResults} activity(ies) in ${args.location}`,
        searchTimestamp: results.searchTimestamp,
        providers: results.providers,
        note: 'Click booking links to book directly with the provider',
        activities: results.results.slice(0, 15).map(activity => ({
          id: activity.id,
          name: activity.name,
          description: activity.shortDescription,
          rating: activity.rating ? `${activity.rating}/5` : 'No rating',
          price: facade.formatPrice(activity.price.amount, activity.price.currency),
          bookingLink: activity.bookingLink,
          picture: activity.pictures[0] || null,
        })),
      };
    }

    // ============================================
    // NATIONAL PARKS TOOLS
    // ============================================
    case 'search_national_parks': {
      const parks = await facade.searchNationalParks(args.query);
      return {
        summary: `Found ${parks.length} park(s) matching "${args.query}"`,
        parks: parks.map(park => ({
          name: park.name,
          parkCode: park.parkCode,
          states: park.states.join(', '),
          description: park.description.substring(0, 200) + '...',
          nearestAirport: `${park.nearestAirport.code} - ${park.nearestAirport.name} (${park.nearestAirport.distance})`,
          entranceFee: park.entranceFee,
          activities: park.activities.slice(0, 10),
          url: park.url,
        })),
      };
    }

    case 'get_park_details': {
      const details = await facade.getParkDetails(args.park_code);
      if (!details) {
        return {
          error: `Park not found: ${args.park_code}`,
          suggestion: 'Try codes like: yose (Yosemite), grca (Grand Canyon), zion (Zion), yell (Yellowstone)',
        };
      }
      return details;
    }

    case 'get_park_hikes': {
      const hikes = facade.getParkHikes(args.park_code);
      if (hikes.length === 0) {
        return {
          message: `No hiking data available for park code: ${args.park_code}`,
          availableParks: 'yose, grca, zion, yell, romo, glac, acad',
        };
      }
      return {
        parkCode: args.park_code,
        totalHikes: hikes.length,
        hikes: hikes.map(hike => ({
          name: hike.name,
          difficulty: hike.difficulty,
          distance: hike.distance,
          elevationGain: hike.elevationGain,
          duration: hike.duration,
          description: hike.description,
          highlights: hike.highlights,
        })),
      };
    }

    case 'plan_park_trip': {
      const tripPlan = await facade.planParkTrip({
        parkCode: args.park_code,
        originAirport: args.origin_airport,
        arrivalDate: args.arrival_date,
        departureDate: args.departure_date,
        adults: args.adults || 1,
      });
      return tripPlan;
    }

    // ============================================
    // UTILITY TOOLS
    // ============================================
    case 'get_airport_info': {
      const airport = facade.getAirportInfo(args.iata_code);
      if (!airport) {
        return {
          error: `Airport not found: ${args.iata_code}`,
          suggestion: 'Try common codes like LAX, JFK, LHR, CDG, NRT, SYD',
        };
      }
      return airport;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
