/**
 * TrailAPI Adapter (RapidAPI)
 * 
 * Fetches trail data from TrailAPI on RapidAPI.
 * API Docs: https://rapidapi.com/trailapi/api/trailapi
 */

import { BaseAdapter } from '../base/BaseAdapter.js';

const TRAILAPI_HOST = 'trailapi-trailapi.p.rapidapi.com';
const TRAILAPI_BASE = `https://${TRAILAPI_HOST}`;

interface TrailAPIResponse {
  data: TrailAPITrail[];
}

interface TrailAPITrail {
  id: number;
  name: string;
  url: string;
  length: string;
  description: string;
  directions: string;
  city: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  difficulty: string;
  features: string;
  rating: number;
  thumbnail: string;
  activities: string[];
}

export interface Trail {
  id: string;
  name: string;
  url: string;
  length: string;
  description: string;
  city: string;
  state: string;
  country: string;
  coordinates: { latitude: number; longitude: number };
  difficulty: string;
  features: string[];
  rating: number;
  imageUrl?: string;
  activities: string[];
}

export class TrailAPIAdapter extends BaseAdapter {
  name = 'trailapi';
  private apiKey: string;

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.TRAILAPI_KEY || '';
    this.cacheTTL = 60 * 60 * 1000; // 1 hour cache
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get trails near a location (lat/lon)
   */
  async getTrailsNearLocation(
    lat: number,
    lon: number,
    radius: number = 25,
    limit: number = 25
  ): Promise<Trail[]> {
    if (!this.isConfigured()) {
      console.log('[TrailAPI] API key not configured');
      return [];
    }

    const cacheKey = this.generateCacheKey('trailapi-near', { lat, lon, radius, limit });

    return this.fetchWithCache(cacheKey, async () => {
      console.log(`[TrailAPI] Fetching trails near ${lat},${lon} (radius: ${radius}mi)`);
      
      // Use hiking activity filter for trail-specific results
      const url = `${TRAILAPI_BASE}/trails/explore/?lat=${lat}&lon=${lon}&radius=${radius}&limit=${limit}&q-activities_activity_type_name_eq=hiking`;
      
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': TRAILAPI_HOST,
        },
      });

      if (!response.ok) {
        console.error(`[TrailAPI] API error: ${response.status}`);
        return [];
      }

      const data = await response.json() as TrailAPIResponse;
      console.log(`[TrailAPI] Found ${data.data?.length || 0} trails`);

      return (data.data || []).map(trail => this.mapTrail(trail));
    });
  }

  /**
   * Get trails by state
   */
  async getTrailsByState(state: string, limit: number = 25): Promise<Trail[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const cacheKey = this.generateCacheKey('trailapi-state', { state, limit });

    return this.fetchWithCache(cacheKey, async () => {
      console.log(`[TrailAPI] Fetching trails in state: ${state}`);
      
      const url = `${TRAILAPI_BASE}/trails/explore/?q-state_cont=${encodeURIComponent(state)}&q-activities_activity_type_name_eq=hiking&limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': TRAILAPI_HOST,
        },
      });

      if (!response.ok) {
        console.error(`[TrailAPI] API error: ${response.status}`);
        return [];
      }

      const data = await response.json() as TrailAPIResponse;
      console.log(`[TrailAPI] Found ${data.data?.length || 0} trails in ${state}`);

      return (data.data || []).map(trail => this.mapTrail(trail));
    });
  }

  /**
   * Get trails by city
   */
  async getTrailsByCity(city: string, limit: number = 25): Promise<Trail[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const cacheKey = this.generateCacheKey('trailapi-city', { city, limit });

    return this.fetchWithCache(cacheKey, async () => {
      console.log(`[TrailAPI] Fetching trails in city: ${city}`);
      
      const url = `${TRAILAPI_BASE}/trails/explore/?q-city_cont=${encodeURIComponent(city)}&q-activities_activity_type_name_eq=hiking&limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': TRAILAPI_HOST,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as TrailAPIResponse;
      console.log(`[TrailAPI] Found ${data.data?.length || 0} trails in ${city}`);

      return (data.data || []).map(trail => this.mapTrail(trail));
    });
  }

  /**
   * Search trails by query (searches city/state)
   */
  async searchTrails(query: string, limit: number = 25): Promise<Trail[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const cacheKey = this.generateCacheKey('trailapi-search', { query, limit });

    return this.fetchWithCache(cacheKey, async () => {
      console.log(`[TrailAPI] Searching trails: ${query}`);
      
      // Try city search first
      const url = `${TRAILAPI_BASE}/trails/explore/?q-city_cont=${encodeURIComponent(query)}&q-activities_activity_type_name_eq=hiking&limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': TRAILAPI_HOST,
        },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as TrailAPIResponse;
      return (data.data || []).map(trail => this.mapTrail(trail));
    });
  }

  /**
   * Get trails for a specific park by searching near its coordinates
   */
  async getTrailsForPark(parkName: string, lat: number, lon: number): Promise<Trail[]> {
    console.log(`[TrailAPI] Getting trails for ${parkName} at ${lat},${lon}`);
    
    const trails = await this.getTrailsNearLocation(lat, lon, 15, 30);
    
    // Filter trails that might be in the park
    const parkWords = parkName.toLowerCase().split(/\s+/);
    return trails.filter(trail => {
      const trailText = `${trail.name} ${trail.description}`.toLowerCase();
      return parkWords.some(word => word.length > 3 && trailText.includes(word));
    });
  }

  private mapTrail(trail: TrailAPITrail): Trail {
    return {
      id: String(trail.id),
      name: trail.name,
      url: trail.url, // Direct trail URL!
      length: trail.length,
      description: trail.description,
      city: trail.city,
      state: trail.region,
      country: trail.country,
      coordinates: {
        latitude: trail.lat,
        longitude: trail.lon,
      },
      difficulty: trail.difficulty,
      features: trail.features ? trail.features.split(',').map(f => f.trim()) : [],
      rating: trail.rating,
      imageUrl: trail.thumbnail,
      activities: trail.activities || [],
    };
  }
}

// Export singleton
export const trailAPIAdapter = new TrailAPIAdapter();
