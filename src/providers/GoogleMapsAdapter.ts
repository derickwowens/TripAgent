interface DistanceResult {
  origin: string;
  destination: string;
  distance: {
    text: string;
    value: number; // meters
  };
  duration: {
    text: string;
    value: number; // seconds
  };
  status: string;
}

interface DirectionsResult {
  routes: Array<{
    summary: string;
    distance: string;
    duration: string;
    steps: Array<{
      instruction: string;
      distance: string;
      duration: string;
    }>;
  }>;
}

export class GoogleMapsAdapter {
  private apiKey: string | undefined;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  async getDistance(origin: string, destination: string): Promise<DistanceResult | null> {
    if (!this.apiKey) {
      console.warn('[GoogleMaps] API key not configured, using fallback estimation');
      return this.estimateDistance(origin, destination);
    }

    try {
      const url = `${this.baseUrl}/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&units=imperial&key=${this.apiKey}`;
      
      const response = await fetch(url);
      const data: any = await response.json();

      if (data.status === 'OK' && data.rows[0]?.elements[0]?.status === 'OK') {
        const element = data.rows[0].elements[0];
        return {
          origin: data.origin_addresses[0],
          destination: data.destination_addresses[0],
          distance: element.distance,
          duration: element.duration,
          status: 'OK',
        };
      }

      console.error('[GoogleMaps] API error:', data.status);
      return this.estimateDistance(origin, destination);
    } catch (error) {
      console.error('[GoogleMaps] Request failed:', error);
      return this.estimateDistance(origin, destination);
    }
  }

  async getDirections(origin: string, destination: string, waypoints?: string[]): Promise<DirectionsResult | null> {
    if (!this.apiKey) {
      console.warn('[GoogleMaps] API key not configured');
      return null;
    }

    try {
      let url = `${this.baseUrl}/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&units=imperial&key=${this.apiKey}`;
      
      if (waypoints && waypoints.length > 0) {
        url += `&waypoints=${waypoints.map(w => encodeURIComponent(w)).join('|')}`;
      }

      const response = await fetch(url);
      const data: any = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        return {
          routes: data.routes.map((route: any) => ({
            summary: route.summary,
            distance: route.legs.reduce((acc: number, leg: any) => acc + leg.distance.value, 0),
            duration: route.legs.reduce((acc: number, leg: any) => acc + leg.duration.value, 0),
            steps: route.legs.flatMap((leg: any) => 
              leg.steps.map((step: any) => ({
                instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
                distance: step.distance.text,
                duration: step.duration.text,
              }))
            ),
          })),
        };
      }

      return null;
    } catch (error) {
      console.error('[GoogleMaps] Directions request failed:', error);
      return null;
    }
  }

  // Fallback estimation when API key is not available
  private estimateDistance(origin: string, destination: string): DistanceResult {
    // Known distances for common national park routes (in miles)
    const knownRoutes: Record<string, { miles: number; hours: number }> = {
      // From major airports to parks
      'LAX-Yosemite': { miles: 280, hours: 4.5 },
      'LAX-Joshua Tree': { miles: 130, hours: 2.5 },
      'LAX-Death Valley': { miles: 275, hours: 4.5 },
      'LAX-Sequoia': { miles: 230, hours: 4 },
      'LAX-Grand Canyon': { miles: 490, hours: 7.5 },
      'SFO-Yosemite': { miles: 170, hours: 3.5 },
      'LAS-Grand Canyon': { miles: 280, hours: 4.5 },
      'LAS-Zion': { miles: 165, hours: 2.5 },
      'LAS-Death Valley': { miles: 140, hours: 2.5 },
      'DEN-Rocky Mountain': { miles: 70, hours: 1.5 },
      'PHX-Grand Canyon': { miles: 230, hours: 3.5 },
      'PHX-Saguaro': { miles: 115, hours: 2 },
      'SLC-Yellowstone': { miles: 320, hours: 5 },
      'SLC-Zion': { miles: 310, hours: 4.5 },
      'SLC-Arches': { miles: 235, hours: 4 },
      'SEA-Olympic': { miles: 90, hours: 2 },
      'SEA-Mount Rainier': { miles: 95, hours: 2 },
      'MIA-Everglades': { miles: 50, hours: 1 },
      'FLL-Everglades': { miles: 60, hours: 1.5 },
      'JFK-Acadia': { miles: 470, hours: 8 },
      'BOS-Acadia': { miles: 280, hours: 4.5 },
    };

    // Try to match origin-destination
    const originCode = this.extractAirportCode(origin);
    const destName = this.extractParkName(destination);
    const routeKey = `${originCode}-${destName}`;

    if (knownRoutes[routeKey]) {
      const route = knownRoutes[routeKey];
      return {
        origin,
        destination,
        distance: {
          text: `${route.miles} mi`,
          value: route.miles * 1609, // convert to meters
        },
        duration: {
          text: `${Math.floor(route.hours)} hr ${Math.round((route.hours % 1) * 60)} min`,
          value: route.hours * 3600, // convert to seconds
        },
        status: 'ESTIMATED',
      };
    }

    // Default fallback - estimate 60 mph average
    return {
      origin,
      destination,
      distance: {
        text: 'Distance unknown',
        value: 0,
      },
      duration: {
        text: 'Duration unknown - please verify with Google Maps',
        value: 0,
      },
      status: 'UNKNOWN',
    };
  }

  private extractAirportCode(location: string): string {
    const codes = ['LAX', 'SFO', 'LAS', 'DEN', 'PHX', 'SLC', 'SEA', 'MIA', 'FLL', 'JFK', 'BOS', 'ORD', 'DFW', 'ATL'];
    for (const code of codes) {
      if (location.toUpperCase().includes(code)) {
        return code;
      }
    }
    return location.substring(0, 3).toUpperCase();
  }

  private extractParkName(destination: string): string {
    const parks = [
      'Yosemite', 'Yellowstone', 'Grand Canyon', 'Zion', 'Glacier', 
      'Acadia', 'Rocky Mountain', 'Joshua Tree', 'Sequoia', 'Death Valley',
      'Olympic', 'Mount Rainier', 'Everglades', 'Arches', 'Saguaro'
    ];
    for (const park of parks) {
      if (destination.toLowerCase().includes(park.toLowerCase())) {
        return park;
      }
    }
    return destination;
  }
}

export default GoogleMapsAdapter;
