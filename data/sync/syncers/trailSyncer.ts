/**
 * Trail Syncer
 * 
 * Syncs trail data from various state-specific APIs to S3.
 * Supports:
 * - California: ArcGIS Hub data
 * - Texas: ArcGIS REST MapServer
 * - Colorado: COTREX (future implementation)
 */

import { BaseSyncer, SyncResult } from '../baseSyncer.js';
import { SYNC_CONFIG } from '../config.js';
import { uploadJson } from '../s3Client.js';

interface ArcGISFeature {
  attributes: Record<string, any>;
  geometry?: {
    paths?: number[][][];
    x?: number;
    y?: number;
  };
}

interface ArcGISResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

interface NormalizedTrail {
  id: string;
  name: string;
  parkName?: string;
  parkId?: string;
  lengthMiles?: number;
  difficulty?: string;
  trailType?: string;
  surface?: string;
  allowedUses?: string[];
  coordinates?: {
    start?: { latitude: number; longitude: number };
    end?: { latitude: number; longitude: number };
  };
  description?: string;
  googleMapsUrl?: string;
  officialUrl?: string;
  dataSource: string;
}

/**
 * California Trail Syncer
 * Fetches trail data from CA State Parks ArcGIS Hub
 */
export class CaliforniaTrailSyncer extends BaseSyncer {
  // CA State Parks Recreational Routes - official trail data
  private trailsUrl = 'https://services2.arcgis.com/AhxrK3F6WM8ECvDi/arcgis/rest/services/RecreationalRoutes/FeatureServer/0';

  constructor() {
    super('CA', 'ca_state_parks_gis');
  }

  async sync(): Promise<SyncResult> {
    console.log('[CA Trails] Starting California trails sync...');

    try {
      const trails = await this.fetchTrails();
      console.log(`[CA Trails] Fetched ${trails.length} trails`);

      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      
      // Group trails by park
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[CA Trails] Grouped into ${Object.keys(trailsByPark).length} parks`);

      // Upload to S3
      await this.uploadTrailData(trailsByPark);

      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[CA Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[CA Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch CA trails: ${response.status}`);
      }

