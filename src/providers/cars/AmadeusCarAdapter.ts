import { BaseAdapter } from '../base/BaseAdapter.js';
import {
  CarRentalProvider,
  CarRentalSearchParams,
  CarRentalOffer,
} from '../../domain/types/index.js';

// Note: Amadeus Car & Transfer APIs are enterprise-only
// This adapter uses a mock implementation for development
// For production, consider: Skyscanner Car Hire API, CarTrawler, or direct vendor APIs

export class AmadeusCarAdapter extends BaseAdapter implements CarRentalProvider {
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

  async searchCarRentals(params: CarRentalSearchParams): Promise<CarRentalOffer[]> {
    const cacheKey = this.generateCacheKey('amadeus-cars', params);

    return this.fetchWithCache(cacheKey, async () => {
      // Note: Amadeus Car API is enterprise-only
      // For self-service, we'll return a helpful message
      // In production, integrate with Skyscanner Car Hire or direct vendor APIs
      
      console.error('Note: Amadeus Car API requires enterprise access. Using placeholder data.');
      
      // Return sample data for development/testing
      return this.getMockCarOffers(params);
    });
  }

  private getMockCarOffers(params: CarRentalSearchParams): CarRentalOffer[] {
    const days = this.calculateDays(params.pickupDate, params.dropoffDate);
    
    const mockVendors = [
      { name: 'Hertz', category: 'Economy', perDay: 35, seats: 5 },
      { name: 'Enterprise', category: 'Compact', perDay: 40, seats: 5 },
      { name: 'Avis', category: 'Midsize SUV', perDay: 65, seats: 5 },
      { name: 'Budget', category: 'Full-size', perDay: 55, seats: 5 },
      { name: 'National', category: 'Luxury', perDay: 120, seats: 5 },
    ];

    return mockVendors.map((vendor, index): CarRentalOffer => ({
      id: `mock-car-${index}`,
      provider: 'mock',
      vendor: vendor.name,
      vehicle: {
        category: vendor.category,
        transmission: 'Automatic',
        seats: vendor.seats,
        airConditioning: true,
      },
      pickup: {
        location: params.pickupLocation,
        dateTime: `${params.pickupDate}T${params.pickupTime || '10:00'}:00`,
      },
      dropoff: {
        location: params.dropoffLocation || params.pickupLocation,
        dateTime: `${params.dropoffDate}T${params.dropoffTime || '10:00'}:00`,
      },
      price: {
        total: vendor.perDay * days,
        perDay: vendor.perDay,
        currency: params.currency || 'USD',
      },
      mileage: { unlimited: true },
      insurance: { included: false, options: ['CDW', 'LDW', 'PAI'] },
      bookingUrl: `https://www.${vendor.name.toLowerCase()}.com`,
    }));
  }

  private calculateDays(pickup: string, dropoff: string): number {
    const start = new Date(pickup);
    const end = new Date(dropoff);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  }
}
