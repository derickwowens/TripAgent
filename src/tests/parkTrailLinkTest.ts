/**
 * Park & Trail Link Validation Tests
 * Tests that all park and trail links are valid URLs
 */

import { 
  generateGoogleMapsLink, 
  generateDirectionsLink, 
  generateAllTrailsLink, 
  generateNPSCampgroundLink, 
  generateRecreationGovLink 
} from '../utils/linkUtils.js';

function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

async function runTests() {
  console.log('=== Park & Trail Link Validation ===\n');
  let passed = 0;
  let failed = 0;

  const testCases = [
    { name: 'Yellowstone Visitor Center', city: 'Yellowstone National Park', state: 'WY' },
    { name: 'Grand Canyon South Rim', city: 'Grand Canyon Village', state: 'AZ' },
    { name: 'Zion Canyon Visitor Center', city: 'Springdale', state: 'UT' },
    { name: 'Yosemite Valley', city: 'Yosemite National Park', state: 'CA' },
    { name: "Devil's Lake State Park", city: 'Baraboo', state: 'WI' },
    { name: 'Slide Rock State Park', city: 'Sedona', state: 'AZ' },
    { name: 'Deception Pass State Park', city: 'Oak Harbor', state: 'WA' },
    { name: 'Big Basin Redwoods State Park', city: 'Boulder Creek', state: 'CA' },
  ];

  console.log('Google Maps Links:');
  for (const tc of testCases) {
    const url = generateGoogleMapsLink(tc.name, tc.city, tc.state);
    if (validateUrl(url)) {
      console.log(`  OK: ${tc.name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${tc.name} - ${url}`);
      failed++;
    }
  }

  console.log('\nDirections Links:');
  for (const tc of testCases.slice(0, 4)) {
    const url = generateDirectionsLink(`${tc.name}, ${tc.city}, ${tc.state}`);
    if (validateUrl(url)) {
      console.log(`  OK: ${tc.name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${tc.name} - ${url}`);
      failed++;
    }
  }

  console.log('\nAllTrails Links:');
  const trails = [
    { name: 'Angels Landing', park: 'Zion National Park' },
    { name: 'Half Dome', park: 'Yosemite National Park' },
    { name: 'Rim Trail', park: 'Grand Canyon National Park' },
    { name: 'Old Faithful Geyser Trail', park: 'Yellowstone National Park' },
    { name: 'Ice Age Trail', park: "Devil's Lake State Park" },
  ];
  for (const t of trails) {
    const url = generateAllTrailsLink(t.name, t.park);
    if (validateUrl(url)) {
      console.log(`  OK: ${t.name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${t.name} - ${url}`);
      failed++;
    }
  }

  console.log('\nNPS Campground Links:');
  const parkCodes = ['yell', 'grca', 'zion', 'yose', 'glac', 'romo', 'acad', 'olym'];
  for (const code of parkCodes) {
    const url = generateNPSCampgroundLink(code);
    if (validateUrl(url)) {
      console.log(`  OK: ${code}`);
      passed++;
    } else {
      console.log(`  FAIL: ${code} - ${url}`);
      failed++;
    }
  }

  console.log('\nRecreation.gov Links:');
  const campgrounds = [
    'Madison Campground',
    'Mather Campground',
    'Watchman Campground',
    'Upper Pines Campground',
    'Many Glacier Campground',
  ];
  for (const cg of campgrounds) {
    const url = generateRecreationGovLink(cg);
    if (validateUrl(url)) {
      console.log(`  OK: ${cg}`);
      passed++;
    } else {
      console.log(`  FAIL: ${cg} - ${url}`);
      failed++;
    }
  }

  console.log('\n============================================================');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('\nAll park & trail links are valid!');
  } else {
    console.log('\nSome links failed validation!');
    process.exit(1);
  }
}

runTests().catch(console.error);