      const data = await response.json() as ArcGISResponse;
      
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
      } else {
        hasMore = false;
      }

      // Rate limiting
      await this.sleep(500);
    }

    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    
    // Extract coordinates from geometry
    let startCoords: { latitude: number; longitude: number } | undefined;
    let endCoords: { latitude: number; longitude: number } | undefined;
    
    if (feature.geometry?.paths && feature.geometry.paths.length > 0) {
      const path = feature.geometry.paths[0];
      if (path.length > 0) {
        startCoords = { longitude: path[0][0], latitude: path[0][1] };
        endCoords = { longitude: path[path.length - 1][0], latitude: path[path.length - 1][1] };
      }
    }

    // CA State Parks field mapping
    const name = (attrs.ROUTENAME && attrs.ROUTENAME.trim()) || 'Unknown Trail';
    const parkName = (attrs.UNITNAME && attrs.UNITNAME.trim()) || 'California Trails';
    const lengthMeters = attrs.Shape__Length || attrs.SEGLNGTH || 0;

    return {
      id: `ca-trail-${attrs.FID || Math.random().toString(36).substr(2, 9)}`,
      name: name,
      parkName: parkName,
      parkId: this.createTrailParkId(parkName),
      lengthMiles: lengthMeters > 0 ? lengthMeters / 1609.34 : undefined,
      difficulty: this.inferDifficultyFromLength(lengthMeters / 1609.34),
      trailType: attrs.ROUTETYPE || attrs.ROUTECLASS,
      surface: attrs.SURFACE,
      allowedUses: this.parseAllowedUses(attrs),
      coordinates: startCoords ? { start: startCoords, end: endCoords } : undefined,
      description: attrs.ROUTECAT,
      googleMapsUrl: startCoords 
        ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}`
        : undefined,
      dataSource: 'California State Parks GIS',
    };
  }

  private parseAllowedUses(attrs: Record<string, any>): string[] {
    const uses: string[] = [];
    
    // CA uses ROUTECLASS to indicate trail type
    const routeClass = (attrs.ROUTECLASS || '').toLowerCase();
    if (routeClass.includes('trail') || routeClass.includes('path')) uses.push('hiking');
    if (routeClass.includes('bike') || routeClass.includes('cycle')) uses.push('biking');
    if (routeClass.includes('horse') || routeClass.includes('equestrian')) uses.push('equestrian');
    
    return uses.length > 0 ? uses : ['hiking'];
  }

  private inferDifficultyFromLength(miles: number | undefined): string | undefined {
    if (!miles || miles <= 0) return undefined;
    if (miles < 2) return 'easy';
    if (miles < 5) return 'moderate';
    return 'difficult';
  }

  private createTrailParkId(parkName: string): string {
    return parkName
      .toLowerCase()
      .replace(/\s*(state\s*park|state\s*beach|state\s*historic\s*park|state\s*recreation\s*area)\s*/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') || 'california-trails';
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};

    for (const trail of trails) {
      const parkId = trail.parkId || 'california-trails';
      const parkName = trail.parkName || 'California Trails';

      if (!grouped[parkId]) {
        grouped[parkId] = { parkName, trails: [] };
      }
      grouped[parkId].trails.push(trail);
    }

    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'CA',
      stateName: 'California',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };

    console.log(`[CA Trails] Uploading ${trailsData.totalTrails} trails for ${trailsData.totalParks} parks`);
    
    // Upload to S3
    await uploadJson(`trails/state-parks/CA/trails.json`, trailsData);
    
    this.parksProcessed = trailsData.totalTrails;
  }

}

/**
 * Texas Trail Syncer
 * Fetches trail data from TPWD ArcGIS MapServer
 */
export class TexasTrailSyncer extends BaseSyncer {
  private trailsUrl = 'https://tpwd.texas.gov/server/rest/services/Parks/TexasStateParksTrails/MapServer/0';

  constructor() {
    super('TX', 'tpwd_arcgis');
  }

  async sync(): Promise<SyncResult> {
    console.log('[TX Trails] Starting Texas trails sync...');

    try {
      const trails = await this.fetchTrails();
      console.log(`[TX Trails] Fetched ${trails.length} trails`);

      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      
      // Group trails by park
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[TX Trails] Grouped into ${Object.keys(trailsByPark).length} parks`);

      // Upload to S3
      await this.uploadTrailData(trailsByPark);

      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[TX Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[TX Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch TX trails: ${response.status}`);
      }

      const data = await response.json() as ArcGISResponse;
      
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
      } else {
        hasMore = false;
      }

      // Rate limiting
      await this.sleep(500);
    }

    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    
    // Extract coordinates from geometry
    let startCoords: { latitude: number; longitude: number } | undefined;
    
    if (feature.geometry?.paths && feature.geometry.paths.length > 0) {
      const path = feature.geometry.paths[0];
      if (path.length > 0) {
        startCoords = { longitude: path[0][0], latitude: path[0][1] };
      }
    }

    const name = attrs.TrailName || attrs.TRAIL_NAME || attrs.Name || 'Unknown Trail';
    const parkName = attrs.ParkName || attrs.PARK_NAME || attrs.Park;

    // Parse trail type from Texas data
    const trailType = attrs.TrailUse || attrs.TRAIL_USE || attrs.UseType;
    const allowedUses = this.parseTrailUses(trailType);

    return {
      id: `tx-trail-${attrs.OBJECTID || attrs.FID || Math.random().toString(36).substr(2, 9)}`,
      name: name,
      parkName: parkName,
      parkId: parkName ? this.createTrailParkId(parkName) : undefined,
      lengthMiles: attrs.Miles || attrs.LENGTH_MILES || attrs.Shape_Length ? attrs.Shape_Length / 1609.34 : undefined,
      difficulty: attrs.Difficulty || this.inferDifficulty(attrs),
      trailType: trailType,
      surface: attrs.Surface || attrs.SURFACE,
      allowedUses: allowedUses,
      coordinates: startCoords ? { start: startCoords } : undefined,
      description: attrs.Description || attrs.COMMENTS,
      googleMapsUrl: startCoords 
        ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}`
        : undefined,
      dataSource: 'Texas Parks and Wildlife GIS',
    };
  }

  private parseTrailUses(trailType: string | undefined): string[] {
    if (!trailType) return [];
    
    const uses: string[] = [];
    const typeLower = trailType.toLowerCase();
    
    if (typeLower.includes('hik')) uses.push('hiking');
    if (typeLower.includes('bik') || typeLower.includes('cycling')) uses.push('biking');
    if (typeLower.includes('equestrian') || typeLower.includes('horse')) uses.push('equestrian');
    if (typeLower.includes('paddle') || typeLower.includes('kayak')) uses.push('paddling');
    if (typeLower.includes('ohv') || typeLower.includes('off highway')) uses.push('ohv');
    if (typeLower.includes('multi')) {
      uses.push('hiking', 'biking');
    }
    
    return [...new Set(uses)];
  }

  private inferDifficulty(attrs: Record<string, any>): string | undefined {
    // Try to infer difficulty from length or other attributes
    const miles = attrs.Miles || attrs.LENGTH_MILES;
    if (miles) {
      if (miles < 2) return 'easy';
      if (miles < 5) return 'moderate';
      return 'difficult';
    }
    return undefined;
  }

  private createTrailParkId(parkName: string): string {
    return parkName
      .toLowerCase()
      .replace(/\s*(state\s*park|state\s*natural\s*area|state\s*historic\s*site)\s*/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};

    for (const trail of trails) {
      const parkId = trail.parkId || 'unknown';
      const parkName = trail.parkName || 'Unknown Park';

      if (!grouped[parkId]) {
        grouped[parkId] = { parkName, trails: [] };
      }
      grouped[parkId].trails.push(trail);
    }

    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'TX',
      stateName: 'Texas',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };

    console.log(`[TX Trails] Uploading ${trailsData.totalTrails} trails for ${trailsData.totalParks} parks`);
    
    // Upload to S3
    await uploadJson(`trails/state-parks/TX/trails.json`, trailsData);
    
    this.parksProcessed = trailsData.totalTrails;
  }

}

