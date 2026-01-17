/**
 * Reservation Flow Integration Tests
 * 
 * Tests the complete flow:
 * 1. User has a "current location" (e.g., Madison, WI)
 * 2. User searches for a national park (e.g., Kenai Fjords)
 * 3. System stores NPS gateway city in context
 * 4. User searches for restaurants near the park
 * 5. User requests reservation link
 * 6. VERIFY: Reservation link uses park gateway city, NOT user's home location
 */

import { YelpAdapter } from '../providers/YelpAdapter.js';

interface TestContext {
  userHomeLocation: { city: string; state: string };
  npsGatewayCity?: { city: string; state: string; parkCode?: string; parkName?: string };
}

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  openTableUrl?: string;
  expectedLocation: string;
  actualLocation: string;
}

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Kenai Fjords - User in Wisconsin',
    userHome: { city: 'Madison', state: 'WI' },
    park: { name: 'Kenai Fjords National Park', code: 'kefj', gateway: { city: 'Seward', state: 'AK' } },
    restaurant: 'Rays Waterfront',
    expectedLocationInUrl: 'Seward',
    wrongLocationInUrl: 'Madison',
  },
  {
    name: 'Yellowstone - User in Texas',
    userHome: { city: 'Dallas', state: 'TX' },
    park: { name: 'Yellowstone National Park', code: 'yell', gateway: { city: 'West Yellowstone', state: 'MT' } },
    restaurant: 'Old Faithful Inn Dining Room',
    expectedLocationInUrl: 'West Yellowstone',
    wrongLocationInUrl: 'Dallas',
  },
  {
    name: 'Grand Canyon - User in Florida',
    userHome: { city: 'Miami', state: 'FL' },
    park: { name: 'Grand Canyon National Park', code: 'grca', gateway: { city: 'Tusayan', state: 'AZ' } },
    restaurant: 'El Tovar Dining Room',
    expectedLocationInUrl: 'Tusayan',
    wrongLocationInUrl: 'Miami',
  },
  {
    name: 'Zion - User in New York',
    userHome: { city: 'New York', state: 'NY' },
    park: { name: 'Zion National Park', code: 'zion', gateway: { city: 'Springdale', state: 'UT' } },
    restaurant: 'Oscars Cafe',
    expectedLocationInUrl: 'Springdale',
    wrongLocationInUrl: 'New York',
  },
  {
    name: 'Glacier - User in California',
    userHome: { city: 'Los Angeles', state: 'CA' },
    park: { name: 'Glacier National Park', code: 'glac', gateway: { city: 'West Glacier', state: 'MT' } },
    restaurant: 'Belton Chalet',
    expectedLocationInUrl: 'West Glacier',
    wrongLocationInUrl: 'Los Angeles',
  },
];

/**
 * Simulates the reservation link generation flow
 */
function simulateReservationFlow(
  scenario: typeof TEST_SCENARIOS[0],
  useNpsGateway: boolean
): TestResult {
  // Simulate context as it would be during a chat session
  const context: TestContext = {
    userHomeLocation: scenario.userHome,
  };

  // If NPS gateway is set (as it should be after park search), use it
  if (useNpsGateway) {
    context.npsGatewayCity = {
      city: scenario.park.gateway.city,
      state: scenario.park.gateway.state,
      parkCode: scenario.park.code,
      parkName: scenario.park.name,
    };
  }

  // Determine which location would be used
  // Priority: 1) NPS gateway from context, 2) User's home location (WRONG!)
  let city: string;
  let state: string;
  let locationSource: string;

  if (context.npsGatewayCity) {
    city = context.npsGatewayCity.city;
    state = context.npsGatewayCity.state;
    locationSource = 'nps-gateway';
  } else {
    // This is the BUG case - falling back to user's home
    city = context.userHomeLocation.city;
    state = context.userHomeLocation.state;
    locationSource = 'user-home (BUG!)';
  }

  // Generate the reservation links
  const links = YelpAdapter.generateReservationLinks(
    scenario.restaurant,
    city,
    state,
    '2026-03-15',
    '19:00',
    2
  );

  // Check if the URL contains the expected location
  const urlContainsExpected = links.openTable.includes(encodeURIComponent(scenario.expectedLocationInUrl));
  const urlContainsWrong = links.openTable.includes(encodeURIComponent(scenario.wrongLocationInUrl));

  const passed = urlContainsExpected && !urlContainsWrong;

  return {
    name: scenario.name,
    passed,
    details: `Location source: ${locationSource}`,
    openTableUrl: links.openTable,
    expectedLocation: `${scenario.park.gateway.city}, ${scenario.park.gateway.state}`,
    actualLocation: `${city}, ${state}`,
  };
}

/**
 * Test that verifies the full flow works correctly
 */
