import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchTrailsForMap, fetchTrailGeometry, fetchParksForMap, fetchCampgroundsForMap, TrailMapMarker } from '../services/api';
import type { ParkMapMarker, CampgroundMapMarker } from '../services/api';
import { PARK_GATEWAYS, PARK_DETECTION_PATTERNS } from '../data/nationalParks';

export interface TrailMapState {
  visible: boolean;
  panelOpen: boolean;
  stateCode: string | null;
  parkCode: string | null;
  parkName: string | null;
  parkLatitude: number | null;
  parkLongitude: number | null;
  trails: TrailMapMarker[];
  parks: ParkMapMarker[];
  campgrounds: CampgroundMapMarker[];
  loading: boolean;
  error: string | null;
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY',
};

/**
 * Resolve a national park code to a state code for trail data lookup
 */
function resolveStateCode(parkCode: string): string | null {
  const gateway = PARK_GATEWAYS[parkCode.toLowerCase()];
  if (gateway) return gateway.state;
  return null;
}

/**
 * Detect a state park mention in text and return a state code
 * Matches patterns like "Wisconsin state parks", "state parks in Colorado", etc.
 */
function detectStateParkFromText(text: string): string | null {
  const stateNames = Object.keys(STATE_NAME_TO_CODE);
  const textLower = text.toLowerCase();

  for (const stateName of stateNames) {
    const patterns = [
      new RegExp(`${stateName}\\s+state\\s+park`, 'i'),
      new RegExp(`state\\s+parks?\\s+in\\s+${stateName}`, 'i'),
      new RegExp(`${stateName}\\s+trails`, 'i'),
      new RegExp(`trails\\s+in\\s+${stateName}`, 'i'),
      new RegExp(`hiking\\s+in\\s+${stateName}`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(textLower)) {
        return STATE_NAME_TO_CODE[stateName];
      }
    }
  }

  return null;
}

/**
 * Detect any state name or 2-letter code in text (broad fallback)
 * Used for destination strings like "Yellowstone, Wyoming" or "camping in CA"
 */
function detectStateFromText(text: string): string | null {
  if (!text) return null;
  const textLower = text.toLowerCase();

  // Check for 2-letter state codes (must be uppercase in source)
  const codeMatch = text.match(/\b([A-Z]{2})\b/);
  if (codeMatch) {
    const code = codeMatch[1];
    const validCodes = Object.values(STATE_NAME_TO_CODE);
    if (validCodes.includes(code)) return code;
  }

  // Check for full state names
  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (textLower.includes(name)) return code;
  }

  return null;
}

// Module-level cache: persists across re-renders and conversation switches
// Keyed by state code - once fetched, data stays cached until app restart
const mapDataCache = new Map<string, {
  trails: TrailMapMarker[];
  parks: ParkMapMarker[];
  campgrounds: CampgroundMapMarker[];
}>();
const pendingFetches = new Map<string, Promise<void>>();

/**
 * Pre-load map data for a state in the background.
 * Call this on app startup with the user's state so data is ready when the map opens.
 */
export const preloadMapData = async (stateCode: string): Promise<void> => {
  const code = stateCode.toUpperCase();
  if (mapDataCache.has(code)) return;
  if (pendingFetches.has(code)) return pendingFetches.get(code);

  const fetchPromise = (async () => {
    try {
      const [trailResult, parksResult, campResult] = await Promise.all([
        fetchTrailsForMap(code),
        fetchParksForMap(code),
        fetchCampgroundsForMap(code),
      ]);
      mapDataCache.set(code, {
        trails: trailResult.trails,
        parks: parksResult,
        campgrounds: campResult,
      });
      console.log(`[MapCache] Pre-loaded ${code}: ${trailResult.trails.length} trails, ${parksResult.length} parks, ${campResult.length} campgrounds`);
    } catch (error: any) {
      console.warn(`[MapCache] Pre-load failed for ${code}:`, error.message);
    } finally {
      pendingFetches.delete(code);
    }
  })();

  pendingFetches.set(code, fetchPromise);
  return fetchPromise;
};

