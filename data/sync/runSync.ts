#!/usr/bin/env npx tsx
/**
 * Park Data Sync Runner
 * 
 * Main entry point for running park data sync jobs.
 * 
 * Usage:
 *   npx tsx data/sync/runSync.ts [state|national|all] [stateCode]
 * 
 * Examples:
 *   npx tsx data/sync/runSync.ts state WI     # Sync Wisconsin state parks
 *   npx tsx data/sync/runSync.ts state FL     # Sync Florida state parks
 *   npx tsx data/sync/runSync.ts state all    # Sync all priority states
 *   npx tsx data/sync/runSync.ts all          # Sync everything
 */

import { StateSyncer } from './syncers/stateSyncer.js';
import { PRIORITY_STATES } from './config.js';
import type { SyncResult } from './baseSyncer.js';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get list of available state configurations
 */
async function getAvailableStates(): Promise<string[]> {
  const statesDir = join(__dirname, '../sources/states');
  try {
    const files = await readdir(statesDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

/**
 * Sync a specific state using configuration-driven syncer
 */
async function syncState(stateCode: string): Promise<SyncResult> {
  try {
    const syncer = await StateSyncer.fromStateCode(stateCode);
    return syncer.sync();
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      const available = await getAvailableStates();
      console.error(`No configuration found for state: ${stateCode}`);
      console.log(`Available states: ${available.join(', ') || 'none'}`);
    } else {
      console.error(`Failed to create syncer for ${stateCode}:`, error.message);
    }
    return {
      success: false,
      parksProcessed: 0,
      parksUpdated: 0,
      parksFailed: 0,
      errors: [`Failed to sync state ${stateCode}: ${error.message}`],
      duration: 0,
    };
  }
}

async function syncAllPriorityStates(): Promise<Map<string, SyncResult>> {
  const results = new Map<string, SyncResult>();
  const availableStates = await getAvailableStates();
  
  for (const state of PRIORITY_STATES) {
    // Only sync if we have a configuration for this state
    if (availableStates.includes(state)) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Syncing ${state}...`);
      console.log('='.repeat(50));
      
      const result = await syncState(state);
      results.set(state, result);
      
      // Wait between states to be nice to APIs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const syncType = args[0] || 'state';
  const target = args[1];

  console.log('Park Data Sync Runner');
  console.log('=====================');
  console.log(`Sync type: ${syncType}`);
  console.log(`Target: ${target || 'all priority states'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  // Check required environment variables
  if (!process.env.RECREATION_GOV_API_KEY) {
    console.warn('Warning: RECREATION_GOV_API_KEY not set - RIDB data will be skipped');
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.warn('Warning: AWS credentials not set - S3 uploads will fail');
  }

  let results: Map<string, SyncResult>;

  switch (syncType.toLowerCase()) {
    case 'state':
      if (target && target.toLowerCase() !== 'all') {
        // Sync specific state
        const result = await syncState(target);
        results = new Map([[target.toUpperCase(), result]]);
      } else {
        // Sync all priority states
        results = await syncAllPriorityStates();
      }
      break;

    case 'national':
      // TODO: Implement national parks syncer
      console.log('National parks sync not yet implemented');
      results = new Map();
      break;

    case 'all':
      // Sync state parks, then national
      results = await syncAllPriorityStates();
      // TODO: Add national parks sync
      break;

    default:
      console.error(`Unknown sync type: ${syncType}`);
      console.log('Usage: npx tsx data/sync/runSync.ts [state|national|all] [stateCode]');
      process.exit(1);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('SYNC SUMMARY');
  console.log('='.repeat(50));
  
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalFailed = 0;
  let allSuccess = true;

  for (const [state, result] of results) {
    const status = result.success ? 'SUCCESS' : 'FAILED';
    console.log(`${state}: ${status} - ${result.parksUpdated} parks updated in ${result.duration}ms`);
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => console.log(`  Error: ${err}`));
    }

    totalProcessed += result.parksProcessed;
    totalUpdated += result.parksUpdated;
    totalFailed += result.parksFailed;
    allSuccess = allSuccess && result.success;
  }

  console.log('');
  console.log(`Total: ${totalProcessed} processed, ${totalUpdated} updated, ${totalFailed} failed`);
  console.log(`Overall status: ${allSuccess ? 'SUCCESS' : 'FAILED'}`);

  process.exit(allSuccess ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
