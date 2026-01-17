/**
 * Yelp Fusion API Adapter
 * Provides rich restaurant data including reviews, photos, and reservation support
 */

export interface YelpRestaurant {
  id: string;
  name: string;
  imageUrl?: string;
  url: string;
  reviewCount: number;
  rating: number;
  price?: string; // $, $$, $$$, $$$$
  phone?: string;
  displayPhone?: string;
  distance?: number; // meters
  location: {
    address1: string;
    city: string;
    state: string;
    zipCode: string;
    displayAddress: string[];
  };
  categories: Array<{
    alias: string;
    title: string;
  }>;
  transactions: string[]; // 'pickup', 'delivery', 'restaurant_reservation'
  isClosed: boolean;
  hours?: Array<{
    isOpenNow: boolean;
  }>;
}

export interface YelpSearchResponse {
  businesses: YelpRestaurant[];
  total: number;
  status: 'OK' | 'ERROR' | 'NO_API_KEY';
}

export interface YelpReview {
  id: string;
  rating: number;
  text: string;
  timeCreated: string;
  user: {
    name: string;
    imageUrl?: string;
  };
}

export class YelpAdapter {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.yelp.com/v3';

  constructor() {
    this.apiKey = process.env.YELP_API_KEY;
  }

  async searchRestaurants(
    location: string,
    options?: {
      term?: string; // cuisine type or search term
      categories?: string; // e.g., 'mexican,italian'
      price?: string; // '1', '2', '3', '4' or '1,2' for multiple
      radius?: number; // meters, max 40000
      sortBy?: 'best_match' | 'rating' | 'review_count' | 'distance';
      limit?: number;
      openNow?: boolean;
    }
  ): Promise<YelpSearchResponse> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return { businesses: [], total: 0, status: 'NO_API_KEY' };
    }

    try {
      const params = new URLSearchParams({
        location,
        categories: options?.categories || 'restaurants,food',
        limit: String(options?.limit || 10),
        sort_by: options?.sortBy || 'best_match',
      });

      if (options?.term) params.append('term', options.term);
      if (options?.price) params.append('price', options.price);
      if (options?.radius) params.append('radius', String(Math.min(options.radius, 40000)));
      if (options?.openNow) params.append('open_now', 'true');

      const url = `${this.baseUrl}/businesses/search?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Yelp] API error:', errorData);
        return { businesses: [], total: 0, status: 'ERROR' };
      }

      const data: any = await response.json();

      return {
        businesses: data.businesses.map((b: any) => ({
          id: b.id,
          name: b.name,
          imageUrl: b.image_url,
          url: b.url,
          reviewCount: b.review_count,
          rating: b.rating,
          price: b.price,
          phone: b.phone,
          displayPhone: b.display_phone,
          distance: b.distance,
          location: {
            address1: b.location.address1,
            city: b.location.city,
            state: b.location.state,
            zipCode: b.location.zip_code,
            displayAddress: b.location.display_address,
          },
          categories: b.categories,
          transactions: b.transactions || [],
          isClosed: b.is_closed,
        })),
        total: data.total,
        status: 'OK',
      };
    } catch (error) {
      console.error('[Yelp] Request failed:', error);
      return { businesses: [], total: 0, status: 'ERROR' };
    }
  }

  async getBusinessDetails(businessId: string): Promise<YelpRestaurant | null> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return null;
    }

    try {
      const url = `${this.baseUrl}/businesses/${businessId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[Yelp] Failed to get business details');
        return null;
      }

      const b: any = await response.json();

      return {
        id: b.id,
        name: b.name,
        imageUrl: b.image_url,
        url: b.url,
        reviewCount: b.review_count,
        rating: b.rating,
        price: b.price,
        phone: b.phone,
        displayPhone: b.display_phone,
        location: {
          address1: b.location.address1,
          city: b.location.city,
          state: b.location.state,
          zipCode: b.location.zip_code,
          displayAddress: b.location.display_address,
        },
        categories: b.categories,
        transactions: b.transactions || [],
        isClosed: b.is_closed,
        hours: b.hours,
      };
    } catch (error) {
      console.error('[Yelp] Request failed:', error);
      return null;
    }
  }

  async getReviews(businessId: string, limit: number = 3): Promise<YelpReview[]> {
    if (!this.apiKey) {
      console.warn('[Yelp] API key not configured');
      return [];
    }

    try {
      const url = `${this.baseUrl}/businesses/${businessId}/reviews?limit=${limit}&sort_by=yelp_sort`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('[Yelp] Failed to get reviews');
        return [];
      }

      const data: any = await response.json();

      return data.reviews.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        text: r.text,
        timeCreated: r.time_created,
        user: {
          name: r.user.name,
          imageUrl: r.user.image_url,
        },
      }));
    } catch (error) {
      console.error('[Yelp] Request failed:', error);
      return [];
    }
  }

  // Generate reservation link based on available platforms
  static generateReservationLink(restaurant: YelpRestaurant, date?: string, time?: string, partySize: number = 2): string | null {
    const hasReservation = restaurant.transactions.includes('restaurant_reservation');
    const encodedName = encodeURIComponent(restaurant.name);
    const encodedLocation = encodeURIComponent(`${restaurant.location.city}, ${restaurant.location.state}`);
    
    // Build date/time string for OpenTable
    let dateTimeParam = '';
    if (date && time) {
      dateTimeParam = `&dateTime=${date}T${time}`;
    } else if (date) {
      dateTimeParam = `&dateTime=${date}T19:00`;
    }

    // Try OpenTable first (most common)
    const openTableLink = `https://www.opentable.com/s?term=${encodedName}&queryUnderstandingType=location&locationQuery=${encodedLocation}&covers=${partySize}${dateTimeParam}`;
    
    // If Yelp indicates reservation support, also provide Yelp link
    if (hasReservation) {
      // Yelp reservation link goes directly to the business page
      return restaurant.url; // Yelp page has reservation button if supported
    }

    return openTableLink;
  }

  // Generate compact reservation links for multiple platforms
  static generateReservationLinks(
    restaurantName: string,
    city: string,
    state: string,
    date?: string,
    time?: string,
    partySize: number = 2
  ): ReservationLinks {
    // Include location IN the search term to prevent OpenTable from using browser geolocation
    const searchTermWithLocation = `${restaurantName} ${city} ${state}`;
    const encodedSearchTerm = encodeURIComponent(searchTermWithLocation);
    const encodedLocation = encodeURIComponent(`${city}, ${state}`);
    const dateTimeStr = date ? (time ? `${date}T${time}` : `${date}T19:00`) : '';
    
    // Use search term that includes location - OpenTable ignores locationQuery and uses geolocation
    const openTableUrl = dateTimeStr 
      ? `https://www.opentable.com/s?term=${encodedSearchTerm}&covers=${partySize}&dateTime=${dateTimeStr}`
      : `https://www.opentable.com/s?term=${encodedSearchTerm}&covers=${partySize}`;
    
    console.log('[OpenTable] Generating reservation link:', {
      restaurantName,
      city,
      state,
      date,
      time,
      partySize,
      searchTermWithLocation,
      encodedSearchTerm,
      dateTimeStr,
      url: openTableUrl,
    });
    
    const encodedName = encodeURIComponent(restaurantName);
    return {
      openTable: openTableUrl,
      resy: `https://resy.com/cities/${encodeURIComponent(city.toLowerCase())}?query=${encodedName}`,
      yelp: `https://www.yelp.com/search?find_desc=${encodedName}&find_loc=${encodedLocation}`,
      google: `https://www.google.com/search?q=${encodedName}+${encodedLocation}+reservations`,
    };
  }

  // Format price level for display
  static formatCategories(categories: Array<{ alias: string; title: string }>): string {
    return categories.map(c => c.title).slice(0, 3).join(', ');
  }
}

// Reservation link types
export interface ReservationLinks {
  openTable: string;
  resy: string;
  yelp: string;
  google: string;
}

export default YelpAdapter;