export const useTrailMap = () => {
  const [state, setState] = useState<TrailMapState>({
    visible: false,
    panelOpen: false,
    stateCode: null,
    parkCode: null,
    parkName: null,
    parkLatitude: null,
    parkLongitude: null,
    trails: [],
    parks: [],
    campgrounds: [],
    loading: false,
    error: null,
  });

  const lastDetectedRef = useRef<string | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, []);

  // Auto-populate from cache when a state is detected
  // If cache is ready, load instantly. If a preload is pending, wait for it.
  useEffect(() => {
    if (!state.stateCode || !state.visible) return;
    // Already have data loaded
    if (state.trails.length > 0 || state.parks.length > 0) return;

    const code = state.stateCode.toUpperCase();
    const cached = mapDataCache.get(code);
    if (cached) {
      setState(prev => ({
        ...prev,
        trails: cached.trails,
        parks: cached.parks,
        campgrounds: cached.campgrounds,
        loading: false,
      }));
      return;
    }

    // If a preload is in progress, wait for it
    const pending = pendingFetches.get(code);
    if (pending) {
      let cancelled = false;
      setState(prev => ({ ...prev, loading: true }));
      pending.then(() => {
        if (cancelled) return;
        const result = mapDataCache.get(code);
        if (result) {
          setState(prev => ({
            ...prev,
            trails: result.trails,
            parks: result.parks,
            campgrounds: result.campgrounds,
            loading: false,
          }));
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      });
      return () => { cancelled = true; };
    }
  }, [state.stateCode, state.visible, state.trails.length, state.parks.length]);

  /**
   * Scan messages for park mentions and trigger trail tab visibility
   */
  const scanMessages = useCallback((messages: Array<{ type: string; content: string }>) => {
    // Scan from newest to oldest for the most recent park mention
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      // Check for national park detection
      for (const park of PARK_DETECTION_PATTERNS) {
        if (park.pattern.test(msg.content)) {
          const sc = resolveStateCode(park.code);
          const key = `${park.code}-${sc}`;
          if (sc && key !== lastDetectedRef.current) {
            lastDetectedRef.current = key;
            const coords = PARK_GATEWAYS[park.code.toLowerCase()];
            setState(prev => ({
              ...prev,
              visible: true,
              stateCode: sc,
              parkCode: park.code,
              parkName: park.name,
              parkLatitude: coords?.lat ?? null,
              parkLongitude: coords?.lng ?? null,
            }));
          }
          return;
        }
      }

      // Check for state park detection
      const stateCode = detectStateParkFromText(msg.content);
      if (stateCode) {
        const key = `state-${stateCode}`;
        if (key !== lastDetectedRef.current) {
          lastDetectedRef.current = key;
          setState(prev => ({
            ...prev,
            visible: true,
            stateCode,
            parkCode: null,
            parkName: `${stateCode} Trails`,
            parkLatitude: null,
            parkLongitude: null,
          }));
        }
        return;
      }
    }
  }, []);

  /**
   * Fetch trail, park, and campground data for the current detected state
   */
  const fetchTrails = useCallback(async () => {
    if (!state.stateCode) return;
    const code = state.stateCode.toUpperCase();

    // Check cache first - instant load if pre-fetched
    const cached = mapDataCache.get(code);
    if (cached) {
      setState(prev => ({
        ...prev,
        trails: cached.trails,
        parks: cached.parks,
        campgrounds: cached.campgrounds,
        loading: false,
      }));
      return;
    }

    // If a fetch is already in progress (from preload), wait for it
    const pending = pendingFetches.get(code);
    if (pending) {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await pending;
      const result = mapDataCache.get(code);
      if (result) {
        setState(prev => ({
          ...prev,
          trails: result.trails,
          parks: result.parks,
          campgrounds: result.campgrounds,
          loading: false,
        }));
        return;
      }
    }

    // Fetch fresh data
    fetchControllerRef.current?.abort();
    fetchControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [trailResult, parksResult, campResult] = await Promise.all([
        fetchTrailsForMap(code),
        fetchParksForMap(code),
        fetchCampgroundsForMap(code),
      ]);

      // Store in cache
      mapDataCache.set(code, {
        trails: trailResult.trails,
        parks: parksResult,
        campgrounds: campResult,
      });

      setState(prev => ({
        ...prev,
        trails: trailResult.trails,
        parks: parksResult,
        campgrounds: campResult,
        loading: false,
      }));
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Failed to load map data',
        }));
      }
    }
  }, [state.stateCode]);

  /**
   * Fetch geometry data for trail lines (lazy - only when user toggles trail lines on)
   */
  const fetchGeometry = useCallback(async () => {
    if (!state.stateCode) return;
    // Skip if trails already have geometry
    if (state.trails.length > 0 && state.trails[0].geometry) return;

    try {
      const result = await fetchTrailGeometry(state.stateCode);
      setState(prev => ({
        ...prev,
        trails: result.trails,
      }));
    } catch (error: any) {
      console.error('Failed to fetch trail geometry:', error);
    }
  }, [state.stateCode, state.trails]);

  /**
   * Toggle the slide-out panel open/closed
   */
  const togglePanel = useCallback(() => {
    setState(prev => {
      const opening = !prev.panelOpen;
      return { ...prev, panelOpen: opening };
    });
  }, []);

  /**
   * Close the panel
   */
  const closePanel = useCallback(() => {
    setState(prev => ({ ...prev, panelOpen: false }));
  }, []);

  /**
   * Dismiss the trail tab entirely
   */
  const dismiss = useCallback(() => {
    setState(prev => ({
      ...prev,
      visible: false,
      panelOpen: false,
    }));
  }, []);

  /**
   * Reset when conversation changes
   */
  const reset = useCallback(() => {
    lastDetectedRef.current = null;
    fetchControllerRef.current?.abort();
    setState({
      visible: false,
      panelOpen: false,
      stateCode: null,
      parkCode: null,
      parkName: null,
      parkLatitude: null,
      parkLongitude: null,
      trails: [],
      parks: [],
      campgrounds: [],
      loading: false,
      error: null,
    });
  }, []);

  /**
   * Initialize trail map from a conversation's metadata + messages.
   * Uses destination/parkMode from metadata FIRST, then scans messages as fallback.
   * This combines reset + detect in a single call to avoid race conditions.
   */
  const initFromConversation = useCallback((
    metadata: { destination?: string; parkMode?: 'national' | 'state' } | null,
    messages: Array<{ type: string; content: string }>
  ) => {
    // Reset first
    lastDetectedRef.current = null;
    fetchControllerRef.current?.abort();

    // 1) Try to resolve from metadata.destination
    if (metadata?.destination) {
      const dest = metadata.destination;

      // Check if destination matches a known national park
      for (const park of PARK_DETECTION_PATTERNS) {
        if (park.pattern.test(dest)) {
          const sc = resolveStateCode(park.code);
          if (sc) {
            const key = `${park.code}-${sc}`;
            lastDetectedRef.current = key;
            const coords = PARK_GATEWAYS[park.code.toLowerCase()];
            preloadMapData(sc);
            setState({
              visible: true,
              panelOpen: false,
              stateCode: sc,
              parkCode: park.code,
              parkName: park.name,
              parkLatitude: coords?.lat ?? null,
              parkLongitude: coords?.lng ?? null,
              trails: [],
              parks: [],
              campgrounds: [],
              loading: false,
              error: null,
            });
            return;
          }
        }
      }

      // Try to extract a state code from the destination string
      const stateFromDest = detectStateFromText(dest);
      if (stateFromDest) {
        const key = `dest-${stateFromDest}`;
        lastDetectedRef.current = key;
        preloadMapData(stateFromDest);
        setState({
          visible: true,
          panelOpen: false,
          stateCode: stateFromDest,
          parkCode: null,
          parkName: dest,
          parkLatitude: null,
          parkLongitude: null,
          trails: [],
          parks: [],
          campgrounds: [],
          loading: false,
          error: null,
        });
        return;
      }
    }

    // 2) Fall back to scanning messages (same logic as scanMessages)
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];

      for (const park of PARK_DETECTION_PATTERNS) {
        if (park.pattern.test(msg.content)) {
          const sc = resolveStateCode(park.code);
          if (sc) {
            const key = `${park.code}-${sc}`;
            lastDetectedRef.current = key;
            const coords = PARK_GATEWAYS[park.code.toLowerCase()];
            preloadMapData(sc);
            setState({
              visible: true,
              panelOpen: false,
              stateCode: sc,
              parkCode: park.code,
              parkName: park.name,
              parkLatitude: coords?.lat ?? null,
              parkLongitude: coords?.lng ?? null,
              trails: [],
              parks: [],
              campgrounds: [],
              loading: false,
              error: null,
            });
            return;
          }
        }
      }

      const stateCode = detectStateParkFromText(msg.content);
      if (stateCode) {
        const key = `state-${stateCode}`;
        lastDetectedRef.current = key;
        preloadMapData(stateCode);
        setState({
          visible: true,
          panelOpen: false,
          stateCode,
          parkCode: null,
          parkName: `${stateCode} Trails`,
          parkLatitude: null,
          parkLongitude: null,
          trails: [],
          parks: [],
          campgrounds: [],
          loading: false,
          error: null,
        });
        return;
      }

      // Broader fallback: detect any state mention in assistant messages
      if (msg.type === 'assistant') {
        const sc = detectStateFromText(msg.content);
        if (sc) {
          const key = `text-${sc}`;
          lastDetectedRef.current = key;
          preloadMapData(sc);
          setState({
            visible: true,
            panelOpen: false,
            stateCode: sc,
            parkCode: null,
            parkName: `${sc} Trails`,
            parkLatitude: null,
            parkLongitude: null,
            trails: [],
            parks: [],
            campgrounds: [],
            loading: false,
            error: null,
          });
          return;
        }
      }
    }

    // 3) Nothing detected - stay hidden
    setState({
      visible: false,
      panelOpen: false,
      stateCode: null,
      parkCode: null,
      parkName: null,
      parkLatitude: null,
      parkLongitude: null,
      trails: [],
      parks: [],
      campgrounds: [],
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    scanMessages,
    fetchTrails,
    fetchGeometry,
    togglePanel,
    closePanel,
    dismiss,
    reset,
    initFromConversation,
  };
};
