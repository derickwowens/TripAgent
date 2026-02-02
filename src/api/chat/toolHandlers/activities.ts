/**
 * Activities Tool Handlers
 * 
 * Handles tours and experiences searches
 */

import { TravelFacade } from '../../../domain/facade/TravelFacade.js';

/**
 * Handle activities/tours search
 */
export async function handleSearchActivities(input: any, facade: TravelFacade): Promise<any> {
  console.log(`[LinkGen] Activities search for location: ${input.location}`);
  
  const activityResults = await facade.searchActivities({
    location: input.location,
    radius: 50,
  });
  
  return {
    activities: activityResults.results.slice(0, 10).map(a => {
      const officialUrl = a.bookingLink;
      const googleMapsUrl = a.coordinates 
        ? `https://www.google.com/maps/search/?api=1&query=${a.coordinates.latitude},${a.coordinates.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name + ' ' + input.location)}`;
      
      console.log(`[LinkGen] Activity "${a.name}": officialUrl=${officialUrl || 'none'}, provider=${a.provider}`);
      
      return {
        name: a.name,
        description: a.shortDescription?.substring(0, 150) + (a.shortDescription && a.shortDescription.length > 150 ? '...' : ''),
        price: a.price?.amount ? `$${a.price.amount}` : 'Price varies',
        rating: a.rating,
        duration: a.duration,
        officialUrl: officialUrl,
        bookingLink: a.bookingLink,
        googleMapsUrl,
        provider: a.provider,
        _linkNote: 'USE officialUrl/bookingLink for activity booking - these are from Amadeus API',
      };
    }),
    totalFound: activityResults.totalResults,
    providers: activityResults.providers,
  };
}
