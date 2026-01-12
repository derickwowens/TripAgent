import { BaseAdapter } from '../base/BaseAdapter.js';
import {
  FlightProvider,
  FlightSearchParams,
  FlightOffer,
  FlightItinerary,
  FlightSegment,
} from '../../domain/types/index.js';

interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AmadeusFlightResponse {
  data: AmadeusFlightOffer[];
  dictionaries?: {
    carriers?: Record<string, string>;
    aircraft?: Record<string, string>;
  };
}

interface AmadeusFlightOffer {
  id: string;
  source: string;
  price: {
    total: string;
    currency: string;
  };
  validatingAirlineCodes: string[];
  itineraries: AmadeusItinerary[];
}

interface AmadeusItinerary {
  duration: string;
  segments: AmadeusSegment[];
}

interface AmadeusSegment {
  departure: { iataCode: string; terminal?: string; at: string };
  arrival: { iataCode: string; terminal?: string; at: string };
  carrierCode: string;
  number: string;
  aircraft?: { code: string };
  duration: string;
  numberOfStops: number;
}

export class AmadeusFlightAdapter extends BaseAdapter implements FlightProvider {
  name = 'amadeus';
  private clientId: string;
  private clientSecret: string;
  private baseUrl = 'https://test.api.amadeus.com'; // Use production URL for live
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId?: string, clientSecret?: string) {
    super();
    this.clientId = clientId || process.env.AMADEUS_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.AMADEUS_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Amadeus credentials not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET.');
    }

    const response = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Amadeus auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as AmadeusTokenResponse;
    this.accessToken = data.access_token;
    // Set expiry 1 minute before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    return this.accessToken;
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightOffer[]> {
    const cacheKey = this.generateCacheKey('amadeus-flights', params);
    
    return this.fetchWithCache(cacheKey, async () => {
      const token = await this.getAccessToken();

      const queryParams = new URLSearchParams({
        originLocationCode: params.origin,
        destinationLocationCode: params.destination,
        departureDate: params.departureDate,
        adults: params.adults.toString(),
        currencyCode: params.currency || 'USD',
        max: '10',
      });

      if (params.returnDate) {
        queryParams.append('returnDate', params.returnDate);
      }
      if (params.children) {
        queryParams.append('children', params.children.toString());
      }
      if (params.infants) {
        queryParams.append('infants', params.infants.toString());
      }
      if (params.cabinClass) {
        const cabinMap: Record<string, string> = {
          economy: 'ECONOMY',
          premium_economy: 'PREMIUM_ECONOMY',
          business: 'BUSINESS',
          first: 'FIRST',
        };
        queryParams.append('travelClass', cabinMap[params.cabinClass] || 'ECONOMY');
      }
      if (params.nonStop) {
        queryParams.append('nonStop', 'true');
      }
      if (params.maxPrice) {
        queryParams.append('maxPrice', params.maxPrice.toString());
      }

      const response = await fetch(
        `${this.baseUrl}/v2/shopping/flight-offers?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Amadeus flight search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as AmadeusFlightResponse;
      return this.transformFlightOffers(data);
    });
  }

  private transformFlightOffers(response: AmadeusFlightResponse): FlightOffer[] {
    const carriers = response.dictionaries?.carriers || {};
    const aircraft = response.dictionaries?.aircraft || {};

    return response.data.map((offer): FlightOffer => ({
      id: `amadeus-${offer.id}`,
      provider: this.name,
      price: {
        total: parseFloat(offer.price.total),
        currency: offer.price.currency,
      },
      validatingAirline: offer.validatingAirlineCodes[0] || 'Unknown',
      itineraries: offer.itineraries.map((itin): FlightItinerary => ({
        duration: itin.duration,
        segments: itin.segments.map((seg): FlightSegment => ({
          departure: {
            iataCode: seg.departure.iataCode,
            terminal: seg.departure.terminal,
            at: seg.departure.at,
          },
          arrival: {
            iataCode: seg.arrival.iataCode,
            terminal: seg.arrival.terminal,
            at: seg.arrival.at,
          },
          carrierCode: seg.carrierCode,
          carrierName: carriers[seg.carrierCode],
          flightNumber: `${seg.carrierCode}${seg.number}`,
          aircraft: seg.aircraft ? aircraft[seg.aircraft.code] : undefined,
          duration: seg.duration,
          numberOfStops: seg.numberOfStops,
        })),
      })),
    }));
  }
}
