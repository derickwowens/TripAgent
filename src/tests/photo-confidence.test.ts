/**
 * Integration Tests for Photo Confidence Scoring
 * Run with: npx tsx src/tests/photo-confidence.test.ts
 * 
 * Tests that photos are correctly filtered based on relevance to trip destinations
 */

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

function assertGreaterThan(value: number, threshold: number, message: string) {
  if (value <= threshold) {
    throw new Error(`${message}: ${value} <= ${threshold}`);
  }
}

function assertLessThan(value: number, threshold: number, message: string) {
  if (value >= threshold) {
    throw new Error(`${message}: ${value} >= ${threshold}`);
  }
}

// ============================================
// Photo Confidence Scoring Function (copied from chat.ts for testing)
// ============================================
function calculatePhotoConfidence(
  photo: { keyword: string; url: string; caption?: string },
  tripDestination: string | undefined,
  conversationText: string
): number {
  let score = 0;
  const keyword = photo.keyword.toLowerCase();
  const caption = (photo.caption || '').toLowerCase();
  const destination = (tripDestination || '').toLowerCase();
  const conversation = conversationText.toLowerCase();
  
  // Clean destination for matching (remove "national park" etc)
  const cleanDest = destination
    .replace('national park', '')
    .replace('national', '')
    .replace('park', '')
    .trim();
  
  // CRITICAL: Photo keyword must contain destination name or vice versa
  // This is the primary filter - without this match, score stays very low
  const hasDestinationMatch = cleanDest.length > 2 && (
    keyword.includes(cleanDest) || 
    cleanDest.includes(keyword.split(' ')[0]) ||
    caption.includes(cleanDest)
  );
  
  if (hasDestinationMatch) {
    score += 50; // Strong base for matching destination
  }
  
  // Check if photo is from a trusted source (NPS, official)
  const url = photo.url.toLowerCase();
  const isTrustedSource = url.includes('nps.gov') || 
                          url.includes('recreation.gov') ||
                          url.includes('nationalpark');
  if (isTrustedSource) score += 15; // Reduced from 30 - source alone isn't enough
  
  // Check if keyword/caption appears in conversation context
  const keywordWords = keyword.split(' ').filter(w => w.length > 4);
  const keywordInConversation = keywordWords.some(w => conversation.includes(w));
  if (keywordInConversation) score += 20;
  
  // Check caption relevance to destination
  if (caption && cleanDest.length > 2) {
    if (caption.includes(cleanDest)) {
      score += 15;
    }
  }
  
  // Cap at 100
  return Math.min(100, score);
}

// ============================================
// Park Relevance Filter Function (copied from chat.ts for testing)
// ============================================
function filterRelevantParks(
  parks: Array<{ name: string; parkCode: string }>,
  searchQuery: string
): Array<{ name: string; parkCode: string }> {
  const cleanQuery = searchQuery
    .replace(/national park/gi, '')
    .replace(/national/gi, '')
    .replace(/park/gi, '')
    .trim()
    .toLowerCase();
  
  return parks.filter(park => {
    const parkNameLower = park.name.toLowerCase();
    const parkCodeLower = park.parkCode.toLowerCase();
    
    // Strip common suffixes from park name
    const coreName = parkNameLower
      .replace(/ national park$/i, '')
      .replace(/ national historical park$/i, '')
      .replace(/ national historic site$/i, '')
      .replace(/ national monument$/i, '')
      .replace(/ national recreation area$/i, '')
      .trim();
    
    // Direct matches - any of these should pass
    if (parkCodeLower === cleanQuery) return true;
    if (coreName === cleanQuery) return true;
    if (cleanQuery.length >= 3 && coreName.includes(cleanQuery)) return true;
    if (coreName.length >= 3 && cleanQuery.includes(coreName)) return true;
    if (cleanQuery.length >= 3 && parkNameLower.includes(cleanQuery)) return true;
    
    // Word-based matching for multi-word queries
    const searchWords = cleanQuery.split(/\s+/).filter((w: string) => w.length >= 3);
    if (searchWords.length > 0) {
      const hasMatch = searchWords.some((sw: string) => 
        coreName.includes(sw) || parkNameLower.includes(sw)
      );
      if (hasMatch) return true;
    }
    
    return false;
  });
}

console.log('\n🧪 Photo Confidence Scoring Tests\n');
console.log('━'.repeat(50));

