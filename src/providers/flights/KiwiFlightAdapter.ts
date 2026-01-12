import { BaseAdapter } from '../base/BaseAdapter.js';
import {
  FlightProvider,
  FlightSearchParams,
  FlightOffer,
  FlightItinerary,
  FlightSegment,
} from '../../domain/types/index.js';

interface KiwiSearchResponse {
  data: KiwiFlightOffer[];
  currency: string;
}

interface KiwiFlightOffer {
  id: string;
  price: number;
  deep_link: string;
  airlines: string[];
  route: KiwiRoute[];
  duration: {
    departure: number;
    return: number;
    total: number;
  };
  fly_duration: string;
  return_duration?: string;
  cityFrom: string;
  cityTo: string;
  flyFrom: string;
  flyTo: string;
  local_departure: string;
  local_arrival: string;
}

interface KiwiRoute {
  id: string;
  flyFrom: string;
  flyTo: string;
  cityFrom: string;
  cityTo: string;
  local_departure: string;
  local_arrival: string;
  airline: string;
  flight_no: number;
  operating_carrier: string;
  operating_flight_no: string;
  return: number; // 0 = outbound, 1 = return
}

export class KiwiFlightAdapter extends BaseAdapter implements FlightProvider {
  name = 'kiwi';
  private apiKey: string;
  private baseUrl = 'https://api.tequila.kiwi.com';

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.KIWI_API_KEY || '';
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    if (!this.apiKey) {
      console.error('Kiwi API key not configured. Skipping Kiwi search.');
      return [];
    }

    const cacheKey = this.generateCacheKey('kiwi-flights', params);

    return this.fetchWithCache(cacheKey, async () => {
      const queryParams = new URLSearchParams({
        fly_from: params.origin,
        fly_to: params.destination,
        date_from: this.formatDate(params.departureDate),
        date_to: this.formatDate(params.departureDate),
        adults: params.adults.toString(),
        curr: params.currency || 'USD',
        limit: '10',
        sort: 'price',
        vehicle_type: 'aircraft',
      });

      if (params.returnDate) {
        queryParams.append('return_from', this.formatDate(params.returnDate));
        queryParams.append('return_to', this.formatDate(params.returnDate));
        queryParams.append('flight_type', 'round');
      } else {
        queryParams.append('flight_type', 'oneway');
      }

      if (params.children) {
        queryParams.append('children', params.children.toString());
      }
      if (params.infants) {
        queryParams.append('infants', params.infants.toString());
      }
      if (params.cabinClass) {
        const cabinMap: Record<string, string> = {
          economy: 'M',
          premium_economy: 'W',
          business: 'C',
          first: 'F',
        };
        queryParams.append('selected_cabins', cabinMap[params.cabinClass] || 'M');
      }
      if (params.nonStop) {
        queryParams.append('max_stopovers', '0');
      }
      if (params.maxPrice) {
        queryParams.append('price_to', params.maxPrice.toString());
      }

      const response = await fetch(
        `${this.baseUrl}/v2/search?${queryParams}`,
        {
          headers: {
            'apikey': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kiwi flight search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as KiwiSearchResponse;
      return this.transformFlightOffers(data);
    });
  }

  private formatDate(isoDate: string): string {
    // Convert YYYY-MM-DD to DD/MM/YYYY for Kiwi API
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  private formatDuration(seconds: number): string {
    // Convert seconds to ISO 8601 duration format
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `PT${hours}H${minutes}M`;
  }

  private transformFlightOffers(response: KiwiSearchResponse): FlightOffer[] {
    if (!response.data || response.data.length === 0) {
      return [];
    }

    return response.data.map((offer): FlightOffer => {
      // Separate outbound and return routes
      const outboundRoutes = offer.route.filter(r => r.return === 0);
      const returnRoutes = offer.route.filter(r => r.return === 1);

      const itineraries: FlightItinerary[] = [];

      // Outbound itinerary
      if (outboundRoutes.length > 0) {
        itineraries.push({
          duration: this.formatDuration(offer.duration.departure),
          segments: outboundRoutes.map((route): FlightSegment => ({
            departure: {
              iataCode: route.flyFrom,
              at: route.local_departure,
            },
            arrival: {
              iataCode: route.flyTo,
              at: route.local_arrival,
            },
            carrierCode: route.airline,
            carrierName: route.airline,
            flightNumber: `${route.airline}${route.flight_no}`,
            duration: 'PT0H', // Kiwi doesn't provide per-segment duration
            numberOfStops: 0,
          })),
        });
      }

      // Return itinerary (if round trip)
      if (returnRoutes.length > 0) {
        itineraries.push({
          duration: this.formatDuration(offer.duration.return),
          segments: returnRoutes.map((route): FlightSegment => ({
            departure: {
              iataCode: route.flyFrom,
              at: route.local_departure,
            },
            arrival: {
              iataCode: route.flyTo,
              at: route.local_arrival,
            },
            carrierCode: route.airline,
            carrierName: route.airline,
            flightNumber: `${route.airline}${route.flight_no}`,
            duration: 'PT0H',
            numberOfStops: 0,
          })),
        });
      }

      return {
        id: `kiwi-${offer.id}`,
        provider: this.name,
        price: {
          total: offer.price,
          currency: response.currency,
        },
        validatingAirline: offer.airlines[0] || 'Multiple',
        itineraries,
        bookingUrl: offer.deep_link,
      };
    });
  }
}
