import { BaseAdapter } from '../base/BaseAdapter.js';
import {
  HotelProvider,
  HotelSearchParams,
  HotelOffer,
} from '../../domain/types/index.js';

interface AmadeusHotelListResponse {
  data: AmadeusHotel[];
}

interface AmadeusHotel {
  hotelId: string;
  name: string;
  address?: {
    lines?: string[];
    cityName?: string;
    countryCode?: string;
    postalCode?: string;
  };
  geoCode?: {
    latitude: number;
    longitude: number;
  };
  rating?: string;
  amenities?: string[];
}

interface AmadeusHotelOfferResponse {
  data: AmadeusHotelOfferData[];
}

interface AmadeusHotelOfferData {
  type: string;
  hotel: {
    hotelId: string;
    name: string;
    cityCode: string;
    address?: {
      lines?: string[];
      cityName?: string;
      countryCode?: string;
    };
    latitude?: number;
    longitude?: number;
    rating?: string;
    amenities?: string[];
    media?: { uri: string }[];
  };
  available: boolean;
  offers: {
    id: string;
    price: {
      total: string;
      currency: string;
    };
    room?: {
      type?: string;
      description?: { text?: string };
    };
  }[];
}

export class AmadeusHotelAdapter extends BaseAdapter implements HotelProvider {
  name = 'amadeus';
  private clientId: string;
  private clientSecret: string;
  private baseUrl = 'https://test.api.amadeus.com';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId?: string, clientSecret?: string) {
    super();
    this.clientId = clientId || process.env.AMADEUS_CLIENT_ID || '';
    this.clientSecret = clientSecret || process.env.AMADEUS_CLIENT_SECRET || '';
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Amadeus credentials not configured.');
    }

    const response = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Amadeus auth failed: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.accessToken!;
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelOffer[]> {
    const cacheKey = this.generateCacheKey('amadeus-hotels', params);

    return this.fetchWithCache(cacheKey, async () => {
      const token = await this.getAccessToken();

      // Step 1: Get city code
      const cityCode = await this.getCityCode(params.location, token);
      
      // Step 2: Get hotel IDs in the city
      const hotelIds = await this.getHotelIdsByCity(cityCode, token, params.starRating);
      
      if (hotelIds.length === 0) {
        return [];
      }

      // Step 3: Get offers for those hotels (limit to 20 hotels per request)
      const limitedHotelIds = hotelIds.slice(0, 20);
      
      const queryParams = new URLSearchParams({
        hotelIds: limitedHotelIds.join(','),
        checkInDate: params.checkInDate,
        checkOutDate: params.checkOutDate,
        adults: params.adults.toString(),
        roomQuantity: (params.rooms || 1).toString(),
        currency: params.currency || 'USD',
        bestRateOnly: 'true',
      });

      const response = await fetch(
        `${this.baseUrl}/v3/shopping/hotel-offers?${queryParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Amadeus hotel search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as AmadeusHotelOfferResponse;
      return this.transformHotelOffers(data, params);
    });
  }

  private async getHotelIdsByCity(
    cityCode: string, 
    token: string, 
    starRating?: number[]
  ): Promise<string[]> {
    const queryParams = new URLSearchParams({
      cityCode,
    });

    if (starRating && starRating.length > 0) {
      queryParams.append('ratings', starRating.join(','));
    }

    const response = await fetch(
      `${this.baseUrl}/v1/reference-data/locations/hotels/by-city?${queryParams}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hotel list failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as AmadeusHotelListResponse;
    return data.data?.map(hotel => hotel.hotelId) || [];
  }

  private async getCityCode(location: string, token: string): Promise<string> {
    // If already an IATA code (3 letters), return as-is
    if (/^[A-Z]{3}$/i.test(location)) {
      return location.toUpperCase();
    }

    // Otherwise, search for the city
    const response = await fetch(
      `${this.baseUrl}/v1/reference-data/locations?subType=CITY&keyword=${encodeURIComponent(location)}&page[limit]=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error(`City lookup failed for: ${location}`);
    }

    const data = await response.json() as { data: { iataCode: string }[] };
    if (!data.data || data.data.length === 0) {
      throw new Error(`City not found: ${location}`);
    }

    return data.data[0].iataCode;
  }

  private transformHotelOffers(
    response: AmadeusHotelOfferResponse,
    params: HotelSearchParams
  ): HotelOffer[] {
    const nights = this.calculateNights(params.checkInDate, params.checkOutDate);

    return response.data
      .filter(item => item.available && item.offers.length > 0)
      .map((item): HotelOffer => {
        const hotel = item.hotel;
        const offer = item.offers[0];
        const totalPrice = parseFloat(offer.price.total);

        return {
          id: `amadeus-${hotel.hotelId}-${offer.id}`,
          provider: this.name,
          name: hotel.name,
          address: {
            street: hotel.address?.lines?.join(', '),
            city: hotel.address?.cityName || params.location,
            country: hotel.address?.countryCode || '',
          },
          coordinates: hotel.latitude && hotel.longitude
            ? { latitude: hotel.latitude, longitude: hotel.longitude }
            : undefined,
          starRating: hotel.rating ? parseInt(hotel.rating) : undefined,
          amenities: hotel.amenities || [],
          images: hotel.media?.map(m => m.uri) || [],
          price: {
            total: totalPrice,
            perNight: totalPrice / nights,
            currency: offer.price.currency,
          },
          roomType: offer.room?.type || offer.room?.description?.text,
        };
      });
  }

  private calculateNights(checkIn: string, checkOut: string): number {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  }
}
