/**
 * Link Prefill Integration Tests
 * Tests that booking links are properly formatted with user parameters
 */

interface LinkTestCase {
  name: string;
  type: 'flight' | 'hotel' | 'car';
  params: Record<string, string>;
  expectedUrlPattern: RegExp;
  generateUrl: () => string;
}

// Flight link generators
const flightLinks = {
  googleFlights: (origin: string, destination: string, date: string) => {
    const formattedDate = date.replace(/-/g, '');
    return `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}+on+${date}`;
  },
  kayakFlights: (origin: string, destination: string, departDate: string, returnDate?: string) => {
    const base = `https://www.kayak.com/flights/${origin}-${destination}/${departDate}`;
    return returnDate ? `${base}/${returnDate}` : base;
  },
  skyscannerFlights: (origin: string, destination: string, departDate: string) => {
    return `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${departDate.replace(/-/g, '')}/`;
  },
};

// Hotel link generators
const hotelLinks = {
  bookingDotCom: (destination: string, checkin?: string, checkout?: string) => {
    let url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`;
    if (checkin) url += `&checkin=${checkin}`;
    if (checkout) url += `&checkout=${checkout}`;
    return url;
  },
  expediaHotels: (destination: string, checkin?: string, checkout?: string) => {
    let url = `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(destination)}`;
    if (checkin) url += `&startDate=${checkin}`;
    if (checkout) url += `&endDate=${checkout}`;
    return url;
  },
  hotelscom: (destination: string) => {
    return `https://www.hotels.com/search.do?q-destination=${encodeURIComponent(destination)}`;
  },
};

// Car rental link generators
const carRentalLinks = {
  kayakCars: (airport: string, pickupDate: string, dropoffDate: string) => {
    return `https://www.kayak.com/cars/${airport}/${pickupDate}/${dropoffDate}`;
  },
  rentalcars: (airport: string, pickupDate: string, dropoffDate: string) => {
    return `https://www.rentalcars.com/search-results?location=${airport}&puDay=${pickupDate}&doDay=${dropoffDate}`;
  },
  expediaCars: (airport: string, pickupDate: string, dropoffDate: string) => {
    return `https://www.expedia.com/Cars?pickupDate=${pickupDate}&dropoffDate=${dropoffDate}&pickupLocation=${airport}`;
  },
};

// Test cases
const testCases: LinkTestCase[] = [
  // Google Flights tests
  {
    name: 'Google Flights - LAX to JFK',
    type: 'flight',
    params: { origin: 'LAX', destination: 'JFK', date: '2026-03-15' },
    expectedUrlPattern: /google\.com\/travel\/flights.*LAX.*JFK/i,
    generateUrl: () => flightLinks.googleFlights('LAX', 'JFK', '2026-03-15'),
  },
  {
    name: 'Google Flights - DEN to SLC',
    type: 'flight',
    params: { origin: 'DEN', destination: 'SLC', date: '2026-06-01' },
    expectedUrlPattern: /google\.com\/travel\/flights.*DEN.*SLC/i,
    generateUrl: () => flightLinks.googleFlights('DEN', 'SLC', '2026-06-01'),
  },
  
  // Kayak Flights tests
  {
    name: 'Kayak Flights - Round trip',
    type: 'flight',
    params: { origin: 'SFO', destination: 'SEA', depart: '2026-04-10', return: '2026-04-15' },
    expectedUrlPattern: /kayak\.com\/flights\/SFO-SEA\/2026-04-10\/2026-04-15/,
    generateUrl: () => flightLinks.kayakFlights('SFO', 'SEA', '2026-04-10', '2026-04-15'),
  },
  
  // Booking.com tests
  {
    name: 'Booking.com - Yosemite with dates',
    type: 'hotel',
    params: { destination: 'Yosemite National Park', checkin: '2026-03-15', checkout: '2026-03-20' },
    expectedUrlPattern: /booking\.com\/searchresults.*Yosemite.*checkin=2026-03-15/i,
    generateUrl: () => hotelLinks.bookingDotCom('Yosemite National Park', '2026-03-15', '2026-03-20'),
  },
  {
    name: 'Booking.com - Grand Canyon',
    type: 'hotel',
    params: { destination: 'Grand Canyon Village' },
    expectedUrlPattern: /booking\.com\/searchresults.*Grand.*Canyon/i,
    generateUrl: () => hotelLinks.bookingDotCom('Grand Canyon Village'),
  },
  
  // Kayak Cars tests
  {
    name: 'Kayak Cars - LAX pickup',
    type: 'car',
    params: { airport: 'LAX', pickup: '2026-03-15', dropoff: '2026-03-20' },
    expectedUrlPattern: /kayak\.com\/cars\/LAX\/2026-03-15\/2026-03-20/,
    generateUrl: () => carRentalLinks.kayakCars('LAX', '2026-03-15', '2026-03-20'),
  },
  {
    name: 'Kayak Cars - DEN pickup',
    type: 'car',
    params: { airport: 'DEN', pickup: '2026-06-01', dropoff: '2026-06-07' },
    expectedUrlPattern: /kayak\.com\/cars\/DEN\/2026-06-01\/2026-06-07/,
    generateUrl: () => carRentalLinks.kayakCars('DEN', '2026-06-01', '2026-06-07'),
  },
];

// Run tests
async function runLinkTests(): Promise<void> {
  console.log('🔗 Link Prefill Integration Tests\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const url = test.generateUrl();
    const matches = test.expectedUrlPattern.test(url);
    
    if (matches) {
      console.log(`✅ ${test.name}`);
      console.log(`   URL: ${url}\n`);
      passed++;
    } else {
      console.log(`❌ ${test.name}`);
      console.log(`   Generated: ${url}`);
      console.log(`   Expected pattern: ${test.expectedUrlPattern}\n`);
      failed++;
    }
  }
  
  console.log('='.repeat(60));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  // Test actual URL accessibility (optional - can be slow)
  console.log('\n🌐 Testing URL accessibility...\n');
  
  const urlsToTest = [
    { name: 'Google Flights', url: flightLinks.googleFlights('LAX', 'JFK', '2026-03-15') },
    { name: 'Booking.com', url: hotelLinks.bookingDotCom('Yosemite National Park', '2026-03-15', '2026-03-20') },
    { name: 'Kayak Cars', url: carRentalLinks.kayakCars('LAX', '2026-03-15', '2026-03-20') },
  ];
  
  for (const { name, url } of urlsToTest) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TripAgent/1.0)' }
      });
      console.log(`${response.ok ? '✅' : '⚠️'} ${name}: ${response.status} - ${url.substring(0, 60)}...`);
    } catch (error: any) {
      console.log(`❌ ${name}: ${error.message}`);
    }
  }
}

// Export for use in other modules
export {
  flightLinks,
  hotelLinks,
  carRentalLinks,
  runLinkTests,
  testCases,
};

// Run if called directly
if (require.main === module) {
  runLinkTests().catch(console.error);
}
