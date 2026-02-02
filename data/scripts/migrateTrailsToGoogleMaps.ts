/**
 * Migration Script: Replace AllTrails URLs with Google Maps + Add Enrichment Flags
 * 
 * This script:
 * 1. Reads the existing trail data from local JSON
 * 2. Replaces allTrailsUrl with googleMapsUrl for each trail
 * 3. Adds enrichment flags (needsNpsUrl, dataCompleteness)
 * 4. Generates a gaps report
 * 5. Uploads the migrated data to S3
 * 
 * Run with: npx ts-node data/scripts/migrateTrailsToGoogleMaps.ts
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

// Park code to state mapping for Google Maps URLs
const PARK_STATES: Record<string, string> = {
  'yose': 'California',
  'grca': 'Arizona',
  'zion': 'Utah',
  'yell': 'Wyoming',
  'glac': 'Montana',
  'romo': 'Colorado',
  'acad': 'Maine',
  'grsm': 'Tennessee',
  'olym': 'Washington',
  'seki': 'California',
  'jotr': 'California',
  'deva': 'California',
  'arch': 'Utah',
  'brca': 'Utah',
  'cany': 'Utah',
  'care': 'Utah',
  'grte': 'Wyoming',
  'mora': 'Washington',
  'noca': 'Washington',
  'crla': 'Oregon',
  'redw': 'California',
  'lavo': 'California',
  'pinn': 'California',
  'chis': 'California',
  'havo': 'Hawaii',
  'hale': 'Hawaii',
  'ever': 'Florida',
  'bisc': 'Florida',
  'drto': 'Florida',
  'shen': 'Virginia',
  'maca': 'Kentucky',
  'cuva': 'Ohio',
  'indu': 'Indiana',
  'badl': 'South Dakota',
  'wica': 'South Dakota',
  'thro': 'North Dakota',
  'voya': 'Minnesota',
  'isro': 'Michigan',
  'bibe': 'Texas',
  'gumo': 'Texas',
  'grsa': 'Colorado',
  'meve': 'Colorado',
  'blca': 'Colorado',
  'cave': 'New Mexico',
  'whsa': 'New Mexico',
  'pefo': 'Arizona',
  'sagu': 'Arizona',
  'cong': 'South Carolina',
  'neri': 'West Virginia',
  'hosp': 'Arkansas',
  'grba': 'Nevada',
  'dena': 'Alaska',
  'kefj': 'Alaska',
  'glba': 'Alaska',
  'katm': 'Alaska',
  'wrst': 'Alaska',
  'gaar': 'Alaska',
  'kova': 'Alaska',
  'lacl': 'Alaska',
  'viis': 'U.S. Virgin Islands',
};

interface Trail {
  id: string;
  name: string;
  lengthMiles?: number;
  elevationGainFeet?: number;
  difficulty?: string;
  trailType?: string;
  estimatedTimeMinutes?: number;
  description?: string;
  highlights?: string[];
  allTrailsUrl?: string;
  allTrailsId?: string;
  permitRequired?: boolean;
  // New fields after migration
  googleMapsUrl?: string;
  npsUrl?: string;
  needsNpsUrl?: boolean;
  dataCompleteness?: {
    hasDescription: boolean;
    hasDistance: boolean;
    hasElevation: boolean;
    hasDifficulty: boolean;
    hasOfficialUrl: boolean;
  };
}

interface ParkTrails {
  parkName: string;
  trails: Trail[];
}

interface TrailsData {
  _meta: {
    description: string;
    lastUpdated: string;
    source: string;
    coverage: any;
    migration?: {
      migratedAt: string;
      fromSource: string;
      toSource: string;
    };
  };
  parks: Record<string, ParkTrails>;
  stateParks?: Record<string, Record<string, ParkTrails>>;
  _gaps?: {
    generated: string;
    summary: {
      totalTrails: number;
      trailsWithNpsUrl: number;
      trailsNeedingEnrichment: number;
      parksWithNoTrails: string[];
    };
    trailsMissingNpsUrl: Array<{ parkCode: string; trailName: string; googleMapsUrl: string }>;
  };
}

/**
 * Generate Google Maps search URL for a trail
 */
