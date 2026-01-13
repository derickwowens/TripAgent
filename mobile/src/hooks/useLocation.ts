import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface UserLocation {
  city: string;
  state: string;
  nearestAirport: string;
}

const AIRPORT_MAPPING: Record<string, string> = {
  'California': 'LAX',
  'New York': 'JFK',
  'Texas': 'DFW',
  'Florida': 'MIA',
  'Illinois': 'ORD',
  'Washington': 'SEA',
  'Colorado': 'DEN',
  'Arizona': 'PHX',
  'Nevada': 'LAS',
  'Georgia': 'ATL',
  'Massachusetts': 'BOS',
  'Pennsylvania': 'PHL',
  'Ohio': 'CLE',
  'Michigan': 'DTW',
  'Oregon': 'PDX',
};

export const useLocation = () => {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const state = address.region || 'California';
      const nearestAirport = AIRPORT_MAPPING[state] || 'LAX';

      setUserLocation({
        city: address.city || 'Unknown',
        state: state,
        nearestAirport: nearestAirport,
      });
      setLocationLoading(false);

    } catch (error) {
      console.error('Location error:', error);
      setLocationLoading(false);
    }
  };

  return {
    userLocation,
    locationLoading,
  };
};
