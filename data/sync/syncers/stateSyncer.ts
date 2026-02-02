/**
 * Abstract State Parks Syncer
 * 
 * A generic, configuration-driven syncer that works for any state.
 * Reads state configuration from JSON files and uses appropriate
 * data sources based on the configuration.
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BaseSyncer, SyncResult, createNormalizedPark } from '../baseSyncer.js';
import { SYNC_CONFIG } from '../config.js';
import type { StateConfig, generateParkUrl } from '../../schema/stateConfig.schema.js';
import type { 
  NormalizedPark, 
  Campground,
  Coordinates,
  OfficialLink,
  DataSource,
  ParkType,
} from '../../schema/park.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PAD-US response types
interface PADUSFeature {
  attributes: {
    OBJECTID: number;
    Unit_Nm: string;
    Mang_Name: string;
    Mang_Type: string;
    Des_Tp: string;
    GIS_Acres: number;
    State_Nm: string;
    Pub_Access: string;
  };
  geometry: {
    x: number;
    y: number;
  };
}

interface PADUSResponse {
  features: PADUSFeature[];
}

// RIDB response types
interface RIDBRecArea {
  RecAreaID: string;
  RecAreaName: string;
  RecAreaDescription: string;
  RecAreaPhone: string;
  RecAreaEmail: string;
  RecAreaReservationURL: string;
  RecAreaLatitude: number;
  RecAreaLongitude: number;
  ACTIVITY?: Array<{ ActivityID: number; ActivityName: string }>;
  MEDIA?: Array<{ URL: string; Title: string; Description: string; Credits: string }>;
  LINK?: Array<{ URL: string; Title: string; LinkType: string }>;
}

interface RIDBFacility {
  FacilityID: string;
  FacilityName: string;
  FacilityDescription: string;
  FacilityPhone: string;
  FacilityReservationURL: string;
  FacilityLatitude: number;
  FacilityLongitude: number;
  FacilityTypeDescription: string;
}

/**
 * Generic State Syncer - Configuration-driven sync for any state
 */
export class StateSyncer extends BaseSyncer {
  private config: StateConfig;
  private ridbApiKey: string;

  constructor(config: StateConfig) {
    super(config.stateCode, 'pad_us');
    this.config = config;
    this.ridbApiKey = process.env.RECREATION_GOV_API_KEY || '';
  }

