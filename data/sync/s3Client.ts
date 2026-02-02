/**
 * S3 Client for Park Data Storage
 * 
 * Handles reading and writing park data to S3.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3_CONFIG } from './config.js';
import type { NormalizedPark, StateParkIndex, NationalParkIndex, SyncMetadata } from '../schema/park.schema.js';

const s3Client = new S3Client({
  region: S3_CONFIG.region,
});

/**
 * Upload JSON data to S3
 */
export async function uploadJson<T>(key: string, data: T): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: S3_CONFIG.bucket,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
    CacheControl: 'max-age=3600', // 1 hour cache
  });
  
  await s3Client.send(command);
  console.log(`[S3] Uploaded: ${key}`);
}

/**
 * Download JSON data from S3
 */
export async function downloadJson<T>(key: string): Promise<T | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    });
    
    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();
    
    if (!body) {
      return null;
    }
    
    return JSON.parse(body) as T;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

/**
 * Check if an object exists in S3
 */
export async function objectExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * List objects with a given prefix
 */
export async function listObjects(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_CONFIG.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    
    const response = await s3Client.send(command);
    
    if (response.Contents) {
      keys.push(...response.Contents.map(obj => obj.Key!).filter(Boolean));
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  
  return keys;
}

// Park-specific helpers

/**
 * Upload a normalized park to S3
 */
export async function uploadPark(park: NormalizedPark): Promise<void> {
  const isNational = park.parkType === 'national_park' || 
                     park.parkType === 'national_monument' ||
                     park.parkType === 'national_recreation_area' ||
                     park.parkType === 'national_seashore' ||
                     park.parkType === 'national_preserve';
  
  const basePath = isNational ? S3_CONFIG.paths.nationalParks : S3_CONFIG.paths.stateParks;
  const key = isNational 
    ? `${basePath}/parks/${park.id}.json`
    : `${basePath}/${park.stateCode}/parks/${park.id}.json`;
  
  await uploadJson(key, park);
}

/**
 * Download a park from S3
 */
export async function downloadPark(parkId: string, stateCode?: string): Promise<NormalizedPark | null> {
  // Try state parks first if stateCode provided
  if (stateCode) {
    const stateKey = `${S3_CONFIG.paths.stateParks}/${stateCode}/parks/${parkId}.json`;
    const statePark = await downloadJson<NormalizedPark>(stateKey);
    if (statePark) return statePark;
  }
  
  // Try national parks
  const nationalKey = `${S3_CONFIG.paths.nationalParks}/parks/${parkId}.json`;
  return downloadJson<NormalizedPark>(nationalKey);
}

/**
 * Upload state park index
 */
export async function uploadStateParkIndex(index: StateParkIndex): Promise<void> {
  const key = `${S3_CONFIG.paths.stateParks}/${index.stateCode}/index.json`;
  await uploadJson(key, index);
}

/**
 * Download state park index
 */
export async function downloadStateParkIndex(stateCode: string): Promise<StateParkIndex | null> {
  const key = `${S3_CONFIG.paths.stateParks}/${stateCode}/index.json`;
  return downloadJson<StateParkIndex>(key);
}

/**
 * Upload national park index
 */
export async function uploadNationalParkIndex(index: NationalParkIndex): Promise<void> {
  const key = `${S3_CONFIG.paths.nationalParks}/index.json`;
  await uploadJson(key, index);
}

/**
 * Download national park index
 */
export async function downloadNationalParkIndex(): Promise<NationalParkIndex | null> {
  const key = `${S3_CONFIG.paths.nationalParks}/index.json`;
  return downloadJson<NationalParkIndex>(key);
}

/**
 * Upload sync metadata
 */
export async function uploadSyncMetadata(metadata: SyncMetadata): Promise<void> {
  const suffix = metadata.stateCode ? `${metadata.stateCode}` : 'all';
  const key = `${S3_CONFIG.paths.syncMetadata}/sync-${suffix}.json`;
  await uploadJson(key, metadata);
}

/**
 * Download sync metadata
 */
export async function downloadSyncMetadata(stateCode?: string): Promise<SyncMetadata | null> {
  const suffix = stateCode ? `${stateCode}` : 'all';
  const key = `${S3_CONFIG.paths.syncMetadata}/sync-${suffix}.json`;
  return downloadJson<SyncMetadata>(key);
}

/**
 * Get public URL for a park data file
 */
export function getPublicUrl(key: string): string {
  return `https://${S3_CONFIG.bucket}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`;
}
