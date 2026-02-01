import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRAVEL_DATES_KEY = 'travel_dates';

export interface TravelDates {
  departure?: string; // ISO date string YYYY-MM-DD
  return?: string;    // ISO date string YYYY-MM-DD
}

/**
 * Hook to manage travel dates with AsyncStorage persistence
 * Travel dates are used to prefill booking links and provide context for trip planning
 */
export function useTravelDates() {
  const [travelDates, setTravelDates] = useState<TravelDates>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load travel dates from storage on mount
  useEffect(() => {
    const loadTravelDates = async () => {
      try {
        const stored = await AsyncStorage.getItem(TRAVEL_DATES_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as TravelDates;
          // Validate dates aren't in the past
          const today = new Date().toISOString().split('T')[0];
          if (parsed.departure && parsed.departure < today) {
            // Clear expired dates
            await AsyncStorage.removeItem(TRAVEL_DATES_KEY);
            setTravelDates({});
          } else {
            setTravelDates(parsed);
          }
        }
      } catch (error) {
        console.error('Failed to load travel dates:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadTravelDates();
  }, []);

  // Update travel dates and persist to storage
  const updateTravelDates = useCallback(async (dates: TravelDates) => {
    try {
      setTravelDates(dates);
      if (dates.departure || dates.return) {
        await AsyncStorage.setItem(TRAVEL_DATES_KEY, JSON.stringify(dates));
      } else {
        await AsyncStorage.removeItem(TRAVEL_DATES_KEY);
      }
    } catch (error) {
      console.error('Failed to save travel dates:', error);
    }
  }, []);

  // Clear travel dates
  const clearTravelDates = useCallback(async () => {
    try {
      setTravelDates({});
      await AsyncStorage.removeItem(TRAVEL_DATES_KEY);
    } catch (error) {
      console.error('Failed to clear travel dates:', error);
    }
  }, []);

  // Format dates for display in prompts/context
  const getFormattedDates = useCallback((): string | null => {
    if (!travelDates.departure) return null;
    
    const formatDate = (isoDate: string): string => {
      const date = new Date(isoDate + 'T12:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (travelDates.return) {
      return `${formatDate(travelDates.departure)} - ${formatDate(travelDates.return)}`;
    }
    return formatDate(travelDates.departure);
  }, [travelDates]);

  // Calculate trip duration in days
  const getTripDuration = useCallback((): number | null => {
    if (!travelDates.departure || !travelDates.return) return null;
    const start = new Date(travelDates.departure);
    const end = new Date(travelDates.return);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [travelDates]);

  return {
    travelDates,
    updateTravelDates,
    clearTravelDates,
    getFormattedDates,
    getTripDuration,
    isLoaded,
  };
}
