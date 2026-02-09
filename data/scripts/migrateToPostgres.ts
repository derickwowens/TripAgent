/**
 * Migrate S3 Park Data to PostgreSQL + PostGIS
 * 
 * Reads all park, trail, and campground data from S3 and imports it into
 * a PostgreSQL database with PostGIS spatial indexes.
 * 
 * Prerequisites:
 *   1. Run data/schema/001-init.sql against your database first
 *   2. Set DATABASE_URL in your .env file
 * 
 * Usage: npx tsx data/scripts/migrateToPostgres.ts [--parks] [--trails] [--campgrounds] [--all]
 * Example: npx tsx data/scripts/migrateToPostgres.ts --all
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  console.error('Set it in your .env file, e.g.:');
  console.error('  DATABASE_URL=postgresql://user:pass@host:5432/dbname');
  process.exit(1);
}

const s3 = new S3Client({ region: S3_REGION });
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const BATCH_SIZE = 100;

// ============================================
// S3 HELPERS
// ============================================

async function fetchS3Json<T>(key: string): Promise<T | null> {
  try {
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    const body = await resp.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function listS3Prefixes(prefix: string): Promise<string[]> {
  const resp = await s3.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
    Delimiter: '/',
  }));
  return (resp.CommonPrefixes || []).map(p => p.Prefix!);
}

// ============================================
// PARK MIGRATION
// ============================================

async function migrateParks() {
  console.log('\n============================================================');
  console.log('Migrating Parks');
  console.log('============================================================');

  let totalParks = 0;

  // --- National Parks ---
  console.log('\n  Fetching national parks index...');
  const npIndex = await fetchS3Json<any>('national-parks/index.json');
  if (npIndex?.parks) {
    console.log(`  Found ${npIndex.parks.length} national parks in index`);
    
    for (let i = 0; i < npIndex.parks.length; i += BATCH_SIZE) {
      const batch = npIndex.parks.slice(i, i + BATCH_SIZE);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const park of batch) {
          // Fetch full park details
          const details = await fetchS3Json<any>(`national-parks/parks/${park.id}.json`);
          
          await client.query(`
            INSERT INTO parks (id, name, park_code, state_code, state_name, category, park_type,
              designation, description, short_description, highlights, latitude, longitude,
              acres, timezone, image_url, official_website, reservations_url, map_url,
              directions_url, phone, email, address_line1, address_city, address_state,
              address_postal_code, weather_description, keywords, data_source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
            ON CONFLICT (id) DO UPDATE SET
              name=EXCLUDED.name, description=EXCLUDED.description, latitude=EXCLUDED.latitude,
              longitude=EXCLUDED.longitude, last_updated=NOW()
          `, [
            park.id,
            details?.name || park.name,
            details?.nationalParkInfo?.parkCode || park.parkCode,
            park.stateCode,
            park.stateName || details?.stateName || '',
            'national',
            details?.parkType || 'National Park',
            details?.designation,
            details?.description,
            details?.shortDescription,
            details?.highlights || null,
            park.coordinates?.latitude,
            park.coordinates?.longitude,
            details?.acres,
            details?.timezone,
            park.imageUrl || details?.images?.[0]?.url,
            details?.quickLinks?.officialWebsite || details?.contact?.website,
            details?.quickLinks?.reservations,
            details?.quickLinks?.map,
            details?.quickLinks?.directions,
            details?.contact?.phone,
            details?.contact?.email,
            details?.contact?.address?.line1,
            details?.contact?.address?.city,
            details?.contact?.address?.state,
            details?.contact?.address?.postalCode,
            details?.climate?.weatherDescription,
            details?.keywords || null,
            'nps',
          ]);

          // Import images
          if (details?.images) {
            for (const [idx, img] of details.images.entries()) {
              await client.query(`
                INSERT INTO park_images (id, park_id, url, title, caption, credit, is_primary, sort_order)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (id) DO UPDATE SET url=EXCLUDED.url, caption=EXCLUDED.caption
              `, [
                img.id || `${park.id}-img-${idx}`,
                park.id,
                img.url,
                img.title,
                img.caption,
                img.credit,
                img.isPrimary || idx === 0,
                idx,
              ]);
            }
          }

          // Import fees
          if (details?.fees) {
            for (const fee of details.fees) {
              await client.query(`
                INSERT INTO park_fees (park_id, title, cost, description)
                VALUES ($1,$2,$3,$4)
              `, [park.id, fee.title, fee.cost, fee.description]);
            }
          }

          // Import activities
          if (details?.activities) {
            for (const act of details.activities) {
              await client.query(`
                INSERT INTO park_activities (park_id, activity_id, name)
                VALUES ($1,$2,$3)
                ON CONFLICT (park_id, activity_id) DO NOTHING
              `, [park.id, act.id, act.name]);
            }
          }
        }
        await client.query('COMMIT');
        totalParks += batch.length;
        process.stdout.write(`\r  National parks: ${totalParks}/${npIndex.parks.length}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
    console.log('');
  }

  // --- State Parks ---
  const masterIndex = await fetchS3Json<any>('index.json');
  if (masterIndex?.stateParks) {
    const states = Object.keys(masterIndex.stateParks);
    console.log(`\n  Found ${states.length} states with state park data`);
    
    for (const stateCode of states) {
      const stateIndex = await fetchS3Json<any>(`state-parks/${stateCode}/index.json`);
      if (!stateIndex?.parks) continue;
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const park of stateIndex.parks) {
          const details = await fetchS3Json<any>(`state-parks/${stateCode}/parks/${park.id}.json`);
          
          await client.query(`
            INSERT INTO parks (id, name, state_code, state_name, category, park_type,
              designation, description, short_description, highlights, latitude, longitude,
              acres, image_url, official_website, reservations_url, keywords, data_source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            ON CONFLICT (id) DO UPDATE SET
              name=EXCLUDED.name, description=EXCLUDED.description,
              latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, last_updated=NOW()
          `, [
            park.id,
            details?.name || park.name,
            stateCode,
            park.stateName || details?.stateName || masterIndex.stateParks[stateCode]?.stateName || '',
            'state',
            details?.parkType || 'State Park',
            details?.designation,
            details?.description,
            details?.shortDescription,
            details?.highlights || null,
            park.coordinates?.latitude,
            park.coordinates?.longitude,
            details?.acres,
            park.imageUrl || details?.images?.[0]?.url,
            details?.quickLinks?.officialWebsite || details?.contact?.website,
            details?.quickLinks?.reservations,
            details?.keywords || null,
            'state-parks',
          ]);

          if (details?.images) {
            for (const [idx, img] of details.images.entries()) {
              await client.query(`
                INSERT INTO park_images (id, park_id, url, title, caption, credit, is_primary, sort_order)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                ON CONFLICT (id) DO UPDATE SET url=EXCLUDED.url
              `, [
                img.id || `${park.id}-img-${idx}`, park.id, img.url,
                img.title, img.caption, img.credit, img.isPrimary || idx === 0, idx,
              ]);
            }
          }
        }
        await client.query('COMMIT');
        totalParks += stateIndex.parks.length;
        console.log(`  ${stateCode}: ${stateIndex.parks.length} parks`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ${stateCode}: ERROR - ${(err as Error).message}`);
      } finally {
        client.release();
      }
    }
  }

  console.log(`\n  Total parks imported: ${totalParks}`);
}

// ============================================
// TRAIL MIGRATION
// ============================================

async function migrateTrails() {
  console.log('\n============================================================');
  console.log('Migrating Trails');
  console.log('============================================================');

  let totalTrails = 0;

  // List all state trail directories
  const prefixes = await listS3Prefixes('trails/state-parks/');
  const stateCodes = prefixes.map(p => p.split('/')[2]).filter(Boolean);
  console.log(`  Found trail data for ${stateCodes.length} states`);

  for (const stateCode of stateCodes) {
    const trailsData = await fetchS3Json<any>(`trails/state-parks/${stateCode}/trails.json`);
    if (!trailsData?.parks) continue;

    let stateTrails = 0;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const [parkId, parkData] of Object.entries(trailsData.parks) as [string, any][]) {
        for (const trail of parkData.trails || []) {
          const coords = trail.trailheadCoordinates;
          const lat = coords?.latitude ? parseFloat(String(coords.latitude)) : null;
          const lng = coords?.longitude ? parseFloat(String(coords.longitude)) : null;

          // Store trail geometry as JSONB if available
          const geometryJson = (trail.geometry && trail.geometry.length >= 2)
            ? JSON.stringify(trail.geometry)
            : null;

          await client.query(`
            INSERT INTO trails (id, park_id, park_name, state_code, name, description,
              length_miles, difficulty, trail_type, latitude, longitude,
              geometry_json, official_url, alltrails_url, google_maps_url, data_source)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            ON CONFLICT (id) DO UPDATE SET
              name=EXCLUDED.name, difficulty=EXCLUDED.difficulty,
              length_miles=EXCLUDED.length_miles, latitude=EXCLUDED.latitude,
              longitude=EXCLUDED.longitude, last_updated=NOW()
          `, [
            trail.id,
            parkId,
            parkData.parkName,
            stateCode,
            trail.name,
            trail.description,
            trail.lengthMiles,
            trail.difficulty,
            trail.trailType,
            lat,
            lng,
            geometryJson,
            trail.officialUrl,
            trail.allTrailsUrl,
            trail.googleMapsUrl,
            trail.dataSource,
          ]);
          stateTrails++;
        }
      }
      
      await client.query('COMMIT');
      totalTrails += stateTrails;
      console.log(`  ${stateCode}: ${stateTrails} trails`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ${stateCode}: ERROR - ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  console.log(`\n  Total trails imported: ${totalTrails}`);
}

// ============================================
// CAMPGROUND MIGRATION
// ============================================

async function migrateCampgrounds() {
  console.log('\n============================================================');
  console.log('Migrating Campgrounds');
  console.log('============================================================');

  let totalCampgrounds = 0;

  const prefixes = await listS3Prefixes('campgrounds/state-parks/');
  const stateCodes = prefixes.map(p => p.split('/')[2]).filter(Boolean);
  console.log(`  Found campground data for ${stateCodes.length} states`);

  for (const stateCode of stateCodes) {
    const data = await fetchS3Json<any>(`campgrounds/state-parks/${stateCode}/campgrounds.json`);
    const campgrounds = Array.isArray(data) ? data : (data?.campgrounds || []);
    if (campgrounds.length === 0) continue;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const cg of campgrounds) {
        await client.query(`
          INSERT INTO campgrounds (id, name, state_code, park_name, description,
            latitude, longitude, total_sites, reservation_url, google_maps_url, data_source)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          ON CONFLICT (id) DO UPDATE SET
            name=EXCLUDED.name, reservation_url=EXCLUDED.reservation_url,
            latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, last_updated=NOW()
        `, [
          cg.id,
          cg.name,
          stateCode,
          cg.parkName,
          cg.description,
          cg.latitude ? parseFloat(String(cg.latitude)) : null,
          cg.longitude ? parseFloat(String(cg.longitude)) : null,
          cg.totalSites,
          cg.reservationUrl,
          cg.googleMapsUrl,
          cg.dataSource,
        ]);
      }
      
      await client.query('COMMIT');
      totalCampgrounds += campgrounds.length;
      console.log(`  ${stateCode}: ${campgrounds.length} campgrounds`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ${stateCode}: ERROR - ${(err as Error).message}`);
    } finally {
      client.release();
    }
  }

  console.log(`\n  Total campgrounds imported: ${totalCampgrounds}`);
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const doAll = args.includes('--all') || args.length === 0;
  const doParks = doAll || args.includes('--parks');
  const doTrails = doAll || args.includes('--trails');
  const doCampgrounds = doAll || args.includes('--campgrounds');

  console.log('============================================================');
  console.log('S3 -> PostgreSQL Migration');
  console.log('============================================================');
  console.log(`  Database: ${DATABASE_URL?.replace(/:[^@]+@/, ':****@')}`);
  console.log(`  S3 Bucket: ${S3_BUCKET}`);
  console.log(`  Migrating: ${[doParks && 'parks', doTrails && 'trails', doCampgrounds && 'campgrounds'].filter(Boolean).join(', ')}`);

  // Test database connection
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`  Connected at: ${res.rows[0].now}`);
  } catch (err: any) {
    console.error(`\n  Failed to connect to database: ${err.message}`);
    process.exit(1);
  }

  if (doParks) await migrateParks();
  if (doTrails) await migrateTrails();
  if (doCampgrounds) await migrateCampgrounds();

  // Print final counts
  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM parks) as parks,
      (SELECT COUNT(*) FROM trails) as trails,
      (SELECT COUNT(*) FROM campgrounds) as campgrounds
  `);
  
  console.log('\n============================================================');
  console.log('Migration Complete');
  console.log('============================================================');
  console.log(`  Parks:       ${counts.rows[0].parks}`);
  console.log(`  Trails:      ${counts.rows[0].trails}`);
  console.log(`  Campgrounds: ${counts.rows[0].campgrounds}`);
  console.log('============================================================');

  await pool.end();
}

main().catch(async (err) => {
  console.error('\nFatal error:', err.message);
  await pool.end();
  process.exit(1);
});
