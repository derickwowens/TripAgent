import { BaseAdapter } from '../base/BaseAdapter.js';

// Recreation.gov RIDB API response types
interface RIDBFacility {
  FacilityID: string;
  FacilityName: string;
  FacilityDescription: string;
  FacilityDirections: string;
  FacilityTypeDescription: string;
  FacilityLatitude: number;
  FacilityLongitude: number;
  FacilityPhone: string;
  FacilityEmail: string;
  FacilityReservationURL: string;
  Reservable: boolean;
  Enabled: boolean;
  LastUpdatedDate: string;
  GEOJSON?: {
    TYPE: string;
    COORDINATES: [number, number];
  };
  MEDIA?: Array<{
    URL: string;
    Title: string;
    IsPrimary: boolean;
    MediaType: string;
  }>;
  ORGANIZATION?: Array<{
    OrgName: string;
    OrgType: string;
  }>;
}

interface RIDBResponse {
  RECDATA: RIDBFacility[];
  METADATA: {
    RESULTS: {
      CURRENT_COUNT: number;
      TOTAL_COUNT: number;
    };
  };
}

// RIDB Recreation Area response types
interface RIDBRecArea {
  RecAreaID: string;
  RecAreaName: string;
  RecAreaDescription: string;
  RecAreaDirections: string;
  RecAreaPhone: string;
  RecAreaEmail: string;
  RecAreaReservationURL: string;
  RecAreaFeeDescription: string;
  RecAreaMapURL: string;
  RecAreaLatitude: number;
  RecAreaLongitude: number;
  StayLimit: string;
  Keywords: string;
  Reservable: boolean;
  Enabled: boolean;
  LastUpdatedDate: string;
  ORGANIZATION?: Array<{
    OrgName: string;
    OrgType: string;
    OrgAbbrevName: string;
  }>;
  RECAREAADDRESS?: Array<{
    RecAreaAddressType: string;
    RecAreaStreetAddress1: string;
    RecAreaStreetAddress2: string;
    City: string;
    PostalCode: string;
    AddressStateCode: string;
    AddressCountryCode: string;
  }>;
  ACTIVITY?: Array<{
    ActivityID: number;
    ActivityName: string;
    ActivityParentID: number;
  }>;
  MEDIA?: Array<{
    URL: string;
    Title: string;
    Description: string;
    Credits: string;
    IsPrimary: boolean;
    MediaType: string;
  }>;
  LINK?: Array<{
    LinkType: string;
    URL: string;
    Title: string;
    Description: string;
  }>;
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

// Output Types
export interface Campground {
  id: string;
  name: string;
  description: string;
  state: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  email?: string;
  reservable: boolean;
  reservationUrl: string;
  photoUrl?: string;
  facilityType: string;
  directions?: string;
  managedBy?: string;
}

export interface CampgroundSearchParams {
  state?: string;
  query?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;      // miles
  limit?: number;
  offset?: number;
  activity?: string;    // e.g., 'CAMPING'
}

// Enhanced Recreation Area output type with activities and rich data
export interface StateRecreationArea {
  id: string;
  name: string;
  description: string;
  state: string;
  city?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  phone?: string;
  email?: string;
  website?: string;
  mapUrl?: string;
  reservable: boolean;
  reservationUrl?: string;
  feeDescription?: string;
  stayLimit?: string;
  activities: string[];
  photos: Array<{
    url: string;
    title?: string;
    description?: string;
    credits?: string;
  }>;
  links: Array<{
    title: string;
    url: string;
    type?: string;
  }>;
  managedBy?: string;
  keywords?: string[];
  lastUpdated?: string;
}

export class RecreationGovAdapter extends BaseAdapter {
  name = 'recreationgov';
  private apiKey: string;
  private baseUrl = 'https://ridb.recreation.gov/api/v1';

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.RECREATION_GOV_API_KEY || '';
    this.cacheTTL = 60 * 60 * 1000; // 1 hour cache
  }

  /**
   * Search for campgrounds/facilities
   */
  async searchCampgrounds(params: CampgroundSearchParams = {}): Promise<Campground[]> {
    const cacheKey = this.generateCacheKey('ridb-campgrounds', params);

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        console.warn('Recreation.gov API key not configured');
        return [];
      }

      const queryParams = new URLSearchParams();
      queryParams.set('limit', (params.limit || 50).toString());
      
      if (params.offset) {
        queryParams.set('offset', params.offset.toString());
      }

      // State filter
      if (params.state) {
        queryParams.set('state', params.state.toUpperCase());
      }

      // Text search
      if (params.query) {
        queryParams.set('query', params.query);
      }

      // Geo search
      if (params.latitude && params.longitude) {
        queryParams.set('latitude', params.latitude.toString());
        queryParams.set('longitude', params.longitude.toString());
        if (params.radius) {
          queryParams.set('radius', params.radius.toString());
        }
      }

