/**
 * Unsplash Adapter - API-first approach with static fallbacks
 * 
 * Strategy (in order):
 * 1. Check cache from previous API calls
 * 2. Try Unsplash API if configured and quota available
 * 3. Fall back to park-specific curated photos (parkPhotos.ts)
 * 4. Return empty array if no photos found
 * 
 * Note: NPS photos are handled separately in chat handler and take priority.
 * This adapter supplements NPS photos with Unsplash content.
 * 
 * Free tier: 50 requests/hour - we use caching to minimize calls
 */

import axios from 'axios';
import { PARK_PHOTOS, findParkKeyFromQuery, ParkPhoto } from '../data/parkPhotos.js';

export interface PhotoResult {
  url: string;
  caption: string;
  credit: string;
  source: 'unsplash';
  photographerId?: string;
}

// API response cache to minimize calls
interface PhotoCache {
  query: string;
  photos: PhotoResult[];
  timestamp: number;
}

const photoCache: Map<string, PhotoCache> = new Map();
const CACHE_TTL_MS = 3600000; // 1 hour

// Rate limiting
let lastApiCall = 0;
const MIN_API_INTERVAL_MS = 2000; // 2 seconds between calls

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}


export class UnsplashAdapter {
  private accessKey: string | null = null;

  constructor(accessKey?: string) {
    this.accessKey = accessKey || process.env.UNSPLASH_ACCESS_KEY || null;
    if (this.accessKey) {
      console.log('[Unsplash] API configured with access key');
    } else {
      console.log('[Unsplash] No API key - using curated photos only');
    }
  }

  isConfigured(): boolean {
    return true; // Always return true - we have fallbacks
  }

  hasApiAccess(): boolean {
    return !!this.accessKey;
  }

  async searchPhotos(query: string, perPage: number = 5): Promise<PhotoResult[]> {
    const cacheKey = query.toLowerCase();

    // 1. Check cache from previous API calls
    const cached = photoCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[Unsplash] Cache hit for: "${query}"`);
      return shuffleArray(cached.photos).slice(0, perPage);
    }

    // 2. Try Unsplash API if configured and rate limit allows
    if (this.accessKey && Date.now() - lastApiCall > MIN_API_INTERVAL_MS) {
      try {
        lastApiCall = Date.now();
        console.log(`[Unsplash] API call for: "${query}"`);
        
        const response = await axios.get('https://api.unsplash.com/search/photos', {
          params: {
            query: `${query} landscape nature`,
            per_page: Math.min(perPage * 2, 20),
            orientation: 'landscape',
          },
          headers: {
            Authorization: `Client-ID ${this.accessKey}`,
          },
          timeout: 5000,
        });

        const photos: PhotoResult[] = response.data.results.map((photo: any) => ({
          url: `${photo.urls.regular}&w=1200`,
          caption: photo.description || photo.alt_description || query,
          credit: `Photo by ${photo.user.name} on Unsplash`,
          source: 'unsplash' as const,
          photographerId: photo.user.id,
        }));

        // Cache results
        if (photos.length > 0) {
          photoCache.set(cacheKey, {
            query: cacheKey,
            photos,
            timestamp: Date.now(),
          });
          console.log(`[Unsplash] API returned ${photos.length} photos for: "${query}"`);
          return photos.slice(0, perPage);
        }
        // If API returned empty, fall through to static fallback
        console.log(`[Unsplash] API returned no photos for: "${query}", using fallback`);
      } catch (error: any) {
        console.warn(`[Unsplash] API error for "${query}":`, error.message);
        // Fall through to static fallback
      }
    }

    // 3. Fallback: park-specific curated photos from parkPhotos.ts
    const parkKey = findParkKeyFromQuery(query);
    if (parkKey && PARK_PHOTOS[parkKey]) {
      const parkPhotos = PARK_PHOTOS[parkKey];
      console.log(`[Unsplash] Using static fallback for park: "${parkKey}" (${parkPhotos.length} available)`);
      const shuffled = shuffleArray(parkPhotos);
      return shuffled.slice(0, Math.min(perPage, parkPhotos.length)).map(photo => ({
        ...photo,
        caption: photo.caption,
      }));
    }

    // No photos available - return empty array (NPS photos should be primary source)
    console.log(`[Unsplash] No photos available for: "${query}"`);
    return [];
  }

  async getPhotosByParkName(parkName: string, count: number = 3): Promise<PhotoResult[]> {
    return this.searchPhotos(parkName, count);
  }
}

// Singleton instance
let unsplashInstance: UnsplashAdapter | null = null;

export function getUnsplashAdapter(): UnsplashAdapter {
  if (!unsplashInstance) {
    unsplashInstance = new UnsplashAdapter();
  }
  return unsplashInstance;
}
