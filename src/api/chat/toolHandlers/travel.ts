/**
 * Travel Tool Handlers
 * 
 * Handles flights, driving distance, EV charging, and car rentals
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';
import { GoogleMapsAdapter } from '../../../providers/GoogleMapsAdapter.js';
import { OpenChargeMapAdapter } from '../../../providers/OpenChargeMapAdapter.js';
import { ChatContext } from '../types.js';
import { resolveContextValue } from '../types.js';
import { 
  generateGoogleMapsLink, 
  generateDirectionsLink, 
  generatePlugShareLink,
  generateTeslaChargerLink,
} from '../../../utils/linkUtils.js';
import { linkPrefillService, TravelContext } from '../../../services/LinkPrefillService.js';

/**
 * Handle flight search with context-aware defaults
 */
export async function handleSearchFlights(
  input: any,
  facade: TravelFacade,
  context: ChatContext,
  activeLeg?: number
): Promise<any> {
  const travelers = input.adults || resolveContextValue<number>('numTravelers', context, activeLeg) || 1;
  const origin = input.origin || resolveContextValue<string>('homeAirport', context, activeLeg) || context.userLocation?.nearestAirport;
  
  const departureDate = input.departure_date || context.travelDates?.departure;
  const returnDate = input.return_date || context.travelDates?.return;
  
  if (!departureDate) {
    return {
      error: 'Departure date is required. Please specify travel dates in your profile or request.',
      flights: [],
    };
  }
  
  const flightResults = await facade.searchFlights({
    origin: origin,
    destination: input.destination,
    departureDate,
    returnDate,
    adults: travelers,
  });
  
  // Use LinkPrefillService for consistent link generation
  const linkContext: TravelContext = {
    origin,
    destination: input.destination,
    departureDate,
    returnDate,
    adults: travelers,
    userProfile: context.userProfile,
  };
  
  const bookingLinks = linkPrefillService.generateBookingLinks('flights', linkContext);
  const flightLinks = linkPrefillService.generateLinks('flights', linkContext);
  const primaryLink = flightLinks.find(l => l.isPrimary) || flightLinks[0];
  
  const originAirportUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(origin + ' Airport')}`;
  const destAirportUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.destination + ' Airport')}`;
  
  console.log(`[LinkGen] Flight search: origin=${origin}, destination=${input.destination}`);
  
  return {
    flights: flightResults.results.slice(0, 5).map(f => ({
      price: `$${f.price.total}`,
      airline: f.validatingAirline,
      duration: f.itineraries[0]?.duration,
    })),
    searchParams: {
      origin: origin,
      destination: input.destination,
      departureDate: input.departure_date,
      returnDate: input.return_date,
      travelers: travelers,
    },
    bookingLinks,
    airportLinks: {
      origin: { code: origin, googleMapsUrl: originAirportUrl },
      destination: { code: input.destination, googleMapsUrl: destAirportUrl },
    },
    bookingLink: primaryLink?.url,
    bookingLinkText: primaryLink?.displayText || `Search ${origin} → ${input.destination} flights`,
    note: "Multiple flight search options available for price comparison",
  };
}

/**
 * Handle driving distance calculation
 */
export async function handleGetDrivingDistance(input: any): Promise<any> {
  const mapsAdapter = new GoogleMapsAdapter();
  const distanceResult = await mapsAdapter.getDistance(input.origin, input.destination);
  return distanceResult ? {
    origin: distanceResult.origin,
    destination: distanceResult.destination,
    distance: distanceResult.distance.text,
    duration: distanceResult.duration.text,
    status: distanceResult.status,
  } : { error: 'Could not calculate driving distance' };
}

/**
 * Handle EV charging station search
 */
export async function handleSearchEvChargingStations(input: any, context: ChatContext): Promise<any> {
  const isTeslaOwner = context.userProfile?.toLowerCase().includes('tesla') || 
                       context.defaults?.vehicle === 'tesla';
  const teslaOnly = input.tesla_only ?? isTeslaOwner;
  
  const evAdapter = new OpenChargeMapAdapter();
  const chargingStations = await evAdapter.searchAlongRoute(
    input.origin_lat,
    input.origin_lng,
    input.dest_lat,
    input.dest_lng,
    25,
    10
  );
  
  return {
    stations: chargingStations.map(s => {
      const officialUrl = generatePlugShareLink(s.latitude, s.longitude);
      const googleMapsUrl = generateGoogleMapsLink(s.name, s.city, s.state);
      
      console.log(`[LinkGen] EV Station "${s.name}": officialUrl=${officialUrl}`);
      
      return {
        name: s.name,
        location: `${s.city}, ${s.state}`,
        operator: s.operator,
        powerKW: s.powerKW,
        numChargers: s.numPoints,
        isTesla: s.isTeslaSupercharger,
        isFastCharger: s.isFastCharger,
        cost: s.usageCost,
        officialUrl: officialUrl,
        googleMapsUrl: googleMapsUrl,
        directionsUrl: generateDirectionsLink(`${s.name}, ${s.city}, ${s.state}`),
        plugShareUrl: officialUrl,
        teslaUrl: s.isTeslaSupercharger ? generateTeslaChargerLink(`${s.city}, ${s.state}`) : undefined,
        _linkNote: 'USE officialUrl/plugShareUrl for charging station info',
      };
    }),
    note: chargingStations.length > 0 
      ? `Found ${chargingStations.length} DC fast charging stations along your route`
      : 'No charging stations found along this route',
  };
}

/**
 * Handle car rental search
 */
export async function handleSearchCarRentals(input: any, facade: TravelFacade, context: ChatContext): Promise<any> {
  const pickupDate = input.pickup_date || context.travelDates?.departure;
  const dropoffDate = input.dropoff_date || context.travelDates?.return;
  
  if (!pickupDate || !dropoffDate) {
    return {
      error: 'Pickup and dropoff dates are required. Please specify travel dates in your profile or request.',
      cars: [],
    };
  }
  
  const carResults = await facade.searchCarRentals({
    pickupLocation: input.pickup_location,
    pickupDate,
    dropoffDate,
    pickupTime: input.pickup_time || '10:00',
    dropoffTime: input.dropoff_time || '10:00',
  });
  
  // Use LinkPrefillService for consistent link generation
  const linkContext: TravelContext = {
    location: input.pickup_location,
    departureDate: pickupDate,
    returnDate: dropoffDate,
    userProfile: context.userProfile,
  };
  
  const bookingLinks = linkPrefillService.generateBookingLinks('cars', linkContext);
  const preferredProvider = linkPrefillService.getPreferredProvider('cars', linkContext);
  
  console.log(`[LinkGen] Car rental: pickup="${input.pickup_location}", dates=${pickupDate} to ${dropoffDate}, preferred=${preferredProvider || 'none'}`);
  
  return {
    cars: carResults.results.slice(0, 8).map(c => ({
      vendor: c.vendor,
      vehicle: `${c.vehicle.category} (${c.vehicle.transmission})`,
      seats: c.vehicle.seats,
      pricePerDay: `$${c.price.perDay}`,
      totalPrice: `$${c.price.total}`,
      features: [
        c.vehicle.airConditioning ? 'A/C' : null,
        c.mileage?.unlimited ? 'Unlimited miles' : null,
      ].filter(Boolean),
    })),
    totalFound: carResults.totalResults,
    providers: carResults.providers,
    bookingLinks,
    preferredProvider,
    note: preferredProvider 
      ? `Based on your preference for ${preferredProvider}, we've included a ${preferredProvider} search link with your dates prefilled.`
      : undefined,
  };
}
