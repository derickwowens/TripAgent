/**
 * Unsplash Integration Tests
 * Verifies that Unsplash fallback photos are working correctly
 * 
 * Run with: npx tsx src/tests/unsplash-integration.test.ts
 */

import 'dotenv/config';
import { UnsplashAdapter } from '../providers/UnsplashAdapter.js';

const MIN_PHOTOS_PER_PARK = 8;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => Promise<void> | void) {
  return { name, fn };
}

async function runTest(testCase: { name: string; fn: () => Promise<void> | void }) {
  try {
    await testCase.fn();
    results.push({ name: testCase.name, passed: true, message: 'Passed' });
    console.log(`  ✅ ${testCase.name}`);
  } catch (error: any) {
    results.push({ name: testCase.name, passed: false, message: error.message });
    console.log(`  ❌ ${testCase.name}: ${error.message}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Test cases
const tests = [
  test('Unsplash API key is configured', () => {
    const adapter = new UnsplashAdapter();
    assert(adapter.isConfigured(), 'UNSPLASH_ACCESS_KEY not set in .env');
  }),

  test('Can fetch photos for Yellowstone', async () => {
    const adapter = new UnsplashAdapter();
    const photos = await adapter.searchPhotos('Yellowstone National Park', 5);
    assert(photos.length > 0, `Expected photos, got ${photos.length}`);
    assert(photos[0].url.startsWith('https://'), 'Photo URL should be HTTPS');
    assert(photos[0].source === 'unsplash', 'Source should be unsplash');
  }),

  test('Can fetch photos for Glacier', async () => {
    const adapter = new UnsplashAdapter();
    const photos = await adapter.searchPhotos('Glacier National Park', 5);
    assert(photos.length > 0, `Expected photos, got ${photos.length}`);
  }),

  test('Can fetch photos for Grand Canyon', async () => {
    const adapter = new UnsplashAdapter();
    const photos = await adapter.searchPhotos('Grand Canyon', 5);
    assert(photos.length >= 3, `Expected at least 3 photos, got ${photos.length}`);
  }),

  test('Can fetch photos for Great Smoky Mountains', async () => {
    const adapter = new UnsplashAdapter();
    const photos = await adapter.searchPhotos('Great Smoky Mountains', 5);
    assert(photos.length > 0, `Expected photos, got ${photos.length}`);
  }),

  test('getPhotosByParkName returns multiple photos', async () => {
    const adapter = new UnsplashAdapter();
    const photos = await adapter.getPhotosByParkName('Yosemite', 5);
    assert(photos.length >= 3, `Expected at least 3 photos, got ${photos.length}`);
  }),

  test('Photos have valid structure', async () => {
    const adapter = new UnsplashAdapter();
    const photos = await adapter.searchPhotos('Zion National Park', 3);
    assert(photos.length > 0, 'Expected at least one photo');
    
    const photo = photos[0];
    assert(typeof photo.url === 'string', 'Photo should have url');
    assert(typeof photo.caption === 'string', 'Photo should have caption');
    assert(typeof photo.credit === 'string', 'Photo should have credit');
    assert(photo.credit.includes('Unsplash'), 'Credit should mention Unsplash');
  }),

  test(`Can fetch ${MIN_PHOTOS_PER_PARK} photos for a single park request`, async () => {
    const adapter = new UnsplashAdapter();
    const photos = await adapter.searchPhotos('Arches National Park landscape', MIN_PHOTOS_PER_PARK);
    assert(
      photos.length >= MIN_PHOTOS_PER_PARK - 2, // Allow some tolerance
      `Expected at least ${MIN_PHOTOS_PER_PARK - 2} photos, got ${photos.length}`
    );
  }),
];

async function main() {
  console.log('🧪 Unsplash Integration Tests\n');
  console.log('━'.repeat(50));
  
  // Check if API key exists first
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.log('\n❌ UNSPLASH_ACCESS_KEY not configured in .env');
    console.log('   Add your key to .env to run these tests\n');
    process.exit(1);
  }

  console.log('\nRunning tests...\n');

  for (const testCase of tests) {
    await runTest(testCase);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log('\n' + '━'.repeat(50));
  console.log(`\n📊 Results: ${passed}/${results.length} passed`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!\n');
  }
}

main().catch(console.error);