      // Activity filter (CAMPING, HIKING, etc.)
      if (params.activity) {
        queryParams.set('activity', params.activity);
      }

      const url = `${this.baseUrl}/facilities?${queryParams}`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': this.apiKey,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Recreation.gov API error: ${response.status}`);
        }

        const data = await response.json() as RIDBResponse;
        return data.RECDATA
          .filter(f => f.Enabled !== false)
          .map(f => this.transformFacility(f, params.state));
      } catch (error) {
        console.error('Recreation.gov API error:', error);
        return [];
      }
    });
  }

  /**
   * Get campgrounds in a specific state
   */
  async getCampgroundsByState(stateCode: string, limit = 100): Promise<Campground[]> {
    return this.searchCampgrounds({ 
      state: stateCode, 
      activity: 'CAMPING',
      limit 
    });
  }

  /**
   * Get campgrounds near a location
   */
  async getCampgroundsNearLocation(
    latitude: number,
    longitude: number,
    radiusMiles = 50,
    limit = 50
  ): Promise<Campground[]> {
    return this.searchCampgrounds({
      latitude,
      longitude,
      radius: radiusMiles,
      activity: 'CAMPING',
      limit,
    });
  }

  /**
   * Search campgrounds by name
   */
  async searchByName(name: string, stateCode?: string): Promise<Campground[]> {
    return this.searchCampgrounds({
      query: name,
      state: stateCode,
      activity: 'CAMPING',
    });
  }

  /**
   * Get a specific facility by ID
   */
  async getFacilityById(facilityId: string): Promise<Campground | null> {
    const cacheKey = this.generateCacheKey('ridb-facility', { id: facilityId });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        return null;
      }

      const url = `${this.baseUrl}/facilities/${facilityId}`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': this.apiKey,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json() as RIDBFacility;
        return this.transformFacility(data);
      } catch (error) {
        console.error('Recreation.gov API error:', error);
        return null;
      }
    });
  }

  /**
   * Get recreation areas (parks, forests, etc.)
   */
  async getRecreationAreas(stateCode?: string, limit = 50): Promise<Campground[]> {
    const cacheKey = this.generateCacheKey('ridb-recareas', { state: stateCode, limit });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        return [];
      }

      const queryParams = new URLSearchParams();
      queryParams.set('limit', limit.toString());
      
      if (stateCode) {
        queryParams.set('state', stateCode.toUpperCase());
      }

      const url = `${this.baseUrl}/recareas?${queryParams}`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': this.apiKey,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return [];
        }

        const data = await response.json() as RIDBResponse;
        return (data.RECDATA || []).map((area: RIDBFacility) => 
          this.transformFacility(area, stateCode)
        );
      } catch (error) {
        console.error('Recreation.gov API error:', error);
        return [];
      }
    });
  }

  /**
   * Get all recreation areas in a state with enhanced data (activities, photos, links)
   * Returns federal recreation areas (BLM, Forest Service, NPS, etc.) in the state
   * These can be used to enrich state park data with nearby camping/activity options
   */
  async getStateRecreationAreas(stateCode: string, limit = 100): Promise<StateRecreationArea[]> {
    const cacheKey = this.generateCacheKey('ridb-state-recareas', { state: stateCode, limit });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        console.warn('[RIDB] API key not configured');
        return [];
      }

      const queryParams = new URLSearchParams({
        state: stateCode.toUpperCase(),
        limit: limit.toString(),
        full: 'true', // Request full details including activities, media, links
      });

      const url = `${this.baseUrl}/recareas?${queryParams}`;
      console.log(`[RIDB] Fetching recreation areas for ${stateCode}`);

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': this.apiKey,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`[RIDB] API error: ${response.status}`);
          return [];
        }

        const data = await response.json() as RIDBRecAreaResponse;
        
        if (!data.RECDATA) {
          return [];
        }

        console.log(`[RIDB] Found ${data.RECDATA.length} recreation areas in ${stateCode}`);
        
        return data.RECDATA.map(area => this.transformRecArea(area, stateCode));
      } catch (error) {
        console.error('[RIDB] API error:', error);
        return [];
      }
    });
  }

  /**
   * Search recreation areas by name with full details
   */
  async searchRecreationAreasByName(query: string, stateCode?: string): Promise<StateRecreationArea[]> {
    const cacheKey = this.generateCacheKey('ridb-recarea-search', { query, state: stateCode });

    return this.fetchWithCache(cacheKey, async () => {
      if (!this.apiKey) {
        return [];
      }

      const queryParams = new URLSearchParams({
        query: query,
        limit: '20',
        full: 'true',
      });
      
      if (stateCode) {
        queryParams.set('state', stateCode.toUpperCase());
      }

      const url = `${this.baseUrl}/recareas?${queryParams}`;

      try {
        const response = await fetch(url, {
          headers: {
            'apikey': this.apiKey,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return [];
        }

        const data = await response.json() as RIDBRecAreaResponse;
        return (data.RECDATA || []).map(area => this.transformRecArea(area, stateCode));
      } catch (error) {
        console.error('[RIDB] Search error:', error);
        return [];
      }
    });
  }

  /**
   * Transform RIDB RecArea to StateRecreationArea with full details
   */
  private transformRecArea(area: RIDBRecArea, stateCode?: string): StateRecreationArea {
    // Extract address info
    const address = area.RECAREAADDRESS?.[0];
    const city = address?.City || undefined;
    const state = address?.AddressStateCode || stateCode || '';

    // Extract activities
    const activities = (area.ACTIVITY || [])
      .map(a => a.ActivityName)
      .filter(Boolean);

    // Extract photos with metadata
    const photos = (area.MEDIA || [])
      .filter(m => m.MediaType === 'Image')
      .map(m => ({
        url: m.URL,
        title: m.Title || undefined,
        description: m.Description || undefined,
        credits: m.Credits || undefined,
      }));

    // Extract links
    const links = (area.LINK || [])
      .filter(l => l.URL)
      .map(l => ({
        title: l.Title || l.LinkType || 'Link',
        url: l.URL,
        type: l.LinkType || undefined,
      }));

    // Extract managing organization
    const managedBy = area.ORGANIZATION?.[0]?.OrgName || undefined;

    // Parse keywords
    const keywords = area.Keywords 
      ? area.Keywords.split(',').map(k => k.trim()).filter(Boolean)
      : undefined;

    // Clean description
    const description = this.stripHtml(area.RecAreaDescription || '');

    return {
      id: `ridb-recarea-${area.RecAreaID}`,
      name: area.RecAreaName,
      description: description.substring(0, 1000) + (description.length > 1000 ? '...' : ''),
      state,
      city,
      coordinates: {
        latitude: area.RecAreaLatitude || 0,
        longitude: area.RecAreaLongitude || 0,
      },
      phone: area.RecAreaPhone || undefined,
      email: area.RecAreaEmail || undefined,
      website: area.LINK?.find(l => l.LinkType === 'Official Web Site')?.URL || undefined,
      mapUrl: area.RecAreaMapURL || undefined,
      reservable: area.Reservable || false,
      reservationUrl: area.RecAreaReservationURL || undefined,
      feeDescription: area.RecAreaFeeDescription ? this.stripHtml(area.RecAreaFeeDescription) : undefined,
      stayLimit: area.StayLimit || undefined,
      activities,
      photos,
      links,
      managedBy,
      keywords,
      lastUpdated: area.LastUpdatedDate || undefined,
    };
  }

  /**
   * Transform RIDB facility to our Campground type
   */
  private transformFacility(facility: RIDBFacility, stateCode?: string): Campground {
    // Extract primary photo
    let photoUrl: string | undefined;
    if (facility.MEDIA && facility.MEDIA.length > 0) {
      const primaryMedia = facility.MEDIA.find(m => m.IsPrimary && m.MediaType === 'Image');
      photoUrl = primaryMedia?.URL || facility.MEDIA[0]?.URL;
    }

    // Extract managing organization
    let managedBy: string | undefined;
    if (facility.ORGANIZATION && facility.ORGANIZATION.length > 0) {
      managedBy = facility.ORGANIZATION[0]?.OrgName;
    }

    // Build reservation URL
    const reservationUrl = facility.FacilityReservationURL || 
      `https://www.recreation.gov/camping/campgrounds/${facility.FacilityID}`;

    // Clean description (remove HTML)
    const description = this.stripHtml(facility.FacilityDescription || '');

    return {
      id: `ridb-${facility.FacilityID}`,
      name: facility.FacilityName,
      description: description.substring(0, 500) + (description.length > 500 ? '...' : ''),
      state: stateCode || this.extractState(facility.FacilityDirections),
      coordinates: {
        latitude: facility.FacilityLatitude || 0,
        longitude: facility.FacilityLongitude || 0,
      },
      phone: facility.FacilityPhone || undefined,
      email: facility.FacilityEmail || undefined,
      reservable: facility.Reservable,
      reservationUrl,
      photoUrl,
      facilityType: facility.FacilityTypeDescription || 'Campground',
      directions: facility.FacilityDirections ? 
        this.stripHtml(facility.FacilityDirections).substring(0, 300) : undefined,
      managedBy,
    };
  }

  /**
   * Strip HTML tags from text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Try to extract state from directions text
   */
  private extractState(directions: string): string {
    if (!directions) return '';
    
    // Look for state abbreviations at end of addresses
    const stateMatch = directions.match(/,\s*([A-Z]{2})\s+\d{5}/);
    return stateMatch ? stateMatch[1] : '';
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}
