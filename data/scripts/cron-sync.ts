#!/usr/bin/env tsx
/**
 * Weekly data sync CRON job for Railway.
 * Runs as a Railway Cron Service on a schedule (e.g. weekly).
 *
 * Usage (local):
 *   npx tsx data/scripts/cron-sync.ts
 *
 * Railway Cron Service:
 *   Build command: npm install
 *   Start command: npx tsx data/scripts/cron-sync.ts
 *   Schedule: 0 6 * * 1  (every Monday at 6am UTC)
 */

import { execSync } from 'child_process';

const SYNC_SCRIPT = 'data/scripts/syncToPostgres.ts';

async function main() {
  const start = Date.now();
  console.log(`[CRON] Data sync started at ${new Date().toISOString()}`);
  console.log(`[CRON] DATABASE_URL: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`);

  if (!process.env.DATABASE_URL) {
    console.error('[CRON] ERROR: DATABASE_URL not set. Exiting.');
    process.exit(1);
  }

  try {
    // Phase 1: Full campground sync (RIDB + USFS + OSM with retry)
    console.log('\n[CRON] === Phase 1: Campground Sync (all sources) ===\n');
    execSync(`npx tsx ${SYNC_SCRIPT} campgrounds`, {
      stdio: 'inherit',
      timeout: 30 * 60 * 1000, // 30 min timeout
    });

    const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
    console.log(`\n[CRON] Data sync completed in ${elapsed} minutes`);
    console.log(`[CRON] Finished at ${new Date().toISOString()}`);
  } catch (error: any) {
    console.error(`[CRON] Sync failed: ${error.message}`);
    process.exit(1);
  }
}

main();
