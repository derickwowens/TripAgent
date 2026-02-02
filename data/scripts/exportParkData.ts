/**
 * Export Park Data to Local JSON
 * 
 * Exports curated park data to local JSON files that mirror the S3 structure.
 * These files can be uploaded to S3 manually or via CLI when credentials are configured.
 * 
 * Usage:
 *   npx tsx data/scripts/exportParkData.ts [state]
 *   npx tsx data/scripts/exportParkData.ts WI
 *   npx tsx data/scripts/exportParkData.ts FL
 *   npx tsx data/scripts/exportParkData.ts all
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { S3_CONFIG, STATE_NAMES } from '../sync/config.js';
import type { 
  NormalizedPark, 
  StateParkIndex, 
  OfficialLink,
  SyncMetadata,
} from '../schema/park.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Output directory for exported data (mirrors S3 structure)
const OUTPUT_DIR = join(__dirname, '../../.park-data');

interface CuratedLinksFile {
  _meta: {
    state: string;
    stateName: string;
    lastUpdated: string;
    lastValidated: string | null;
    totalParks: number;
    notes: string;
  };
  parks: Record<string, {
    name: string;
    links: Record<string, string>;
  }>;
}

interface StateConfigFile {
  stateCode: string;
  stateName: string;
  parkAuthority: {
    name: string;
    abbreviation: string;
    website: string;
  };
  reservationSystem: {
    provider: string;
    baseUrl: string;
  };
  contact?: {
    generalPhone?: string;
    reservationPhone?: string;
    email?: string;
  };
}

async function loadLinksFile(stateCode: string): Promise<CuratedLinksFile> {
  const filePath = join(__dirname, '../sources/links', `${stateCode.toUpperCase()}.json`);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function loadStateConfig(stateCode: string): Promise<StateConfigFile | null> {
  try {
    const filePath = join(__dirname, '../sources/states', `${stateCode.toUpperCase()}.json`);
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

interface CoordinatesFile {
  parks: Record<string, { latitude: number; longitude: number }>;
}

async function loadCoordinates(stateCode: string): Promise<CoordinatesFile | null> {
  try {
    const filePath = join(__dirname, '../sources/coordinates', `${stateCode.toUpperCase()}.json`);
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

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

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(dirname(filePath));
  await writeFile(filePath, JSON.stringify(data, null, 2));
  console.log(`  [WRITE] ${filePath.replace(OUTPUT_DIR, '.park-data')}`);
}

function convertLinksToOfficialLinks(
  links: Record<string, string>,
  stateCode: string
): OfficialLink[] {
  const officialLinks: OfficialLink[] = [];
  
  for (const [linkType, url] of Object.entries(links)) {
    let type: OfficialLink['type'] = 'other';
    
    switch (linkType) {
      case 'official':
        type = 'official_website';
        break;
      case 'reservation':
        type = 'reservation';
        break;
      case 'recreation':
        type = 'activities';
        break;
      case 'maps':
        type = 'map';
        break;
      case 'camping':
        type = 'camping';
        break;
      case 'experiences':
        type = 'activities';
        break;
      case 'hours_fees':
        type = 'fees';
        break;
    }
    
    officialLinks.push({
      type,
      url,
      isPrimary: linkType === 'official' || linkType === 'reservation',
    });
  }
  
  return officialLinks;
}

function createNormalizedPark(
  parkId: string,
  parkData: { name: string; links: Record<string, string> },
  stateCode: string,
  stateName: string,
  stateConfig: StateConfigFile | null,
  coordinates?: { latitude: number; longitude: number }
): NormalizedPark {
  const officialLinks = convertLinksToOfficialLinks(parkData.links, stateCode);
  
  const park: NormalizedPark = {
    id: `${stateCode.toLowerCase()}-${parkId}`,
    name: parkData.name,
    category: 'state',
    parkType: 'state_park',
    stateCode: stateCode.toUpperCase(),
    stateName,
    coordinates: coordinates || { latitude: 0, longitude: 0 },
    officialLinks,
    contact: stateConfig ? {
      phone: stateConfig.contact?.generalPhone,
      reservationUrl: stateConfig.reservationSystem.baseUrl,
    } : {
      reservationUrl: parkData.links.reservation,
    },
    quickLinks: {
      officialWebsite: parkData.links.official,
      reservations: parkData.links.reservation,
      map: parkData.links.maps,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  };
  
  return park;
}

async function exportState(stateCode: string): Promise<{ 
  parksExported: number; 
  errors: string[];
}> {
  const errors: string[] = [];
  let parksExported = 0;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Exporting ${stateCode}...`);
  console.log('='.repeat(50));
  
  try {
    const linksFile = await loadLinksFile(stateCode);
    const stateConfig = await loadStateConfig(stateCode);
    const coordinatesFile = await loadCoordinates(stateCode);
    const stateName = STATE_NAMES[stateCode] || linksFile._meta.stateName;
    
    console.log(`Found ${Object.keys(linksFile.parks).length} parks in ${stateName}`);
    if (coordinatesFile) {
      console.log(`Loaded coordinates for ${Object.keys(coordinatesFile.parks).length} parks`);
    }
    
    const parks: NormalizedPark[] = [];
    const stateDir = join(OUTPUT_DIR, S3_CONFIG.paths.stateParks, stateCode);
    const parksDir = join(stateDir, 'parks');
    
    // Export each park
    for (const [parkId, parkData] of Object.entries(linksFile.parks)) {
      try {
        const coords = coordinatesFile?.parks[parkId];
        const park = createNormalizedPark(parkId, parkData, stateCode, stateName, stateConfig, coords);
        const parkFile = join(parksDir, `${park.id}.json`);
        await writeJson(parkFile, park);
        parks.push(park);
        parksExported++;
      } catch (error: any) {
        errors.push(`${parkData.name}: ${error.message}`);
        console.log(`  [ERR] ${parkData.name}: ${error.message}`);
      }
    }
    
    // Create and export state index
    const index: StateParkIndex = {
      stateCode: stateCode.toUpperCase(),
      stateName,
      totalParks: parks.length,
      lastSynced: new Date().toISOString(),
      s3Prefix: `${S3_CONFIG.paths.stateParks}/${stateCode.toUpperCase()}`,
      parks: parks.map(p => ({
        id: p.id,
        name: p.name,
        parkType: p.parkType,
        coordinates: p.coordinates,
        hasCamping: p.officialLinks?.some(l => l.type === 'camping') || false,
        hasTrails: false,
        imageUrl: p.images?.[0]?.url,
      })),
    };
    
    await writeJson(join(stateDir, 'index.json'), index);
    
    // Export sync metadata
    const syncMetadata: SyncMetadata = {
      stateCode: stateCode.toUpperCase(),
      lastSyncStart: new Date().toISOString(),
      lastSyncEnd: new Date().toISOString(),
      recordsProcessed: Object.keys(linksFile.parks).length,
      recordsUpdated: parksExported,
      recordsFailed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
    };
    
    const metadataDir = join(OUTPUT_DIR, S3_CONFIG.paths.syncMetadata);
    await writeJson(join(metadataDir, `manual-${stateCode}.json`), syncMetadata);
    
  } catch (error: any) {
    errors.push(`Failed to export ${stateCode}: ${error.message}`);
    console.error(`[ERR] ${error.message}`);
  }
  
  return { parksExported, errors };
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0]?.toUpperCase() || 'ALL';
  
  console.log('='.repeat(60));
  console.log('TRIPAGENT PARK DATA EXPORT');
  console.log('Exporting curated park data to local JSON files');
  console.log('='.repeat(60));
  console.log(`Output directory: ${OUTPUT_DIR}`);
  
  const results = new Map<string, { parksExported: number; errors: string[] }>();
  
  if (target === 'ALL') {
    const states = await getAvailableStates();
    console.log(`\nExporting all states: ${states.join(', ')}`);
    
    for (const state of states) {
      const result = await exportState(state);
      results.set(state, result);
    }
  } else {
    const result = await exportState(target);
    results.set(target, result);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('EXPORT SUMMARY');
  console.log('='.repeat(60));
  
  let totalParks = 0;
  let totalErrors = 0;
  
  for (const [state, result] of results) {
    console.log(`\n${state}: ${result.parksExported} parks exported`);
    totalParks += result.parksExported;
    totalErrors += result.errors.length;
    
    if (result.errors.length > 0) {
      console.log(`  Errors:`);
      for (const err of result.errors) {
        console.log(`    - ${err}`);
      }
    }
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log(`TOTAL: ${totalParks} parks exported`);
  console.log(`OUTPUT: ${OUTPUT_DIR}`);
  
  if (totalErrors > 0) {
    console.log(`ERRORS: ${totalErrors}`);
    process.exit(1);
  } else {
    console.log('STATUS: SUCCESS');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('FILE STRUCTURE (mirrors S3):');
  console.log(`  ${S3_CONFIG.paths.stateParks}/{stateCode}/index.json`);
  console.log(`  ${S3_CONFIG.paths.stateParks}/{stateCode}/parks/{parkId}.json`);
  console.log(`  ${S3_CONFIG.paths.syncMetadata}/manual-{stateCode}.json`);
  console.log('\nTo upload to S3:');
  console.log(`  aws s3 sync .park-data s3://${S3_CONFIG.bucket}/`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
