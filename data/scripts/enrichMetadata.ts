/**
 * Metadata Enrichment Script
 *
 * Populates the new schema columns added in 002-schema-enhancements.sql.
 *
 * Phase 1: Computed fields (no API calls)
 *   - estimated_minutes from length_miles + difficulty
 *   - region from state_code
 *   - source_id extracted from trail/campground IDs
 *   - campground park_id matched by proximity to parks table
 *
 * Phase 2: RIDB campground detail enrichment
 *   - amenities, site_types, price, open_season, phone, pet_friendly
 *
 * Phase 3: OSM trail metadata enrichment
 *   - surface_type, elevation_gain_ft, pet_friendly, seasonal_access
 *
 * Usage:
 *   npx tsx data/scripts/enrichMetadata.ts all
 *   npx tsx data/scripts/enrichMetadata.ts phase1
 *   npx tsx data/scripts/enrichMetadata.ts phase2
 *   npx tsx data/scripts/enrichMetadata.ts phase3
 */

import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.app') ? { rejectUnauthorized: false } : false,
  max: 5,
});

const RIDB_API_KEY = process.env.RECREATION_GOV_API_KEY || '';
const RIDB_BASE = 'https://ridb.recreation.gov/api/v1';
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

// ============================================================================
// PHASE 1: COMPUTED FIELDS (no API calls)
// ============================================================================

const STATE_REGIONS: Record<string, string> = {
  // Pacific Northwest
  WA: 'Pacific Northwest', OR: 'Pacific Northwest',
  // West Coast
  CA: 'West Coast',
  // Mountain West
  MT: 'Mountain West', ID: 'Mountain West', WY: 'Mountain West',
  CO: 'Mountain West', UT: 'Mountain West', NV: 'Mountain West',
  // Southwest
  AZ: 'Southwest', NM: 'Southwest', TX: 'Southwest',
  // Great Plains
  ND: 'Great Plains', SD: 'Great Plains', NE: 'Great Plains',
  KS: 'Great Plains', OK: 'Great Plains',
  // Midwest
  MN: 'Midwest', WI: 'Midwest', IA: 'Midwest', MO: 'Midwest',
  IL: 'Midwest', IN: 'Midwest', MI: 'Midwest', OH: 'Midwest',
  // Appalachia
  WV: 'Appalachia', KY: 'Appalachia', TN: 'Appalachia',
  VA: 'Appalachia', NC: 'Appalachia',
  // Southeast
  GA: 'Southeast', SC: 'Southeast', AL: 'Southeast', MS: 'Southeast',
  FL: 'Southeast', LA: 'Southeast', AR: 'Southeast',
  // Mid-Atlantic
  PA: 'Mid-Atlantic', NJ: 'Mid-Atlantic', DE: 'Mid-Atlantic',
  MD: 'Mid-Atlantic', DC: 'Mid-Atlantic',
  // Northeast
  NY: 'Northeast', CT: 'Northeast', RI: 'Northeast', MA: 'Northeast',
  VT: 'Northeast', NH: 'Northeast', ME: 'Northeast',
  // Pacific Islands
  HI: 'Pacific Islands', AK: 'Alaska',
};

