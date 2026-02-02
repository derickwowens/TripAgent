/**
 * Base Syncer Class
 * 
 * Common functionality for syncing park data from various sources.
 */

import { SYNC_CONFIG, STATE_NAMES } from './config.js';
import { uploadPark, uploadStateParkIndex, uploadSyncMetadata, downloadPark } from './s3Client.js';
import type { 
  NormalizedPark, 
  StateParkIndex, 
  SyncMetadata, 
  DataSource,
  ParkType,
  Coordinates,
  Activity,
  Campground,
  ParkImage,
  Fee,
  ContactInfo,
} from '../schema/park.schema.js';

export interface SyncResult {
  success: boolean;
  parksProcessed: number;
  parksUpdated: number;
  parksFailed: number;
  errors: string[];
  duration: number;
}

export abstract class BaseSyncer {
  protected stateCode: string;
  protected stateName: string;
  protected source: DataSource;
  protected startTime: Date;
  protected errors: string[] = [];
  protected parksProcessed = 0;
  protected parksUpdated = 0;
  protected parksFailed = 0;

  constructor(stateCode: string, source: DataSource) {
    this.stateCode = stateCode;
    this.stateName = STATE_NAMES[stateCode] || stateCode;
    this.source = source;
    this.startTime = new Date();
  }

  /**
   * Main sync method - must be implemented by subclasses
   */
  abstract sync(): Promise<SyncResult>;

  /**
   * Generate a unique park ID
   */
  protected generateParkId(name: string): string {
    const prefix = this.stateCode.toLowerCase();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
    return `${prefix}-${slug}`;
  }

  /**
   * Normalize park type from various source formats
   */
  protected normalizeParkType(designation: string): ParkType {
    const lower = designation.toLowerCase();
    
    if (lower.includes('national park')) return 'national_park';
    if (lower.includes('national monument')) return 'national_monument';
    if (lower.includes('national recreation')) return 'national_recreation_area';
    if (lower.includes('national seashore')) return 'national_seashore';
    if (lower.includes('national preserve')) return 'national_preserve';
    if (lower.includes('state beach')) return 'state_beach';
    if (lower.includes('state forest')) return 'state_forest';
    if (lower.includes('state historic')) return 'state_historic_site';
    if (lower.includes('recreation area')) return 'state_recreation_area';
    
    return 'state_park';
  }

  /**
   * Save a park to S3 and track stats
   */
  protected async savePark(park: NormalizedPark): Promise<boolean> {
    try {
      // Check if park already exists to determine if it's an update
      const existing = await downloadPark(park.id, park.stateCode);
      
      // Update metadata
      park.metadata.updatedAt = new Date().toISOString();
      if (!existing) {
        park.metadata.createdAt = park.metadata.updatedAt;
        park.metadata.version = 1;
      } else {
        park.metadata.createdAt = existing.metadata.createdAt;
        park.metadata.version = (existing.metadata.version || 0) + 1;
      }
      
      await uploadPark(park);
      this.parksProcessed++;
      this.parksUpdated++;
      return true;
    } catch (error: any) {
      this.errors.push(`Failed to save park ${park.id}: ${error.message}`);
      this.parksFailed++;
      return false;
    }
  }

  /**
   * Save the state park index
   */
  protected async saveIndex(parks: NormalizedPark[]): Promise<void> {
    const index: StateParkIndex = {
      stateCode: this.stateCode,
      stateName: this.stateName,
      totalParks: parks.length,
      lastSynced: new Date().toISOString(),
      parks: parks.map(p => ({
        id: p.id,
        name: p.name,
        parkType: p.parkType,
        coordinates: p.coordinates,
        acres: p.acres,
        hasCamping: (p.campgrounds?.length || 0) > 0,
        hasTrails: (p.trails?.length || 0) > 0,
        imageUrl: p.images?.[0]?.url,
        popularity: p.popularity,
      })),
    };
    
    await uploadStateParkIndex(index);
    console.log(`[${this.stateCode}] Saved index with ${parks.length} parks`);
  }

  /**
   * Save sync metadata
   */
  protected async saveSyncMetadata(): Promise<void> {
    const metadata: SyncMetadata = {
      source: this.source,
      stateCode: this.stateCode,
      lastSyncStart: this.startTime.toISOString(),
      lastSyncEnd: new Date().toISOString(),
      recordsProcessed: this.parksProcessed,
      recordsUpdated: this.parksUpdated,
      recordsFailed: this.parksFailed,
      errors: this.errors.length > 0 ? this.errors : undefined,
    };
    
    await uploadSyncMetadata(metadata);
  }

  /**
   * Get final sync result
   */
  protected getSyncResult(): SyncResult {
    const endTime = new Date();
    return {
      success: this.parksFailed === 0,
      parksProcessed: this.parksProcessed,
      parksUpdated: this.parksUpdated,
      parksFailed: this.parksFailed,
      errors: this.errors,
      duration: endTime.getTime() - this.startTime.getTime(),
    };
  }

  /**
   * Fetch JSON from a URL with rate limiting
   */
  protected async fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json() as Promise<T>;
  }

  /**
   * Sleep for rate limiting
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Helper to create a normalized park structure
 */
export function createNormalizedPark(params: {
  id: string;
  name: string;
  parkType: ParkType;
  stateCode: string;
  stateName: string;
  coordinates: Coordinates;
  source: DataSource;
  sourceId?: string;
  description?: string;
  designation?: string;
  acres?: number;
  contact?: ContactInfo;
  images?: ParkImage[];
  activities?: Activity[];
  campgrounds?: Campground[];
  fees?: Fee[];
  keywords?: string[];
  popularity?: number;
}): NormalizedPark {
  const now = new Date().toISOString();
  
  return {
    id: params.id,
    name: params.name,
    parkType: params.parkType,
    stateCode: params.stateCode,
    stateName: params.stateName,
    description: params.description,
    designation: params.designation,
    coordinates: params.coordinates,
    acres: params.acres,
    contact: params.contact,
    images: params.images,
    activities: params.activities,
    campgrounds: params.campgrounds,
    fees: params.fees,
    keywords: params.keywords,
    popularity: params.popularity,
    metadata: {
      sources: [{
        source: params.source,
        sourceId: params.sourceId,
        lastSynced: now,
      }],
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
  };
}
