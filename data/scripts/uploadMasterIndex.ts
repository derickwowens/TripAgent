/**
 * Upload Master Index to S3
 * 
 * Creates and uploads the master index that serves as the entry point
 * for all park data in the S3 database.
 * 
 * Usage:
 *   npx tsx data/scripts/uploadMasterIndex.ts
 */

import 'dotenv/config';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { 
  uploadJson, 
  downloadStateParkIndex,
  downloadNationalParkIndex,
} from '../sync/s3Client.js';
import { S3_CONFIG, STATE_NAMES } from '../sync/config.js';
import type { MasterIndex } from '../schema/park.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_VERSION = '1.0.0';

async function getAvailableStates(): Promise<string[]> {
  const linksDir = join(__dirname, '../sources/links');
  try {
    const files = await readdir(linksDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

async function buildMasterIndex(): Promise<MasterIndex> {
  console.log('Building master index...\n');
  
  const states = await getAvailableStates();
  const stateParks: MasterIndex['stateParks'] = {};
  
  // Get state park indexes
  for (const stateCode of states) {
    try {
      const index = await downloadStateParkIndex(stateCode);
      if (index) {
        stateParks[stateCode] = {
          stateCode,
          stateName: STATE_NAMES[stateCode] || stateCode,
          totalParks: index.totalParks,
          indexUrl: `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${S3_CONFIG.paths.stateParks}/${stateCode}/index.json`,
          lastSynced: index.lastSynced,
        };
        console.log(`  [OK] ${stateCode}: ${index.totalParks} parks`);
      }
    } catch (error: any) {
      console.log(`  [SKIP] ${stateCode}: ${error.message}`);
    }
  }
  
  // Get national park index
  let nationalParksInfo = {
    totalParks: 0,
    indexUrl: `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${S3_CONFIG.paths.nationalParks}/index.json`,
    lastSynced: new Date().toISOString(),
  };
  
  try {
    const npIndex = await downloadNationalParkIndex();
    if (npIndex) {
      nationalParksInfo = {
        totalParks: npIndex.totalParks,
        indexUrl: `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${S3_CONFIG.paths.nationalParks}/index.json`,
        lastSynced: npIndex.lastSynced,
      };
      console.log(`  [OK] National Parks: ${npIndex.totalParks} parks`);
    }
  } catch {
    console.log('  [SKIP] National Parks: No index found');
  }
  
  // Calculate totals
  let totalStateParks = 0;
  for (const state of Object.values(stateParks)) {
    totalStateParks += state.totalParks;
  }
  
  const masterIndex: MasterIndex = {
    lastUpdated: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    nationalParks: nationalParksInfo,
    stateParks,
    statistics: {
      totalParks: nationalParksInfo.totalParks + totalStateParks,
      totalPhotos: 0, // Will be updated when photos are added
      lastFullSync: new Date().toISOString(),
    },
  };
  
  return masterIndex;
}

async function main() {
  console.log('='.repeat(60));
  console.log('TRIPAGENT MASTER INDEX UPLOAD');
  console.log('='.repeat(60));
  
  try {
    const masterIndex = await buildMasterIndex();
    
    // Upload master index
    await uploadJson('index.json', masterIndex);
    
    // Also upload schema
    const schemaInfo = {
      version: SCHEMA_VERSION,
      lastUpdated: new Date().toISOString(),
      schemaUrl: `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/schemas/park.schema.json`,
    };
    await uploadJson('schemas/info.json', schemaInfo);
    
    console.log('\n' + '='.repeat(60));
    console.log('MASTER INDEX UPLOADED');
    console.log('='.repeat(60));
    console.log(`\nPublic URL:`);
    console.log(`  https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/index.json`);
    console.log(`\nContents:`);
    console.log(`  Schema Version: ${masterIndex.schemaVersion}`);
    console.log(`  National Parks: ${masterIndex.nationalParks.totalParks}`);
    console.log(`  State Parks: ${Object.keys(masterIndex.stateParks).length} states`);
    
    let totalStateParks = 0;
    for (const state of Object.values(masterIndex.stateParks)) {
      totalStateParks += state.totalParks;
    }
    console.log(`  Total State Parks: ${totalStateParks}`);
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('Failed to upload master index:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