async function phase1ComputedFields(): Promise<void> {
  console.log('\n=== PHASE 1: Computed Fields ===\n');

  // 1a. Estimated duration from length + difficulty
  console.log('1a. Computing estimated_minutes from length_miles + difficulty...');
  // Base pace: 2 mph easy, 1.5 mph moderate, 1 mph hard, 0.75 mph expert
  const durationResult = await pool.query(`
    UPDATE trails SET estimated_minutes = CASE
      WHEN difficulty = 'easy' THEN ROUND(length_miles / 2.0 * 60)
      WHEN difficulty = 'moderate' THEN ROUND(length_miles / 1.5 * 60)
      WHEN difficulty = 'hard' THEN ROUND(length_miles / 1.0 * 60)
      WHEN difficulty = 'expert' THEN ROUND(length_miles / 0.75 * 60)
      ELSE ROUND(length_miles / 1.5 * 60)
    END
    WHERE length_miles IS NOT NULL AND length_miles > 0 AND estimated_minutes IS NULL
  `);
  console.log(`  Updated ${durationResult.rowCount} trails with estimated_minutes`);

  // 1b. Region from state_code on parks
  console.log('1b. Setting region on parks from state_code...');
  for (const [stateCode, region] of Object.entries(STATE_REGIONS)) {
    await pool.query(`UPDATE parks SET region = $1 WHERE state_code = $2 AND region IS NULL`, [region, stateCode]);
  }
  const regionCount = await pool.query(`SELECT count(*) FROM parks WHERE region IS NOT NULL`);
  console.log(`  ${regionCount.rows[0].count} parks now have region`);

  // 1c. Extract source_id from trail IDs
  console.log('1c. Extracting source_id from trail IDs...');
  // OSM trails: id pattern is "{state}-osm-{osmId}" — extract numeric OSM ID
  const osmSourceResult = await pool.query(`
    UPDATE trails SET source_id = regexp_replace(id, '^[a-z]+-osm-', '')
    WHERE data_source = 'openstreetmap' AND source_id IS NULL AND id ~ '^[a-z]+-osm-'
  `);
  console.log(`  Updated ${osmSourceResult.rowCount} OSM trails with source_id`);

  // All other trails: use full ID as source_id (slug-based IDs)
  const otherSourceResult = await pool.query(`
    UPDATE trails SET source_id = id
    WHERE data_source != 'openstreetmap' AND source_id IS NULL
  `);
  console.log(`  Updated ${otherSourceResult.rowCount} non-OSM trails with source_id`);

  // RIDB campgrounds: id pattern is "ridb-{facilityId}" — extract numeric facility ID
  const ridbSourceResult = await pool.query(`
    UPDATE campgrounds SET source_id = regexp_replace(id, '^ridb-', '')
    WHERE data_source = 'recreation.gov' AND source_id IS NULL AND id ~ '^ridb-'
  `);
  console.log(`  Updated ${ridbSourceResult.rowCount} RIDB campgrounds with source_id`);

  // Non-RIDB campgrounds: use full ID as source_id
  const otherCampResult = await pool.query(`
    UPDATE campgrounds SET source_id = id
    WHERE data_source != 'recreation.gov' AND source_id IS NULL
  `);
  console.log(`  Updated ${otherCampResult.rowCount} non-RIDB campgrounds with source_id`);

  // 1d. Link campgrounds to nearest park within 25 miles
  console.log('1d. Linking campgrounds to nearest park...');
  const linkResult = await pool.query(`
    UPDATE campgrounds c SET park_id = (
      SELECT p.id FROM parks p
      WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND earth_distance(ll_to_earth(c.latitude, c.longitude), ll_to_earth(p.latitude, p.longitude)) <= 40234
      ORDER BY earth_distance(ll_to_earth(c.latitude, c.longitude), ll_to_earth(p.latitude, p.longitude))
      LIMIT 1
    )
    WHERE c.latitude IS NOT NULL AND c.longitude IS NOT NULL AND c.park_id IS NULL
  `);
  console.log(`  Linked ${linkResult.rowCount} campgrounds to nearest park`);

  console.log('\nPhase 1 complete.');
}

// ============================================================================
// PHASE 2: RIDB CAMPGROUND ENRICHMENT
// ============================================================================

interface RIDBFacilityDetail {
  FacilityID: string;
  FacilityPhone: string;
  FacilityDescription: string;
  FacilityTypeDescription: string;
  Reservable: boolean;
  Enabled: boolean;
  FACILITYADDRESS?: Array<{ FacilityStreetAddress1: string; City: string; PostalCode: string; AddressStateCode: string }>;
  ACTIVITY?: Array<{ ActivityName: string }>;
  CAMPSITE?: Array<{
    CampsiteType: string;
    CampsiteName: string;
    Attributes?: Array<{ AttributeName: string; AttributeValue: string }>;
  }>;
  PERMITENTRANCE?: Array<{
    PermitEntranceType: string;
    PermitEntranceFee: number;
    PermitEntranceDescription: string;
  }>;
}

