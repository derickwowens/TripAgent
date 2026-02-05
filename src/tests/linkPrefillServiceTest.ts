/**
 * LinkPrefillService Tests
 * Tests the new SOLID-compliant link prefill service
 */

import { linkPrefillService } from '../services/LinkPrefillService.js';

async function runTests() {
  console.log('Testing LinkPrefillService...\n');

  // Test car rental links with Turo preference
  const carContext = {
    location: 'Denver, CO',
    departureDate: '2026-06-15',
    returnDate: '2026-06-22',
    userProfile: 'I prefer Turo for car rentals'
  };

  console.log('=== Car Rental Links (Turo preferred) ===');
  const carLinks = linkPrefillService.generateLinks('cars', carContext);
  carLinks.forEach(l => console.log(`${l.isPrimary ? '[PRIMARY]' : '         '} ${l.provider}: ${l.url}`));

  // Test hotel links with Airbnb preference
  const hotelContext = {
    location: 'Yellowstone',
    departureDate: '2026-07-01',
    returnDate: '2026-07-05',
    adults: 2,
    rooms: 1,
    userProfile: 'I prefer Airbnb'
  };

  console.log('\n=== Hotel Links (Airbnb preferred) ===');
  const hotelLinks = linkPrefillService.generateLinks('hotels', hotelContext);
  hotelLinks.forEach(l => console.log(`${l.isPrimary ? '[PRIMARY]' : '         '} ${l.provider}: ${l.url}`));

  // Test flight links
  const flightContext = {
    origin: 'DEN',
    destination: 'SLC',
    departureDate: '2026-08-10',
    returnDate: '2026-08-15',
    adults: 2
  };

  console.log('\n=== Flight Links ===');
  const flightLinks = linkPrefillService.generateLinks('flights', flightContext);
  flightLinks.forEach(l => console.log(`${l.provider}: ${l.url}`));

  // Test camping links
  const campingContext = {
    location: 'Yosemite National Park',
    departureDate: '2026-09-01',
  };

  console.log('\n=== Camping Links ===');
  const campingLinks = linkPrefillService.generateLinks('camping', campingContext);
  campingLinks.forEach(l => console.log(`${l.provider}: ${l.url}`));

  // Test booking links object generation
  console.log('\n=== Booking Links Object (cars) ===');
  const bookingLinks = linkPrefillService.generateBookingLinks('cars', carContext);
  console.log(JSON.stringify(bookingLinks, null, 2));

  // Test preferred provider detection
  console.log('\n=== Preferred Provider Detection ===');
  console.log(`Cars (Turo user): ${linkPrefillService.getPreferredProvider('cars', carContext)}`);
  console.log(`Hotels (Airbnb user): ${linkPrefillService.getPreferredProvider('hotels', hotelContext)}`);
  console.log(`Flights (no pref): ${linkPrefillService.getPreferredProvider('flights', flightContext) || 'none'}`);

  // Validate URLs are properly formatted
  console.log('\n=== URL Validation ===');
  let allValid = true;
  
  const allLinks = [...carLinks, ...hotelLinks, ...flightLinks, ...campingLinks];
  for (const link of allLinks) {
    try {
      new URL(link.url);
      console.log(`OK: ${link.provider}`);
    } catch (e) {
      console.log(`INVALID URL: ${link.provider} - ${link.url}`);
      allValid = false;
    }
  }

  console.log('\n' + (allValid ? 'All URLs are valid!' : 'Some URLs are invalid!'));
}

// Run tests
runTests().catch(console.error);
