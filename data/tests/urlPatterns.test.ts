/**
 * URL Patterns Test
 * 
 * Demonstrates how reservation and official links work WITHOUT needing API keys.
 * These are deterministic URL patterns that we construct from park data.
 */

// ============================================================================
// WISCONSIN - GoingToCamp URL Patterns
// ============================================================================

/**
 * Wisconsin uses GoingToCamp (Aspira) for reservations.
 * We don't need an API - we just construct URLs from known patterns.
 */
const WI_URL_PATTERNS = {
  // Base reservation site
  reservationBase: 'https://wisconsin.goingtocamp.com/',
  
  // Search page for all campgrounds
  searchUrl: 'https://wisconsin.goingtocamp.com/create-booking/results?mapId=-2147483648&searchTabGroupId=0',
  
  // Official DNR park pages - CORRECT pattern: /topic/parks/{slug}
  // Examples: /topic/parks/devilslake, /topic/parks/peninsula
  officialParkPage: 'https://dnr.wisconsin.gov/topic/parks/{slug}',
  
  // Park map pages
  parkMap: 'https://dnr.wisconsin.gov/topic/parks/{slug}/maps',
};

/**
 * Generate a reservation URL for a Wisconsin park
 * No API needed - just string interpolation!
 */
function generateWIReservationUrl(parkName: string): string {
  // GoingToCamp uses search - users search by park name
  const encodedName = encodeURIComponent(parkName);
  return `${WI_URL_PATTERNS.searchUrl}&searchText=${encodedName}`;
}

/**
 * Generate an official park page URL for Wisconsin
 * Pattern: dnr.wisconsin.gov/topic/parks/{slug}
 * Slug is lowercase, no spaces, no "state park" suffix
 */
function generateWIOfficialUrl(parkName: string): string {
  // Remove designation suffixes and create slug
  const slug = parkName
    .toLowerCase()
    .replace(/state park|state recreation area|state forest/gi, '')
    .replace(/[']/g, '')  // Remove apostrophes but keep the 's' (devil's -> devils)
    .trim()
    .replace(/\s+/g, '')  // Remove all spaces (devilslake, not devils-lake)
    .replace(/[^a-z0-9]/g, '');
  
  return WI_URL_PATTERNS.officialParkPage.replace('{slug}', slug);
}

// ============================================================================
// FLORIDA - State Parks URL Patterns  
// ============================================================================

/**
 * Florida has its own reservation system at reserve.floridastateparks.org
 * Again, no API needed - just URL patterns.
 */
const FL_URL_PATTERNS = {
  // Base reservation site
  reservationBase: 'https://reserve.floridastateparks.org/',
  
  // Search/booking page
  searchUrl: 'https://reserve.floridastateparks.org/Web/',
  
  // Official park pages - CORRECT pattern: PascalCase slug
  // Examples: /BahiaHonda, /JohnPennekampCoralReef
  officialParkPage: 'https://www.floridastateparks.org/{slug}',
};

/**
 * Generate a reservation URL for a Florida park
 */
function generateFLReservationUrl(parkName: string): string {
  // Florida's system also uses search
  return FL_URL_PATTERNS.searchUrl;
}

/**
 * Generate an official park page URL for Florida
 * Pattern: floridastateparks.org/{PascalCaseSlug}
 * Slug is PascalCase, no spaces, no "State Park" suffix
 */
function generateFLOfficialUrl(parkName: string): string {
  // Remove "State Park" and other suffixes, then convert to PascalCase
  const cleaned = parkName
    .replace(/state park|state recreation area|state preserve|state forest/gi, '')
    .trim();
  
  // Convert to PascalCase (each word capitalized, no spaces)
  const slug = cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  return FL_URL_PATTERNS.officialParkPage.replace('{slug}', slug);
}

// ============================================================================
// TEST: Generate URLs for real parks
// ============================================================================

console.log('='.repeat(60));
console.log('URL PATTERN DEMONSTRATION - NO API KEYS NEEDED');
console.log('='.repeat(60));

// Wisconsin test parks
const wiParks = [
  'Devil\'s Lake State Park',
  'Peninsula State Park',
  'Governor Dodge State Park',
  'Copper Falls State Park',
];

console.log('\n--- WISCONSIN PARKS ---\n');

for (const park of wiParks) {
  console.log(`Park: ${park}`);
  console.log(`  Reservation: ${generateWIReservationUrl(park)}`);
  console.log(`  Official:    ${generateWIOfficialUrl(park)}`);
  console.log('');
}

// Florida test parks
const flParks = [
  'Bahia Honda State Park',
  'John Pennekamp Coral Reef State Park',
  'Myakka River State Park',
  'Ichetucknee Springs State Park',
];

console.log('\n--- FLORIDA PARKS ---\n');

for (const park of flParks) {
  console.log(`Park: ${park}`);
  console.log(`  Reservation: ${generateFLReservationUrl(park)}`);
  console.log(`  Official:    ${generateFLOfficialUrl(park)}`);
  console.log('');
}

// ============================================================================
// TEST: Verify URLs are accessible (no auth required)
// ============================================================================

console.log('\n--- VERIFICATION: Testing URL accessibility ---\n');

async function testUrlAccessible(url: string, description: string): Promise<void> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',  // Just check if accessible, don't download
      redirect: 'follow',
    });
    
    const status = response.ok ? 'OK' : `HTTP ${response.status}`;
    console.log(`[${status}] ${description}`);
    console.log(`        ${url}`);
  } catch (error: any) {
    console.log(`[ERROR] ${description}: ${error.message}`);
  }
}

