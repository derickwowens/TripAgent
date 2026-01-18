/**
 * Unsplash Adapter - Now uses local static photos to avoid API quota usage
 * 
 * Previously used Unsplash API (Free tier: 50 requests/hour)
 * Now returns curated local photos for all requests to conserve API calls
 */

export interface PhotoResult {
  url: string;
  caption: string;
  credit: string;
  source: 'unsplash';
  photographerId?: string;
}

// Local curated nature/landscape photos - no API calls needed
const LOCAL_PHOTOS: PhotoResult[] = [
  { url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1200', caption: 'Misty forest landscape', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-1' },
  { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200', caption: 'Mountain peaks', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-2' },
  { url: 'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1200', caption: 'Valley view', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-3' },
  { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200', caption: 'Foggy mountains', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-4' },
  { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200', caption: 'Sun through forest', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-5' },
  { url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200', caption: 'Mountain lake', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-6' },
  { url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1200', caption: 'Sunrise over hills', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-7' },
  { url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200', caption: 'Alpine sunrise', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-8' },
  { url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1200', caption: 'Waterfall in forest', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-9' },
  { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200', caption: 'Canyon vista', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-10' },
  { url: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=1200', caption: 'Forest path', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-11' },
  { url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1200', caption: 'Sunbeam through trees', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-12' },
  { url: 'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1200', caption: 'Mountain meadow', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-13' },
  { url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200', caption: 'Snowy peaks', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-14' },
  { url: 'https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=1200', caption: 'Autumn forest', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-15' },
  { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1200', caption: 'Dusk sky', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-16' },
  { url: 'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=1200', caption: 'Coastal cliffs', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-17' },
  { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200', caption: 'River bend', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-18' },
  { url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=1200', caption: 'Sunset colors', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-19' },
  { url: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=1200', caption: 'Mountain peaks', credit: 'Photo on Unsplash', source: 'unsplash', photographerId: 'local-20' },
];

// Shuffle helper for variety
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class UnsplashAdapter {
  constructor(_accessKey?: string) {
    // Access key no longer needed - using local photos
  }

  isConfigured(): boolean {
    // Always return true since we use local photos
    return true;
  }

  async searchPhotos(query: string, perPage: number = 5): Promise<PhotoResult[]> {
    // Return shuffled local photos instead of API call
    console.log(`[Unsplash] Using local photos for query: "${query}" (no API call)`);
    const shuffled = shuffleArray(LOCAL_PHOTOS);
    return shuffled.slice(0, Math.min(perPage, LOCAL_PHOTOS.length)).map(photo => ({
      ...photo,
      caption: `${query} - ${photo.caption}`,
    }));
  }

  async getPhotosByParkName(parkName: string, count: number = 3): Promise<PhotoResult[]> {
    // Return local photos for park requests
    console.log(`[Unsplash] Using local photos for park: "${parkName}" (no API call)`);
    const shuffled = shuffleArray(LOCAL_PHOTOS);
    return shuffled.slice(0, Math.min(count, LOCAL_PHOTOS.length)).map(photo => ({
      ...photo,
      caption: `${parkName} - ${photo.caption}`,
    }));
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
