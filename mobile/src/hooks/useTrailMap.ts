import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchTrailsForMap, fetchParksForMap, fetchCampgroundsForMap, TrailMapMarker } from '../services/api';
import type { ParkMapMarker, CampgroundMapMarker } from '../services/api';
import { PARK_GATEWAYS, PARK_DETECTION_PATTERNS } from '../data/nationalParks';

export interface TrailMapState {
  visible: boolean;
  panelOpen: boolean;
  tabDismissed: boolean;
  stateCode: string | null;
  parkCode: string | null;
  parkName: string | null;
  parkLatitude: number | null;
  parkLongitude: number | null;
  trails: TrailMapMarker[];
  parks: ParkMapMarker[];
  campgrounds: CampgroundMapMarker[];
  loading: boolean;
  regionLoading: boolean;
  error: string | null;
}

// Approximate bounding boxes for states with map data
const DATA_STATE_BOUNDS: Record<string, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  WI: { minLat: 42.5, maxLat: 47.1, minLng: -92.9, maxLng: -86.8 },
  FL: { minLat: 24.4, maxLat: 31.0, minLng: -87.6, maxLng: -80.0 },
  CA: { minLat: 32.5, maxLat: 42.0, minLng: -124.4, maxLng: -114.1 },
  TX: { minLat: 25.8, maxLat: 36.5, minLng: -106.6, maxLng: -93.5 },
  CO: { minLat: 37.0, maxLat: 41.0, minLng: -109.1, maxLng: -102.0 },
  OR: { minLat: 42.0, maxLat: 46.3, minLng: -124.6, maxLng: -116.5 },
  AZ: { minLat: 31.3, maxLat: 37.0, minLng: -114.8, maxLng: -109.0 },
  UT: { minLat: 37.0, maxLat: 42.0, minLng: -114.1, maxLng: -109.0 },
  WA: { minLat: 45.5, maxLat: 49.0, minLng: -124.8, maxLng: -116.9 },
  MI: { minLat: 41.7, maxLat: 48.3, minLng: -90.4, maxLng: -82.1 },
  NC: { minLat: 33.8, maxLat: 36.6, minLng: -84.3, maxLng: -75.5 },
  VA: { minLat: 36.5, maxLat: 39.5, minLng: -83.7, maxLng: -75.2 },
  TN: { minLat: 35.0, maxLat: 36.7, minLng: -90.3, maxLng: -81.6 },
  WV: { minLat: 37.2, maxLat: 40.6, minLng: -82.6, maxLng: -77.7 },
  KY: { minLat: 36.5, maxLat: 39.1, minLng: -89.6, maxLng: -81.9 },
  GA: { minLat: 30.4, maxLat: 35.0, minLng: -85.6, maxLng: -80.8 },
  NY: { minLat: 40.5, maxLat: 45.0, minLng: -79.8, maxLng: -71.9 },
  PA: { minLat: 39.7, maxLat: 42.3, minLng: -80.5, maxLng: -74.7 },
  MN: { minLat: 43.5, maxLat: 49.4, minLng: -97.2, maxLng: -89.5 },
  SC: { minLat: 32.0, maxLat: 35.2, minLng: -83.4, maxLng: -78.5 },
  NM: { minLat: 31.3, maxLat: 37.0, minLng: -109.0, maxLng: -103.0 },
  ID: { minLat: 42.0, maxLat: 49.0, minLng: -117.2, maxLng: -111.0 },
  MT: { minLat: 44.4, maxLat: 49.0, minLng: -116.0, maxLng: -104.0 },
};

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


