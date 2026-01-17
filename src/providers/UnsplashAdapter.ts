/**
 * Unsplash API Adapter for fallback park photos
 * Free tier: 50 requests/hour
 * API docs: https://unsplash.com/documentation
 */

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string | null;
  description: string | null;
  user: {
    name: string;
    username: string;
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashPhoto[];
}

export interface PhotoResult {
  url: string;
  caption: string;
  credit: string;
  source: 'unsplash';
  photographerId?: string; // Unsplash username for deduplication
}

export class UnsplashAdapter {
  private accessKey: string;
  private baseUrl = 'https://api.unsplash.com';

  constructor(accessKey?: string) {
    this.accessKey = accessKey || process.env.UNSPLASH_ACCESS_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.accessKey;
  }

  async searchPhotos(query: string, perPage: number = 5): Promise<PhotoResult[]> {
    if (!this.accessKey) {
      console.log('[Unsplash] API key not configured, skipping fallback photos');
      return [];
    }

    try {
      const url = `${this.baseUrl}/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`,
          'Accept-Version': 'v1',
        },
      });

      if (!response.ok) {
        console.error(`[Unsplash] API error: ${response.status}`);
        return [];
      }

      const data = await response.json() as UnsplashSearchResponse;
      
      return data.results.map(photo => ({
        url: photo.urls.regular, // Good quality, reasonable size
        caption: photo.alt_description || photo.description || query,
        credit: `Photo by ${photo.user.name} on Unsplash`,
        source: 'unsplash' as const,
        photographerId: photo.user.username, // For deduplication
      }));
    } catch (error) {
      console.error('[Unsplash] Search failed:', error);
      return [];
    }
  }

  async getPhotosByParkName(parkName: string, count: number = 3): Promise<PhotoResult[]> {
    // Search with park name + "national park" for better results
    const searchTerms = [
      parkName,
      `${parkName} landscape`,
      `${parkName} nature`,
    ];

    // Try first search term
    let photos = await this.searchPhotos(searchTerms[0], count);
    
    // If not enough results, try alternative search
    if (photos.length < count) {
      const morePhotos = await this.searchPhotos(searchTerms[1], count - photos.length);
      photos = [...photos, ...morePhotos];
    }

    return photos.slice(0, count);
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
