/**
 * Park Data Provider Factory
 * 
 * Returns PostgresParkDataService. DATABASE_URL is required.
 * S3 is no longer used at runtime — all data is served from Postgres.
 * 
 * Uses lazy initialization so dotenv has time to load before we check
 * DATABASE_URL. The provider is created on first access.
 */

import { PostgresParkDataService } from './PostgresParkDataService.js';

let _provider: PostgresParkDataService | null = null;
let _initialized = false;

function init() {
  if (_initialized) return;
  _initialized = true;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[ParkData] DATABASE_URL is required. Postgres is the sole data provider.');
  }
  _provider = new PostgresParkDataService();
  console.log('[ParkData] Using PostgreSQL + earthdistance data provider');
}

/**
 * Get the active park data provider (PostgreSQL).
 * Lazy-initialized so dotenv.config() runs first.
 */
export const parkData = new Proxy({} as PostgresParkDataService, {
  get(_target, prop, receiver) {
    init();
    return Reflect.get(_provider!, prop, receiver);
  },
});

/**
 * Whether the current provider is PostgreSQL (always true now)
 */
export function isPostgresProvider(): boolean {
  return true;
}

/**
 * Get the PostgreSQL provider directly.
 */
export function getPgParkData(): PostgresParkDataService {
  init();
  return _provider!;
}

// Keep backward-compatible export name
export const pgParkData = new Proxy({} as PostgresParkDataService, {
  get(_target, prop, receiver) {
    init();
    return Reflect.get(_provider!, prop, receiver);
  },
});