// ============================================
// CONFIDENCE SCORING TESTS
// ============================================

console.log('\n📸 Confidence Scoring Tests\n');

test('NPS photos get +15 trusted source bonus (but not enough alone)', () => {
  const photo = {
    keyword: 'Random Photo',
    url: 'https://www.nps.gov/common/uploads/photo.jpg',
  };
  const score = calculatePhotoConfidence(photo, undefined, '');
  assertLessThan(score, 60, 'NPS alone should NOT pass threshold');
});

test('Exact destination match gets high score', () => {
  const photo = {
    keyword: 'Yosemite National Park',
    url: 'https://www.nps.gov/yose/photo.jpg',
    caption: 'Yosemite National Park - Half Dome'
  };
  const score = calculatePhotoConfidence(photo, 'Yosemite', 'Planning a trip to Yosemite');
  assertGreaterThan(score, 80, 'Exact match should score 80+');
});

test('Rocky Mountain matches "rocky mountain national park"', () => {
  const photo = {
    keyword: 'Rocky Mountain National Park',
    url: 'https://www.nps.gov/romo/photo.jpg',
    caption: 'Rocky Mountain National Park'
  };
  const score = calculatePhotoConfidence(photo, 'Rocky Mountain', 'Trip to Rocky Mountain National Park');
  assertGreaterThan(score, 60, 'Rocky Mountain should match and score 60+');
});

test('Arches matches arches national park', () => {
  const photo = {
    keyword: 'Arches National Park',
    url: 'https://www.nps.gov/arch/photo.jpg',
    caption: 'Arches National Park - Delicate Arch'
  };
  const score = calculatePhotoConfidence(photo, 'Arches', 'Planning trip to Arches');
  assertGreaterThan(score, 60, 'Arches should score 60+');
});

test('Unrelated park gets low score', () => {
  const photo = {
    keyword: 'Abraham Lincoln Birthplace',
    url: 'https://www.nps.gov/abli/photo.jpg',
    caption: 'Abraham Lincoln Birthplace National Historic Park'
  };
  const score = calculatePhotoConfidence(photo, 'Arches', 'Trip to Arches National Park in Utah');
  assertLessThan(score, 60, 'Unrelated park should score below threshold');
});

test('Great Smoky Mountains matches "smoky" query', () => {
  const photo = {
    keyword: 'Great Smoky Mountains National Park',
    url: 'https://www.nps.gov/grsm/photo.jpg',
    caption: 'Great Smoky Mountains'
  };
  const score = calculatePhotoConfidence(photo, 'Smoky Mountains', 'Trip to the Smokies');
  assertGreaterThan(score, 60, 'Smoky Mountains should score 60+');
});

test('Non-NPS random URL scores lower', () => {
  const photo = {
    keyword: 'Some Random Place',
    url: 'https://random-site.com/photo.jpg',
  };
  const score = calculatePhotoConfidence(photo, 'Yosemite', 'Trip to Yosemite');
  assertLessThan(score, 30, 'Random unrelated photo should score low');
});

test('Photo with destination match + conversation context scores high', () => {
  const photo = {
    keyword: 'Yosemite Half Dome',
    url: 'https://www.nps.gov/yose/photo.jpg',
    caption: 'Half Dome at Yosemite'
  };
  const score = calculatePhotoConfidence(
    photo, 
    'Yosemite', 
    'I want to hike Half Dome at Yosemite'
  );
  assertGreaterThan(score, 60, 'Destination match with context should score high');
});

// ============================================
// PARK RELEVANCE FILTER TESTS
// ============================================

console.log('\n🏞️ Park Relevance Filter Tests\n');

const mockParks = [
  { name: 'Arches National Park', parkCode: 'arch' },
  { name: 'Rocky Mountain National Park', parkCode: 'romo' },
  { name: 'Abraham Lincoln Birthplace National Historical Park', parkCode: 'abli' },
  { name: 'Great Smoky Mountains National Park', parkCode: 'grsm' },
  { name: 'Yellowstone National Park', parkCode: 'yell' },
  { name: 'Yosemite National Park', parkCode: 'yose' },
  { name: 'Grand Canyon National Park', parkCode: 'grca' },
  { name: 'Zion National Park', parkCode: 'zion' },
  { name: 'Olympic National Park', parkCode: 'olym' },
];