async function phase2RIDBEnrichment(): Promise<void> {
  console.log('\n=== PHASE 2: RIDB Campground Enrichment ===\n');

  if (!RIDB_API_KEY) {
    console.log('  No RECREATION_GOV_API_KEY set, skipping Phase 2');
    return;
  }

  // Get all RIDB campgrounds that need enrichment
  const { rows: campgrounds } = await pool.query(`
    SELECT id, source_id, name FROM campgrounds
    WHERE data_source = 'recreation.gov' AND source_id IS NOT NULL AND amenities IS NULL
    ORDER BY id
  `);

  console.log(`Found ${campgrounds.length} RIDB campgrounds to enrich`);

  let enriched = 0;
  let errors = 0;

  for (let i = 0; i < campgrounds.length; i++) {
    const cg = campgrounds[i];
    try {
      // Fetch facility detail
      const resp = await fetch(`${RIDB_BASE}/facilities/${cg.source_id}`, {
        headers: { 'apikey': RIDB_API_KEY, 'Accept': 'application/json' },
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          console.log(`  Rate limited at ${i}, waiting 10s...`);
          await sleep(10000);
          i--; // retry
          continue;
        }
        errors++;
        continue;
      }

      const detail = await resp.json() as RIDBFacilityDetail;

      // Extract phone
      const phone = detail.FacilityPhone || null;

      // Fetch campsites for site types and amenities
      let siteTypes: string[] = [];
      let amenities: string[] = [];
      let petFriendly: boolean | null = null;
      let priceMin: number | null = null;
      let priceMax: number | null = null;

      try {
        const sitesResp = await fetch(`${RIDB_BASE}/facilities/${cg.source_id}/campsites?limit=50`, {
          headers: { 'apikey': RIDB_API_KEY, 'Accept': 'application/json' },
        });
        if (sitesResp.ok) {
          const sitesData = await sitesResp.json();
          const sites = sitesData.RECDATA || [];

          // Collect unique site types
          const typeSet = new Set<string>();
          for (const site of sites) {
            const t = site.CampsiteType?.toLowerCase() || '';
            if (t.includes('tent')) typeSet.add('tent');
            if (t.includes('rv') || t.includes('standard')) typeSet.add('rv');
            if (t.includes('cabin') || t.includes('yurt') || t.includes('shelter')) typeSet.add('cabin');
            if (t.includes('group')) typeSet.add('group');
            if (t.includes('equestrian') || t.includes('horse')) typeSet.add('equestrian');
            if (t.includes('boat')) typeSet.add('boat');

            // Check attributes for amenities and pets
            const attrs = site.ATTRIBUTES || site.ENTITYMEDIA || [];
            for (const attr of (Array.isArray(attrs) ? attrs : [])) {
              const name = (attr.AttributeName || '').toLowerCase();
              const val = (attr.AttributeValue || '').toLowerCase();
              if (name.includes('pets') && (val === 'yes' || val === 'y' || val === 'domestic')) petFriendly = true;
              if (name.includes('pets') && (val === 'no' || val === 'n')) petFriendly = petFriendly || false;
            }
          }
          siteTypes = Array.from(typeSet);
          if (siteTypes.length === 0 && sites.length > 0) siteTypes = ['tent']; // default
        }
      } catch (_) { /* campsites fetch optional */ }

      // Fetch fees/entrance for pricing
      try {
        const feesResp = await fetch(`${RIDB_BASE}/facilities/${cg.source_id}/permitentrances?limit=10`, {
          headers: { 'apikey': RIDB_API_KEY, 'Accept': 'application/json' },
        });
        if (feesResp.ok) {
          const feesData = await feesResp.json();
          const fees = feesData.RECDATA || [];
          const prices = fees
            .map((f: any) => parseFloat(f.PermitEntranceFee))
            .filter((p: number) => !isNaN(p) && p > 0);
          if (prices.length > 0) {
            priceMin = Math.min(...prices);
            priceMax = Math.max(...prices);
          }
        }
      } catch (_) { /* fees fetch optional */ }

      // Derive amenities from activities
      const amenitySet = new Set<string>();
      if (detail.ACTIVITY) {
        for (const a of detail.ACTIVITY) {
          const name = (a.ActivityName || '').toLowerCase();
          if (name.includes('fishing')) amenitySet.add('fishing');
          if (name.includes('swimming') || name.includes('water')) amenitySet.add('swimming');
          if (name.includes('hiking')) amenitySet.add('hiking');
          if (name.includes('biking') || name.includes('cycling')) amenitySet.add('biking');
          if (name.includes('horse') || name.includes('equestrian')) amenitySet.add('equestrian');
          if (name.includes('boat') || name.includes('kayak') || name.includes('canoe')) amenitySet.add('boating');
        }
      }

      // Check description for common amenity keywords
      const desc = (detail.FacilityDescription || '').toLowerCase();
      if (desc.includes('shower')) amenitySet.add('showers');
      if (desc.includes('flush toilet') || desc.includes('restroom')) amenitySet.add('flush_toilets');
      if (desc.includes('vault toilet') || desc.includes('pit toilet')) amenitySet.add('vault_toilets');
      if (desc.includes('potable water') || desc.includes('drinking water')) amenitySet.add('water');
      if (desc.includes('electric') || desc.includes('hookup')) amenitySet.add('electric');
      if (desc.includes('dump station') || desc.includes('rv dump')) amenitySet.add('dump_station');
      if (desc.includes('wifi') || desc.includes('internet')) amenitySet.add('wifi');
      if (desc.includes('camp store') || desc.includes('general store')) amenitySet.add('store');
      if (desc.includes('firewood') || desc.includes('fire ring') || desc.includes('campfire')) amenitySet.add('campfire');
      if (desc.includes('picnic')) amenitySet.add('picnic');
      if (desc.includes('playground')) amenitySet.add('playground');
      if (desc.includes('amphitheater') || desc.includes('ranger program')) amenitySet.add('ranger_programs');
      if (desc.includes('pet') || desc.includes('dog') || desc.includes('leash')) {
        if (desc.includes('no pet') || desc.includes('no dog') || desc.includes('pets not')) petFriendly = false;
        else petFriendly = true;
      }

      amenities = Array.from(amenitySet);

      // Determine open season from description
      let openSeason: string | null = null;
      if (desc.includes('year-round') || desc.includes('year round') || desc.includes('open all year')) {
        openSeason = 'year-round';
      } else if (desc.match(/open\s+(from\s+)?[a-z]+\s+(through|to|until|-)\s+[a-z]+/i)) {
        const m = desc.match(/open\s+(?:from\s+)?([a-z]+\s+(?:through|to|until|-)\s+[a-z]+)/i);
        if (m) openSeason = m[1].replace(/\s+/g, ' ').trim();
      } else if (desc.match(/(may|june|april|march)\s*(through|to|-)\s*(october|november|september)/i)) {
        const m = desc.match(/((?:may|june|april|march)\s*(?:through|to|-)\s*(?:october|november|september))/i);
        if (m) openSeason = m[1].trim();
      } else if (desc.includes('seasonal')) {
        openSeason = 'seasonal';
      }

      // Update campground
      await pool.query(`
        UPDATE campgrounds SET
          phone = COALESCE($2, phone),
          amenities = CASE WHEN $3::text[] != '{}' THEN $3::text[] ELSE amenities END,
          site_types = CASE WHEN $4::text[] != '{}' THEN $4::text[] ELSE site_types END,
          pet_friendly = COALESCE($5, pet_friendly),
          price_per_night_min = COALESCE($6, price_per_night_min),
          price_per_night_max = COALESCE($7, price_per_night_max),
          open_season = COALESCE($8, open_season),
          last_verified = NOW()
        WHERE id = $1
      `, [cg.id, phone, amenities, siteTypes, petFriendly, priceMin, priceMax, openSeason]);

      enriched++;
      if (enriched % 50 === 0) console.log(`  Enriched ${enriched}/${campgrounds.length} campgrounds...`);

      // RIDB rate limit: ~5 requests per campground, be gentle
      await sleep(300);

    } catch (e: any) {
      errors++;
      if (errors % 20 === 0) console.log(`  ${errors} errors so far (latest: ${e.message})`);
    }
  }

  console.log(`\nPhase 2 complete: ${enriched} enriched, ${errors} errors`);
}

