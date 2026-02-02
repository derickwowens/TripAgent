/**
 * Trail Coverage Report Generator
 * 
 * Generates a comprehensive coverage report for trail data across all sources.
 * 
 * Run with: npx ts-node data/scripts/generateCoverageReport.ts
 */

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const S3_BUCKET = process.env.PARK_DATA_S3_BUCKET || 'tripagent-park-data';
const S3_REGION = process.env.AWS_REGION || 'us-east-1';

interface CoverageGoal {
  parks: number;
  trails: number;
}

interface CoverageMetrics {
  stateCode: string;
  stateName: string;
  currentParks: number;
  currentTrails: number;
  estimatedTotalParks: number;
  estimatedTotalTrails: number;
  coveragePercent: number;
  trailCoveragePercent: number;
  goals: {
    phase1: CoverageGoal;
    phase2: CoverageGoal;
    phase3: CoverageGoal;
  };
  dataQuality: {
    withDescription: number;
    withDistance: number;
    withDifficulty: number;
    withOfficialUrl: number;
    withCoordinates: number;
  };
  lastUpdated: string;
}

interface NationalParkMetrics {
  totalParks: number;
  totalTrails: number;
  targetParks: number;
  coveragePercent: number;
  dataQuality: {
    withNpsUrl: number;
    withDescription: number;
    withDuration: number;
  };
  lastUpdated: string;
}

const ESTIMATED_TOTALS: Record<string, { parks: number; trails: number }> = {
  WI: { parks: 50, trails: 500 },
  FL: { parks: 175, trails: 1300 },
  NP: { parks: 63, trails: 2000 },
};

async function fetchS3Json(s3Client: S3Client, key: string): Promise<any | null> {
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }));
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return null;
    }
    console.error(`Error fetching ${key}:`, error.message);
    return null;
  }
}

function calculateDataQuality(parks: Record<string, any>): CoverageMetrics['dataQuality'] {
  let withDescription = 0;
  let withDistance = 0;
  let withDifficulty = 0;
  let withOfficialUrl = 0;
  let withCoordinates = 0;
  let totalTrails = 0;

  for (const parkData of Object.values(parks)) {
    const park = parkData as any;
    for (const trail of park.trails || []) {
      totalTrails++;
      if (trail.description) withDescription++;
      if (trail.lengthMiles) withDistance++;
      if (trail.difficulty) withDifficulty++;
      if (trail.officialUrl) withOfficialUrl++;
      if (trail.trailheadCoordinates?.latitude) withCoordinates++;
    }
  }

  if (totalTrails === 0) {
    return { withDescription: 0, withDistance: 0, withDifficulty: 0, withOfficialUrl: 0, withCoordinates: 0 };
  }

  return {
    withDescription: Math.round((withDescription / totalTrails) * 100),
    withDistance: Math.round((withDistance / totalTrails) * 100),
    withDifficulty: Math.round((withDifficulty / totalTrails) * 100),
    withOfficialUrl: Math.round((withOfficialUrl / totalTrails) * 100),
    withCoordinates: Math.round((withCoordinates / totalTrails) * 100),
  };
}