export const useTrailMap = () => {
  const [state, setState] = useState<TrailMapState>({
    visible: false,
    panelOpen: false,
    tabDismissed: false,
    stateCode: null,
    parkCode: null,
    parkName: null,
    parkLatitude: null,
    parkLongitude: null,
    trails: [],
    parks: [],
    campgrounds: [],
    loading: false,
    regionLoading: false,
    error: null,
  });

  const lastDetectedRef = useRef<string | null>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);
  const loadedStatesRef = useRef<Set<string>>(new Set());
  const regionFetchingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, []);


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

    fetchControllerRef.current?.abort();
    fetchControllerRef.current = new AbortController();

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [trailResult, parksResult, campResult] = await Promise.all([
        fetchTrailsForMap(code),
        fetchParksForMap(code),
        fetchCampgroundsForMap(code),
      ]);

      loadedStatesRef.current.add(code);

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
   * Progressive data loading: fetch data for states visible in the map viewport
   * that haven't been loaded yet. Accumulates data with existing.
   */
  const fetchForRegion = useCallback(async (region: {
    latitude: number; longitude: number;
    latitudeDelta: number; longitudeDelta: number;
  }) => {
    if (regionFetchingRef.current) return;

    const { latitude, longitude, latitudeDelta, longitudeDelta } = region;
    const viewMinLat = latitude - latitudeDelta / 2;
    const viewMaxLat = latitude + latitudeDelta / 2;
    const viewMinLng = longitude - longitudeDelta / 2;
    const viewMaxLng = longitude + longitudeDelta / 2;

    // Find states that overlap the viewport and aren't loaded yet
    const statesToLoad: string[] = [];
    for (const [code, bounds] of Object.entries(DATA_STATE_BOUNDS)) {
      if (loadedStatesRef.current.has(code)) continue;
      if (bounds.maxLat >= viewMinLat && bounds.minLat <= viewMaxLat &&
          bounds.maxLng >= viewMinLng && bounds.minLng <= viewMaxLng) {
        statesToLoad.push(code);
      }
    }

    if (statesToLoad.length === 0) return;

    regionFetchingRef.current = true;
    setState(prev => ({ ...prev, regionLoading: true }));

    try {
      // Fetch all visible unloaded states in parallel
      const results = await Promise.all(
        statesToLoad.map(async (code) => {
          const [trailResult, parksResult, campResult] = await Promise.all([
            fetchTrailsForMap(code),
            fetchParksForMap(code),
            fetchCampgroundsForMap(code),
          ]);
          return { code, trails: trailResult.trails, parks: parksResult, campgrounds: campResult };
        })
      );

      // Mark as loaded
      for (const r of results) {
        loadedStatesRef.current.add(r.code);
      }

      // Merge with existing data (dedupe by id)
      setState(prev => {
        const existingTrailIds = new Set(prev.trails.map(t => t.id));
        const existingParkIds = new Set(prev.parks.map(p => p.id));
        const existingCampIds = new Set(prev.campgrounds.map(c => c.id));

        const newTrails = [...prev.trails];
        const newParks = [...prev.parks];
        const newCamps = [...prev.campgrounds];

        for (const r of results) {
          for (const t of r.trails) {
            if (!existingTrailIds.has(t.id)) {
              newTrails.push(t);
              existingTrailIds.add(t.id);
            }
          }
          for (const p of r.parks) {
            if (!existingParkIds.has(p.id)) {
              newParks.push(p);
              existingParkIds.add(p.id);
            }
          }
          for (const c of r.campgrounds) {
            if (!existingCampIds.has(c.id)) {
              newCamps.push(c);
              existingCampIds.add(c.id);
            }
          }
        }

        return { ...prev, trails: newTrails, parks: newParks, campgrounds: newCamps, regionLoading: false };
      });
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        setState(prev => ({ ...prev, regionLoading: false }));
      }
    } finally {
      regionFetchingRef.current = false;
    }
  }, []);

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
   * Dismiss the tab toast but keep data available (small map button will show)
   */
  const dismissTab = useCallback(() => {
    setState(prev => ({ ...prev, tabDismissed: true, panelOpen: false }));
  }, []);

  /**
   * Re-show the tab (and optionally open the panel)
   */
  const showTab = useCallback(() => {
    setState(prev => ({ ...prev, tabDismissed: false }));
  }, []);

  /**
   * Reset when conversation changes
   */
  const reset = useCallback(() => {
    lastDetectedRef.current = null;
    fetchControllerRef.current?.abort();
    loadedStatesRef.current.clear();
    setState({
      visible: false,
      panelOpen: false,
      tabDismissed: false,
      stateCode: null,
      parkCode: null,
      parkName: null,
      parkLatitude: null,
      parkLongitude: null,
      trails: [],
      parks: [],
      campgrounds: [],
      loading: false,
      regionLoading: false,
      error: null,
    });
  }, []);

  /**
   * Initialize trail map from a conversation's metadata + messages.
   * Uses destination/parkMode from metadata FIRST, then scans messages as fallback.
   * This combines reset + detect in a single call to avoid race conditions.
   */
  const initFromConversation = useCallback((
    metadata: { destination?: string; parkMode?: 'national' | 'state'; parkCoords?: { lat: number; lng: number }; stateCode?: string } | null,
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
            setState({
              visible: true,
              panelOpen: false,
              tabDismissed: false,
              stateCode: sc,
              parkCode: park.code,
              parkName: park.name,
              parkLatitude: coords?.lat ?? null,
              parkLongitude: coords?.lng ?? null,
              trails: [],
              parks: [],
              campgrounds: [],
              loading: false,
              regionLoading: false,
              error: null,
            });
            return;
          }
        }
      }

      // Try to extract a state code from the destination string, or use explicit stateCode
      const stateFromDest = detectStateFromText(dest) || metadata?.stateCode;
      if (stateFromDest) {
        const key = `dest-${stateFromDest}`;
        lastDetectedRef.current = key;
        setState({
          visible: true,
          panelOpen: false,
          tabDismissed: false,
          stateCode: stateFromDest,
          parkCode: null,
          parkName: dest,
          parkLatitude: metadata?.parkCoords?.lat ?? null,
          parkLongitude: metadata?.parkCoords?.lng ?? null,
          trails: [],
          parks: [],
          campgrounds: [],
          loading: false,
          regionLoading: false,
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
            setState({
              visible: true,
              panelOpen: false,
              tabDismissed: false,
              stateCode: sc,
              parkCode: park.code,
              parkName: park.name,
              parkLatitude: coords?.lat ?? null,
              parkLongitude: coords?.lng ?? null,
              trails: [],
              parks: [],
              campgrounds: [],
              loading: false,
              regionLoading: false,
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
        setState({
          visible: true,
          panelOpen: false,
          tabDismissed: false,
          stateCode,
          parkCode: null,
          parkName: `${stateCode} Trails`,
          parkLatitude: null,
          parkLongitude: null,
          trails: [],
          parks: [],
          campgrounds: [],
          loading: false,
          regionLoading: false,
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
          setState({
            visible: true,
            panelOpen: false,
            tabDismissed: false,
            stateCode: sc,
            parkCode: null,
            parkName: `${sc} Trails`,
            parkLatitude: null,
            parkLongitude: null,
            trails: [],
            parks: [],
            campgrounds: [],
            loading: false,
            regionLoading: false,
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
      tabDismissed: false,
      stateCode: null,
      parkCode: null,
      parkName: null,
      parkLatitude: null,
      parkLongitude: null,
      trails: [],
      parks: [],
      campgrounds: [],
      loading: false,
      regionLoading: false,
      error: null,
    });
  }, []);

  const setParkLocation = useCallback((lat: number, lng: number, name?: string) => {
    setState(prev => ({
      ...prev,
      parkLatitude: lat,
      parkLongitude: lng,
      ...(name ? { parkName: name } : {}),
    }));
  }, []);

  return {
    ...state,
    scanMessages,
    fetchTrails,
    fetchForRegion,
    togglePanel,
    closePanel,
    dismiss,
    dismissTab,
    showTab,
    reset,
    initFromConversation,
    setParkLocation,
  };
};