// ============================================================================
// PHASE 3: OSM TRAIL METADATA ENRICHMENT
// ============================================================================

async function phase3OSMEnrichment(): Promise<void> {
  console.log('\n=== PHASE 3: OSM Trail Metadata Enrichment ===\n');

  // Get distinct state_codes that have OSM trails
  const { rows: states } = await pool.query(`
    SELECT DISTINCT state_code FROM trails
    WHERE data_source = 'openstreetmap' AND surface_type IS NULL
    ORDER BY state_code
  `);

  console.log(`Found ${states.length} states with OSM trails to enrich`);

  // Get bounding box per state from existing trail coordinates
  let totalUpdated = 0;

  for (const { state_code: stateCode } of states) {
    // Get all OSM trail IDs and their source_ids for this state
    const { rows: osmTrails } = await pool.query(`
      SELECT id, source_id FROM trails
      WHERE state_code = $1 AND data_source = 'openstreetmap' AND source_id IS NOT NULL
        AND surface_type IS NULL
    `, [stateCode]);

    if (!osmTrails.length) continue;

    // Get bounding box for this state's trails
    const { rows: bboxRows } = await pool.query(`
      SELECT MIN(latitude) as south, MAX(latitude) as north,
             MIN(longitude) as west, MAX(longitude) as east
      FROM trails WHERE state_code = $1 AND data_source = 'openstreetmap'
        AND latitude IS NOT NULL AND longitude IS NOT NULL
    `, [stateCode]);

    const bbox = bboxRows[0];
    if (!bbox.south) continue;

    // Split into grid cells to avoid Overpass timeouts
    const latStep = 0.5;
    const lngStep = 0.5;
    const osmIdMap = new Map(osmTrails.map(t => [t.source_id, t.id]));
    let stateUpdated = 0;

    for (let lat = bbox.south; lat < bbox.north; lat += latStep) {
      for (let lng = bbox.west; lng < bbox.east; lng += lngStep) {
        const cellSouth = lat;
        const cellNorth = Math.min(lat + latStep, bbox.north);
        const cellWest = lng;
        const cellEast = Math.min(lng + lngStep, bbox.east);
        const bboxStr = `${cellSouth},${cellWest},${cellNorth},${cellEast}`;

        try {
          // Query only for metadata tags on ways we care about
          const query = `[out:json][timeout:60];(way["highway"~"path|footway|track"]["name"](${bboxStr});relation["route"="hiking"]["name"](${bboxStr}););out tags;`;
          const resp = await fetch(OVERPASS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
          });

          if (resp.status === 429) {
            console.log(`  [OSM] Rate limited on ${stateCode} grid cell, waiting 30s...`);
            await sleep(30000);
            lng -= lngStep; // retry this cell
            continue;
          }
          if (resp.status === 504) {
            // Skip this cell, too dense
            continue;
          }
          if (!resp.ok) continue;

          const data = await resp.json();
          const elements = data.elements || [];

          // Build batch updates
          for (const el of elements) {
            const osmId = String(el.id);
            const trailId = osmIdMap.get(osmId);
            if (!trailId) continue;

            const tags = el.tags || {};
            const updates: string[] = [];
            const values: any[] = [trailId];
            let paramIdx = 2;

            // Surface type
            if (tags.surface) {
              const s = tags.surface.toLowerCase();
              let surface: string | null = null;
              if (['asphalt', 'paved', 'concrete', 'paving_stones'].includes(s)) surface = 'paved';
              else if (['gravel', 'fine_gravel', 'compacted', 'crushed_limestone'].includes(s)) surface = 'gravel';
              else if (['dirt', 'earth', 'ground', 'mud', 'sand', 'grass'].includes(s)) surface = 'dirt';
              else if (['rock', 'stone', 'pebblestone', 'scree'].includes(s)) surface = 'rock';
              else if (s === 'wood' || s === 'boardwalk') surface = 'boardwalk';
              else surface = 'mixed';
              if (surface) {
                updates.push(`surface_type = $${paramIdx}`);
                values.push(surface);
                paramIdx++;
              }
            }

            // Elevation gain
            if (tags.ele || tags['ele:gain']) {
              const eleStr = tags['ele:gain'] || tags.ele;
              const m = eleStr.match(/[\d.]+/);
              if (m) {
                let meters = parseFloat(m[0]);
                if (eleStr.includes('ft') || eleStr.includes("'")) {
                  // Already in feet
                  updates.push(`elevation_gain_ft = $${paramIdx}`);
                  values.push(Math.round(meters));
                } else {
                  // Convert meters to feet
                  updates.push(`elevation_gain_ft = $${paramIdx}`);
                  values.push(Math.round(meters * 3.28084));
                }
                paramIdx++;
              }
            }

            // Pet friendly
            if (tags.dog) {
              const d = tags.dog.toLowerCase();
              updates.push(`pet_friendly = $${paramIdx}`);
              values.push(d === 'yes' || d === 'leashed');
              paramIdx++;
            }

            // Seasonal access
            if (tags.seasonal || tags.opening_hours) {
              let season: string | null = null;
              const val = (tags.seasonal || tags.opening_hours || '').toLowerCase();
              if (val === 'no' || val.includes('24/7') || val.includes('year')) season = 'year-round';
              else if (val === 'yes' || val.includes('seasonal')) season = 'seasonal';
              else if (val.includes('winter')) season = 'winter-only';
              else if (val.includes('summer')) season = 'summer-only';
              if (season) {
                updates.push(`seasonal_access = $${paramIdx}`);
                values.push(season);
                paramIdx++;
              }
            }

            if (updates.length > 0) {
              updates.push(`last_verified = NOW()`);
              await pool.query(`UPDATE trails SET ${updates.join(', ')} WHERE id = $1`, values);
              stateUpdated++;
            }
          }

          await sleep(1500); // Overpass rate limit
        } catch (e: any) {
          // Skip cell on error
        }
      }
    }

    totalUpdated += stateUpdated;
    console.log(`  [${stateCode}] Enriched ${stateUpdated} trails with OSM metadata`);
  }

  console.log(`\nPhase 3 complete: ${totalUpdated} trails enriched with OSM metadata`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const arg = process.argv[2] || 'all';

  console.log('='.repeat(60));
  console.log('TripAgent Metadata Enrichment');
  console.log('='.repeat(60));

  if (arg === 'all' || arg === 'phase1') {
    await phase1ComputedFields();
  }
  if (arg === 'all' || arg === 'phase2') {
    await phase2RIDBEnrichment();
  }
  if (arg === 'all' || arg === 'phase3') {
    await phase3OSMEnrichment();
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('ENRICHMENT SUMMARY');
  console.log('='.repeat(60));

  const { rows: trailStats } = await pool.query(`
    SELECT
      count(*) as total,
      count(estimated_minutes) as has_duration,
      count(surface_type) as has_surface,
      count(elevation_gain_ft) as has_elevation,
      count(pet_friendly) as has_pet,
      count(seasonal_access) as has_seasonal,
      count(source_id) as has_source_id
    FROM trails
  `);
  const t = trailStats[0];
  console.log(`\nTrails (${t.total} total):`);
  console.log(`  estimated_minutes: ${t.has_duration}`);
  console.log(`  surface_type:      ${t.has_surface}`);
  console.log(`  elevation_gain_ft: ${t.has_elevation}`);
  console.log(`  pet_friendly:      ${t.has_pet}`);
  console.log(`  seasonal_access:   ${t.has_seasonal}`);
  console.log(`  source_id:         ${t.has_source_id}`);

  const { rows: campStats } = await pool.query(`
    SELECT
      count(*) as total,
      count(amenities) as has_amenities,
      count(site_types) as has_site_types,
      count(price_per_night_min) as has_price,
      count(phone) as has_phone,
      count(pet_friendly) as has_pet,
      count(park_id) as has_park_id,
      count(open_season) as has_season
    FROM campgrounds
  `);
  const c = campStats[0];
  console.log(`\nCampgrounds (${c.total} total):`);
  console.log(`  amenities:    ${c.has_amenities}`);
  console.log(`  site_types:   ${c.has_site_types}`);
  console.log(`  price_range:  ${c.has_price}`);
  console.log(`  phone:        ${c.has_phone}`);
  console.log(`  pet_friendly: ${c.has_pet}`);
  console.log(`  park_id:      ${c.has_park_id}`);
  console.log(`  open_season:  ${c.has_season}`);

  const { rows: parkStats } = await pool.query(`
    SELECT count(*) as total, count(region) as has_region FROM parks
  `);
  console.log(`\nParks (${parkStats[0].total} total):`);
  console.log(`  region: ${parkStats[0].has_region}`);

  await pool.end();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
