/**
 * NPS API Trail Adapter
 * 
 * Fetches official trail data from the National Park Service API.
 * API Docs: https://www.nps.gov/subjects/developer/api-documentation.htm
 */

import { BaseAdapter } from '../base/BaseAdapter.js';

const NPS_API_BASE = 'https://developer.nps.gov/api/v1';

interface NPSThingToDoResponse {
  total: string;
  limit: string;
  start: string;
  data: NPSThingToDo[];
}

interface NPSThingToDo {
  id: string;
  url: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  duration: string;
  durationDescription: string;
  activityDescription: string;
  location: string;
  locationDescription: string;
  season: string[];
  seasonDescription: string;
  arePetsPermitted: string;
  arePetsPermittedwithRestrictions: string;
  petsDescription: string;
  isReservationRequired: string;
  reservationDescription: string;
  doFeesApply: string;
  feeDescription: string;
  timeOfDay: string[];
  accessibilityInformation: string;
  tags: string[];
  images: Array<{
    credit: string;
    title: string;
    altText: string;
    caption: string;
    url: string;
  }>;
  relatedParks: Array<{
    states: string;
    parkCode: string;
    designation: string;
    fullName: string;
    url: string;
    name: string;
  }>;
}

export interface NPSTrail {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  url: string;
  duration: string;
  location: string;
  season: string[];
  reservationRequired: boolean;
  feesApply: boolean;
  petsAllowed: boolean;
  accessibility: string;
  imageUrl?: string;
  tags: string[];
  parkCode: string;
  parkName: string;
}

export class NPSTrailAdapter extends BaseAdapter {
  name = 'nps-trails';
  private apiKey: string;

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.NPS_API_KEY || '';
    this.cacheTTL = 60 * 60 * 1000; // 1 hour cache
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get trails/hikes for a specific national park
   */
  async getTrailsForPark(parkCode: string): Promise<NPSTrail[]> {
    if (!this.isConfigured()) {
      console.log('[NPS Trails] API key not configured');
      return [];
    }

    const cacheKey = this.generateCacheKey('nps-trails', { parkCode });

    return this.fetchWithCache(cacheKey, async () => {
      console.log(`[NPS Trails] Fetching trails for park: ${parkCode}`);
      
      // Fetch "things to do" filtered by hiking-related activities
      const url = `${NPS_API_BASE}/thingstodo?parkCode=${parkCode}&limit=50&api_key=${this.apiKey}`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.error(`[NPS Trails] API error: ${response.status}`);
        return [];
      }

      const data = await response.json() as NPSThingToDoResponse;
      console.log(`[NPS Trails] Found ${data.data.length} activities for ${parkCode}`);

      // Filter for hiking-related activities
      const hikingKeywords = ['hike', 'hiking', 'trail', 'walk', 'trek', 'backpack'];
      const trails = data.data.filter(item => {
        const searchText = `${item.title} ${item.shortDescription} ${item.tags.join(' ')}`.toLowerCase();
        return hikingKeywords.some(kw => searchText.includes(kw));
      });

      console.log(`[NPS Trails] Filtered to ${trails.length} hiking trails`);

      return trails.map(item => ({
        id: item.id,
        name: item.title,
        description: item.longDescription || item.shortDescription,
        shortDescription: item.shortDescription,
        url: item.url, // Official NPS URL!
        duration: item.duration || item.durationDescription,
        location: item.location || item.locationDescription,
        season: item.season,
        reservationRequired: item.isReservationRequired === 'true',
        feesApply: item.doFeesApply === 'true',
        petsAllowed: item.arePetsPermitted === 'true',
        accessibility: item.accessibilityInformation,
        imageUrl: item.images?.[0]?.url,
        tags: item.tags,
        parkCode: item.relatedParks?.[0]?.parkCode || parkCode,
        parkName: item.relatedParks?.[0]?.fullName || '',
      }));
    });
  }

  /**
   * Search trails across all parks
   */
  async searchTrails(query: string, limit = 20): Promise<NPSTrail[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const cacheKey = this.generateCacheKey('nps-trails-search', { query, limit });

    return this.fetchWithCache(cacheKey, async () => {
      console.log(`[NPS Trails] Searching trails: ${query}`);
      
      const url = `${NPS_API_BASE}/thingstodo?q=${encodeURIComponent(query)}&limit=${limit}&api_key=${this.apiKey}`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as NPSThingToDoResponse;
      
      // Filter for hiking-related
      const hikingKeywords = ['hike', 'hiking', 'trail', 'walk', 'trek'];
      return data.data
        .filter(item => {
          const searchText = `${item.title} ${item.tags.join(' ')}`.toLowerCase();
          return hikingKeywords.some(kw => searchText.includes(kw));
        })
        .map(item => ({
          id: item.id,
          name: item.title,
          description: item.longDescription || item.shortDescription,
          shortDescription: item.shortDescription,
          url: item.url,
          duration: item.duration || item.durationDescription,
          location: item.location || item.locationDescription,
          season: item.season,
          reservationRequired: item.isReservationRequired === 'true',
          feesApply: item.doFeesApply === 'true',
          petsAllowed: item.arePetsPermitted === 'true',
          accessibility: item.accessibilityInformation,
          imageUrl: item.images?.[0]?.url,
          tags: item.tags,
          parkCode: item.relatedParks?.[0]?.parkCode || '',
          parkName: item.relatedParks?.[0]?.fullName || '',
        }));
    });
  }
}

// Export singleton
export const npsTrailAdapter = new NPSTrailAdapter();
