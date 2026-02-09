/**
 * Fast S3 -> PostgreSQL Migration (Batch Inserts)
 * 
 * Uses multi-row VALUES inserts (500 rows per batch) for 10-50x speedup
 * over single-row inserts across network connections.
 * 
 * Usage: npx tsx data/scripts/migrateToPostgresFast.ts [--trails] [--campgrounds] [--all]
 * 
 * Parks are already imported (550). This script handles trails + campgrounds.
 */

import { config } from 'dotenv';
config();

import { Pool } from 'pg';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const DATABASE_URL = process.env.DATABASE_URL!;
const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const BATCH_SIZE = 500;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

const s3 = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function fetchS3Json<T>(key: string): Promise<T | null> {
  try {
    const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: key });
    const resp = await s3.send(cmd);
    const body = await resp.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

async function listS3Prefixes(prefix: string): Promise<string[]> {
  const cmd = new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix, Delimiter: '/' });
  const resp = await s3.send(cmd);
  return (resp.CommonPrefixes || []).map(p => p.Prefix!).filter(Boolean);
}

/**
 * Batch insert trails using multi-row VALUES
 */
async function batchInsertTrails(trails: any[]): Promise<void> {
  if (trails.length === 0) return;

  const cols = ['id', 'park_id', 'park_name', 'state_code', 'name', 'description',
    'length_miles', 'difficulty', 'trail_type', 'latitude', 'longitude',
    'geometry_json', 'official_url', 'alltrails_url', 'google_maps_url', 'data_source'];
  const colCount = cols.length;

  for (let i = 0; i < trails.length; i += BATCH_SIZE) {
    const batch = trails.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const t = batch[j];
      const offset = j * colCount;
      const ph = cols.map((_, k) => `$${offset + k + 1}`);
      placeholders.push(`(${ph.join(',')})`);
      values.push(
        t.id, t.parkId, t.parkName, t.stateCode, t.name, t.description || null,
        t.lengthMiles || null, t.difficulty || null, t.trailType || null,
        t.latitude, t.longitude,
        t.geometryJson || null, t.officialUrl || null, t.alltrailsUrl || null,
        t.googleMapsUrl || null, t.dataSource || null
      );
    }

    await pool.query(`
      INSERT INTO trails (${cols.join(',')})
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, difficulty=EXCLUDED.difficulty,
        length_miles=EXCLUDED.length_miles, latitude=EXCLUDED.latitude,
        longitude=EXCLUDED.longitude, last_updated=NOW()
    `, values);
  }
}

/**
 * Batch insert campgrounds using multi-row VALUES
 */
async function batchInsertCampgrounds(campgrounds: any[]): Promise<void> {
  if (campgrounds.length === 0) return;

  const cols = ['id', 'name', 'state_code', 'park_name', 'description',
    'latitude', 'longitude', 'total_sites', 'reservation_url', 'google_maps_url', 'data_source'];
  const colCount = cols.length;

  for (let i = 0; i < campgrounds.length; i += BATCH_SIZE) {
    const batch = campgrounds.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];

    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const offset = j * colCount;
      const ph = cols.map((_, k) => `$${offset + k + 1}`);
      placeholders.push(`(${ph.join(',')})`);
      values.push(
        c.id, c.name, c.stateCode, c.parkName || null, c.description || null,
        c.latitude, c.longitude, c.totalSites || null,
        c.reservationUrl || null, c.googleMapsUrl || null, c.dataSource || null
      );
    }

    await pool.query(`
      INSERT INTO campgrounds (${cols.join(',')})
      VALUES ${placeholders.join(',')}
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, latitude=EXCLUDED.latitude,
        longitude=EXCLUDED.longitude, reservation_url=EXCLUDED.reservation_url,
        last_updated=NOW()
    `, values);
  }
}

