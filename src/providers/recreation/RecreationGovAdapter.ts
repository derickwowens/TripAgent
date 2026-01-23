import { BaseAdapter } from '../base/BaseAdapter.js';

// RIDB API Response Types
interface RIDBFacilitiesResponse {
  RECDATA: RIDBFacility[];
  METADATA: {
    RESULTS: {
      CURRENT_COUNT: number;
      TOTAL_COUNT: number;
    };
  };
}

interface RIDBFacility {
  FacilityID: string;
  FacilityName: string;
  FacilityDescription: string;
  FacilityTypeDescription: string;
  FacilityUseFeeDescription: string;
  FacilityReservationURL: string;
  FacilityLatitude: number;
  FacilityLongitude: number;
  FacilityPhone: string;
  FacilityEmail: string;
  Reservable: boolean;
  Enabled: boolean;
  LastUpdatedDate: string;
}

interface RIDBRecAreaResponse {
  RECDATA: RIDBRecArea[];
  METADATA: {
    RESULTS: {
      CURRENT_COUNT: number;
      TOTAL_COUNT: number;
    };
  };
}

interface RIDBRecArea {
  RecAreaID: string;
  RecAreaName: string;
  RecAreaDescription: string;
  RecAreaPhone: string;
  RecAreaEmail: string;
  RecAreaReservationURL: string;
  RecAreaLatitude: number;
  RecAreaLongitude: number;
  LastUpdatedDate: string;
}

// Output Types
export interface RecreationFacility {
  id: string;
  name: string;
  description: string;
  type: string;
  reservable: boolean;
  reservationUrl: string;
  coordinates: { latitude: number; longitude: number };
  phone: string;
  feeDescription: string;
}

export interface RecreationArea {
  id: string;
  name: string;
  description: string;
  reservationUrl: string;
  coordinates: { latitude: number; longitude: number };
  phone: string;
}

// Park code to Recreation Area ID mapping for National Parks
const PARK_REC_AREA_IDS: Record<string, string> = {
  'yose': '2991',   // Yosemite
  'grca': '2733',   // Grand Canyon
  'zion': '2769',   // Zion
  'yell': '2812',   // Yellowstone
  'glac': '2725',   // Glacier
  'grte': '2817',   // Grand Teton
  'romo': '2907',   // Rocky Mountain
  'acad': '2563',   // Acadia
  'arch': '2715',   // Arches
  'brca': '2719',   // Bryce Canyon
  'jotr': '2787',   // Joshua Tree
  'seki': '2829',   // Sequoia & Kings Canyon
  'deva': '2562',   // Death Valley
  'olym': '2881',   // Olympic
  'havo': '2843',   // Hawaii Volcanoes
  'ever': '2731',   // Everglades
  'grsm': '2751',   // Great Smoky Mountains
  'bibe': '2564',   // Big Bend
  'cany': '2724',   // Canyonlands
  'crla': '2855',   // Crater Lake
  'dena': '2728',   // Denali
  'glba': '2739',   // Glacier Bay
  'grba': '2748',   // Great Basin
  'gumo': '2755',   // Guadalupe Mountains
  'hale': '2756',   // Haleakala
  'indu': '2776',   // Indiana Dunes
  'isro': '2779',   // Isle Royale
  'kefj': '2790',   // Kenai Fjords
  'lavo': '2795',   // Lassen Volcanic
  'maca': '2802',   // Mammoth Cave
  'meve': '2810',   // Mesa Verde
  'mora': '2819',   // Mount Rainier
  'noca': '2866',   // North Cascades
  'pefo': '2872',   // Petrified Forest
  'pinn': '2874',   // Pinnacles
  'redw': '2892',   // Redwood
  'sagu': '2899',   // Saguaro
  'shen': '2918',   // Shenandoah
  'thro': '2932',   // Theodore Roosevelt
  'voya': '2943',   // Voyageurs
  'wica': '2950',   // Wind Cave
  'wrst': '2955',   // Wrangell-St. Elias
  'badl': '2570',   // Badlands
  'bisc': '2693',   // Biscayne
  'blca': '2696',   // Black Canyon of the Gunnison
  'care': '2731',   // Capitol Reef
  'cave': '2732',   // Carlsbad Caverns
  'chis': '2739',   // Channel Islands
  'cong': '2744',   // Congaree
  'cuva': '2754',   // Cuyahoga Valley
  'drto': '2764',   // Dry Tortugas
  'gaar': '2735',   // Gates of the Arctic
  'jeff': '2785',   // Gateway Arch
  'grsa': '2752',   // Great Sand Dunes
  'hosp': '2773',   // Hot Springs
  'katm': '2789',   // Katmai
  'kova': '2791',   // Kobuk Valley
  'lacl': '2794',   // Lake Clark
  'npsa': '2860',   // National Park of American Samoa
  'viis': '2940',   // Virgin Islands
  'whsa': '2948',   // White Sands
};

