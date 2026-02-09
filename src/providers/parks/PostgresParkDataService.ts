/**
 * PostgreSQL + earthdistance Park Data Service
 * 
 * Replaces S3 JSON file fetching with spatial database queries.
 * Uses cube + earthdistance extensions (available on Railway) for:
 *   - Distance queries via earth_distance(ll_to_earth(lat1,lng1), ll_to_earth(lat2,lng2))
 *   - Bounding box queries via lat/lng range filters
 *   - No full-file downloads — query only what you need
 *   - Proper indexing on state_code, difficulty, coordinates
 *   - Connection pooling via pg Pool
 */

import { Pool, PoolClient } from 'pg';
import { TrailData } from './S3ParkDataService.js';

// Re-export TrailData so consumers don't need to import from S3 service
export type { TrailData } from './S3ParkDataService.js';

interface ParkSummary {
  id: string;
  name: string;
  parkCode?: string;
  stateCode: string;
  stateName: string;
  coordinates: { latitude: number; longitude: number };
  designation?: string;
  category?: 'national' | 'state' | 'local';
  parkType?: string;
  imageUrl?: string;
}

interface ParkDetails {
  id: string;
  name: string;
  category: 'national' | 'state' | 'local';
  parkType: string;
  stateCode: string;
  stateName: string;
  region?: string;
  description?: string;
  shortDescription?: string;
  designation?: string;
  highlights?: string[];
  coordinates: { latitude: number; longitude: number };
  acres?: number;
  timezone?: string;
  officialLinks?: Array<{ type: string; url: string; isPrimary?: boolean }>;
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    address?: { line1?: string; city?: string; state?: string; postalCode?: string };
  };
  operatingHours?: Record<string, string>;
  fees?: Array<{ title: string; cost: string; description?: string }>;
  climate?: { weatherDescription?: string };
  images?: Array<{ id: string; url: string; title?: string; caption?: string; credit?: string; isPrimary?: boolean }>;
  activities?: Array<{ id: string; name: string }>;
  trails?: Array<{ id: string; name: string; lengthMiles?: number; difficulty?: string }>;
  campgrounds?: Array<{ id: string; name: string; totalSites?: number }>;
  quickLinks?: { officialWebsite?: string; reservations?: string; map?: string; directions?: string };
  keywords?: string[];
}

// Simple TTL cache: { value, expiresAt }
interface CacheEntry<T> { value: T; expiresAt: number; }

class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) { this.cache.delete(key); return undefined; }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    // Evict expired entries periodically
    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.cache) { if (now > v.expiresAt) this.cache.delete(k); }
    }
  }
}

export class PostgresParkDataService {
  private pool: Pool;
  private parkCache = new TTLCache<ParkDetails | null>(30 * 60 * 1000);     // 30 min
  private searchCache = new TTLCache<ParkSummary[]>(15 * 60 * 1000);        // 15 min
  private trailCache = new TTLCache<TrailData[]>(15 * 60 * 1000);           // 15 min
  private stateCache = new TTLCache<{ national: ParkSummary[]; state: ParkSummary[] }>(30 * 60 * 1000); // 30 min
  private statsCache = new TTLCache<any>(30 * 60 * 1000);                   // 30 min

