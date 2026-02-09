/**
 * Park Data Provider Factory
 * 
 * Returns PostgresParkDataService when DATABASE_URL is configured,
 * otherwise falls back to S3ParkDataService.
 * 
 * Uses lazy initialization so dotenv has time to load before we check
 * DATABASE_URL. The provider is created on first access.
 */

import { S3ParkDataService, s3ParkData } from './S3ParkDataService.js';
import { PostgresParkDataService } from './PostgresParkDataService.js';

let _provider: PostgresParkDataService | S3ParkDataService | null = null;
let _pgProvider: PostgresParkDataService | null = null;
let _initialized = false;

function init() {
  if (_initialized) return;
  _initialized = true;

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    _pgProvider = new PostgresParkDataService();
    _provider = _pgProvider;
    console.log('[ParkData] Using PostgreSQL + earthdistance data provider');
  } else {
    _provider = s3ParkData;
    console.log('[ParkData] Using S3 data provider (set DATABASE_URL for Postgres)');
  }
}

/**
 * Get the active park data provider.
 * Returns Postgres service if DATABASE_URL is set, otherwise S3 service.
 * Lazy-initialized so dotenv.config() runs first.
 */
export const parkData = new Proxy({} as PostgresParkDataService & S3ParkDataService, {
  get(_target, prop, receiver) {
    init();
    return Reflect.get(_provider!, prop, receiver);
  },
});

/**
 * Whether the current provider is PostgreSQL
 */
export function isPostgresProvider(): boolean {
  init();
  return !!_pgProvider;
}

/**
 * Get the PostgreSQL provider directly (for spatial queries not available in S3)
 * Returns null if DATABASE_URL is not configured.
 */
export function getPgParkData(): PostgresParkDataService | null {
  init();
  return _pgProvider;
}

// Keep backward-compatible export name
export const pgParkData = new Proxy({} as PostgresParkDataService, {
  get(_target, prop, receiver) {
    init();
    if (!_pgProvider) return undefined;
    return Reflect.get(_pgProvider, prop, receiver);
  },
});
