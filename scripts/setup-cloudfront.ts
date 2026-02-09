/**
 * CloudFront CDN Setup Script
 * 
 * Creates a CloudFront distribution in front of the S3 park data bucket.
 * This dramatically reduces latency for data fetches (200-500ms -> ~20ms for cached).
 * 
 * Usage: npx tsx scripts/setup-cloudfront.ts
 * 
 * After running, add the output CLOUDFRONT_DOMAIN to your .env file.
 */

import {
  CloudFrontClient,
  CreateDistributionCommand,
  GetDistributionCommand,
  ListDistributionsCommand,
} from '@aws-sdk/client-cloudfront';
import * as dotenv from 'dotenv';

dotenv.config();

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';
const S3_ORIGIN_DOMAIN = `${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

const cf = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is global, but API is in us-east-1

async function checkExistingDistribution(): Promise<string | null> {
  console.log('Checking for existing CloudFront distributions...');
  const resp = await cf.send(new ListDistributionsCommand({}));
  const distributions = resp.DistributionList?.Items || [];
  
  for (const dist of distributions) {
    const origins = dist.Origins?.Items || [];
    for (const origin of origins) {
      if (origin.DomainName === S3_ORIGIN_DOMAIN) {
        console.log(`  Found existing distribution: ${dist.Id} -> ${dist.DomainName}`);
        return dist.DomainName || null;
      }
    }
  }
  return null;
}

async function createDistribution(): Promise<string> {
  console.log(`\nCreating CloudFront distribution for ${S3_ORIGIN_DOMAIN}...`);
  
  const resp = await cf.send(new CreateDistributionCommand({
    DistributionConfig: {
      CallerReference: `tripagent-park-data-${Date.now()}`,
      Comment: 'TripAgent Park Data CDN - S3 acceleration layer',
      Enabled: true,
      DefaultCacheBehavior: {
        TargetOriginId: 'S3-tripagent-park-data',
        ViewerProtocolPolicy: 'redirect-to-https',
        AllowedMethods: {
          Quantity: 2,
          Items: ['GET', 'HEAD'],
          CachedMethods: {
            Quantity: 2,
            Items: ['GET', 'HEAD'],
          },
        },
        ForwardedValues: {
          QueryString: false,
          Cookies: { Forward: 'none' },
        },
        MinTTL: 0,
        DefaultTTL: 3600,    // 1 hour default cache
        MaxTTL: 86400,       // 24 hour max cache
        Compress: true,      // Enable gzip/brotli compression
      },
      Origins: {
        Quantity: 1,
        Items: [
          {
            Id: 'S3-tripagent-park-data',
            DomainName: S3_ORIGIN_DOMAIN,
            S3OriginConfig: {
              OriginAccessIdentity: '', // Public bucket, no OAI needed
            },
          },
        ],
      },
      DefaultRootObject: 'index.json',
      PriceClass: 'PriceClass_100', // US, Canada, Europe (cheapest)
      HttpVersion: 'http2and3',
    },
  }));
  
  const domain = resp.Distribution?.DomainName || '';
  const id = resp.Distribution?.Id || '';
  
  console.log(`\n  Distribution created!`);
  console.log(`  ID: ${id}`);
  console.log(`  Domain: ${domain}`);
  console.log(`  Status: Deploying (takes 5-15 minutes to fully propagate)`);
  
  return domain;
}

async function main() {
  console.log('============================================================');
  console.log('CloudFront CDN Setup for TripAgent Park Data');
  console.log('============================================================');
  console.log(`  S3 Bucket: ${S3_BUCKET}`);
  console.log(`  S3 Origin: ${S3_ORIGIN_DOMAIN}`);
  
  // Check if distribution already exists
  const existing = await checkExistingDistribution();
  
  let domain: string;
  if (existing) {
    console.log(`\n  Distribution already exists! Using: ${existing}`);
    domain = existing;
  } else {
    domain = await createDistribution();
  }
  
  console.log('\n============================================================');
  console.log('Next Steps:');
  console.log('============================================================');
  console.log(`\n  1. Add to your .env file:`);
  console.log(`     CLOUDFRONT_DOMAIN=${domain}`);
  console.log(`\n  2. The server will automatically use CloudFront when this env var is set.`);
  console.log(`     Direct S3 access remains as fallback.\n`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
