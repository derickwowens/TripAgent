/**
 * Tests for Itinerary HTML Hosting Feature
 * Run with: npx tsx src/tests/itinerary-host.test.ts
 */

import { storeItinerary, getItinerary, generateItineraryHtml, getItineraryStats } from '../api/itineraryHost.js';

// Simple test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error: any) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertContains(str: string, substr: string) {
  if (!str.includes(substr)) {
    throw new Error(`Expected string to contain "${substr}"`);
  }
}

console.log('\n🧪 Itinerary Host Tests\n');
console.log('━'.repeat(50));

// Test: Store itinerary and get ID
test('storeItinerary returns a 12-char ID', () => {
  const content = '## Trip Overview\nA wonderful trip to Yosemite';
  const id = storeItinerary(content, 'Yosemite');
  assert(id.length === 12, `Expected 12-char ID, got ${id.length}`);
  assert(typeof id === 'string', 'Expected string ID');
});

// Test: Unique IDs
test('storeItinerary generates unique IDs', () => {
  const id1 = storeItinerary('Trip 1', 'Place 1');
  const id2 = storeItinerary('Trip 2', 'Place 2');
  assert(id1 !== id2, 'IDs should be unique');
});

// Test: Store with photos
test('storeItinerary includes photos in HTML', () => {
  const photos = [
    { url: 'https://example.com/photo1.jpg', caption: 'Beautiful view' },
    { url: 'https://example.com/photo2.jpg', keyword: 'mountain' },
  ];
  const id = storeItinerary('Trip content', 'Grand Canyon', photos);
  const retrieved = getItinerary(id);
  assert(retrieved !== null, 'Should retrieve itinerary');
  assertContains(retrieved!.html, 'photo1.jpg');
  assertContains(retrieved!.html, 'Beautiful view');
});

// Test: Store with links
test('storeItinerary includes links in HTML', () => {
  const links = [
    { text: 'Book flights', url: 'https://flights.example.com' },
    { text: 'Park info', url: 'https://nps.gov/yose' },
  ];
  const id = storeItinerary('Trip content', 'Yosemite', undefined, links);
  const retrieved = getItinerary(id);
  assert(retrieved !== null, 'Should retrieve itinerary');
  assertContains(retrieved!.html, 'Book flights');
  assertContains(retrieved!.html, 'https://flights.example.com');
});

// Test: Retrieve by ID
test('getItinerary retrieves stored itinerary', () => {
  const content = '## Day 1\nArrive at the park';
  const id = storeItinerary(content, 'Yellowstone');
  const retrieved = getItinerary(id);
  assert(retrieved !== null, 'Should retrieve itinerary');
  assert(retrieved!.id === id, 'ID should match');
  assert(retrieved!.destination === 'Yellowstone', 'Destination should match');
  assertContains(retrieved!.html, 'Day 1');
});

// Test: Non-existent ID
test('getItinerary returns null for non-existent ID', () => {
  const retrieved = getItinerary('nonexistent123');
  assert(retrieved === null, 'Should return null');
});

// Test: HTML generation with title
test('generateItineraryHtml creates valid HTML with title', () => {
  const html = generateItineraryHtml('Content here', 'Zion National Park');
  assertContains(html, '<!DOCTYPE html>');
  assertContains(html, 'Zion National Park Itinerary');
  assertContains(html, 'TripAgent');
});

// Test: Markdown headers conversion
test('generateItineraryHtml converts markdown headers', () => {
  const content = '## Trip Overview\n### Day 1';
  const html = generateItineraryHtml(content);
  assertContains(html, '<h2>Trip Overview</h2>');
  assertContains(html, '<h3>Day 1</h3>');
});

// Test: Bold conversion
test('generateItineraryHtml converts bold text', () => {
  const content = 'This is **important** information';
  const html = generateItineraryHtml(content);
  assertContains(html, '<strong>important</strong>');
});

// Test: Link preservation
test('generateItineraryHtml preserves links', () => {
  const content = 'Visit [National Park Service](https://nps.gov) for more info';
  const html = generateItineraryHtml(content);
  assertContains(html, '<a href="https://nps.gov"');
  assertContains(html, 'target="_blank"');
});

// Test: Photo gallery
test('generateItineraryHtml includes photo gallery', () => {
  const photos = [{ url: 'https://example.com/img.jpg', caption: 'Mountain view' }];
  const html = generateItineraryHtml('Content', 'Test', photos);
  assertContains(html, 'Trip Photos');
  assertContains(html, 'photo-gallery');
  assertContains(html, 'https://example.com/img.jpg');
});

// Test: Links section
test('generateItineraryHtml includes useful links', () => {
  const links = [{ text: 'Book Now', url: 'https://booking.com' }];
  const html = generateItineraryHtml('Content', 'Test', undefined, links);
  assertContains(html, 'Useful Links');
  assertContains(html, 'Book Now');
});

// Test: Responsive viewport
test('generateItineraryHtml has responsive viewport', () => {
  const html = generateItineraryHtml('Test content');
  assertContains(html, 'viewport');
  assertContains(html, 'width=device-width');
});

// Test: Stats
test('getItineraryStats returns correct count', () => {
  const initialStats = getItineraryStats();
  const id1 = storeItinerary('Trip A', 'Dest A');
  const id2 = storeItinerary('Trip B', 'Dest B');
  const stats = getItineraryStats();
  assert(stats.count >= initialStats.count + 2, 'Count should increase');
  assert(stats.ids.includes(id1), 'Should include id1');
  assert(stats.ids.includes(id2), 'Should include id2');
});

// Integration test
test('Full itinerary with photos, links, and markdown', () => {
  const content = `## Trip Overview
**Destination:** Grand Canyon
## Day 1
- Visit [South Rim](https://nps.gov/grca)
## Budget
- **Entry:** $35`;

  const photos = [{ url: 'https://example.com/canyon.jpg', caption: 'Canyon view' }];
  const links = [{ text: 'NPS Site', url: 'https://nps.gov/grca' }];

  const id = storeItinerary(content, 'Grand Canyon', photos, links);
  const retrieved = getItinerary(id);
  
  assert(retrieved !== null, 'Should retrieve');
  assertContains(retrieved!.html, 'Grand Canyon');
  assertContains(retrieved!.html, 'Trip Photos');
  assertContains(retrieved!.html, 'Useful Links');
  assertContains(retrieved!.html, '<strong>Entry:</strong>');
});

// Summary
console.log('━'.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
