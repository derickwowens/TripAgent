/**
 * Link Validator with Fallback Formats
 * Validates booking links and retries with alternative formats if needed
 */

interface LinkValidationResult {
  originalUrl: string;
  validatedUrl: string;
  isValid: boolean;
  format: string;
}

// Flight link formats (in order of preference)
const flightFormats = [
  {
    name: 'kayak',
    generate: (origin: string, dest: string, depart: string, returnDate?: string) => {
      const base = `https://www.kayak.com/flights/${origin}-${dest}/${depart}`;
      return returnDate ? `${base}/${returnDate}` : base;
    },
  },
  {
    name: 'google',
    generate: (origin: string, dest: string, depart: string, returnDate?: string) => {
      return `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${dest}+on+${depart}`;
    },
  },
  {
    name: 'skyscanner',
    generate: (origin: string, dest: string, depart: string, returnDate?: string) => {
      const formattedDate = depart.replace(/-/g, '');
      return `https://www.skyscanner.com/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${formattedDate}/`;
    },
  },
];

// Hotel link formats (in order of preference)
const hotelFormats = [
  {
    name: 'booking',
    generate: (destination: string, checkin?: string, checkout?: string) => {
      let url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`;
      if (checkin) url += `&checkin=${checkin}`;
      if (checkout) url += `&checkout=${checkout}`;
      return url;
    },
  },
  {
    name: 'expedia',
    generate: (destination: string, checkin?: string, checkout?: string) => {
      let url = `https://www.expedia.com/Hotel-Search?destination=${encodeURIComponent(destination)}`;
      if (checkin) url += `&startDate=${checkin}`;
      if (checkout) url += `&endDate=${checkout}`;
      return url;
    },
  },
  {
    name: 'hotels',
    generate: (destination: string) => {
      return `https://www.hotels.com/search.do?q-destination=${encodeURIComponent(destination)}`;
    },
  },
];

// Car rental link formats (in order of preference)
const carFormats = [
  {
    name: 'kayak',
    generate: (airport: string, pickup: string, dropoff: string) => {
      return `https://www.kayak.com/cars/${airport}/${pickup}/${dropoff}`;
    },
  },
  {
    name: 'expedia',
    generate: (airport: string, pickup: string, dropoff: string) => {
      return `https://www.expedia.com/Cars?pickupDate=${pickup}&dropoffDate=${dropoff}&pickupLocation=${airport}`;
    },
  },
  {
    name: 'rentalcars',
    generate: (airport: string, pickup: string, dropoff: string) => {
      return `https://www.rentalcars.com/search-results?location=${airport}&puDay=${pickup}&doDay=${dropoff}`;
    },
  },
];

// Validate a URL by checking if it returns a successful response
async function validateUrl(url: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; TripAgent/1.0)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    // Consider 2xx and 3xx as valid (redirects are fine for booking sites)
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    return false;
  }
}

// Get a validated flight link, trying multiple formats
export async function getValidatedFlightLink(
  origin: string,
  destination: string,
  departDate: string,
  returnDate?: string
): Promise<LinkValidationResult> {
  for (const format of flightFormats) {
    const url = format.generate(origin, destination, departDate, returnDate);
    const isValid = await validateUrl(url);
    
    if (isValid) {
      return {
        originalUrl: url,
        validatedUrl: url,
        isValid: true,
        format: format.name,
      };
    }
  }
  
  // If none valid, return the first format (Kayak) as fallback
  const fallbackUrl = flightFormats[0].generate(origin, destination, departDate, returnDate);
  return {
    originalUrl: fallbackUrl,
    validatedUrl: fallbackUrl,
    isValid: false,
    format: 'kayak-fallback',
  };
}

// Get a validated hotel link, trying multiple formats
export async function getValidatedHotelLink(
  destination: string,
  checkin?: string,
  checkout?: string
): Promise<LinkValidationResult> {
  for (const format of hotelFormats) {
    const url = format.generate(destination, checkin, checkout);
    const isValid = await validateUrl(url);
    
    if (isValid) {
      return {
        originalUrl: url,
        validatedUrl: url,
        isValid: true,
        format: format.name,
      };
    }
  }
  
  // If none valid, return Booking.com as fallback
  const fallbackUrl = hotelFormats[0].generate(destination, checkin, checkout);
  return {
    originalUrl: fallbackUrl,
    validatedUrl: fallbackUrl,
    isValid: false,
    format: 'booking-fallback',
  };
}

// Get a validated car rental link, trying multiple formats
export async function getValidatedCarLink(
  airport: string,
  pickupDate: string,
  dropoffDate: string
): Promise<LinkValidationResult> {
  for (const format of carFormats) {
    const url = format.generate(airport, pickupDate, dropoffDate);
    const isValid = await validateUrl(url);
    
    if (isValid) {
      return {
        originalUrl: url,
        validatedUrl: url,
        isValid: true,
        format: format.name,
      };
    }
  }
  
  // If none valid, return Kayak as fallback
  const fallbackUrl = carFormats[0].generate(airport, pickupDate, dropoffDate);
  return {
    originalUrl: fallbackUrl,
    validatedUrl: fallbackUrl,
    isValid: false,
    format: 'kayak-fallback',
  };
}

// Parse and validate links in a response text
export async function validateLinksInResponse(responseText: string): Promise<string> {
  // Regex to find markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  
  const links: Array<{ match: string; text: string; url: string }> = [];
  let match;
  
  while ((match = linkRegex.exec(responseText)) !== null) {
    links.push({
      match: match[0],
      text: match[1],
      url: match[2],
    });
  }
  
  // Validate each link in parallel
  const validations = await Promise.all(
    links.map(async (link) => {
      const isValid = await validateUrl(link.url);
      return { ...link, isValid };
    })
  );
  
  // Replace invalid links with validated alternatives
  let processedText = responseText;
  
  for (const validation of validations) {
    if (!validation.isValid) {
      // Try to determine link type and get alternative
      let newUrl = validation.url;
      
      if (validation.url.includes('flight') || validation.url.includes('kayak.com/flights')) {
        // Extract params and try alternatives
        const kayakMatch = validation.url.match(/kayak\.com\/flights\/([A-Z]{3})-([A-Z]{3})\/(\d{4}-\d{2}-\d{2})/);
        if (kayakMatch) {
          const result = await getValidatedFlightLink(kayakMatch[1], kayakMatch[2], kayakMatch[3]);
          newUrl = result.validatedUrl;
        }
      } else if (validation.url.includes('booking.com') || validation.url.includes('hotel')) {
        // Extract destination and try alternatives
        const bookingMatch = validation.url.match(/ss=([^&]+)/);
        if (bookingMatch) {
          const destination = decodeURIComponent(bookingMatch[1]);
          const result = await getValidatedHotelLink(destination);
          newUrl = result.validatedUrl;
        }
      } else if (validation.url.includes('cars') || validation.url.includes('rental')) {
        // Extract params and try alternatives
        const carMatch = validation.url.match(/kayak\.com\/cars\/([A-Z]{3})\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})/);
        if (carMatch) {
          const result = await getValidatedCarLink(carMatch[1], carMatch[2], carMatch[3]);
          newUrl = result.validatedUrl;
        }
      }
      
      // Replace the link in the response
      if (newUrl !== validation.url) {
        processedText = processedText.replace(
          validation.match,
          `[${validation.text}](${newUrl})`
        );
      }
    }
  }
  
  return processedText;
}

export {
  flightFormats,
  hotelFormats,
  carFormats,
  validateUrl,
};