test('Filter finds "Arches" for arches query', () => {
  const results = filterRelevantParks(mockParks, 'arches');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'arch'), 'Should find Arches');
  assert(!results.some(p => p.parkCode === 'abli'), 'Should NOT include Abraham Lincoln');
});

test('Filter finds "Rocky Mountain" for rocky mountain query', () => {
  const results = filterRelevantParks(mockParks, 'rocky mountain');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'romo'), 'Should find Rocky Mountain');
});

test('Filter finds "Smoky" for great smoky query', () => {
  const results = filterRelevantParks(mockParks, 'smoky');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'grsm'), 'Should find Great Smoky Mountains');
});

test('Filter finds "Olympic" for olympic national park query', () => {
  const results = filterRelevantParks(mockParks, 'olympic national park');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'olym'), 'Should find Olympic');
  assert(!results.some(p => p.parkCode === 'abli'), 'Should NOT include Abraham Lincoln');
});

test('Filter finds "Zion" for zion query', () => {
  const results = filterRelevantParks(mockParks, 'zion');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'zion'), 'Should find Zion');
  assert(!results.some(p => p.parkCode === 'abli'), 'Should NOT include Abraham Lincoln');
});

test('Filter finds park by code', () => {
  const results = filterRelevantParks(mockParks, 'yose');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'yose'), 'Should find Yosemite by code');
});

test('Filter finds "Grand Canyon" with partial match', () => {
  const results = filterRelevantParks(mockParks, 'grand canyon');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'grca'), 'Should find Grand Canyon');
});

test('Filter excludes unrelated parks', () => {
  const results = filterRelevantParks(mockParks, 'yellowstone');
  assert(results.length >= 1, 'Should find at least 1 park');
  assert(results.some(p => p.parkCode === 'yell'), 'Should find Yellowstone');
  assert(!results.some(p => p.parkCode === 'zion'), 'Should NOT include Zion');
  assert(!results.some(p => p.parkCode === 'arch'), 'Should NOT include Arches');
});

// ============================================
// INTEGRATION SCENARIO TESTS
// ============================================

console.log('\n🔄 Integration Scenario Tests\n');

test('Scenario: User asks about Arches - only Arches photos pass', () => {
  const THRESHOLD = 60;
  const destination = 'Arches';
  const conversation = 'I want to plan a trip to Arches National Park in Utah';
  
  const photos = [
    { keyword: 'Arches National Park', url: 'https://www.nps.gov/arch/photo.jpg', caption: 'Arches National Park' },
    { keyword: 'Delicate Arch', url: 'https://www.nps.gov/arch/delicate.jpg', caption: 'Delicate Arch at Arches' },
    { keyword: 'Abraham Lincoln Birthplace', url: 'https://www.nps.gov/abli/photo.jpg', caption: 'Lincoln Birthplace' },
  ];
  
  const passed = photos.filter(p => calculatePhotoConfidence(p, destination, conversation) >= THRESHOLD);
  
  assert(passed.length >= 1, 'At least 1 Arches photo should pass');
  assert(passed.some(p => p.keyword.includes('Arches') || p.keyword.includes('Delicate')), 'Arches photos should pass');
  assert(!passed.some(p => p.keyword.includes('Lincoln')), 'Lincoln photo should NOT pass');
});

test('Scenario: User asks about Rocky Mountain - Rocky Mountain photos pass', () => {
  const THRESHOLD = 60;
  const destination = 'Rocky Mountain';
  const conversation = 'Planning a trip to Rocky Mountain National Park in Colorado';
  
  const photos = [
    { keyword: 'Rocky Mountain National Park', url: 'https://www.nps.gov/romo/photo.jpg', caption: 'Rocky Mountain NP' },
    { keyword: 'Bear Lake', url: 'https://www.nps.gov/romo/bear.jpg', caption: 'Bear Lake at Rocky Mountain' },
    { keyword: 'Grand Canyon', url: 'https://www.nps.gov/grca/photo.jpg', caption: 'Grand Canyon' },
  ];
  
  const passed = photos.filter(p => calculatePhotoConfidence(p, destination, conversation) >= THRESHOLD);
  
  assert(passed.length >= 1, 'At least 1 Rocky Mountain photo should pass');
  assert(passed.some(p => p.keyword.includes('Rocky') || p.caption?.includes('Rocky')), 'Rocky Mountain photos should pass');
});

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '━'.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
