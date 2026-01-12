#!/usr/bin/env node
import { config } from 'dotenv';
import { TravelFacade } from '../domain/facade/TravelFacade.js';
import { AmadeusFlightAdapter } from '../providers/flights/AmadeusFlightAdapter.js';
import { KiwiFlightAdapter } from '../providers/flights/KiwiFlightAdapter.js';
import { AmadeusHotelAdapter } from '../providers/hotels/AmadeusHotelAdapter.js';
import { AmadeusCarAdapter } from '../providers/cars/AmadeusCarAdapter.js';
import { AmadeusActivitiesAdapter } from '../providers/activities/AmadeusActivitiesAdapter.js';
import { NationalParksAdapter } from '../providers/parks/NationalParksAdapter.js';

// Load environment variables
config();

// Initialize facade with providers
const facade = new TravelFacade(
  [new AmadeusFlightAdapter(), new KiwiFlightAdapter()],
  [new AmadeusHotelAdapter()],
  [new AmadeusCarAdapter()],
  [new AmadeusActivitiesAdapter()],
  new NationalParksAdapter(process.env.NPS_API_KEY)
);

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'search-flights':
        await searchFlights(args.slice(1));
        break;

      case 'search-hotels':
        await searchHotels(args.slice(1));
        break;

      case 'search-cars':
        await searchCars(args.slice(1));
        break;

      case 'airport':
        await getAirport(args.slice(1));
        break;

      case 'search-activities':
        await searchActivities(args.slice(1));
        break;

      case 'park-hikes':
        await getParkHikes(args.slice(1));
        break;

      case 'plan-park-trip':
        await planParkTrip(args.slice(1));
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
🌍 TripAgent CLI

Usage: npm run cli -- <command> [options]

Commands:
  search-flights <origin> <destination> <date> [return_date]
    Search for flights between airports
    Example: npm run cli -- search-flights LAX JFK 2025-02-15

  search-hotels <location> <check_in> <check_out> [adults]
    Search for hotels in a city
    Example: npm run cli -- search-hotels Paris 2025-02-15 2025-02-20

  search-cars <location> <pickup_date> <dropoff_date>
    Search for rental cars
    Example: npm run cli -- search-cars LAX 2025-02-15 2025-02-20

  search-activities <location>
    Search for tours, activities, and things to do
    Example: npm run cli -- search-activities Paris

  park-hikes <park_code>
    Get popular hikes with difficulty ratings
    Example: npm run cli -- park-hikes yose
    Park codes: yose, grca, zion, yell, romo, glac, acad

  plan-park-trip <park_code> <origin_airport> <arrival_date> <departure_date>
    Plan a budget-friendly national park trip
    Example: npm run cli -- plan-park-trip yose LAX 2026-06-15 2026-06-20

  airport <iata_code>
    Get airport information
    Example: npm run cli -- airport LAX

  help
    Show this help message

Environment Variables:
  AMADEUS_CLIENT_ID      - Amadeus API client ID
  AMADEUS_CLIENT_SECRET  - Amadeus API client secret
  NPS_API_KEY            - National Park Service API key (free)