// ============================================
// TRAIL MIGRATION
// ============================================
async function migrateTrails() {
  console.log('\n============================================================');
  console.log('Migrating Trails (batch mode)');
  console.log('============================================================');

  // Clear existing trails for clean import
  await pool.query('TRUNCATE trails CASCADE');
  console.log('  Cleared existing trails');

  let totalTrails = 0;
  const prefixes = await listS3Prefixes('trails/state-parks/');
  const stateCodes = prefixes.map(p => p.split('/')[2]).filter(Boolean);
  console.log(`  Found trail data for ${stateCodes.length} states\n`);

  for (const stateCode of stateCodes.sort()) {
    const trailsData = await fetchS3Json<any>(`trails/state-parks/${stateCode}/trails.json`);
    if (!trailsData?.parks) continue;

    const trailRows: any[] = [];

    for (const [parkId, parkData] of Object.entries(trailsData.parks) as [string, any][]) {
      for (const trail of parkData.trails || []) {
        const coords = trail.trailheadCoordinates;
        const lat = coords?.latitude ? parseFloat(String(coords.latitude)) : null;
        const lng = coords?.longitude ? parseFloat(String(coords.longitude)) : null;

        const geometryJson = (trail.geometry && trail.geometry.length >= 2)
          ? JSON.stringify(trail.geometry) : null;

        trailRows.push({
          id: trail.id,
          parkId,
          parkName: parkData.parkName,
          stateCode,
          name: trail.name,
          description: trail.description,
          lengthMiles: trail.lengthMiles,
          difficulty: trail.difficulty,
          trailType: trail.trailType,
          latitude: lat,
          longitude: lng,
          geometryJson,
          officialUrl: trail.officialUrl,
          alltrailsUrl: trail.allTrailsUrl,
          googleMapsUrl: trail.googleMapsUrl,
          dataSource: trail.dataSource,
        });
      }
    }

    if (trailRows.length > 0) {
      // Deduplicate by ID (keep last occurrence)
      const deduped = [...new Map(trailRows.map(t => [t.id, t])).values()];
      const start = Date.now();
      await batchInsertTrails(deduped);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      totalTrails += deduped.length;
      const skipped = trailRows.length - deduped.length;
      console.log(`  ${stateCode}: ${deduped.length.toLocaleString()} trails (${elapsed}s)${skipped > 0 ? ` [${skipped} dupes removed]` : ''}`);
    }
  }

  console.log(`\n  Total trails imported: ${totalTrails.toLocaleString()}`);
}

// ============================================
// CAMPGROUND MIGRATION
// ============================================
async function migrateCampgrounds() {
  console.log('\n============================================================');
  console.log('Migrating Campgrounds (batch mode)');
  console.log('============================================================');

  await pool.query('TRUNCATE campgrounds CASCADE');
  console.log('  Cleared existing campgrounds');

  let totalCampgrounds = 0;
  const prefixes = await listS3Prefixes('campgrounds/state-parks/');
  const stateCodes = prefixes.map(p => p.split('/')[2]).filter(Boolean);
  console.log(`  Found campground data for ${stateCodes.length} states\n`);

  for (const stateCode of stateCodes.sort()) {
    const data = await fetchS3Json<any>(`campgrounds/state-parks/${stateCode}/campgrounds.json`);
    if (!data?.campgrounds) continue;

    const campRows = data.campgrounds
      .filter((c: any) => c.id)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        stateCode: stateCode.toUpperCase(),
        parkName: c.parkName,
        description: c.description,
        latitude: c.latitude ? parseFloat(String(c.latitude)) : null,
        longitude: c.longitude ? parseFloat(String(c.longitude)) : null,
        totalSites: c.totalSites,
        reservationUrl: c.reservationUrl,
        googleMapsUrl: c.googleMapsUrl,
        dataSource: 'recreation.gov',
      }));

    if (campRows.length > 0) {
      // Deduplicate by ID
      const deduped = [...new Map(campRows.map((c: any) => [c.id, c])).values()];
      const start = Date.now();
      await batchInsertCampgrounds(deduped as any[]);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      totalCampgrounds += (deduped as any[]).length;
      console.log(`  ${stateCode}: ${(deduped as any[]).length} campgrounds (${elapsed}s)`);
    }
  }

  console.log(`\n  Total campgrounds imported: ${totalCampgrounds.toLocaleString()}`);
}

// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const doTrails = args.includes('--trails') || args.includes('--all') || args.length === 0;
  const doCampgrounds = args.includes('--campgrounds') || args.includes('--all') || args.length === 0;

  console.log('============================================================');
  console.log('Fast S3 -> PostgreSQL Migration (Batch Inserts)');
  console.log('============================================================');
  console.log(`  Batch size: ${BATCH_SIZE} rows per INSERT`);
  console.log(`  Migrating: ${[doTrails && 'trails', doCampgrounds && 'campgrounds'].filter(Boolean).join(', ')}`);

  const start = Date.now();

  if (doTrails) await migrateTrails();
  if (doCampgrounds) await migrateCampgrounds();

  const totalTime = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n============================================================`);
  console.log(`Migration complete in ${totalTime}s`);
  console.log('============================================================');

  // Final counts
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM parks) as parks,
      (SELECT COUNT(*) FROM trails) as trails,
      (SELECT COUNT(*) FROM campgrounds) as campgrounds
  `);
  console.log(`  Parks: ${rows[0].parks} | Trails: ${rows[0].trails} | Campgrounds: ${rows[0].campgrounds}`);

  await pool.end();
}

main().catch(e => {
  console.error('Migration failed:', e.message);
  pool.end();
  process.exit(1);
});