function generateGoogleMapsUrl(trailName: string, parkName: string, state?: string): string {
  const query = state 
    ? `${trailName} trailhead ${parkName} ${state}`
    : `${trailName} trailhead ${parkName}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Calculate data completeness for a trail
 */
function calculateCompleteness(trail: Trail): Trail['dataCompleteness'] {
  return {
    hasDescription: !!trail.description && trail.description.length > 10,
    hasDistance: !!trail.lengthMiles && trail.lengthMiles > 0,
    hasElevation: !!trail.elevationGainFeet && trail.elevationGainFeet > 0,
    hasDifficulty: !!trail.difficulty,
    hasOfficialUrl: !!trail.npsUrl,
  };
}

async function main() {
  console.log('============================================================');
  console.log('Trail Data Migration: AllTrails -> Google Maps + Enrichment');
  console.log('============================================================\n');

  // Read the source file
  const sourceFile = path.join(__dirname, '../sources/trails/national-parks-trails.json');
  
  if (!fs.existsSync(sourceFile)) {
    console.error(`Source file not found: ${sourceFile}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(sourceFile, 'utf-8');
  const data: TrailsData = JSON.parse(rawData);

  console.log(`Loaded ${Object.keys(data.parks).length} parks from source file\n`);

  // Track gaps for reporting
  const trailsMissingNpsUrl: Array<{ parkCode: string; trailName: string; googleMapsUrl: string }> = [];
  let totalTrails = 0;
  let trailsWithNpsUrl = 0;

  // Migrate each park's trails
  for (const [parkCode, parkData] of Object.entries(data.parks)) {
    const state = PARK_STATES[parkCode] || '';
    console.log(`Processing ${parkCode} (${parkData.parkName})...`);

    for (const trail of parkData.trails) {
      totalTrails++;

      // Generate Google Maps URL
      trail.googleMapsUrl = generateGoogleMapsUrl(trail.name, parkData.parkName, state);

      // Check if we have an NPS URL (we don't in this source, so flag for enrichment)
      if (!trail.npsUrl) {
        trail.needsNpsUrl = true;
        trailsMissingNpsUrl.push({
          parkCode,
          trailName: trail.name,
          googleMapsUrl: trail.googleMapsUrl,
        });
      } else {
        trailsWithNpsUrl++;
      }

      // Calculate data completeness
      trail.dataCompleteness = calculateCompleteness(trail);

      // Remove deprecated AllTrails fields (keep for reference but mark as deprecated)
      // We'll keep them but add a note that they're deprecated
    }

    console.log(`  - Migrated ${parkData.trails.length} trails`);
  }

  // Migrate state parks if present
  if (data.stateParks) {
    for (const [stateCode, stateParks] of Object.entries(data.stateParks)) {
      for (const [parkId, parkData] of Object.entries(stateParks)) {
        console.log(`Processing ${stateCode}/${parkId} (${parkData.parkName})...`);

        for (const trail of parkData.trails) {
          totalTrails++;

          // Generate Google Maps URL
          trail.googleMapsUrl = generateGoogleMapsUrl(
            trail.name, 
            parkData.parkName, 
            stateCode === 'WI' ? 'Wisconsin' : stateCode === 'FL' ? 'Florida' : ''
          );

          // Flag for enrichment
          if (!trail.npsUrl) {
            trail.needsNpsUrl = true;
            trailsMissingNpsUrl.push({
              parkCode: `${stateCode}-${parkId}`,
              trailName: trail.name,
              googleMapsUrl: trail.googleMapsUrl,
            });
          } else {
            trailsWithNpsUrl++;
          }

          trail.dataCompleteness = calculateCompleteness(trail);
        }

        console.log(`  - Migrated ${parkData.trails.length} trails`);
      }
    }
  }

  // Update metadata
  data._meta.description = 'Trail data with Google Maps URLs (AllTrails deprecated)';
  data._meta.source = 'Google Maps (migrated from AllTrails)';
  data._meta.lastUpdated = new Date().toISOString().split('T')[0];
  data._meta.migration = {
    migratedAt: new Date().toISOString(),
    fromSource: 'AllTrails',
    toSource: 'Google Maps + NPS enrichment flags',
  };

  // Add gaps report
  data._gaps = {
    generated: new Date().toISOString(),
    summary: {
      totalTrails,
      trailsWithNpsUrl,
      trailsNeedingEnrichment: trailsMissingNpsUrl.length,
      parksWithNoTrails: [], // Could populate this if needed
    },
    trailsMissingNpsUrl: trailsMissingNpsUrl.slice(0, 100), // Limit to first 100 for readability
  };

  // Write migrated data locally first
  const outputFile = path.join(__dirname, '../sources/trails/national-parks-trails-migrated.json');
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
  console.log(`\nWrote migrated data to: ${outputFile}`);

  // Upload to S3
  console.log('\nUploading to S3...');
  
  const s3Client = new S3Client({ region: S3_REGION });
  
  await s3Client.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: 'trails/all-parks-trails.json',
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  }));
  
  console.log(`[OK] Uploaded to s3://${S3_BUCKET}/trails/all-parks-trails.json`);

  // Generate gaps report
  const gapsReport = `# Trail Data Gaps Report
Generated: ${new Date().toISOString()}

## Summary
- **Total Trails**: ${totalTrails}
- **Trails with NPS URL**: ${trailsWithNpsUrl}
- **Trails Needing Enrichment**: ${trailsMissingNpsUrl.length}
- **Enrichment Rate**: ${((trailsWithNpsUrl / totalTrails) * 100).toFixed(1)}%

## Trails Missing Official NPS URLs
These trails have Google Maps fallback URLs but would benefit from official NPS trail page URLs.

| Park Code | Trail Name | Google Maps URL |
|-----------|------------|-----------------|
${trailsMissingNpsUrl.slice(0, 50).map(t => `| ${t.parkCode} | ${t.trailName} | [View](${t.googleMapsUrl}) |`).join('\n')}

${trailsMissingNpsUrl.length > 50 ? `\n... and ${trailsMissingNpsUrl.length - 50} more trails\n` : ''}

## Next Steps
1. Run \`fetchAndUploadTrails.ts\` to fetch NPS API data and merge
2. Manually verify popular trails have correct NPS URLs
3. Re-run this script to update the gaps report
`;

  const gapsFile = path.join(__dirname, '../sources/trails/GAPS_REPORT.md');
  fs.writeFileSync(gapsFile, gapsReport);
  console.log(`\nWrote gaps report to: ${gapsFile}`);

  console.log('\n============================================================');
  console.log('Migration Complete!');
  console.log('============================================================');
  console.log(`Total trails migrated: ${totalTrails}`);
  console.log(`Trails with official NPS URLs: ${trailsWithNpsUrl}`);
  console.log(`Trails needing enrichment: ${trailsMissingNpsUrl.length}`);
  console.log(`\nAll trails now have Google Maps fallback URLs.`);
  console.log(`Run 'fetchAndUploadTrails.ts' to enrich with NPS API data.`);
}

main().catch(console.error);