export class RecreationGovAdapter extends BaseAdapter {
  name = 'recreation-gov';
  private apiKey: string;
  private baseUrl = 'https://ridb.recreation.gov/api/v1';

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.RECREATION_GOV_API_KEY || '';
    this.cacheTTL = 30 * 60 * 1000; // 30 min cache
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async searchFacilities(query: string, limit = 20): Promise<RecreationFacility[]> {
    const cacheKey = this.generateCacheKey('ridb-facilities-search', { query, limit });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        throw new Error('Recreation.gov API key not configured. Set RECREATION_GOV_API_KEY environment variable.');
      }

      const response = await fetch(
        `${this.baseUrl}/facilities?query=${encodeURIComponent(query)}&limit=${limit}&apikey=${this.apiKey}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Recreation.gov API error: ${response.status}`);
      }

      const data = await response.json() as RIDBFacilitiesResponse;
      return (data.RECDATA || []).map(facility => this.transformFacility(facility));
    });
  }

  async getFacilitiesByParkCode(parkCode: string): Promise<RecreationFacility[]> {
    const recAreaId = PARK_REC_AREA_IDS[parkCode.toLowerCase()];
    
    if (!recAreaId) {
      // Fallback to search by park name
      return this.searchFacilities(`${parkCode} national park campground`);
    }

    const cacheKey = this.generateCacheKey('ridb-recarea-facilities', { recAreaId });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        throw new Error('Recreation.gov API key not configured.');
      }

      const response = await fetch(
        `${this.baseUrl}/recareas/${recAreaId}/facilities?limit=50&apikey=${this.apiKey}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Recreation.gov API error: ${response.status}`);
      }

      const data = await response.json() as RIDBFacilitiesResponse;
      
      // Filter to only campgrounds and reservable facilities
      const campgrounds = (data.RECDATA || []).filter(f => 
        f.FacilityTypeDescription?.toLowerCase().includes('camping') ||
        f.FacilityTypeDescription?.toLowerCase().includes('campground') ||
        f.FacilityName?.toLowerCase().includes('campground') ||
        f.FacilityName?.toLowerCase().includes('camp')
      );

      return campgrounds.map(facility => this.transformFacility(facility));
    });
  }

  async getRecreationArea(recAreaId: string): Promise<RecreationArea | null> {
    const cacheKey = this.generateCacheKey('ridb-recarea', { recAreaId });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        throw new Error('Recreation.gov API key not configured.');
      }

      const response = await fetch(
        `${this.baseUrl}/recareas/${recAreaId}?apikey=${this.apiKey}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Recreation.gov API error: ${response.status}`);
      }

      const data = await response.json() as RIDBRecArea[];
      if (!data || data.length === 0) return null;

      const area = Array.isArray(data) ? data[0] : data;
      return this.transformRecArea(area);
    });
  }

  async searchCampgrounds(parkName: string): Promise<RecreationFacility[]> {
    // Search for campgrounds specifically
    const query = `${parkName} campground`;
    const facilities = await this.searchFacilities(query, 30);
    
    // Filter to only camping-related facilities
    return facilities.filter(f => 
      f.type?.toLowerCase().includes('camping') ||
      f.type?.toLowerCase().includes('campground') ||
      f.name?.toLowerCase().includes('campground') ||
      f.name?.toLowerCase().includes('camp')
    );
  }

  getRecAreaIdForPark(parkCode: string): string | null {
    return PARK_REC_AREA_IDS[parkCode.toLowerCase()] || null;
  }

  private transformFacility(facility: RIDBFacility): RecreationFacility {
    return {
      id: facility.FacilityID,
      name: facility.FacilityName,
      description: this.cleanDescription(facility.FacilityDescription),
      type: facility.FacilityTypeDescription || 'Facility',
      reservable: facility.Reservable || false,
      reservationUrl: facility.FacilityReservationURL || 'https://www.recreation.gov',
      coordinates: {
        latitude: facility.FacilityLatitude || 0,
        longitude: facility.FacilityLongitude || 0,
      },
      phone: facility.FacilityPhone || '',
      feeDescription: facility.FacilityUseFeeDescription || '',
    };
  }

  private transformRecArea(area: RIDBRecArea): RecreationArea {
    return {
      id: area.RecAreaID,
      name: area.RecAreaName,
      description: this.cleanDescription(area.RecAreaDescription),
      reservationUrl: area.RecAreaReservationURL || 'https://www.recreation.gov',
      coordinates: {
        latitude: area.RecAreaLatitude || 0,
        longitude: area.RecAreaLongitude || 0,
      },
      phone: area.RecAreaPhone || '',
    };
  }

  private cleanDescription(desc: string | undefined): string {
    if (!desc) return '';
    // Remove HTML tags and limit length
    return desc
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);
  }
}
