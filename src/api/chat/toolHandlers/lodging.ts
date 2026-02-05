/**
 * Lodging Tool Handlers
 * 
 * Handles hotel searches
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';
import { ChatContext } from '../types.js';
import { resolveContextValue } from '../types.js';
import { generateGoogleMapsLink, generateDirectionsLink } from '../../../utils/linkUtils.js';
import { linkPrefillService, TravelContext } from '../../../services/LinkPrefillService.js';

/**
 * Handle hotel search with context-aware defaults
 */
export async function handleSearchHotels(
  input: any,
  facade: TravelFacade,
  context: ChatContext,
  activeLeg?: number
): Promise<any> {
  const travelers = input.adults || resolveContextValue<number>('numTravelers', context, activeLeg) || 2;
  const rooms = input.rooms || Math.ceil(travelers / 2);
  
  const checkInDate = input.check_in_date || context.travelDates?.departure;
  const checkOutDate = input.check_out_date || context.travelDates?.return;
  
  if (!checkInDate || !checkOutDate) {
    return {
      error: 'Check-in and check-out dates are required. Please specify travel dates in your profile or request.',
      hotels: [],
    };
  }
  
  const hotelResults = await facade.searchHotels({
    location: input.location,
    checkInDate,
    checkOutDate,
    adults: travelers,
    rooms: rooms,
  });
  
  // Use LinkPrefillService for consistent link generation
  const linkContext: TravelContext = {
    location: input.location,
    departureDate: checkInDate,
    returnDate: checkOutDate,
    adults: travelers,
    rooms: rooms,
    userProfile: context.userProfile,
  };
  
  const bookingLinks = linkPrefillService.generateBookingLinks('hotels', linkContext);
  const preferredProvider = linkPrefillService.getPreferredProvider('hotels', linkContext);
  
  console.log(`[LinkGen] Hotel search: location="${input.location}", dates=${checkInDate} to ${checkOutDate}, preferred=${preferredProvider || 'none'}`);
  
  return {
    hotels: hotelResults.results.slice(0, 8).map(h => {
      const googleMapsUrl = generateGoogleMapsLink(h.name, input.location);
      const directionsUrl = generateDirectionsLink(`${h.name}, ${input.location}`);
      console.log(`[LinkGen] Hotel "${h.name}": googleMaps=${googleMapsUrl}`);
      return {
        name: h.name,
        price: `$${h.price.total}`,
        pricePerNight: `$${h.price.perNight}`,
        rating: h.rating,
        address: h.address,
        amenities: h.amenities?.slice(0, 5),
        googleMapsUrl,
        directionsUrl,
      };
    }),
    totalFound: hotelResults.totalResults,
    providers: hotelResults.providers,
    bookingLinks,
    preferredProvider,
    note: preferredProvider 
      ? `Based on your preference for ${preferredProvider}, we've included a ${preferredProvider} search link with your dates prefilled.`
      : undefined,
  };
}