Get API keys at:
  - Amadeus: https://developers.amadeus.com
  - NPS: https://www.nps.gov/subjects/developer/get-started.htm
  `);
}

async function searchFlights(args: string[]) {
  const [origin, destination, departureDate, returnDate] = args;

  if (!origin || !destination || !departureDate) {
    console.error('Usage: search-flights <origin> <destination> <departure_date> [return_date]');
    console.error('Example: search-flights LAX JFK 2025-02-15');
    process.exit(1);
  }

  console.log(`\n✈️  Searching flights from ${origin} to ${destination}...`);
  console.log(`   Departure: ${departureDate}${returnDate ? `, Return: ${returnDate}` : ' (one-way)'}\n`);

  const results = await facade.searchFlights({
    origin: origin.toUpperCase(),
    destination: destination.toUpperCase(),
    departureDate,
    returnDate,
    adults: 1,
  });

  if (results.results.length === 0) {
    console.log('No flights found for this route and date.');
    return;
  }

  console.log(`Found ${results.totalResults} flight(s):\n`);

  results.results.slice(0, 5).forEach((flight, index) => {
    console.log(`${index + 1}. ${facade.formatPrice(flight.price.total, flight.price.currency)}`);
    console.log(`   Airline: ${flight.validatingAirline}`);
    
    flight.itineraries.forEach((itin, i) => {
      const direction = i === 0 ? 'Outbound' : 'Return';
      console.log(`   ${direction}: ${facade.formatDuration(itin.duration)}`);
      
      itin.segments.forEach(seg => {
        console.log(`     ${seg.flightNumber}: ${seg.departure.iataCode} → ${seg.arrival.iataCode} (${facade.formatDuration(seg.duration)})`);
      });
    });
    console.log('');
  });
}

async function searchHotels(args: string[]) {
  const [location, checkInDate, checkOutDate, adultsStr] = args;

  if (!location || !checkInDate || !checkOutDate) {
    console.error('Usage: search-hotels <location> <check_in_date> <check_out_date> [adults]');
    console.error('Example: search-hotels Paris 2025-02-15 2025-02-20');
    process.exit(1);
  }

  console.log(`\n🏨 Searching hotels in ${location}...`);
  console.log(`   Check-in: ${checkInDate}, Check-out: ${checkOutDate}\n`);

  const results = await facade.searchHotels({
    location,
    checkInDate,
    checkOutDate,
    adults: adultsStr ? parseInt(adultsStr) : 1,
  });

  if (results.results.length === 0) {
    console.log('No hotels found for this location and dates.');
    return;
  }

  console.log(`Found ${results.totalResults} hotel(s):\n`);

  results.results.slice(0, 5).forEach((hotel, index) => {
    console.log(`${index + 1}. ${hotel.name}`);
    console.log(`   ${hotel.starRating ? `${hotel.starRating}⭐` : ''} ${hotel.address.city}, ${hotel.address.country}`);
    console.log(`   ${facade.formatPrice(hotel.price.perNight, hotel.price.currency)}/night (${facade.formatPrice(hotel.price.total, hotel.price.currency)} total)`);
    if (hotel.amenities.length > 0) {
      console.log(`   Amenities: ${hotel.amenities.slice(0, 5).join(', ')}`);
    }
    console.log('');
  });
}

async function searchCars(args: string[]) {
  const [pickupLocation, pickupDate, dropoffDate] = args;

  if (!pickupLocation || !pickupDate || !dropoffDate) {
    console.error('Usage: search-cars <location> <pickup_date> <dropoff_date>');
    console.error('Example: search-cars LAX 2025-02-15 2025-02-20');
    process.exit(1);
  }

  console.log(`\n🚗 Searching car rentals at ${pickupLocation}...`);
  console.log(`   Pickup: ${pickupDate}, Return: ${dropoffDate}\n`);

  const results = await facade.searchCarRentals({
    pickupLocation,
    pickupDate,
    dropoffDate,
  });

  if (results.results.length === 0) {
    console.log('No car rentals found for this location and dates.');
    return;
  }

  console.log(`Found ${results.totalResults} car rental(s):\n`);

  results.results.slice(0, 5).forEach((car, index) => {
    console.log(`${index + 1}. ${car.vendor} - ${car.vehicle.category}`);
    console.log(`   ${car.vehicle.seats} seats, ${car.vehicle.transmission}`);
    console.log(`   ${facade.formatPrice(car.price.perDay, car.price.currency)}/day (${facade.formatPrice(car.price.total, car.price.currency)} total)`);
    console.log(`   Mileage: ${car.mileage?.unlimited ? 'Unlimited' : `${car.mileage?.included || 0} miles`}`);
    console.log('');
  });
}

async function getAirport(args: string[]) {
  const [iataCode] = args;

  if (!iataCode) {
    console.error('Usage: airport <iata_code>');
    console.error('Example: airport LAX');
    process.exit(1);
  }

  const airport = facade.getAirportInfo(iataCode);

  if (!airport) {
    console.log(`\n❌ Airport not found: ${iataCode.toUpperCase()}`);
    console.log('Try common codes: LAX, JFK, LHR, CDG, NRT, SYD, DXB, SIN');
    return;
  }

  console.log(`\n✈️  ${airport.name} (${airport.iataCode})`);
  console.log(`   City: ${airport.city}`);
  console.log(`   Country: ${airport.country}`);
}

async function searchActivities(args: string[]) {
  const [location] = args;

  if (!location) {
    console.error('Usage: search-activities <location>');
    console.error('Example: search-activities Paris');
    process.exit(1);
  }

  console.log(`\n🎭 Searching activities in ${location}...\n`);

  const results = await facade.searchActivities({
    location,
    radius: 20,
  });

  if (results.results.length === 0) {
    console.log('No activities found for this location.');
    return;
  }

  console.log(`Found ${results.totalResults} activity(ies):\n`);

  results.results.slice(0, 10).forEach((activity, index) => {
    console.log(`${index + 1}. ${activity.name}`);
    if (activity.rating) {
      console.log(`   ⭐ ${activity.rating}/5`);
    }
    const priceStr = activity.price.currency 
      ? facade.formatPrice(activity.price.amount, activity.price.currency)
      : `${activity.price.amount}`;
    console.log(`   💰 ${priceStr}`);
    if (activity.shortDescription) {
      const desc = activity.shortDescription.length > 100 
        ? activity.shortDescription.substring(0, 100) + '...' 
        : activity.shortDescription;
      console.log(`   ${desc}`);
    }
    console.log(`   🔗 ${activity.bookingLink}`);
    console.log('');
  });
}

async function getParkHikes(args: string[]) {
  const [parkCode] = args;

  if (!parkCode) {
    console.error('Usage: park-hikes <park_code>');
    console.error('Example: park-hikes yose');
    console.error('Park codes: yose (Yosemite), grca (Grand Canyon), zion, yell (Yellowstone), romo (Rocky Mountain), glac (Glacier), acad (Acadia)');
    process.exit(1);
  }

  console.log(`\n🥾 Hikes in ${parkCode.toUpperCase()}...\n`);

  const hikes = facade.getParkHikes(parkCode);

  if (hikes.length === 0) {
    console.log('No hiking data available for this park.');
    console.log('Available parks: yose, grca, zion, yell, romo, glac, acad');
    return;
  }

  console.log(`Found ${hikes.length} popular hike(s):\n`);

  hikes.forEach((hike, index) => {
    const difficultyEmoji = {
      'Easy': '🟢',
      'Moderate': '🟡',
      'Strenuous': '🟠',
      'Very Strenuous': '🔴',
    }[hike.difficulty] || '⚪';

    console.log(`${index + 1}. ${hike.name}`);
    console.log(`   ${difficultyEmoji} ${hike.difficulty} | ${hike.distance} | ↑ ${hike.elevationGain}`);
    console.log(`   ⏱️  ${hike.duration}`);
    console.log(`   ${hike.description}`);
    console.log(`   ✨ ${hike.highlights.join(', ')}`);
    console.log('');
  });
}

async function planParkTrip(args: string[]) {
  const [parkCode, originAirport, arrivalDate, departureDate] = args;

  if (!parkCode || !originAirport || !arrivalDate || !departureDate) {
    console.error('Usage: plan-park-trip <park_code> <origin_airport> <arrival_date> <departure_date>');
    console.error('Example: plan-park-trip yose LAX 2026-06-15 2026-06-20');
    process.exit(1);
  }

  console.log(`\n🏞️  Planning trip to ${parkCode.toUpperCase()}...`);
  console.log(`   From: ${originAirport} | ${arrivalDate} to ${departureDate}\n`);

  try {
    const tripPlan = await facade.planParkTrip({
      parkCode,
      originAirport: originAirport.toUpperCase(),
      arrivalDate,
      departureDate,
      adults: 1,
    });

    if (tripPlan.error) {
      console.log(`❌ ${tripPlan.error}`);
      return;
    }

    // Trip Summary
    console.log('═══════════════════════════════════════');
    console.log(`🏞️  ${tripPlan.tripSummary.park}`);
    console.log(`📅 ${tripPlan.tripSummary.dates}`);
    console.log(`✈️  Nearest Airport: ${tripPlan.tripSummary.nearestAirport}`);
    console.log('═══════════════════════════════════════\n');

    // Park Info
    console.log('📍 PARK INFO');
    console.log(`   Entrance Fee: ${tripPlan.park.entranceFee}`);
    console.log(`   States: ${tripPlan.park.states}`);
    console.log(`   ${tripPlan.park.url}\n`);

    // Flights
    console.log('✈️  FLIGHTS');
    if (tripPlan.flights.options?.length > 0) {
      tripPlan.flights.options.forEach((f: any, i: number) => {
        console.log(`   ${i + 1}. ${f.price} - ${f.airline} (${f.duration}, ${f.stops} stops)`);
      });
    } else {
      console.log(`   ${tripPlan.flights.note}`);
    }
    console.log('');

    // Lodging
    console.log('🏕️  CAMPGROUNDS');
    if (tripPlan.lodging.campgrounds?.length > 0) {
      tripPlan.lodging.campgrounds.forEach((c: any) => {
        console.log(`   • ${c.name} - ${c.sites} sites - ${c.fees}`);
      });
    } else {
      console.log('   No campground data available');
    }
    console.log(`   💡 ${tripPlan.lodging.note}\n`);

    // Hikes
    console.log('🥾 POPULAR HIKES');
    if (tripPlan.hikes?.length > 0) {
      tripPlan.hikes.forEach((h: any) => {
        const difficultyEmoji: Record<string, string> = { 'Easy': '🟢', 'Moderate': '🟡', 'Strenuous': '🟠', 'Very Strenuous': '🔴' };
        const emoji = difficultyEmoji[h.difficulty as string] || '⚪';
        console.log(`   ${emoji} ${h.name} - ${h.difficulty} - ${h.distance}`);
      });
    } else {
      console.log('   No hiking data available for this park');
    }
    console.log('');

    // Budget Tips
    console.log('💰 BUDGET TIPS');
    tripPlan.budgetTips?.forEach((tip: string) => {
      console.log(`   • ${tip}`);
    });

  } catch (error: any) {
    console.error(`Error planning trip: ${error.message}`);
  }
}

main();
