import { BaseAdapter } from '../base/BaseAdapter.js';
import {
  ActivityProvider,
  ActivitySearchParams,
  ActivitySearchByLocationParams,
  ActivityOffer,
} from '../../domain/types/index.js';

interface AmadeusActivityResponse {
  data: AmadeusActivity[];
}

interface AmadeusActivity {
  id: string;
  type: string;
  name: string;
  shortDescription?: string;
  description?: string;
  geoCode: {
    latitude: string;
    longitude: string;
  };
  rating?: string;
  pictures?: string[];
  bookingLink: string;
  price: {
    currencyCode: string;
    amount: string;
  };
  category?: string;
  duration?: string;
}

interface AmadeusCityResponse {
  data: {
    iataCode: string;
    name: string;
    geoCode: {
      latitude: number;
      longitude: number;
    };
  }[];
}

// City coordinates for common destinations (fallback)
const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  'paris': { latitude: 48.8566, longitude: 2.3522 },
  'london': { latitude: 51.5074, longitude: -0.1278 },
  'new york': { latitude: 40.7128, longitude: -74.0060 },
  'nyc': { latitude: 40.7128, longitude: -74.0060 },
  'los angeles': { latitude: 34.0522, longitude: -118.2437 },
  'tokyo': { latitude: 35.6762, longitude: 139.6503 },
  'rome': { latitude: 41.9028, longitude: 12.4964 },
  'barcelona': { latitude: 41.3874, longitude: 2.1686 },
  'amsterdam': { latitude: 52.3676, longitude: 4.9041 },
  'berlin': { latitude: 52.5200, longitude: 13.4050 },
  'madrid': { latitude: 40.4168, longitude: -3.7038 },
  'dubai': { latitude: 25.2048, longitude: 55.2708 },
  'singapore': { latitude: 1.3521, longitude: 103.8198 },
  'hong kong': { latitude: 22.3193, longitude: 114.1694 },
  'sydney': { latitude: -33.8688, longitude: 151.2093 },
  'san francisco': { latitude: 37.7749, longitude: -122.4194 },
  'miami': { latitude: 25.7617, longitude: -80.1918 },
  'chicago': { latitude: 41.8781, longitude: -87.6298 },
  'las vegas': { latitude: 36.1699, longitude: -115.1398 },
  'orlando': { latitude: 28.5383, longitude: -81.3792 },
  'denver': { latitude: 39.7392, longitude: -104.9903 },
  'seattle': { latitude: 47.6062, longitude: -122.3321 },
  'boston': { latitude: 42.3601, longitude: -71.0589 },
  'atlanta': { latitude: 33.7490, longitude: -84.3880 },
  'nashville': { latitude: 36.1627, longitude: -86.7816 },
  'austin': { latitude: 30.2672, longitude: -97.7431 },
  'cancun': { latitude: 21.1619, longitude: -86.8515 },
  'mexico city': { latitude: 19.4326, longitude: -99.1332 },
  'lisbon': { latitude: 38.7223, longitude: -9.1393 },
  'prague': { latitude: 50.0755, longitude: 14.4378 },
  'vienna': { latitude: 48.2082, longitude: 16.3738 },
  'florence': { latitude: 43.7696, longitude: 11.2558 },
  'venice': { latitude: 45.4408, longitude: 12.3155 },
  'athens': { latitude: 37.9838, longitude: 23.7275 },
  'istanbul': { latitude: 41.0082, longitude: 28.9784 },
  'bangkok': { latitude: 13.7563, longitude: 100.5018 },
  'bali': { latitude: -8.3405, longitude: 115.0920 },
  'phuket': { latitude: 7.8804, longitude: 98.3923 },
  'hawaii': { latitude: 21.3069, longitude: -157.8583 },
  'honolulu': { latitude: 21.3069, longitude: -157.8583 },
};

export class AmadeusActivitiesAdapter extends BaseAdapter implements ActivityProvider {
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

  async searchActivities(params: ActivitySearchParams): Promise<ActivityOffer[]> {
    const cacheKey = this.generateCacheKey('amadeus-activities', params);

    return this.fetchWithCache(cacheKey, async () => {
      const token = await this.getAccessToken();

      const queryParams = new URLSearchParams({
        latitude: params.latitude.toString(),
        longitude: params.longitude.toString(),
      });

      if (params.radius) {
        queryParams.append('radius', params.radius.toString());
      }

      const response = await fetch(
        `${this.baseUrl}/v1/shopping/activities?${queryParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Activities search failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as AmadeusActivityResponse;
      return this.transformActivities(data);
    });
  }

  async searchActivitiesByLocation(params: ActivitySearchByLocationParams): Promise<ActivityOffer[]> {
    const coords = await this.getCoordinatesForLocation(params.location);
    
    return this.searchActivities({
      latitude: coords.latitude,
      longitude: coords.longitude,
      radius: params.radius || 20, // Default 20km radius for city searches
    });
  }

  private async getCoordinatesForLocation(location: string): Promise<{ latitude: number; longitude: number }> {
    // Check local cache first
    const normalizedLocation = location.toLowerCase().trim();
    if (CITY_COORDINATES[normalizedLocation]) {
      return CITY_COORDINATES[normalizedLocation];
    }

    // Try Amadeus city search
    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `${this.baseUrl}/v1/reference-data/locations/cities?keyword=${encodeURIComponent(location)}&max=1`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json() as AmadeusCityResponse;
        if (data.data && data.data.length > 0) {
          return {
            latitude: data.data[0].geoCode.latitude,
            longitude: data.data[0].geoCode.longitude,
          };
        }
      }
    } catch (error) {
      console.error('City geocode failed, using fallback:', error);
    }

    // Fallback to common cities
    for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
      if (normalizedLocation.includes(city) || city.includes(normalizedLocation)) {
        return coords;
      }
    }

    throw new Error(`Could not find coordinates for location: ${location}. Try a major city like "Paris", "New York", or "Tokyo".`);
  }

  private transformActivities(response: AmadeusActivityResponse): ActivityOffer[] {
    if (!response.data) return [];

    // Filter to only include activities with price and booking link
    return response.data
      .filter(activity => activity.price && activity.bookingLink)
      .map((activity): ActivityOffer => ({
        id: `amadeus-activity-${activity.id}`,
        provider: this.name,
        name: activity.name,
        shortDescription: activity.shortDescription || activity.description || '',
        coordinates: {
          latitude: parseFloat(activity.geoCode.latitude),
          longitude: parseFloat(activity.geoCode.longitude),
        },
        rating: activity.rating ? parseFloat(activity.rating) : undefined,
        pictures: activity.pictures || [],
        price: {
          amount: parseFloat(activity.price.amount) || 0,
          currency: activity.price.currencyCode || 'EUR',
        },
        bookingLink: activity.bookingLink,
        category: activity.category,
        duration: activity.duration,
      }));
  }
}