/**
 * Colorado Trail Syncer
 * Fetches trail data from COTREX (Colorado Trail Explorer) via public ArcGIS FeatureServer
 * Data source: Colorado Geospatial Portal - no API key required
 */
export class ColoradoTrailSyncer extends BaseSyncer {
  // COTREX public ArcGIS endpoint - Layer 2 is the actual trails (polylines)
  private trailsUrl = 'https://services3.arcgis.com/0jWpHMuhmHsukKE3/arcgis/rest/services/CPW_Trails_08222024/FeatureServer/2';

  constructor() {
    super('CO', 'cotrex');
  }

  async sync(): Promise<SyncResult> {
    console.log('[CO Trails] Starting Colorado COTREX trails sync...');

    try {
      const trails = await this.fetchTrails();
      console.log(`[CO Trails] Fetched ${trails.length} trails`);

      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      
      // Group trails by managing agency/park
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[CO Trails] Grouped into ${Object.keys(trailsByPark).length} areas`);

      // Upload to S3
      await this.uploadTrailData(trailsByPark);

      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[CO Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 2000; // COTREX has ~40k trails, fetch in larger batches
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[CO Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch CO trails: ${response.status}`);
      }

      const data = await response.json() as ArcGISResponse;
      
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
        
        // Log progress every 10k
        if (allFeatures.length % 10000 === 0) {
          console.log(`[CO Trails] Progress: ${allFeatures.length} trails fetched...`);
        }
      } else {
        hasMore = false;
      }

      // Rate limiting
      await this.sleep(300);
    }

    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    
    // Extract coordinates from geometry (COTREX uses paths for polylines)
    let startCoords: { latitude: number; longitude: number } | undefined;
    
    if (feature.geometry?.paths && feature.geometry.paths.length > 0) {
      const path = feature.geometry.paths[0];
      if (path.length > 0) {
        startCoords = { longitude: path[0][0], latitude: path[0][1] };
      }
    }

    // COTREX Layer 2 field mapping
    const name = (attrs.name && attrs.name.trim()) || 'Unknown Trail';
    
    // Try to identify park from name patterns or use generic grouping
    const parkName = this.inferParkFromTrailName(name) || 'Colorado Trails';

    // Parse allowed uses from COTREX Layer 2 fields
    const allowedUses = this.parseAllowedUses(attrs);

    // Calculate length in miles from Shape__Length (meters)
    const lengthMeters = attrs.Shape__Length || 0;
    const lengthMiles = lengthMeters > 0 ? lengthMeters / 1609.34 : undefined;

    return {
      id: `co-trail-${attrs.FID || Math.random().toString(36).substr(2, 9)}`,
      name: name,
      parkName: parkName,
      parkId: this.createTrailParkId(parkName),
      lengthMiles: lengthMiles,
      difficulty: this.inferDifficultyFromLength(lengthMiles),
      trailType: attrs.type || undefined,
      surface: attrs.surface || undefined,
      allowedUses: allowedUses,
      coordinates: startCoords ? { start: startCoords } : undefined,
      description: undefined,
      googleMapsUrl: startCoords 
        ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}`
        : undefined,
      dataSource: 'COTREX - Colorado Trail Explorer',
    };
  }

  private inferParkFromTrailName(trailName: string): string | undefined {
    // Map common Colorado State Park trail patterns to park names
    const parkPatterns: Record<string, string[]> = {
      'Roxborough State Park': ['roxborough'],
      'Castlewood Canyon State Park': ['castlewood'],
      'Golden Gate Canyon State Park': ['golden gate'],
      'Staunton State Park': ['staunton'],
      'Cheyenne Mountain State Park': ['cheyenne mountain'],
      'Mueller State Park': ['mueller'],
      'Eldorado Canyon State Park': ['eldorado'],
      'Lory State Park': ['lory'],
      'State Forest State Park': ['state forest', 'never summer'],
      'Steamboat Lake State Park': ['steamboat lake'],
      'Pearl Lake State Park': ['pearl lake'],
      'Rifle Falls State Park': ['rifle falls'],
      'Rifle Gap State Park': ['rifle gap'],
      'Sylvan Lake State Park': ['sylvan lake'],
      'Vega State Park': ['vega'],
      'Paonia State Park': ['paonia'],
      'Crawford State Park': ['crawford'],
      'Ridgway State Park': ['ridgway'],
      'Navajo State Park': ['navajo'],
      'Mancos State Park': ['mancos'],
      'Trinidad Lake State Park': ['trinidad'],
      'Lathrop State Park': ['lathrop'],
      'San Luis State Park': ['san luis'],
      'Lake Pueblo State Park': ['lake pueblo', 'pueblo reservoir'],
      'Arkansas Headwaters Recreation Area': ['arkansas headwaters', 'brown\'s canyon'],
      'Cherry Creek State Park': ['cherry creek'],
      'Chatfield State Park': ['chatfield'],
      'Barr Lake State Park': ['barr lake'],
      'Boyd Lake State Park': ['boyd lake'],
      'Jackson Lake State Park': ['jackson lake'],
      'North Sterling State Park': ['north sterling'],
      'Bonny Lake State Park': ['bonny lake'],
      'Eleven Mile State Park': ['eleven mile'],
      'Spinney Mountain State Park': ['spinney mountain'],
    };

    const nameLower = trailName.toLowerCase();
    
    for (const [parkName, patterns] of Object.entries(parkPatterns)) {
      if (patterns.some(p => nameLower.includes(p))) {
        return parkName;
      }
    }
    
    return undefined;
  }

  private parseAllowedUses(attrs: Record<string, any>): string[] {
    const uses: string[] = [];
    
    // COTREX Layer 2 uses lowercase field names with 'yes'/'no' values
    if (attrs.hiking === 'yes') uses.push('hiking');
    if (attrs.bike === 'yes') uses.push('biking');
    if (attrs.horse === 'yes') uses.push('equestrian');
    if (attrs.motorcycle === 'yes') uses.push('motorcycle');
    if (attrs.atv === 'yes') uses.push('atv');
    if (attrs.ohv_gt_50 === 'yes') uses.push('ohv');
    if (attrs.snowmobile === 'yes') uses.push('snowmobile');
    if (attrs.snowshoe === 'yes') uses.push('snowshoe');
    if (attrs.xcski === 'yes') uses.push('skiing');
    
    return uses;
  }

  private inferDifficultyFromLength(miles: number | undefined): string | undefined {
    if (!miles) return undefined;
    if (miles < 2) return 'easy';
    if (miles < 5) return 'moderate';
    return 'difficult';
  }

  private createTrailParkId(parkName: string): string {
    return parkName
      .toLowerCase()
      .replace(/\s*(state\s*park|state\s*recreation\s*area|recreation\s*area)\s*/gi, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};

    for (const trail of trails) {
      const parkId = trail.parkId || 'colorado-trails';
      const parkName = trail.parkName || 'Colorado Trails';

      if (!grouped[parkId]) {
        grouped[parkId] = { parkName, trails: [] };
      }
      grouped[parkId].trails.push(trail);
    }

    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'CO',
      stateName: 'Colorado',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };

    console.log(`[CO Trails] Uploading ${trailsData.totalTrails} trails for ${trailsData.totalParks} areas`);
    
    // Upload to S3
    await uploadJson(`trails/state-parks/CO/trails.json`, trailsData);
    
    this.parksProcessed = trailsData.totalTrails;
  }
}

/**
 * Oregon Trail Syncer
 * Fetches trail data from Oregon State Parks ArcGIS
 */
export class OregonTrailSyncer extends BaseSyncer {
  private trailsUrl = 'https://maps.prd.state.or.us/arcgis/rest/services/Land_ownership/Oregon_State_Parks/FeatureServer/0';

  constructor() {
    super('OR', 'or_state_parks');
  }

  async sync(): Promise<SyncResult> {
    console.log('[OR Trails] Starting Oregon trails sync...');
    try {
      const trails = await this.fetchTrails();
      console.log(`[OR Trails] Fetched ${trails.length} trails`);
      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[OR Trails] Grouped into ${Object.keys(trailsByPark).length} parks`);
      await this.uploadTrailData(trailsByPark);
      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[OR Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[OR Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const data = await response.json() as ArcGISResponse;
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
      } else {
        hasMore = false;
      }
      await this.sleep(200);
    }
    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    let startCoords: { latitude: number; longitude: number } | undefined;
    if (feature.geometry?.paths?.[0]?.[0]) {
      startCoords = { longitude: feature.geometry.paths[0][0][0], latitude: feature.geometry.paths[0][0][1] };
    }
    const name = attrs.NAME || attrs.PARK_NAME || 'Unknown Trail';
    const parkName = attrs.PARK_NAME || 'Oregon Trails';
    return {
      id: `or-trail-${attrs.OBJECTID || attrs.FID || Math.random().toString(36).substr(2, 9)}`,
      name, parkName,
      parkId: this.createParkId(parkName),
      lengthMiles: attrs.Shape__Length ? attrs.Shape__Length / 1609.34 : undefined,
      difficulty: undefined,
      trailType: attrs.TYPE,
      surface: attrs.SURFACE,
      allowedUses: ['hiking'],
      coordinates: startCoords ? { start: startCoords } : undefined,
      googleMapsUrl: startCoords ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}` : undefined,
      dataSource: 'Oregon State Parks GIS',
    };
  }

  private createParkId(parkName: string): string {
    return parkName.toLowerCase().replace(/\s*(state\s*park|state\s*recreation\s*area)\s*/gi, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'oregon-trails';
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};
    for (const trail of trails) {
      const parkId = trail.parkId || 'oregon-trails';
      if (!grouped[parkId]) grouped[parkId] = { parkName: trail.parkName || 'Oregon Trails', trails: [] };
      grouped[parkId].trails.push(trail);
    }
    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'OR', stateName: 'Oregon',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };
    console.log(`[OR Trails] Uploading ${trailsData.totalTrails} trails`);
    await uploadJson(`trails/state-parks/OR/trails.json`, trailsData);
    this.parksProcessed = trailsData.totalTrails;
  }
}

/**
 * Arizona Trail Syncer
 * Fetches trail data from Arizona State Parks ArcGIS
 */
export class ArizonaTrailSyncer extends BaseSyncer {
  // AZ trails uses layer 3 (Statewide_Trais)
  private trailsUrl = 'https://services1.arcgis.com/UpxtrwRYNaXVpkGe/arcgis/rest/services/AZSPTrails/FeatureServer/3';

  constructor() {
    super('AZ', 'az_state_parks');
  }

  async sync(): Promise<SyncResult> {
    console.log('[AZ Trails] Starting Arizona trails sync...');
    try {
      const trails = await this.fetchTrails();
      console.log(`[AZ Trails] Fetched ${trails.length} trails`);
      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[AZ Trails] Grouped into ${Object.keys(trailsByPark).length} parks`);
      await this.uploadTrailData(trailsByPark);
      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[AZ Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[AZ Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const data = await response.json() as ArcGISResponse;
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
      } else {
        hasMore = false;
      }
      await this.sleep(200);
    }
    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    let startCoords: { latitude: number; longitude: number } | undefined;
    if (feature.geometry?.paths?.[0]?.[0]) {
      startCoords = { longitude: feature.geometry.paths[0][0][0], latitude: feature.geometry.paths[0][0][1] };
    }
    const name = attrs.TRAILNAME || attrs.NAME || attrs.Trail_Name || 'Unknown Trail';
    const parkName = attrs.PARKNAME || attrs.Park_Name || attrs.UNIT || 'Arizona Trails';
    return {
      id: `az-trail-${attrs.OBJECTID || attrs.FID || Math.random().toString(36).substr(2, 9)}`,
      name, parkName,
      parkId: this.createParkId(parkName),
      lengthMiles: attrs.MILES || attrs.LENGTH_MI || (attrs.Shape__Length ? attrs.Shape__Length / 1609.34 : undefined),
      difficulty: attrs.DIFFICULTY,
      trailType: attrs.TRAILTYPE || attrs.Trail_Type,
      surface: attrs.SURFACE,
      allowedUses: this.parseAllowedUses(attrs),
      coordinates: startCoords ? { start: startCoords } : undefined,
      googleMapsUrl: startCoords ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}` : undefined,
      dataSource: 'Arizona State Parks and Trails',
    };
  }

  private parseAllowedUses(attrs: Record<string, any>): string[] {
    const uses: string[] = [];
    if (attrs.HIKING === 'Yes' || attrs.Hiking === 'Yes') uses.push('hiking');
    if (attrs.BIKING === 'Yes' || attrs.Biking === 'Yes') uses.push('biking');
    if (attrs.EQUESTRIAN === 'Yes' || attrs.Equestrian === 'Yes') uses.push('equestrian');
    return uses.length > 0 ? uses : ['hiking'];
  }

  private createParkId(parkName: string): string {
    return parkName.toLowerCase().replace(/\s*(state\s*park|state\s*historic\s*park)\s*/gi, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'arizona-trails';
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};
    for (const trail of trails) {
      const parkId = trail.parkId || 'arizona-trails';
      if (!grouped[parkId]) grouped[parkId] = { parkName: trail.parkName || 'Arizona Trails', trails: [] };
      grouped[parkId].trails.push(trail);
    }
    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'AZ', stateName: 'Arizona',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };
    console.log(`[AZ Trails] Uploading ${trailsData.totalTrails} trails`);
    await uploadJson(`trails/state-parks/AZ/trails.json`, trailsData);
    this.parksProcessed = trailsData.totalTrails;
  }
}

/**
 * Utah Trail Syncer
 * Fetches trail data from UGRC Utah Trails
 */
export class UtahTrailSyncer extends BaseSyncer {
  // Utah UGRC TrailsAndPathways dataset
  private trailsUrl = 'https://services1.arcgis.com/99lidPhWCzftIe9K/arcgis/rest/services/TrailsAndPathways/FeatureServer/0';

  constructor() {
    super('UT', 'utah_trails');
  }

  async sync(): Promise<SyncResult> {
    console.log('[UT Trails] Starting Utah trails sync...');
    try {
      const trails = await this.fetchTrails();
      console.log(`[UT Trails] Fetched ${trails.length} trails`);
      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[UT Trails] Grouped into ${Object.keys(trailsByPark).length} areas`);
      await this.uploadTrailData(trailsByPark);
      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[UT Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 2000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[UT Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const data = await response.json() as ArcGISResponse;
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
        if (allFeatures.length % 10000 === 0) console.log(`[UT Trails] Progress: ${allFeatures.length} trails...`);
      } else {
        hasMore = false;
      }
      await this.sleep(200);
    }
    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    let startCoords: { latitude: number; longitude: number } | undefined;
    if (feature.geometry?.paths?.[0]?.[0]) {
      startCoords = { longitude: feature.geometry.paths[0][0][0], latitude: feature.geometry.paths[0][0][1] };
    }
    const name = attrs.PrimaryName || attrs.NAME || attrs.TrailName || 'Unknown Trail';
    const parkName = attrs.Manager || attrs.Steward || 'Utah Trails';
    return {
      id: `ut-trail-${attrs.OBJECTID || attrs.FID || Math.random().toString(36).substr(2, 9)}`,
      name, parkName,
      parkId: this.createParkId(parkName),
      lengthMiles: attrs.Miles || attrs.LENGTH || (attrs.Shape__Length ? attrs.Shape__Length / 1609.34 : undefined),
      difficulty: attrs.Difficulty,
      trailType: attrs.TrailType || attrs.SurfaceType,
      surface: attrs.SurfaceType || attrs.Surface,
      allowedUses: this.parseAllowedUses(attrs),
      coordinates: startCoords ? { start: startCoords } : undefined,
      googleMapsUrl: startCoords ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}` : undefined,
      dataSource: 'UGRC Utah Trails and Pathways',
    };
  }

  private parseAllowedUses(attrs: Record<string, any>): string[] {
    const uses: string[] = [];
    if (attrs.Hike === 'Yes' || attrs.HIKE === 1) uses.push('hiking');
    if (attrs.Bike === 'Yes' || attrs.BIKE === 1) uses.push('biking');
    if (attrs.Horse === 'Yes' || attrs.HORSE === 1) uses.push('equestrian');
    if (attrs.ATV === 'Yes' || attrs.OHV === 'Yes') uses.push('atv');
    return uses.length > 0 ? uses : ['hiking'];
  }

  private createParkId(parkName: string): string {
    return parkName.toLowerCase().replace(/\s*(state\s*park)\s*/gi, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'utah-trails';
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};
    for (const trail of trails) {
      const parkId = trail.parkId || 'utah-trails';
      if (!grouped[parkId]) grouped[parkId] = { parkName: trail.parkName || 'Utah Trails', trails: [] };
      grouped[parkId].trails.push(trail);
    }
    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'UT', stateName: 'Utah',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };
    console.log(`[UT Trails] Uploading ${trailsData.totalTrails} trails`);
    await uploadJson(`trails/state-parks/UT/trails.json`, trailsData);
    this.parksProcessed = trailsData.totalTrails;
  }
}

/**
 * Washington Trail Syncer
 * Fetches trail data from WA State GIS
 */
export class WashingtonTrailSyncer extends BaseSyncer {
  private trailsUrl = 'https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/WATrails2017_State/FeatureServer/0';

  constructor() {
    super('WA', 'wa_state_trails');
  }

  async sync(): Promise<SyncResult> {
    console.log('[WA Trails] Starting Washington trails sync...');
    try {
      const trails = await this.fetchTrails();
      console.log(`[WA Trails] Fetched ${trails.length} trails`);
      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[WA Trails] Grouped into ${Object.keys(trailsByPark).length} areas`);
      await this.uploadTrailData(trailsByPark);
      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[WA Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 2000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[WA Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const data = await response.json() as ArcGISResponse;
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
        if (allFeatures.length % 10000 === 0) console.log(`[WA Trails] Progress: ${allFeatures.length} trails...`);
      } else {
        hasMore = false;
      }
      await this.sleep(200);
    }
    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    let startCoords: { latitude: number; longitude: number } | undefined;
    if (feature.geometry?.paths?.[0]?.[0]) {
      startCoords = { longitude: feature.geometry.paths[0][0][0], latitude: feature.geometry.paths[0][0][1] };
    }
    const name = attrs.TR_NM || attrs.TR_ALT_NM || 'Unknown Trail';
    const parkName = attrs.MGMT_AGNCY || attrs.TR_SYS || 'Washington Trails';
    return {
      id: `wa-trail-${attrs.OBJECTID || Math.random().toString(36).substr(2, 9)}`,
      name, parkName,
      parkId: this.createParkId(parkName),
      lengthMiles: attrs.Shape__Length ? attrs.Shape__Length / 5280 : undefined,
      difficulty: attrs.DIFFICULTY,
      trailType: attrs.TR_CLASS,
      surface: attrs.SURFACE,
      allowedUses: this.parseAllowedUses(attrs),
      coordinates: startCoords ? { start: startCoords } : undefined,
      googleMapsUrl: startCoords ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}` : undefined,
      dataSource: 'Washington State Trails GIS',
    };
  }

  private parseAllowedUses(attrs: Record<string, any>): string[] {
    const uses: string[] = [];
    if (attrs.HIKE === 'Y' || attrs.HIKE === 'Yes') uses.push('hiking');
    if (attrs.BIKE === 'Y' || attrs.BIKE === 'Yes') uses.push('biking');
    if (attrs.HORSE === 'Y' || attrs.HORSE === 'Yes') uses.push('equestrian');
    if (attrs.ATV === 'Y' || attrs.ATV === 'Yes') uses.push('atv');
    if (attrs.SNOWMOBILE === 'Y') uses.push('snowmobile');
    return uses.length > 0 ? uses : ['hiking'];
  }

  private createParkId(parkName: string): string {
    return parkName.toLowerCase().replace(/\s*(state\s*park)\s*/gi, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'washington-trails';
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};
    for (const trail of trails) {
      const parkId = trail.parkId || 'washington-trails';
      if (!grouped[parkId]) grouped[parkId] = { parkName: trail.parkName || 'Washington Trails', trails: [] };
      grouped[parkId].trails.push(trail);
    }
    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'WA', stateName: 'Washington',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };
    console.log(`[WA Trails] Uploading ${trailsData.totalTrails} trails`);
    await uploadJson(`trails/state-parks/WA/trails.json`, trailsData);
    this.parksProcessed = trailsData.totalTrails;
  }
}

/**
 * Michigan Trail Syncer
 * Fetches trail data from Michigan DNR GIS
 */
export class MichiganTrailSyncer extends BaseSyncer {
  // Michigan DNR Trails layer (layer 13)
  private trailsUrl = 'https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/services/open_Trails/FeatureServer/13';

  constructor() {
    super('MI', 'mi_dnr_trails');
  }

  async sync(): Promise<SyncResult> {
    console.log('[MI Trails] Starting Michigan trails sync...');
    try {
      const trails = await this.fetchTrails();
      console.log(`[MI Trails] Fetched ${trails.length} trails`);
      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[MI Trails] Grouped into ${Object.keys(trailsByPark).length} areas`);
      await this.uploadTrailData(trailsByPark);
      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[MI Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 2000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[MI Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const data = await response.json() as ArcGISResponse;
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
        if (allFeatures.length % 10000 === 0) console.log(`[MI Trails] Progress: ${allFeatures.length} trails...`);
      } else {
        hasMore = false;
      }
      await this.sleep(200);
    }
    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    let startCoords: { latitude: number; longitude: number } | undefined;
    if (feature.geometry?.paths?.[0]?.[0]) {
      startCoords = { longitude: feature.geometry.paths[0][0][0], latitude: feature.geometry.paths[0][0][1] };
    }
    const name = attrs.Trail_Name || attrs.NAME || 'Unknown Trail';
    const parkName = attrs.PRD_DB || attrs.Unit_Name || 'Michigan Trails';
    return {
      id: `mi-trail-${attrs.OBJECTID || Math.random().toString(36).substr(2, 9)}`,
      name, parkName,
      parkId: this.createParkId(parkName),
      lengthMiles: attrs.Shape__Length ? attrs.Shape__Length / 1609.34 : undefined,
      difficulty: attrs.Difficulty,
      trailType: attrs.Trail_Type,
      surface: attrs.Surface,
      allowedUses: this.parseAllowedUses(attrs),
      coordinates: startCoords ? { start: startCoords } : undefined,
      googleMapsUrl: startCoords ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}` : undefined,
      dataSource: 'Michigan DNR Trails',
    };
  }

  private parseAllowedUses(attrs: Record<string, any>): string[] {
    const uses: string[] = [];
    if (attrs.Hiking === 1 || attrs.HIKING === 'Yes') uses.push('hiking');
    if (attrs.Biking === 1 || attrs.BIKING === 'Yes') uses.push('biking');
    if (attrs.Equestrian === 1 || attrs.HORSE === 'Yes') uses.push('equestrian');
    if (attrs.Snowmobile === 1) uses.push('snowmobile');
    if (attrs.ORV === 1 || attrs.ATV === 1) uses.push('atv');
    return uses.length > 0 ? uses : ['hiking'];
  }

  private createParkId(parkName: string): string {
    return parkName.toLowerCase().replace(/\s*(state\s*park|state\s*forest|recreation\s*area)\s*/gi, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'michigan-trails';
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};
    for (const trail of trails) {
      const parkId = trail.parkId || 'michigan-trails';
      if (!grouped[parkId]) grouped[parkId] = { parkName: trail.parkName || 'Michigan Trails', trails: [] };
      grouped[parkId].trails.push(trail);
    }
    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'MI', stateName: 'Michigan',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };
    console.log(`[MI Trails] Uploading ${trailsData.totalTrails} trails`);
    await uploadJson(`trails/state-parks/MI/trails.json`, trailsData);
    this.parksProcessed = trailsData.totalTrails;
  }
}

/**
 * Florida Trail Syncer
 * Fetches trail data from Florida Greenways and Trails System
 */
export class FloridaTrailSyncer extends BaseSyncer {
  private trailsUrl = 'https://services.arcgis.com/LBbVDC0hKPAnLRpO/arcgis/rest/services/Florida_Greenways_and_Trails_System___Existing_Trails/FeatureServer/0';

  constructor() {
    super('FL', 'fl_greenways_trails');
  }

  async sync(): Promise<SyncResult> {
    console.log('[FL Trails] Starting Florida trails sync...');
    try {
      const trails = await this.fetchTrails();
      console.log(`[FL Trails] Fetched ${trails.length} trails`);
      const normalizedTrails = trails.map(t => this.normalizeTrail(t));
      const trailsByPark = this.groupTrailsByPark(normalizedTrails);
      console.log(`[FL Trails] Grouped into ${Object.keys(trailsByPark).length} areas`);
      await this.uploadTrailData(trailsByPark);
      return this.getSyncResult();
    } catch (error: any) {
      this.errors.push(`Sync failed: ${error.message}`);
      console.error('[FL Trails] Sync failed:', error);
      return this.getSyncResult();
    }
  }

  private async fetchTrails(): Promise<ArcGISFeature[]> {
    const allFeatures: ArcGISFeature[] = [];
    let offset = 0;
    const limit = 2000;
    let hasMore = true;

    while (hasMore) {
      const queryParams = new URLSearchParams({
        where: '1=1',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        resultOffset: offset.toString(),
        resultRecordCount: limit.toString(),
        f: 'json',
      });

      const url = `${this.trailsUrl}/query?${queryParams}`;
      console.log(`[FL Trails] Fetching offset ${offset}...`);

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

      const data = await response.json() as ArcGISResponse;
      if (data.features && data.features.length > 0) {
        allFeatures.push(...data.features);
        offset += data.features.length;
        hasMore = data.exceededTransferLimit === true || data.features.length === limit;
      } else {
        hasMore = false;
      }
      await this.sleep(200);
    }
    return allFeatures;
  }

  private normalizeTrail(feature: ArcGISFeature): NormalizedTrail {
    const attrs = feature.attributes;
    let startCoords: { latitude: number; longitude: number } | undefined;
    if (feature.geometry?.paths?.[0]?.[0]) {
      startCoords = { longitude: feature.geometry.paths[0][0][0], latitude: feature.geometry.paths[0][0][1] };
    }
    const name = attrs.NAME || attrs.NAME2 || 'Unknown Trail';
    const parkName = attrs.MANAGER || attrs.COUNTY || 'Florida Trails';
    return {
      id: `fl-trail-${attrs.FID || attrs.OBJECTID || Math.random().toString(36).substr(2, 9)}`,
      name, parkName,
      parkId: this.createParkId(parkName),
      lengthMiles: attrs.Shape__Length ? attrs.Shape__Length / 1609.34 : (attrs.MILES || undefined),
      difficulty: undefined,
      trailType: attrs.TYPE,
      surface: attrs.SURFACE,
      allowedUses: this.parseAllowedUses(attrs),
      coordinates: startCoords ? { start: startCoords } : undefined,
      googleMapsUrl: startCoords ? `https://www.google.com/maps/search/?api=1&query=${startCoords.latitude},${startCoords.longitude}` : undefined,
      dataSource: 'Florida Greenways and Trails System',
    };
  }

  private parseAllowedUses(attrs: Record<string, any>): string[] {
    const uses: string[] = [];
    if (attrs.HIKING === 'Yes' || attrs.HIKING === 'Y') uses.push('hiking');
    if (attrs.BIKING === 'Yes' || attrs.BIKING === 'Y') uses.push('biking');
    if (attrs.EQUESTRIAN === 'Yes' || attrs.EQUESTRIAN === 'Y') uses.push('equestrian');
    if (attrs.SKATING === 'Yes' || attrs.SKATING === 'Y') uses.push('skating');
    if (attrs.PADDLING === 'Yes' || attrs.PADDLING === 'Y') uses.push('paddling');
    return uses.length > 0 ? uses : ['hiking'];
  }

  private createParkId(parkName: string): string {
    return parkName.toLowerCase().replace(/\s*(state\s*park|state\s*forest|county)\s*/gi, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'florida-trails';
  }

  private groupTrailsByPark(trails: NormalizedTrail[]): Record<string, { parkName: string; trails: NormalizedTrail[] }> {
    const grouped: Record<string, { parkName: string; trails: NormalizedTrail[] }> = {};
    for (const trail of trails) {
      const parkId = trail.parkId || 'florida-trails';
      if (!grouped[parkId]) grouped[parkId] = { parkName: trail.parkName || 'Florida Trails', trails: [] };
      grouped[parkId].trails.push(trail);
    }
    return grouped;
  }

  private async uploadTrailData(trailsByPark: Record<string, { parkName: string; trails: NormalizedTrail[] }>): Promise<void> {
    const trailsData = {
      stateCode: 'FL', stateName: 'Florida',
      lastSynced: new Date().toISOString(),
      totalTrails: Object.values(trailsByPark).reduce((sum, p) => sum + p.trails.length, 0),
      totalParks: Object.keys(trailsByPark).length,
      parks: trailsByPark,
    };
    console.log(`[FL Trails] Uploading ${trailsData.totalTrails} trails`);
    await uploadJson(`trails/state-parks/FL/trails.json`, trailsData);
    this.parksProcessed = trailsData.totalTrails;
  }
}

export { NormalizedTrail };
