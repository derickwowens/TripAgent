/**
 * Upload Trail Data to S3
 * 
 * This script uploads the trail data JSON file to S3 so it can be accessed
 * by the S3ParkDataService for deterministic AllTrails URL retrieval.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function uploadTrailData(): Promise<void> {
  console.log('='.repeat(50));
  console.log('Trail Data Upload to S3');
  console.log('='.repeat(50));
  console.log(`Bucket: ${S3_BUCKET}`);
  console.log(`Region: ${S3_REGION}`);
  console.log('');

  try {
    // Read the trail data file
    const trailDataPath = join(__dirname, '../sources/trails/national-parks-trails.json');
    const trailData = await readFile(trailDataPath, 'utf-8');
    const parsed = JSON.parse(trailData);
    
    // Count trails
    let totalTrails = 0;
    const parkCounts: Record<string, number> = {};
    for (const [parkCode, parkData] of Object.entries(parsed.parks)) {
      const count = (parkData as any).trails.length;
      parkCounts[parkCode] = count;
      totalTrails += count;
    }
    
    console.log(`Found ${Object.keys(parsed.parks).length} parks with ${totalTrails} trails:`);
    for (const [parkCode, count] of Object.entries(parkCounts)) {
      console.log(`  - ${parkCode}: ${count} trails`);
    }
    console.log('');

    // Upload to S3
    const key = 'trails/national-parks-trails.json';
    console.log(`Uploading to s3://${S3_BUCKET}/${key}...`);
    
    await s3Client.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: trailData,
      ContentType: 'application/json',
      CacheControl: 'max-age=3600', // Cache for 1 hour
    }));
    
    console.log('[OK] Trail data uploaded successfully!');
    console.log('');
    console.log('Public URL:');
    console.log(`  https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`);
    console.log('');
    console.log('='.repeat(50));
    console.log('Upload Complete');
    console.log('='.repeat(50));
    
  } catch (error: any) {
    console.error('[ERROR] Upload failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
uploadTrailData();