  constructor() {
    const connStr = process.env.DATABASE_URL;
    const useSSL = connStr?.includes('railway.app') 
      ? { rejectUnauthorized: false } 
      : false;
    
    this.pool = new Pool({
      connectionString: connStr,
      ssl: useSSL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  // ============================================
  // PARK QUERIES
  // ============================================

  async getParkById(parkId: string): Promise<ParkDetails | null> {
    const cached = this.parkCache.get(parkId);
    if (cached !== undefined) return cached;

    const { rows } = await this.pool.query(`
      SELECT p.*,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', pi.id, 'url', pi.url, 'title', pi.title,
            'caption', pi.caption, 'credit', pi.credit, 'isPrimary', pi.is_primary))
          FILTER (WHERE pi.id IS NOT NULL), '[]'
        ) as images,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('title', pf.title, 'cost', pf.cost, 'description', pf.description))
          FILTER (WHERE pf.id IS NOT NULL), '[]'
        ) as fees,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('id', pa.activity_id, 'name', pa.name))
          FILTER (WHERE pa.id IS NOT NULL), '[]'
        ) as activities
      FROM parks p
      LEFT JOIN park_images pi ON p.id = pi.park_id
      LEFT JOIN park_fees pf ON p.id = pf.park_id
      LEFT JOIN park_activities pa ON p.id = pa.park_id
      WHERE p.id = $1
      GROUP BY p.id
    `, [parkId]);

    if (rows.length === 0) { this.parkCache.set(parkId, null); return null; }
    const result = this.rowToParkDetails(rows[0]);
    this.parkCache.set(parkId, result);
    return result;
  }

  async getParkByCode(parkCode: string): Promise<ParkDetails | null> {
    return this.getParkById(`np-${parkCode.toLowerCase()}`);
  }

  async searchParks(query: string, options?: {
    category?: 'national' | 'state' | 'all';
    stateCode?: string;
    limit?: number;
  }): Promise<ParkSummary[]> {
    const { category = 'all', stateCode, limit = 10 } = options || {};
    const cacheKey = `${query}|${category}|${stateCode || ''}|${limit}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;
    const params: any[] = [`%${query}%`];
    let whereClause = `WHERE (p.name ILIKE $1 OR p.park_code = $${params.length + 1})`;
    params.push(query.toLowerCase());

    if (category !== 'all') {
      params.push(category);
      whereClause += ` AND p.category = $${params.length}`;
    }
    if (stateCode) {
      params.push(stateCode.toUpperCase());
      whereClause += ` AND p.state_code = $${params.length}`;
    }

    params.push(limit);
    const { rows } = await this.pool.query(`
      SELECT p.id, p.name, p.park_code, p.state_code, p.state_name, p.category,
        p.park_type, p.designation, p.latitude, p.longitude, p.image_url,
        similarity(p.name, $1) as sim
      FROM parks p
      ${whereClause}
      ORDER BY sim DESC, p.name
      LIMIT $${params.length}
    `, params);

    const results = rows.map(r => this.rowToParkSummary(r));
    this.searchCache.set(cacheKey, results);
    return results;
  }

  async getParksNearLocation(
    latitude: number, longitude: number, radiusMiles: number = 50,
    options?: { category?: 'national' | 'state' | 'all'; limit?: number }
  ): Promise<Array<ParkSummary & { distanceMiles: number }>> {
    const { category = 'all', limit = 10 } = options || {};
    const radiusMeters = radiusMiles * 1609.34;
    const params: any[] = [latitude, longitude, radiusMeters];

    let categoryFilter = '';
    if (category !== 'all') {
      params.push(category);
      categoryFilter = `AND p.category = $${params.length}`;
    }
    params.push(limit);

    const { rows } = await this.pool.query(`
      SELECT p.id, p.name, p.park_code, p.state_code, p.state_name, p.category,
        p.park_type, p.designation, p.latitude, p.longitude, p.image_url,
        earth_distance(ll_to_earth($1, $2), ll_to_earth(p.latitude, p.longitude)) / 1609.34 as distance_miles
      FROM parks p
      WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND earth_distance(ll_to_earth($1, $2), ll_to_earth(p.latitude, p.longitude)) <= $3
        ${categoryFilter}
      ORDER BY distance_miles
      LIMIT $${params.length}
    `, params);

    return rows.map(r => ({
      ...this.rowToParkSummary(r),
      distanceMiles: Math.round(r.distance_miles * 10) / 10,
    }));
  }

  async getParksInState(stateCode: string): Promise<{ national: ParkSummary[]; state: ParkSummary[] }> {
    const cached = this.stateCache.get(stateCode);
    if (cached) return cached;

    const { rows } = await this.pool.query(`
      SELECT id, name, park_code, state_code, state_name, category, park_type,
        designation, latitude, longitude, image_url
      FROM parks
      WHERE state_code = $1
      ORDER BY category, name
    `, [stateCode.toUpperCase()]);

    const result = {
      national: rows.filter(r => r.category === 'national').map(r => this.rowToParkSummary(r)),
      state: rows.filter(r => r.category === 'state').map(r => this.rowToParkSummary(r)),
    };
    this.stateCache.set(stateCode, result);
    return result;
  }

  async getStats(): Promise<{
    totalParks: number; nationalParks: number; stateParks: number;
    statesWithData: string[]; lastUpdated: string;
  } | null> {
    const cached = this.statsCache.get('stats');
    if (cached) return cached;

    const { rows } = await this.pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE category = 'national') as national,
        COUNT(*) FILTER (WHERE category = 'state') as state,
        array_agg(DISTINCT state_code ORDER BY state_code) as states,
        MAX(last_updated) as last_updated
      FROM parks
    `);
    if (rows.length === 0) return null;
    const result = {
      totalParks: parseInt(rows[0].total),
      nationalParks: parseInt(rows[0].national),
      stateParks: parseInt(rows[0].state),
      statesWithData: rows[0].states || [],
      lastUpdated: rows[0].last_updated?.toISOString() || new Date().toISOString(),
    };
    this.statsCache.set('stats', result);
    return result;
  }

  async buildParkContext(parkId: string): Promise<string | null> {
    const park = await this.getParkById(parkId);
    if (!park) return null;

    const lines: string[] = [
      `## ${park.name}`,
      `**Category:** ${park.category === 'national' ? 'National Park Service' : 'State Park'}`,
      `**Type:** ${park.designation || park.parkType}`,
      `**Location:** ${park.stateName} (${park.stateCode})`,
    ];

    if (park.coordinates.latitude && park.coordinates.longitude) {
      lines.push(`**Coordinates:** ${park.coordinates.latitude}, ${park.coordinates.longitude}`);
    }
    if (park.description) lines.push('', `**Description:** ${park.description}`);
    if (park.highlights?.length) lines.push('', `**Highlights:** ${park.highlights.join(', ')}`);
    if (park.quickLinks?.officialWebsite) lines.push('', `**Official Website:** ${park.quickLinks.officialWebsite}`);
    if (park.quickLinks?.reservations) lines.push(`**Reservations:** ${park.quickLinks.reservations}`);
    if (park.fees?.length) {
      lines.push('', '**Entrance Fees:**');
      park.fees.slice(0, 3).forEach(fee => lines.push(`- ${fee.title}: $${fee.cost}`));
    }
    if (park.activities?.length) {
      lines.push('', `**Activities:** ${park.activities.slice(0, 10).map(a => a.name).join(', ')}`);
    }
    if (park.climate?.weatherDescription) {
      lines.push('', `**Weather:** ${park.climate.weatherDescription.slice(0, 200)}...`);
    }
    return lines.join('\n');
  }

  // ============================================
  // TRAIL QUERIES
  // ============================================

  async getTrailsForPark(parkCode: string): Promise<TrailData[]> {
    const cached = this.trailCache.get(`park:${parkCode}`);
    if (cached) return cached;

    const { rows } = await this.pool.query(`
      SELECT t.*, p.name as resolved_park_name
      FROM trails t
      LEFT JOIN parks p ON t.park_id = p.id
      WHERE t.park_id = $1 OR t.park_id = $2
      ORDER BY t.name
    `, [`np-${parkCode.toLowerCase()}`, parkCode.toLowerCase()]);

    const result = rows.map(r => ({
      name: r.name,
      description: r.description,
      length: r.length_miles ? `${r.length_miles} miles` : undefined,
      difficulty: r.difficulty,
      type: r.trail_type,
      trailUrl: r.official_url || r.alltrails_url || r.google_maps_url,
      alltrailsUrl: r.alltrails_url,
      npsUrl: r.official_url,
      googleMapsUrl: r.google_maps_url,
      parkCode: parkCode.toLowerCase(),
      parkName: r.resolved_park_name || r.park_name,
      source: r.data_source || 'TripAgent Database',
    }));
    this.trailCache.set(`park:${parkCode}`, result);
    return result;
  }

  async getTrailsForStatePark(stateCode: string, parkId: string): Promise<TrailData[]> {
    const { rows } = await this.pool.query(`
      SELECT * FROM trails
      WHERE state_code = $1 AND park_id = $2
      ORDER BY name
    `, [stateCode.toUpperCase(), parkId]);

    return rows.map(r => this.rowToTrailData(r));
  }

  async getTrailsForMap(stateCode: string, parkId?: string, includeGeometry: boolean = false): Promise<{
    stateCode: string; totalTrails: number;
    trails: Array<{
      id: string; name: string; parkId: string; parkName: string;
      latitude: number; longitude: number; lengthMiles?: number;
      difficulty?: string; trailType?: string; googleMapsUrl?: string;
      allTrailsUrl?: string;
      geometry?: Array<{ latitude: number; longitude: number }>;
    }>;
  }> {
    const params: any[] = [stateCode.toUpperCase()];
    let parkFilter = '';
    if (parkId) {
      params.push(parkId);
      parkFilter = `AND park_id = $${params.length}`;
    }

    const geometrySelect = includeGeometry
      ? `, geometry_json as trail_geometry`
      : '';

    // Try with difficulty_source column; fall back without it if column doesn't exist yet
    let rows: any[];
    try {
      const res = await this.pool.query(`
        SELECT id, name, park_id, park_name, latitude, longitude,
          length_miles, difficulty, difficulty_source, trail_type, google_maps_url, alltrails_url
          ${geometrySelect}
        FROM trails
        WHERE state_code = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
          ${parkFilter}
      `, params);
      rows = res.rows;
    } catch (err: any) {
      if (err.message?.includes('difficulty_source')) {
        const res = await this.pool.query(`
          SELECT id, name, park_id, park_name, latitude, longitude,
            length_miles, difficulty, trail_type, google_maps_url, alltrails_url
            ${geometrySelect}
          FROM trails
          WHERE state_code = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
            ${parkFilter}
        `, params);
        rows = res.rows;
      } else {
        throw err;
      }
    }

    return {
      stateCode: stateCode.toUpperCase(),
      totalTrails: rows.length,
      trails: rows.map(r => ({
        id: r.id,
        name: r.name,
        parkId: r.park_id,
        parkName: r.park_name,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        lengthMiles: r.length_miles,
        difficulty: r.difficulty,
        difficultySource: r.difficulty_source || null,
        trailType: r.trail_type,
        googleMapsUrl: r.google_maps_url,
        allTrailsUrl: r.alltrails_url,
        ...(includeGeometry && r.trail_geometry ? { geometry: simplifyGeometryServer(r.trail_geometry, 12) } : {}),
      })),
    };
  }

  /**
   * Spatial trail query: find trails within a bounding box
   * This is the key improvement over S3 — no more loading entire state files
   */
  async getTrailsInBoundingBox(
    minLat: number, minLng: number, maxLat: number, maxLng: number,
    options?: { limit?: number; difficulty?: string }
  ): Promise<Array<{
    id: string; name: string; parkId: string; parkName: string;
    latitude: number; longitude: number; difficulty?: string;
    lengthMiles?: number;
  }>> {
    const { limit = 300, difficulty } = options || {};
    const params: any[] = [minLat, maxLat, minLng, maxLng];

    let diffFilter = '';
    if (difficulty) {
      params.push(difficulty);
      diffFilter = `AND difficulty = $${params.length}`;
    }
    params.push(limit);

    const { rows } = await this.pool.query(`
      SELECT id, name, park_id, park_name, latitude, longitude, difficulty, length_miles
      FROM trails
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND latitude BETWEEN $1 AND $2
        AND longitude BETWEEN $3 AND $4
        ${diffFilter}
      LIMIT $${params.length}
    `, params);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      parkId: r.park_id,
      parkName: r.park_name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      difficulty: r.difficulty,
      lengthMiles: r.length_miles,
    }));
  }

  async searchTrails(query: string, options?: { parkCode?: string; limit?: number }): Promise<TrailData[]> {
    const { parkCode, limit = 10 } = options || {};
    const params: any[] = [`%${query}%`];

    let parkFilter = '';
    if (parkCode) {
      params.push(parkCode.toLowerCase());
      parkFilter = `AND park_id = $${params.length}`;
    }
    params.push(limit);

    const { rows } = await this.pool.query(`
      SELECT * FROM trails
      WHERE name ILIKE $1 ${parkFilter}
      ORDER BY similarity(name, $1) DESC
      LIMIT $${params.length}
    `, params);

    return rows.map(r => this.rowToTrailData(r));
  }

  // ============================================
  // CAMPGROUND QUERIES
  // ============================================

  async getCampgroundsForMap(stateCode: string): Promise<{
    stateCode: string; totalCampgrounds: number;
    campgrounds: Array<{
      id: string; name: string; latitude: number; longitude: number;
      parkName?: string; totalSites?: number; reservationUrl?: string;
      googleMapsUrl?: string; description?: string;
    }>;
  }> {
    const { rows } = await this.pool.query(`
      SELECT id, name, latitude, longitude, park_name, total_sites,
        reservation_url, google_maps_url, description
      FROM campgrounds
      WHERE state_code = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
    `, [stateCode.toUpperCase()]);

    return {
      stateCode: stateCode.toUpperCase(),
      totalCampgrounds: rows.length,
      campgrounds: rows.map(r => ({
        id: r.id,
        name: r.name,
        latitude: parseFloat(r.latitude),
        longitude: parseFloat(r.longitude),
        parkName: r.park_name,
        totalSites: r.total_sites,
        reservationUrl: r.reservation_url,
        googleMapsUrl: r.google_maps_url,
        description: r.description,
      })),
    };
  }

  /**
   * Spatial campground query: find campgrounds near a point
   */
  async getCampgroundsNearLocation(
    latitude: number, longitude: number, radiusMiles: number = 50,
    limit: number = 20
  ): Promise<Array<{
    id: string; name: string; latitude: number; longitude: number;
    parkName?: string; reservationUrl?: string; distanceMiles: number;
  }>> {
    const radiusMeters = radiusMiles * 1609.34;
    const { rows } = await this.pool.query(`
      SELECT id, name, latitude, longitude, park_name, reservation_url,
        earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) / 1609.34 as distance_miles
      FROM campgrounds
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        AND earth_distance(ll_to_earth($1, $2), ll_to_earth(latitude, longitude)) <= $3
      ORDER BY distance_miles
      LIMIT $4
    `, [latitude, longitude, radiusMeters, limit]);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      latitude: parseFloat(r.latitude),
      longitude: parseFloat(r.longitude),
      parkName: r.park_name,
      reservationUrl: r.reservation_url,
      distanceMiles: Math.round(r.distance_miles * 10) / 10,
    }));
  }

  // ============================================
  // STATE TRAIL QUERIES
  // ============================================

  /**
   * Get state-wide trails (e.g. Wisconsin State Trails, Florida State Trails)
   * These are longer multi-use trails that span regions, stored with park_id like "wi-state-trails"
   */
  async getStateTrails(stateCode: string): Promise<TrailData[]> {
    const stateTrailsKey = `${stateCode.toLowerCase()}-state-trails`;
    const { rows } = await this.pool.query(`
      SELECT * FROM trails
      WHERE park_id = $1
      ORDER BY name
    `, [stateTrailsKey]);

    return rows.map(r => this.rowToTrailData(r));
  }

  /**
   * Get nearby state trails for a given state park.
   * Returns state-wide trails that pass near the given park (by checking nearbyParks in trail data).
   * Falls back to distance-based lookup using earthdistance.
   */
  async getNearbyStateTrails(stateCode: string, parkId: string): Promise<TrailData[]> {
    const stateTrailsKey = `${stateCode.toLowerCase()}-state-trails`;

    // First try: look for trails in the state-trails group that have geometry near the park
    // Get the park's coordinates
    const parkResult = await this.pool.query(`
      SELECT latitude, longitude FROM parks WHERE id = $1
    `, [parkId]);

    if (parkResult.rows.length > 0 && parkResult.rows[0].latitude && parkResult.rows[0].longitude) {
      const { latitude, longitude } = parkResult.rows[0];
      const radiusMeters = 80467; // 50 miles

      const { rows } = await this.pool.query(`
        SELECT * FROM trails
        WHERE park_id = $1
          AND latitude IS NOT NULL AND longitude IS NOT NULL
          AND earth_distance(ll_to_earth($2, $3), ll_to_earth(latitude, longitude)) <= $4
        ORDER BY earth_distance(ll_to_earth($2, $3), ll_to_earth(latitude, longitude))
      `, [stateTrailsKey, latitude, longitude, radiusMeters]);

      return rows.map(r => this.rowToTrailData(r));
    }

    return [];
  }

  // ============================================
  // HELPERS
  // ============================================

  private rowToParkSummary(r: any): ParkSummary {
    return {
      id: r.id,
      name: r.name,
      parkCode: r.park_code,
      stateCode: r.state_code,
      stateName: r.state_name,
      coordinates: { latitude: r.latitude, longitude: r.longitude },
      designation: r.designation,
      category: r.category,
      parkType: r.park_type,
      imageUrl: r.image_url,
    };
  }

  private rowToParkDetails(r: any): ParkDetails {
    return {
      id: r.id,
      name: r.name,
      category: r.category,
      parkType: r.park_type || '',
      stateCode: r.state_code,
      stateName: r.state_name,
      description: r.description,
      shortDescription: r.short_description,
      designation: r.designation,
      highlights: r.highlights,
      coordinates: { latitude: r.latitude, longitude: r.longitude },
      acres: r.acres,
      timezone: r.timezone,
      images: r.images?.filter((i: any) => i.id) || [],
      fees: r.fees?.filter((f: any) => f.title) || [],
      activities: r.activities?.filter((a: any) => a.id) || [],
      contact: {
        phone: r.phone,
        email: r.email,
        website: r.official_website,
        address: {
          line1: r.address_line1,
          city: r.address_city,
          state: r.address_state,
          postalCode: r.address_postal_code,
        },
      },
      climate: r.weather_description ? { weatherDescription: r.weather_description } : undefined,
      quickLinks: {
        officialWebsite: r.official_website,
        reservations: r.reservations_url,
        map: r.map_url,
        directions: r.directions_url,
      },
      keywords: r.keywords,
    };
  }

  private rowToTrailData(r: any): TrailData {
    return {
      name: r.name,
      description: r.description,
      length: r.length_miles ? `${r.length_miles} miles` : undefined,
      difficulty: r.difficulty,
      type: r.trail_type,
      trailUrl: r.official_url || r.alltrails_url || r.google_maps_url,
      alltrailsUrl: r.alltrails_url,
      googleMapsUrl: r.google_maps_url,
      parkCode: r.park_id,
      parkName: r.park_name,
      source: r.data_source,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Simplify geometry server-side to reduce payload size.
 * Keeps first point, last point, and evenly-spaced points in between.
 */
function simplifyGeometryServer(
  coords: Array<{ latitude: number; longitude: number }>,
  maxPoints: number
): Array<{ latitude: number; longitude: number }> {
  if (!Array.isArray(coords) || coords.length <= maxPoints) return coords;
  const step = (coords.length - 1) / (maxPoints - 1);
  const result: Array<{ latitude: number; longitude: number }> = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}
