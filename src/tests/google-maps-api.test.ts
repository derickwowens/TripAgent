/**
 * Test for Google Maps Distance Matrix API
 * Run with: npx tsx src/tests/google-maps-api.test.ts
 */

import { GoogleMapsAdapter } from '../providers/GoogleMapsAdapter.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const adapter = new GoogleMapsAdapter();

interface TestCase {
  origin: string;
  destination: string;
  description: string;
}

const testCases: TestCase[] = [
  {
    origin: 'LAX Airport, Los Angeles, CA',
    destination: 'Yosemite National Park, CA',
    description: 'LAX to Yosemite',
  },
  {
    origin: 'Denver International Airport, CO',
    destination: 'Rocky Mountain National Park, CO',
    description: 'Denver to Rocky Mountain',
  },
  {
    origin: 'McGhee Tyson Airport, Knoxville, TN',
    destination: 'Great Smoky Mountains National Park',
    description: 'Knoxville to Great Smoky Mountains',
  },
  {
    origin: 'Miami International Airport, FL',
    destination: 'Everglades National Park, FL',
    description: 'Miami to Everglades',
  },
];

async function runTests() {
  console.log('='.repeat(60));
  console.log('Google Maps Distance Matrix API Test');
  console.log('='.repeat(60));
  console.log();

  // Check if API key is configured
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.log('⚠️  GOOGLE_MAPS_API_KEY not found in environment');
    console.log('   The adapter will use fallback estimates instead of real API data');
    console.log();
  } else {
    console.log('✅ GOOGLE_MAPS_API_KEY is configured');
    console.log(`   Key prefix: ${apiKey.substring(0, 8)}...`);
    console.log();
  }

  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.description}`);
    console.log(`  Origin: ${testCase.origin}`);
    console.log(`  Destination: ${testCase.destination}`);
    
    try {
      const result = await adapter.getDistance(testCase.origin, testCase.destination);
      
      if (result) {
        console.log(`  ✅ Result:`);
        console.log(`     Status: ${result.status}`);
        console.log(`     Distance: ${result.distance.text}`);
        console.log(`     Duration: ${result.duration.text}`);
        
        if (result.status === 'OK') {
          console.log(`     📍 Using REAL Google Maps API data`);
          passCount++;
        } else if (result.status === 'ESTIMATED') {
          console.log(`     ⚠️  Using FALLBACK estimation (API key missing or error)`);
          passCount++;
        } else if (result.status === 'UNKNOWN') {
          console.log(`     ❌ Unknown route - no data available`);
          failCount++;
        }
      } else {
        console.log(`  ❌ No result returned`);
        failCount++;
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failCount++;
    }
    
    console.log();
  }

  console.log('='.repeat(60));
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  console.log('='.repeat(60));
  
  if (!apiKey) {
    console.log();
    console.log('To enable real Google Maps API data:');
    console.log('1. Get an API key from https://console.cloud.google.com/');
    console.log('2. Enable "Distance Matrix API" in your Google Cloud project');
    console.log('3. Add GOOGLE_MAPS_API_KEY=your_key to your .env file');
  }
}

// Run the tests
runTests().catch(console.error);