async function main() {
  console.log('============================================================');
  console.log('Trail Coverage Report Generator');
  console.log('============================================================\n');

  const s3Client = new S3Client({ region: S3_REGION });
  const report: {
    generatedAt: string;
    nationalParks: NationalParkMetrics | null;
    stateParks: Record<string, CoverageMetrics>;
    summary: {
      totalParks: number;
      totalTrails: number;
      overallCoverage: number;
      dataQualityScore: number;
    };
  } = {
    generatedAt: new Date().toISOString(),
    nationalParks: null,
    stateParks: {},
    summary: {
      totalParks: 0,
      totalTrails: 0,
      overallCoverage: 0,
      dataQualityScore: 0,
    },
  };

  // Fetch National Parks data
  console.log('Fetching National Parks trail data...');
  const npsData = await fetchS3Json(s3Client, 'trails/api-trails.json');
  if (npsData?.nationalParks) {
    const parks = Object.keys(npsData.nationalParks);
    let totalTrails = 0;
    let withNpsUrl = 0;
    let withDescription = 0;
    let withDuration = 0;

    for (const parkData of Object.values(npsData.nationalParks) as any[]) {
      for (const trail of parkData.trails || []) {
        totalTrails++;
        if (trail.npsUrl) withNpsUrl++;
        if (trail.description) withDescription++;
        if (trail.duration) withDuration++;
      }
    }

    report.nationalParks = {
      totalParks: parks.length,
      totalTrails,
      targetParks: 63,
      coveragePercent: Math.round((parks.length / 63) * 100),
      dataQuality: {
        withNpsUrl: totalTrails > 0 ? Math.round((withNpsUrl / totalTrails) * 100) : 0,
        withDescription: totalTrails > 0 ? Math.round((withDescription / totalTrails) * 100) : 0,
        withDuration: totalTrails > 0 ? Math.round((withDuration / totalTrails) * 100) : 0,
      },
      lastUpdated: npsData._meta?.lastUpdated || 'unknown',
    };

    report.summary.totalParks += parks.length;
    report.summary.totalTrails += totalTrails;
    console.log(`  National Parks: ${parks.length} parks, ${totalTrails} trails`);
  }

  // Fetch Wisconsin data
  console.log('Fetching Wisconsin trail data...');
  const wiData = await fetchS3Json(s3Client, 'trails/state-parks/WI/trails.json');
  if (wiData?.parks) {
    const parks = Object.keys(wiData.parks);
    const totalTrails = wiData._meta?.totalTrails || 0;
    const dataQuality = calculateDataQuality(wiData.parks);

    report.stateParks['WI'] = {
      stateCode: 'WI',
      stateName: 'Wisconsin',
      currentParks: parks.length,
      currentTrails: totalTrails,
      estimatedTotalParks: ESTIMATED_TOTALS.WI.parks,
      estimatedTotalTrails: ESTIMATED_TOTALS.WI.trails,
      coveragePercent: Math.round((parks.length / ESTIMATED_TOTALS.WI.parks) * 100),
      trailCoveragePercent: Math.round((totalTrails / ESTIMATED_TOTALS.WI.trails) * 100),
      goals: wiData._meta?.coverageGoal || {
        phase1: { parks: 25, trails: 150 },
        phase2: { parks: 40, trails: 300 },
        phase3: { parks: 50, trails: 400 },
      },
      dataQuality,
      lastUpdated: wiData._meta?.lastUpdated || 'unknown',
    };

    report.summary.totalParks += parks.length;
    report.summary.totalTrails += totalTrails;
    console.log(`  Wisconsin: ${parks.length} parks, ${totalTrails} trails`);
  }

  // Fetch Florida data
  console.log('Fetching Florida trail data...');
  const flData = await fetchS3Json(s3Client, 'trails/state-parks/FL/trails.json');
  if (flData?.parks) {
    const parks = Object.keys(flData.parks);
    const totalTrails = flData._meta?.totalTrails || 0;
    const dataQuality = calculateDataQuality(flData.parks);

    report.stateParks['FL'] = {
      stateCode: 'FL',
      stateName: 'Florida',
      currentParks: parks.length,
      currentTrails: totalTrails,
      estimatedTotalParks: ESTIMATED_TOTALS.FL.parks,
      estimatedTotalTrails: ESTIMATED_TOTALS.FL.trails,
      coveragePercent: Math.round((parks.length / ESTIMATED_TOTALS.FL.parks) * 100),
      trailCoveragePercent: Math.round((totalTrails / ESTIMATED_TOTALS.FL.trails) * 100),
      goals: flData._meta?.coverageGoal || {
        phase1: { parks: 50, trails: 400 },
        phase2: { parks: 100, trails: 800 },
        phase3: { parks: 150, trails: 1000 },
      },
      dataQuality,
      lastUpdated: flData._meta?.lastUpdated || 'unknown',
    };

    report.summary.totalParks += parks.length;
    report.summary.totalTrails += totalTrails;
    console.log(`  Florida: ${parks.length} parks, ${totalTrails} trails`);
  }

  // Calculate overall metrics
  const totalEstimatedParks = ESTIMATED_TOTALS.WI.parks + ESTIMATED_TOTALS.FL.parks + 63;
  const totalEstimatedTrails = ESTIMATED_TOTALS.WI.trails + ESTIMATED_TOTALS.FL.trails + 2000;
  report.summary.overallCoverage = Math.round((report.summary.totalParks / totalEstimatedParks) * 100);

  // Generate markdown report
  const markdown = `# Trail Coverage Report
Generated: ${new Date().toISOString()}

## Summary

| Metric | Current | Target | Coverage |
|--------|---------|--------|----------|
| Total Parks | ${report.summary.totalParks} | ${totalEstimatedParks} | ${report.summary.overallCoverage}% |
| Total Trails | ${report.summary.totalTrails} | ${totalEstimatedTrails} | ${Math.round((report.summary.totalTrails / totalEstimatedTrails) * 100)}% |

---

## National Parks

| Metric | Value |
|--------|-------|
| Parks with Data | ${report.nationalParks?.totalParks || 0} / 63 |
| Total Trails | ${report.nationalParks?.totalTrails || 0} |
| Coverage | ${report.nationalParks?.coveragePercent || 0}% |

### Data Quality
- Trails with NPS URL: ${report.nationalParks?.dataQuality.withNpsUrl || 0}%
- Trails with Description: ${report.nationalParks?.dataQuality.withDescription || 0}%
- Trails with Duration: ${report.nationalParks?.dataQuality.withDuration || 0}%

---

## State Parks

### Wisconsin
| Metric | Current | Phase 1 Goal | Phase 2 Goal | Phase 3 Goal |
|--------|---------|--------------|--------------|--------------|
| Parks | ${report.stateParks['WI']?.currentParks || 0} | 25 | 40 | 50 |
| Trails | ${report.stateParks['WI']?.currentTrails || 0} | 150 | 300 | 400 |
| Coverage | ${report.stateParks['WI']?.coveragePercent || 0}% | 50% | 80% | 100% |

**Data Quality:**
- With Description: ${report.stateParks['WI']?.dataQuality.withDescription || 0}%
- With Distance: ${report.stateParks['WI']?.dataQuality.withDistance || 0}%
- With Difficulty: ${report.stateParks['WI']?.dataQuality.withDifficulty || 0}%
- With Official URL: ${report.stateParks['WI']?.dataQuality.withOfficialUrl || 0}%
- With Coordinates: ${report.stateParks['WI']?.dataQuality.withCoordinates || 0}%

### Florida
| Metric | Current | Phase 1 Goal | Phase 2 Goal | Phase 3 Goal |
|--------|---------|--------------|--------------|--------------|
| Parks | ${report.stateParks['FL']?.currentParks || 0} | 50 | 100 | 150 |
| Trails | ${report.stateParks['FL']?.currentTrails || 0} | 400 | 800 | 1000 |
| Coverage | ${report.stateParks['FL']?.coveragePercent || 0}% | 29% | 57% | 86% |

**Data Quality:**
- With Description: ${report.stateParks['FL']?.dataQuality.withDescription || 0}%
- With Distance: ${report.stateParks['FL']?.dataQuality.withDistance || 0}%
- With Difficulty: ${report.stateParks['FL']?.dataQuality.withDifficulty || 0}%
- With Official URL: ${report.stateParks['FL']?.dataQuality.withOfficialUrl || 0}%
- With Coordinates: ${report.stateParks['FL']?.dataQuality.withCoordinates || 0}%

---

## Next Steps

1. Run \`fetchWisconsinTrails.ts\` to expand WI coverage
2. Run \`fetchFloridaTrails.ts\` to expand FL coverage
3. Run \`fetchAndUploadTrails.ts\` to refresh NPS data
4. Manual curation for high-priority parks
`;

  // Write reports
  const jsonPath = path.join(__dirname, '../sources/trails/COVERAGE_REPORT.json');
  const mdPath = path.join(__dirname, '../sources/trails/COVERAGE_REPORT.md');
  
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdown);

  console.log(`\nReports written to:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${mdPath}`);

  console.log('\n============================================================');
  console.log('Coverage Summary');
  console.log('============================================================');
  console.log(`Total Parks: ${report.summary.totalParks}`);
  console.log(`Total Trails: ${report.summary.totalTrails}`);
  console.log(`Overall Coverage: ${report.summary.overallCoverage}%`);
}

main().catch(console.error);