  /**
   * Create a syncer from a state code by loading its configuration
   */
  static async fromStateCode(stateCode: string): Promise<StateSyncer> {
    const configPath = join(__dirname, '../../sources/states', `${stateCode.toUpperCase()}.json`);
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData) as StateConfig;
    return new StateSyncer(config);
  }

  async sync(): Promise<SyncResult> {
    console.log(`[${this.stateCode}] Starting ${this.config.stateName} state parks sync...`);
    console.log(`[${this.stateCode}] Park Authority: ${this.config.parkAuthority.name}`);

    try {
      // Step 1: Fetch parks from primary source (PAD-US by default)
      const parks = await this.fetchParksFromPrimarySource();
      console.log(`[${this.stateCode}] Fetched ${parks.length} parks from primary source`);

      // Step 2: Fetch enrichment data from RIDB if configured
      const ridbData = await this.fetchRIDBData();
      console.log(`[${this.stateCode}] Fetched ${ridbData.recAreas.length} rec areas, ${ridbData.facilities.length} facilities from RIDB`);

      // Step 3: Normalize and merge the data
      const normalizedParks = this.normalizeAndMerge(parks, ridbData);
      console.log(`[${this.stateCode}] Normalized ${normalizedParks.length} parks`);

      // Step 4: Save each park
      for (const park of normalizedParks) {
        await this.savePark(park);
        await this.sleep(100); // Rate limit S3 writes
      }

      // Step 5: Save the index
      await this.saveIndex(normalizedParks);

      // Step 6: Save sync metadata
      await this.saveSyncMetadata();

      const result = this.getSyncResult();
      console.log(`[${this.stateCode}] Sync complete: ${result.parksUpdated} parks updated in ${result.duration}ms`);
      
      return result;
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error(`[${this.stateCode}] Sync failed:`, error);
      return this.getSyncResult();
    }
  }

  /**
   * Fetch parks from the primary data source (PAD-US)
   */
  private async fetchParksFromPrimarySource(): Promise<PADUSFeature[]> {
    const sourceConfig = this.config.dataSources.parkList;
    
    if (sourceConfig.type !== 'pad_us') {
      console.warn(`[${this.stateCode}] Unsupported primary source type: ${sourceConfig.type}`);
      return [];
    }

    const baseUrl = SYNC_CONFIG.sources.padUs.baseUrl;
    
    // Build WHERE clause from filters
    const filters = sourceConfig.filters || {};
    const whereClauses: string[] = [];
    
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        const values = value.map(v => `'${v}'`).join(', ');
        whereClauses.push(`${key} IN (${values})`);
      } else {
        whereClauses.push(`${key} = '${value}'`);
      }
    }
    
    const where = encodeURIComponent(whereClauses.join(' AND '));
    const url = `${baseUrl}/query?where=${where}&outFields=*&returnGeometry=true&outSR=4326&f=json`;
    
    console.log(`[${this.stateCode}] Fetching from PAD-US...`);
    const response = await this.fetchJson<PADUSResponse>(url);
    return response.features || [];
  }

  /**
   * Fetch recreation areas and facilities from RIDB
   */
  private async fetchRIDBData(): Promise<{ recAreas: RIDBRecArea[]; facilities: RIDBFacility[] }> {
    if (!this.ridbApiKey) {
      console.warn(`[${this.stateCode}] RIDB API key not configured, skipping RIDB data`);
      return { recAreas: [], facilities: [] };
    }

    const headers = {
      'apikey': this.ridbApiKey,
      'Accept': 'application/json',
    };

    try {
      // Fetch recreation areas
      const recAreasUrl = `${SYNC_CONFIG.sources.ridb.baseUrl}/recareas?state=${this.stateCode}&limit=100&full=true`;
      const recAreasResponse = await this.fetchJson<{ RECDATA: RIDBRecArea[] }>(recAreasUrl, headers);
      
      await this.sleep(200); // Rate limit

      // Fetch facilities (campgrounds)
      const facilitiesUrl = `${SYNC_CONFIG.sources.ridb.baseUrl}/facilities?state=${this.stateCode}&limit=100&full=true`;
      const facilitiesResponse = await this.fetchJson<{ RECDATA: RIDBFacility[] }>(facilitiesUrl, headers);

      return {
        recAreas: recAreasResponse.RECDATA || [],
        facilities: facilitiesResponse.RECDATA || [],
      };
    } catch (error: any) {
      console.warn(`[${this.stateCode}] RIDB fetch failed: ${error.message}`);
      return { recAreas: [], facilities: [] };
    }
  }

  /**
   * Normalize and merge data from multiple sources
   */
  private normalizeAndMerge(
    padUsParks: PADUSFeature[],
    ridbData: { recAreas: RIDBRecArea[]; facilities: RIDBFacility[] }
  ): NormalizedPark[] {
    const parks: NormalizedPark[] = [];
    const processedNames = new Set<string>();

    for (const feature of padUsParks) {
      const name = feature.attributes.Unit_Nm;
      const normalizedName = name.toLowerCase();
      
      // Skip duplicates
      if (processedNames.has(normalizedName)) continue;
      processedNames.add(normalizedName);

      // Find matching RIDB data
      const ridbMatch = this.findRIDBMatch(name, ridbData.recAreas);
      const campgrounds = this.buildCampgrounds(name, ridbData.facilities);

      // Get enrichment data from config
      const enrichment = this.getEnrichment(name);

      // Build coordinates
      const coordinates: Coordinates = ridbMatch 
        ? { latitude: ridbMatch.RecAreaLatitude, longitude: ridbMatch.RecAreaLongitude }
        : { latitude: feature.geometry.y, longitude: feature.geometry.x };

      // Build official links
      const officialLinks = this.buildOfficialLinks(name, feature, ridbMatch);

      // Determine park type from designation
      const parkType = this.mapDesignationToParkType(feature.attributes.Des_Tp);

      const park = createNormalizedPark({
        id: this.generateParkId(name),
        name: this.formatParkName(name, feature.attributes.Des_Tp),
        parkType,
        stateCode: this.stateCode,
        stateName: this.config.stateName,
        coordinates,
        source: 'pad_us',
        sourceId: feature.attributes.OBJECTID.toString(),
        description: enrichment?.description || ridbMatch?.RecAreaDescription,
        designation: this.getDesignationName(feature.attributes.Des_Tp),
        acres: feature.attributes.GIS_Acres,
        contact: ridbMatch ? {
          phone: ridbMatch.RecAreaPhone || undefined,
          email: ridbMatch.RecAreaEmail || undefined,
          reservationUrl: ridbMatch.RecAreaReservationURL || this.config.reservationSystem.baseUrl,
        } : {
          reservationUrl: this.config.reservationSystem.baseUrl,
        },
        images: ridbMatch?.MEDIA?.map(m => ({
          url: m.URL,
          title: m.Title,
          caption: m.Description,
          credit: m.Credits,
        })),
        activities: ridbMatch?.ACTIVITY?.map(a => ({
          id: a.ActivityID.toString(),
          name: a.ActivityName,
        })),
        campgrounds,
        keywords: enrichment?.keywords,
        popularity: enrichment?.popularity,
      });

      // Add official links
      park.officialLinks = officialLinks;

      // Build quick links for convenience
      park.quickLinks = {
        officialWebsite: officialLinks.find(l => l.type === 'official_website')?.url,
        reservations: officialLinks.find(l => l.type === 'reservation')?.url,
        map: officialLinks.find(l => l.type === 'map')?.url,
      };

      // Add RIDB as secondary source if matched
      if (ridbMatch) {
        park.metadata.sources.push({
          source: 'ridb',
          sourceId: ridbMatch.RecAreaID,
          lastSynced: new Date().toISOString(),
        });
      }

      parks.push(park);
    }

    return parks;
  }

  /**
   * Build official links from configuration patterns
   */
  private buildOfficialLinks(
    parkName: string, 
    feature: PADUSFeature,
    ridbMatch?: RIDBRecArea
  ): OfficialLink[] {
    const links: OfficialLink[] = [];
    const slug = this.generateSlug(parkName);
    const patterns = this.config.urlPatterns;

    // Official website
    if (patterns.officialParkPage) {
      links.push({
        type: 'official_website',
        url: this.applyUrlPattern(patterns.officialParkPage, { slug, id: feature.attributes.OBJECTID.toString() }),
        title: `${parkName} Official Page`,
        isPrimary: true,
        source: 'state_api',
      });
    }

    // Reservation link
    if (this.config.reservationSystem.baseUrl) {
      links.push({
        type: 'reservation',
        url: this.config.reservationSystem.deepLinkPattern 
          ? this.applyUrlPattern(this.config.reservationSystem.deepLinkPattern, { 
              slug, 
              parkId: feature.attributes.OBJECTID.toString(),
            })
          : this.config.reservationSystem.baseUrl,
        title: 'Make a Reservation',
        isPrimary: true,
        source: 'state_api',
      });
    }

    // Map link
    if (patterns.parkMap) {
      links.push({
        type: 'map',
        url: this.applyUrlPattern(patterns.parkMap, { slug }),
        title: 'Park Map',
        source: 'state_api',
      });
    }

    // Add RIDB links if available
    if (ridbMatch?.LINK) {
      for (const ridbLink of ridbMatch.LINK) {
        const linkType = this.mapRIDBLinkType(ridbLink.LinkType);
        // Don't duplicate if we already have this type
        if (!links.some(l => l.type === linkType && l.isPrimary)) {
          links.push({
            type: linkType,
            url: ridbLink.URL,
            title: ridbLink.Title,
            source: 'ridb',
          });
        }
      }
    }

    return links;
  }

  /**
   * Build campground objects from RIDB facilities
   */
  private buildCampgrounds(parkName: string, facilities: RIDBFacility[]): Campground[] {
    const normalizedName = parkName.toLowerCase();
    
    return facilities
      .filter(f => {
        const facilityName = f.FacilityName.toLowerCase();
        return (facilityName.includes(normalizedName) || normalizedName.includes(facilityName)) &&
               f.FacilityTypeDescription?.toLowerCase().includes('camping');
      })
      .map(f => ({
        id: f.FacilityID,
        name: f.FacilityName,
        description: f.FacilityDescription,
        coordinates: f.FacilityLatitude && f.FacilityLongitude 
          ? { latitude: f.FacilityLatitude, longitude: f.FacilityLongitude }
          : undefined,
        reservationUrl: f.FacilityReservationURL || this.config.reservationSystem.baseUrl,
        reservationSystem: {
          provider: this.config.reservationSystem.provider,
          campgroundId: f.FacilityID,
          deepLinkSupported: !!this.config.reservationSystem.deepLinkPattern,
        },
        source: 'ridb' as DataSource,
        sourceId: f.FacilityID,
      }));
  }

  /**
   * Find matching RIDB recreation area
   */
  private findRIDBMatch(parkName: string, recAreas: RIDBRecArea[]): RIDBRecArea | undefined {
    const normalizedName = parkName.toLowerCase();
    
    return recAreas.find(area => {
      const areaName = area.RecAreaName.toLowerCase();
      return areaName.includes(normalizedName) || normalizedName.includes(areaName);
    });
  }

  /**
   * Get enrichment data from configuration
   */
  private getEnrichment(parkName: string): { 
    description?: string; 
    shortDescription?: string;
    popularity?: number; 
    keywords?: string[] 
  } | undefined {
    if (!this.config.enrichment) return undefined;
    
    const normalizedName = parkName.toLowerCase();
    
    for (const [key, enrichment] of Object.entries(this.config.enrichment)) {
      if (normalizedName.includes(key.toLowerCase())) {
        return enrichment;
      }
    }
    
    return undefined;
  }

  /**
   * Format park name with proper capitalization and designation
   */
  private formatParkName(name: string, desType: string): string {
    const designation = this.config.designationTypes[desType];
    
    // Capitalize words
    let formatted = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Replace abbreviations with full names
    if (designation) {
      formatted = formatted.replace(new RegExp(`\\b${desType}\\b`, 'gi'), designation.name);
    }
    
    return formatted;
  }

  /**
   * Get designation name from code
   */
  private getDesignationName(desType: string): string {
    return this.config.designationTypes[desType]?.name || 'State Park';
  }

  /**
   * Map PAD-US designation to ParkType enum
   */
  private mapDesignationToParkType(desType: string): ParkType {
    const mapping: Record<string, ParkType> = {
      'SP': 'state_park',
      'SRA': 'state_recreation_area',
      'SF': 'state_forest',
      'SHCA': 'state_historic_site',
      'SHS': 'state_historic_site',
      'SG': 'state_park',
      'SOTH': 'state_park',
      'SNA': 'state_park',
      'ST': 'state_park',
      'SRMA': 'state_recreation_area',
    };
    
    return mapping[desType] || 'state_park';
  }

  /**
   * Map RIDB link type to our LinkType enum
   */
  private mapRIDBLinkType(ridbType: string): OfficialLink['type'] {
    const mapping: Record<string, OfficialLink['type']> = {
      'Official Web Site': 'official_website',
      'Reservations': 'reservation',
      'Online Reservations': 'reservation',
      'Map': 'map',
      'Directions': 'directions',
      'Facebook': 'social_media',
      'Twitter': 'social_media',
    };
    
    return mapping[ridbType] || 'other';
  }

  /**
   * Generate URL slug from park name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Apply URL pattern with placeholders
   */
  private applyUrlPattern(pattern: string, values: Record<string, string>): string {
    let url = pattern;
    for (const [key, value] of Object.entries(values)) {
      url = url.replace(`{${key}}`, value);
    }
    return url;
  }
}

// CLI entry point for running sync on a specific state
if (import.meta.url === `file://${process.argv[1]}`) {
  const stateCode = process.argv[2];
  
  if (!stateCode) {
    console.error('Usage: npx tsx stateSyncer.ts <STATE_CODE>');
    console.error('Example: npx tsx stateSyncer.ts WI');
    process.exit(1);
  }
  
  StateSyncer.fromStateCode(stateCode)
    .then(syncer => syncer.sync())
    .then(result => {
      console.log('\nSync Result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
