/**
 * Test for Open Charge Map EV Charging Stations API
 * Run with: npx tsx src/tests/ev-charging-api.test.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { OpenChargeMapAdapter } from '../providers/OpenChargeMapAdapter.js';

// Log API key status
const apiKey = process.env.OPEN_CHARGE_MAP_API_KEY;
console.log(apiKey ? `✅ API key found: ${apiKey.substring(0, 8)}...` : '❌ No API key found');

const adapter = new OpenChargeMapAdapter();

interface TestCase {
  description: string;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}

const testCases: TestCase[] = [
  {
    description: 'Los Angeles to Yosemite',
    originLat: 34.0522,
    originLng: -118.2437,
    destLat: 37.8651,
    destLng: -119.5383,
  },
  {
    description: 'Denver to Rocky Mountain NP',
    originLat: 39.8561,
    originLng: -104.6737,
    destLat: 40.3428,
    destLng: -105.6836,
  },
  {
    description: 'Miami to Everglades',
    originLat: 25.7959,
    originLng: -80.2870,
    destLat: 25.2866,
    destLng: -80.8987,
  },
  {
    description: 'San Francisco to Lake Tahoe',
    originLat: 37.7749,
    originLng: -122.4194,
    destLat: 39.0968,
    destLng: -120.0324,
  },
];

async function runTests() {
  console.log('='.repeat(60));
  console.log('Open Charge Map EV Charging Stations API Test');
  console.log('='.repeat(60));
  console.log();

  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.description}`);
    console.log(`  Route: (${testCase.originLat}, ${testCase.originLng}) → (${testCase.destLat}, ${testCase.destLng})`);
    
    try {
      const stations = await adapter.searchAlongRoute(
        testCase.originLat,
        testCase.originLng,
        testCase.destLat,
        testCase.destLng,
        25, // corridor width in miles
        10  // max results
      );
      
      if (stations && stations.length > 0) {
        console.log(`  ✅ Found ${stations.length} charging stations:`);
        
        // Show first 3 stations
        stations.slice(0, 3).forEach((station, idx) => {
          const teslaTag = station.isTeslaSupercharger ? ' [TESLA]' : '';
          console.log(`     ${idx + 1}. ${station.name} - ${station.city}, ${station.state}${teslaTag}`);
          console.log(`        Operator: ${station.operator}, Power: ${station.powerKW}kW, Chargers: ${station.numPoints}`);
        });
        
        if (stations.length > 3) {
          console.log(`     ... and ${stations.length - 3} more`);
        }
        
        // Count Tesla Superchargers
        const teslaCount = stations.filter(s => s.isTeslaSupercharger).length;
        if (teslaCount > 0) {
          console.log(`     ⚡ ${teslaCount} Tesla Supercharger(s) found`);
        }
        
        passCount++;
      } else {
        console.log(`  ⚠️ No charging stations found along this route`);
        passCount++; // Still a valid response
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failCount++;
    }
    
    console.log();
  }

  // Test Tesla-only search
  console.log('Testing: Tesla Superchargers near Los Angeles');
  try {
    const teslaStations = await adapter.searchTeslaSuperchargers(34.0522, -118.2437, 50);
    if (teslaStations.length > 0) {
      console.log(`  ✅ Found ${teslaStations.length} Tesla Superchargers`);
      teslaStations.slice(0, 3).forEach((station, idx) => {
        console.log(`     ${idx + 1}. ${station.name} - ${station.city}, ${station.state}`);
      });
      passCount++;
    } else {
      console.log(`  ⚠️ No Tesla Superchargers found (API may not have data for this area)`);
      passCount++;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    failCount++;
  }

  console.log();
  console.log('='.repeat(60));
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));
  console.log();
  console.log('Note: Open Charge Map is a free API with community-sourced data.');
  console.log('Station availability may vary by region.');
}

// Run the tests
runTests().catch(console.error);