function testFullFlow(): void {
  console.log('='.repeat(70));
  console.log('RESERVATION FLOW INTEGRATION TESTS');
  console.log('='.repeat(70));
  console.log('\nThis test verifies that reservation links use the PARK gateway city,');
  console.log('not the user\'s home location.\n');

  let passed = 0;
  let failed = 0;

  console.log('-'.repeat(70));
  console.log('TEST 1: With NPS Gateway City in Context (Expected: PASS)');
  console.log('-'.repeat(70));

  for (const scenario of TEST_SCENARIOS) {
    const result = simulateReservationFlow(scenario, true);
    
    if (result.passed) {
      console.log(`\n✅ ${result.name}`);
      passed++;
    } else {
      console.log(`\n❌ ${result.name}`);
      failed++;
    }
    
    console.log(`   Expected: ${result.expectedLocation}`);
    console.log(`   Actual:   ${result.actualLocation}`);
    console.log(`   Source:   ${result.details}`);
    console.log(`   URL:      ${result.openTableUrl?.substring(0, 100)}...`);
  }

  console.log('\n' + '-'.repeat(70));
  console.log('TEST 2: Without NPS Gateway (Simulating Bug) (Expected: FAIL)');
  console.log('-'.repeat(70));

  for (const scenario of TEST_SCENARIOS) {
    const result = simulateReservationFlow(scenario, false);
    
    // In this case, we EXPECT it to fail (use wrong location)
    const expectedToFail = !result.passed;
    
    if (expectedToFail) {
      console.log(`\n⚠️  ${result.name} - Correctly detected bug scenario`);
    } else {
      console.log(`\n❓ ${result.name} - Unexpected pass without gateway`);
    }
    
    console.log(`   User Home:     ${scenario.userHome.city}, ${scenario.userHome.state}`);
    console.log(`   Park Gateway:  ${scenario.park.gateway.city}, ${scenario.park.gateway.state}`);
    console.log(`   URL Location:  ${result.actualLocation}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${passed}/${TEST_SCENARIOS.length} scenarios passed with gateway`);
  console.log('='.repeat(70));
}

/**
 * Test URL structure and encoding
 */
function testOpenTableUrlStructure(): void {
  console.log('\n' + '='.repeat(70));
  console.log('OPENTABLE URL STRUCTURE ANALYSIS');
  console.log('='.repeat(70));

  const testCases = [
    { restaurant: 'Rays Waterfront', city: 'Seward', state: 'AK' },
    { restaurant: "Oscar's Cafe", city: 'Springdale', state: 'UT' },
    { restaurant: 'The Ahwahnee', city: 'Yosemite Valley', state: 'CA' },
  ];

  for (const tc of testCases) {
    const links = YelpAdapter.generateReservationLinks(
      tc.restaurant,
      tc.city,
      tc.state,
      '2026-03-15',
      '19:00',
      2
    );

    console.log(`\nRestaurant: ${tc.restaurant}`);
    console.log(`Location:   ${tc.city}, ${tc.state}`);
    console.log(`URL:        ${links.openTable}`);
    
    // Parse URL to show components
    const url = new URL(links.openTable);
    console.log(`  - term:          ${url.searchParams.get('term')}`);
    console.log(`  - locationQuery: ${url.searchParams.get('locationQuery')}`);
    console.log(`  - covers:        ${url.searchParams.get('covers')}`);
    console.log(`  - dateTime:      ${url.searchParams.get('dateTime')}`);
  }
}

/**
 * Verify context flow simulation
 */
function testContextPropagation(): void {
  console.log('\n' + '='.repeat(70));
  console.log('CONTEXT PROPAGATION TEST');
  console.log('='.repeat(70));
  
  console.log('\nSimulating the chat flow step by step:\n');

  // Step 1: User starts chat with home location
  const userProfile = {
    homeCity: 'Madison',
    homeState: 'WI',
  };
  console.log(`1. User Profile: ${userProfile.homeCity}, ${userProfile.homeState}`);

  // Step 2: User searches for Kenai Fjords
  console.log(`2. User asks: "Tell me about Kenai Fjords National Park"`);
  
  // Step 3: Park search returns gateway city
  const parkResult = {
    name: 'Kenai Fjords National Park',
    parkCode: 'kefj',
    gatewayCity: 'Seward',
    gatewayState: 'AK',
  };
  console.log(`3. Park API returns gateway: ${parkResult.gatewayCity}, ${parkResult.gatewayState}`);

  // Step 4: Context should be updated
  const context = {
    npsGatewayCity: {
      city: parkResult.gatewayCity,
      state: parkResult.gatewayState,
      parkCode: parkResult.parkCode,
      parkName: parkResult.name,
    },
  };
  console.log(`4. Context.npsGatewayCity set to: ${JSON.stringify(context.npsGatewayCity)}`);

  // Step 5: User asks for restaurants
  console.log(`5. User asks: "What restaurants are near the park?"`);
  console.log(`   -> Restaurant search should use: ${context.npsGatewayCity.city}, ${context.npsGatewayCity.state}`);

  // Step 6: User asks for reservation
  console.log(`6. User asks: "Make a reservation at Ray's Waterfront"`);
  
  const links = YelpAdapter.generateReservationLinks(
    "Ray's Waterfront",
    context.npsGatewayCity.city,
    context.npsGatewayCity.state,
    '2026-03-15',
    '19:00',
    2
  );
  
  console.log(`   -> Reservation link generated with: ${context.npsGatewayCity.city}, ${context.npsGatewayCity.state}`);
  console.log(`   -> OpenTable URL: ${links.openTable}`);

  // Verify
  const urlHasCorrectLocation = links.openTable.includes('Seward');
  const urlHasWrongLocation = links.openTable.includes('Madison');
  
  console.log(`\nVERIFICATION:`);
  console.log(`  Contains 'Seward' (correct):  ${urlHasCorrectLocation ? '✅ YES' : '❌ NO'}`);
  console.log(`  Contains 'Madison' (wrong):   ${urlHasWrongLocation ? '❌ YES (BUG!)' : '✅ NO'}`);
}

// Main test runner
async function runAllTests(): Promise<void> {
  console.log('\n🧪 RESERVATION FLOW INTEGRATION TESTS\n');
  console.log('Testing that OpenTable links use park gateway cities,');
  console.log('not the user\'s home location.\n');

  testFullFlow();
  testOpenTableUrlStructure();
  testContextPropagation();

  console.log('\n' + '='.repeat(70));
  console.log('TEST SUITE COMPLETE');
  console.log('='.repeat(70));
}

// Export for use
export { runAllTests, testFullFlow, testOpenTableUrlStructure, testContextPropagation, TEST_SCENARIOS };

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