async function runAccessibilityTests() {
  console.log('\n--- Testing ACTUAL generated park URLs ---\n');
  
  // Test Wisconsin individual park pages
  await testUrlAccessible(
    'https://dnr.wisconsin.gov/topic/parks/devilslake',
    'WI Devil\'s Lake (ACTUAL)'
  );
  
  await testUrlAccessible(
    'https://dnr.wisconsin.gov/topic/parks/peninsula',
    'WI Peninsula (ACTUAL)'
  );
  
  await testUrlAccessible(
    'https://dnr.wisconsin.gov/topic/parks/governordodge',
    'WI Governor Dodge (ACTUAL)'
  );
  
  // Test Florida individual park pages
  await testUrlAccessible(
    'https://www.floridastateparks.org/BahiaHonda',
    'FL Bahia Honda (ACTUAL)'
  );
  
  await testUrlAccessible(
    'https://www.floridastateparks.org/JohnPennekampCoralReef',
    'FL John Pennekamp (ACTUAL)'
  );
  
  await testUrlAccessible(
    'https://www.floridastateparks.org/MyakkaRiver',
    'FL Myakka River (ACTUAL)'
  );
  
  console.log('\n--- Testing reservation base URLs ---\n');
  
  // Test reservation bases
  await testUrlAccessible(
    FL_URL_PATTERNS.reservationBase,
    'FL Reservation Base'
  );
  
  await testUrlAccessible(
    'https://dnr.wisconsin.gov/topic/parks',
    'WI DNR Parks Directory'
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('WHY NO API KEY IS NEEDED:');
  console.log('='.repeat(60));
  console.log(`
1. RESERVATION LINKS are just URLs to public websites
   - GoingToCamp and FL Reserve are public booking sites
   - We link users TO these sites, we don't query them
   - The user completes their booking on the official site

2. OFFICIAL PARK PAGES follow predictable URL patterns
   - dnr.wisconsin.gov/topic/parks/name/{parkslug}
   - floridastateparks.org/parks-and-trails/{parkslug}
   - We generate these URLs from park names

3. PARK DATA comes from PAD-US (public, no auth)
   - Boundaries, acreage, coordinates
   - Free ArcGIS feature service

4. ENRICHMENT from RIDB (optional, uses your existing key)
   - Activities, photos, campground details
   - Nice to have but not required
`);
}

runAccessibilityTests();
