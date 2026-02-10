import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  InteractionManager,
  Linking,
  PanResponder,
  Platform,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polygon, Polyline, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useParkTheme } from '../../hooks/useParkTheme';
import { TrailMapMarker, ParkMapMarker, CampgroundMapMarker, fetchCampgroundsNearPark } from '../../services/api';
import { getTrailMarkerImage, getParkMarkerImage, getCampgroundMarkerImage } from '../../utils/markerImages';
import {
  formatAmenitySummary,
  formatSiteTypeSummary,
  formatOpenSeason,
  formatPrice,
  formatPhone,
  formatPetFriendly,
  formatTotalSites,
  formatTrailType,
  formatSurfaceType,
  formatDuration,
  formatTrailLength,
} from '../../utils/dataPresentation';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.88;
const TAB_WIDTH = 28;
const TAB_HEIGHT = 110;

// 0.5 mile radius in degrees (approximate)
const HALF_MILE_LAT_DELTA = 0.015;  // ~0.5mi north-south
const HALF_MILE_LNG_DELTA = 0.018;  // ~0.5mi east-west (varies by latitude)

// 10-mile landing zone: proportional E/W based on screen aspect ratio
const TEN_MILES_LAT_DELTA = 0.145;  // ~10mi north-south
const TEN_MILES_LNG_DELTA = TEN_MILES_LAT_DELTA * (SCREEN_WIDTH / SCREEN_HEIGHT);

// Difficulty color mapping - covers all values from TrailAPI, USFS, OSM, Recreation.gov
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#4CAF50',
  easiest: '#4CAF50',
  beginner: '#4CAF50',
  moderate: '#FF9800',
  intermediate: '#FF9800',
  hard: '#F44336',
  difficult: '#F44336',
  advanced: '#F44336',
  expert: '#9C27B0',
  strenuous: '#9C27B0',
  very_strenuous: '#9C27B0',
};

// Canonical labels for the map legend
const DIFFICULTY_LEGEND: Array<{ label: string; color: string }> = [
  { label: 'Easy', color: '#4CAF50' },
  { label: 'Moderate', color: '#FF9800' },
  { label: 'Hard', color: '#F44336' },
  { label: 'Expert', color: '#9C27B0' },
  { label: 'Unknown', color: '#9E9E9E' },
];

// Normalized display labels
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy', easiest: 'Easy', beginner: 'Easy',
  moderate: 'Moderate', intermediate: 'Moderate',
  hard: 'Hard', difficult: 'Hard', advanced: 'Hard',
  expert: 'Expert', strenuous: 'Expert', very_strenuous: 'Expert',
};

const UNKNOWN_COLOR = '#9E9E9E';

function getDifficultyColor(difficulty?: string): string {
  if (!difficulty) return UNKNOWN_COLOR;
  const norm = normalizeDifficultyKey(difficulty);
  return DIFFICULTY_COLORS[norm] || UNKNOWN_COLOR;
}

function normalizeDifficultyKey(difficulty: string): string {
  const key = difficulty.toLowerCase().trim();
  if (['easy', 'easiest', 'beginner'].includes(key)) return 'easy';
  if (['moderate', 'intermediate'].includes(key)) return 'moderate';
  if (['hard', 'difficult', 'advanced'].includes(key)) return 'hard';
  if (['expert', 'strenuous', 'very_strenuous'].includes(key)) return 'expert';
  return key;
}

const DIFFICULTY_COLORS_RGBA: Record<string, string> = {
  easy: 'rgba(76, 175, 80, 0.6)',
  easiest: 'rgba(76, 175, 80, 0.6)',
  beginner: 'rgba(76, 175, 80, 0.6)',
  moderate: 'rgba(255, 152, 0, 0.6)',
  intermediate: 'rgba(255, 152, 0, 0.6)',
  hard: 'rgba(244, 67, 54, 0.6)',
  difficult: 'rgba(244, 67, 54, 0.6)',
  advanced: 'rgba(244, 67, 54, 0.6)',
  expert: 'rgba(156, 39, 176, 0.6)',
  strenuous: 'rgba(156, 39, 176, 0.6)',
  very_strenuous: 'rgba(156, 39, 176, 0.6)',
};
const UNKNOWN_COLOR_RGBA = 'rgba(158, 158, 158, 0.5)';

function getDifficultyColorRGBA(difficulty?: string): string {
  if (!difficulty) return UNKNOWN_COLOR_RGBA;
  const norm = normalizeDifficultyKey(difficulty);
  return DIFFICULTY_COLORS_RGBA[norm] || UNKNOWN_COLOR_RGBA;
}

function simplifyGeometry(
  coords: Array<{ latitude: number; longitude: number }>,
  zoomDelta: number
): Array<{ latitude: number; longitude: number }> {
  if (coords.length <= 4) return coords;
  let step: number;
  if (zoomDelta > 2) step = 8;
  else if (zoomDelta > 1) step = 5;
  else if (zoomDelta > 0.5) step = 3;
  else if (zoomDelta > 0.2) step = 2;
  else return coords;
  const simplified: Array<{ latitude: number; longitude: number }> = [coords[0]];
  for (let i = step; i < coords.length - 1; i += step) {
    simplified.push(coords[i]);
  }
  simplified.push(coords[coords.length - 1]);
  return simplified;
}

function parseTrailLength(trail: TrailMapMarker): number {
  return trail.lengthMiles || 0;
}

function normalizeDifficulty(difficulty?: string): string {
  if (!difficulty) return 'unknown';
  const key = difficulty.toLowerCase().trim();
  if (['easy', 'easiest', 'beginner'].includes(key)) return 'easy';
  if (['moderate', 'intermediate'].includes(key)) return 'moderate';
  if (['hard', 'difficult', 'advanced'].includes(key)) return 'hard';
  if (['expert', 'strenuous', 'very_strenuous'].includes(key)) return 'expert';
  return 'unknown';
}

/** True only for the 63 designated National Parks (not monuments, rec areas, etc.) */
function isActualNationalPark(park: ParkMapMarker): boolean {
  const d = park.designation?.toLowerCase() || '';
  return d.includes('national park') && !d.includes('national parkway');
}

/** True for state parks */
function isStatePark(park: ParkMapMarker): boolean {
  return park.category === 'state';
}

/** True for NPs + state parks — these get the prominent brown road-sign marker */
function isProminentPark(park: ParkMapMarker): boolean {
  return isActualNationalPark(park) || isStatePark(park);
}

/** Legacy: true for any national-category park (including monuments) */
function isNationalPark(park: ParkMapMarker): boolean {
  return park.category === 'national' || park.id?.startsWith('np-');
}

function getDifficultyLabel(difficulty?: string): string {
  if (!difficulty) return 'Unknown';
  const key = difficulty.toLowerCase().trim();
  return DIFFICULTY_LABELS[key] || difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
}

export type { ParkMapMarker, CampgroundMapMarker } from '../../services/api';

interface TrailMapPanelProps {
  visible: boolean;
  panelOpen: boolean;
  trails: TrailMapMarker[];
  parks: ParkMapMarker[];
  campgrounds: CampgroundMapMarker[];
  loading: boolean;
  regionLoading: boolean;
  error: string | null;
  parkName: string | null;
  stateCode: string | null;
  userLatitude: number | null;
  userLongitude: number | null;
  parkLatitude: number | null;
  parkLongitude: number | null;
  onTogglePanel: () => void;
  onClose: () => void;
  onFetchTrails: () => void;
  onFetchForRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }) => void;
  onPlanAdventure?: (parkName: string, parkState?: string, parkCategory?: string) => void;
}

export const TrailMapPanel: React.FC<TrailMapPanelProps> = ({
  visible,
  panelOpen,
  trails = [],
  parks = [],
  campgrounds = [],
  loading,
  regionLoading,
  error,
  parkName,
  stateCode,
  userLatitude,
  userLongitude,
  parkLatitude,
  parkLongitude,
  onTogglePanel,
  onClose,
  onFetchTrails,
  onFetchForRegion,
  onPlanAdventure,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useParkTheme();
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const mapRef = useRef<MapView>(null);
  const markerJustPressedRef = useRef(false);
  const preFocusRegionRef = useRef<Region | null>(null);
  const regionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterGuardRef = useRef(false);
  const filterGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTrail, setSelectedTrail] = useState<TrailMapMarker | null>(null);
  const [selectedPark, setSelectedPark] = useState<ParkMapMarker | null>(null);
  const [selectedCampground, setSelectedCampground] = useState<CampgroundMapMarker | null>(null);
  const [parkCampgrounds, setParkCampgrounds] = useState<(CampgroundMapMarker & { distanceMiles: number })[]>([]);
  const [showTrailLines, setShowTrailLines] = useState(true);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [mapStable, setMapStable] = useState(true);
  const [androidMarkersReady, setAndroidMarkersReady] = useState(Platform.OS !== 'android');
  const [focusCoords, setFocusCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [trailsCollapsed, setTrailsCollapsed] = useState(true);
  const [campgroundsCollapsed, setCampgroundsCollapsed] = useState(true);
  const [filters, setFilters] = useState({
    easy: true,
    moderate: true,
    hard: true,
    expert: true,
    unknown: true,
    stateParks: true,
    nationalParks: true,
    campgrounds: true,
  });

  const toggleFilter = useCallback((key: keyof typeof filters) => {
    // Guard: block region updates for 500ms after filter change to prevent
    // marker reflows from triggering cascading viewport recomputation
    filterGuardRef.current = true;
    if (filterGuardTimerRef.current) clearTimeout(filterGuardTimerRef.current);
    filterGuardTimerRef.current = setTimeout(() => {
      filterGuardRef.current = false;
    }, 500);
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const FOCUS_RADIUS_DEG = 0.05; // ~3.5 miles
  const ONE_MILE_DEG = 0.0145; // ~1 mile in degrees

  // Compute focus window bounds when a node is selected
  const focusBounds = useMemo(() => {
    if (!focusCoords) return null;
    return {
      north: focusCoords.latitude + FOCUS_RADIUS_DEG,
      south: focusCoords.latitude - FOCUS_RADIUS_DEG,
      east: focusCoords.longitude + FOCUS_RADIUS_DEG,
      west: focusCoords.longitude - FOCUS_RADIUS_DEG,
    };
  }, [focusCoords]);

  // Viewport bounds with 10% buffer to prevent edge-flicker on tiny region shifts
  const viewportBounds = useMemo(() => {
    if (!mapRegion) return null;
    const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;
    const latBuffer = latitudeDelta * 0.1;
    const lngBuffer = longitudeDelta * 0.1;
    return {
      north: latitude + latitudeDelta / 2 + latBuffer,
      south: latitude - latitudeDelta / 2 - latBuffer,
      east: longitude + longitudeDelta / 2 + lngBuffer,
      west: longitude - longitudeDelta / 2 - lngBuffer,
    };
  }, [mapRegion]);

  // Step 1: Geographic viewport filter (only changes when user pans/zooms)
  // Sorted: known-difficulty first, then by length descending
  const viewportTrails = useMemo(() => {
    if (focusCoords) {
      return selectedTrail ? [selectedTrail] : [];
    }
    if (!viewportBounds) return [];
    const { north, south, east, west } = viewportBounds;
    const inView = trails.filter(t =>
      t.latitude >= south && t.latitude <= north &&
      t.longitude >= west && t.longitude <= east
    );
    inView.sort((a, b) => {
      const aKnown = a.difficulty ? 1 : 0;
      const bKnown = b.difficulty ? 1 : 0;
      if (aKnown !== bKnown) return bKnown - aKnown;
      return (b.lengthMiles || 0) - (a.lengthMiles || 0);
    });
    return inView;
  }, [trails, viewportBounds, focusCoords, selectedTrail]);

  // Step 2: Difficulty filter (only changes when filter toggles, NOT when map moves)
  const visibleTrails = useMemo(() => {
    return viewportTrails.filter(t => {
      const norm = normalizeDifficulty(t.difficulty);
      return filters[norm as keyof typeof filters] !== false;
    });
  }, [viewportTrails, filters.easy, filters.moderate, filters.hard, filters.expert, filters.unknown]);

  // Visible parks = buffered viewport + type filter; in focus mode only the selected park
  const MAX_VISIBLE_PARKS = 100;
  const viewportParks = useMemo(() => {
    if (focusCoords) {
      return selectedPark ? [selectedPark] : [];
    }
    if (!viewportBounds) return [];
    const { north, south, east, west } = viewportBounds;
    const inView = parks.filter(p =>
      p.latitude >= south && p.latitude <= north &&
      p.longitude >= west && p.longitude <= east
    );
    return inView.length > MAX_VISIBLE_PARKS ? inView.slice(0, MAX_VISIBLE_PARKS) : inView;
  }, [parks, viewportBounds, focusCoords, selectedPark]);

  const visibleParks = useMemo(() => {
    return viewportParks.filter(p =>
      isNationalPark(p) ? filters.nationalParks : filters.stateParks
    );
  }, [viewportParks, filters.stateParks, filters.nationalParks]);

  // Sort parks: other national sites first (bottom), then state parks, then actual NPs last (on top)
  const sortedViewportParks = useMemo(() => {
    return [...viewportParks].sort((a, b) => {
      const scoreA = isActualNationalPark(a) ? 2 : isStatePark(a) ? 1 : 0;
      const scoreB = isActualNationalPark(b) ? 2 : isStatePark(b) ? 1 : 0;
      return scoreA - scoreB;
    });
  }, [viewportParks]);

  // Visible campgrounds = buffered viewport + filter; in focus mode only the selected campground
  const MAX_VISIBLE_CAMPGROUNDS = 100;
  const viewportCampgrounds = useMemo(() => {
    if (focusCoords) {
      return selectedCampground ? [selectedCampground] : [];
    }
    if (!viewportBounds) return [];
    const { north, south, east, west } = viewportBounds;
    const inView = campgrounds.filter(c =>
      c.latitude >= south && c.latitude <= north &&
      c.longitude >= west && c.longitude <= east
    );
    return inView.length > MAX_VISIBLE_CAMPGROUNDS ? inView.slice(0, MAX_VISIBLE_CAMPGROUNDS) : inView;
  }, [campgrounds, viewportBounds, focusCoords, selectedCampground]);

  const visibleCampgrounds = useMemo(() => {
    if (!filters.campgrounds) return [];
    return viewportCampgrounds;
  }, [viewportCampgrounds, filters.campgrounds]);

  const hasTrailsLoaded = trails.length > 0 && !loading;

  // Trails associated with the focused node (within the focus window rectangle)
  const associatedTrails = useMemo(() => {
    if (!focusBounds) return [];
    if (selectedTrail) return [selectedTrail];
    return trails.filter(t =>
      t.latitude >= focusBounds.south && t.latitude <= focusBounds.north &&
      t.longitude >= focusBounds.west && t.longitude <= focusBounds.east
    );
  }, [focusBounds, selectedTrail, trails]);

  // Campgrounds associated with the focused node
  // For parks: use API-fetched parkCampgrounds (spatial query with distance)
  // For other selections: use focus bounds rectangle
  const associatedCampgrounds = useMemo(() => {
    if (selectedPark && parkCampgrounds.length > 0) {
      return parkCampgrounds;
    }
    if (!focusBounds) return [];
    if (selectedCampground) return [selectedCampground];
    return campgrounds.filter(c =>
      c.latitude >= focusBounds.south && c.latitude <= focusBounds.north &&
      c.longitude >= focusBounds.west && c.longitude <= focusBounds.east
    );
  }, [focusBounds, selectedCampground, campgrounds, selectedPark, parkCampgrounds]);

  // Polyline rendering: only for the clicked node's associated trails
  const MAX_VISIBLE_POLYLINES = 100;
  const hasSelection = !!(selectedTrail || selectedPark || selectedCampground);
  const trailsWithLines = useMemo(() => {
    if (!hasSelection) return [];
    const withGeom = associatedTrails.filter(t => t.geometry && t.geometry.length >= 2);
    withGeom.sort((a, b) => parseTrailLength(b) - parseTrailLength(a));
    const capped = withGeom.length > MAX_VISIBLE_POLYLINES
      ? withGeom.slice(0, MAX_VISIBLE_POLYLINES)
      : withGeom;
    if (mapRegion) {
      return capped.map(t => ({
        ...t,
        geometry: simplifyGeometry(t.geometry!, mapRegion.latitudeDelta),
      }));
    }
    return capped;
  }, [hasSelection, associatedTrails, mapRegion]);

  // Zoom-dependent stroke width: thinner when zoomed out, thicker when zoomed in
  const trailStrokeWidth = useMemo(() => {
    if (!mapRegion) return 2;
    const delta = mapRegion.latitudeDelta;
    if (delta > 2) return 1;
    if (delta > 1) return 1.5;
    if (delta > 0.5) return 2;
    if (delta > 0.1) return 2.5;
    return 3;
  }, [mapRegion]);

  // On Android, allow markers to render as bitmaps first, then disable tracking for touch events
  useEffect(() => {
    if (Platform.OS === 'android' && !androidMarkersReady && (trails.length > 0 || parks.length > 0 || campgrounds.length > 0)) {
      const timer = setTimeout(() => setAndroidMarkersReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [trails.length, parks.length, campgrounds.length, androidMarkersReady]);

  const handleRegionChangeStart = useCallback(() => {
    setMapStable(false);
  }, []);

  const regionFetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setMapStable(true);
    // CRITICAL: If a filter just changed, ignore this region event entirely.
    // Marker reflows from filter toggles cause the map to fire spurious
    // onRegionChangeComplete events with slightly shifted regions, which
    // would cascade into viewport recomputation and phantom nodes.
    if (filterGuardRef.current) return;
    // Debounce genuine user pan/zoom events
    if (regionDebounceRef.current) clearTimeout(regionDebounceRef.current);
    regionDebounceRef.current = setTimeout(() => {
      setMapRegion(region);
      regionDebounceRef.current = null;
    }, 100);
    // Progressive data loading: debounce longer to avoid rapid requests
    if (regionFetchDebounceRef.current) clearTimeout(regionFetchDebounceRef.current);
    regionFetchDebounceRef.current = setTimeout(() => {
      onFetchForRegion(region);
      regionFetchDebounceRef.current = null;
    }, 800);
  }, [onFetchForRegion]);

  const selectTrail = useCallback((trail: TrailMapMarker) => {
    markerJustPressedRef.current = true;
    setTimeout(() => { markerJustPressedRef.current = false; }, 300);
    if (!preFocusRegionRef.current && mapRegion) preFocusRegionRef.current = mapRegion;
    setSelectedTrail(trail);
    setSelectedPark(null);
    setSelectedCampground(null);
    setFocusCoords({ latitude: trail.latitude, longitude: trail.longitude });
    mapRef.current?.animateToRegion({
      latitude: trail.latitude,
      longitude: trail.longitude,
      latitudeDelta: ONE_MILE_DEG * 2, // 1 mile each direction
      longitudeDelta: ONE_MILE_DEG * 2,
    }, 500);
  }, [mapRegion]);

  const selectPark = useCallback((park: ParkMapMarker) => {
    markerJustPressedRef.current = true;
    setTimeout(() => { markerJustPressedRef.current = false; }, 300);
    if (!preFocusRegionRef.current && mapRegion) preFocusRegionRef.current = mapRegion;
    setSelectedPark(park);
    setSelectedTrail(null);
    setSelectedCampground(null);
    setParkCampgrounds([]); // Clear previous
    setFocusCoords({ latitude: park.latitude, longitude: park.longitude });
    mapRef.current?.animateToRegion({
      latitude: park.latitude,
      longitude: park.longitude,
      latitudeDelta: FOCUS_RADIUS_DEG * 2.5,
      longitudeDelta: FOCUS_RADIUS_DEG * 2.5,
    }, 500);
    // Fetch campgrounds near this park
    fetchCampgroundsNearPark(park.id, 30, 10)
      .then(cgs => {
        setParkCampgrounds(cgs);
      })
      .catch(err => {
        console.warn('Failed to fetch campgrounds near park:', err);
        setParkCampgrounds([]);
      });
  }, [mapRegion]);

  const selectCampground = useCallback((cg: CampgroundMapMarker) => {
    markerJustPressedRef.current = true;
    setTimeout(() => { markerJustPressedRef.current = false; }, 300);
    if (!preFocusRegionRef.current && mapRegion) preFocusRegionRef.current = mapRegion;
    setSelectedCampground(cg);
    setSelectedTrail(null);
    setSelectedPark(null);
    setFocusCoords({ latitude: cg.latitude, longitude: cg.longitude });
    mapRef.current?.animateToRegion({
      latitude: cg.latitude,
      longitude: cg.longitude,
      latitudeDelta: FOCUS_RADIUS_DEG * 2.5,
      longitudeDelta: FOCUS_RADIUS_DEG * 2.5,
    }, 500);
  }, [mapRegion]);

  const clearSelection = useCallback(() => {
    // Clear everything immediately — selection, focus, and polylines all reset at once
    setSelectedTrail(null);
    setSelectedPark(null);
    setSelectedCampground(null);
    setParkCampgrounds([]);
    setFocusCoords(null);
    setTrailsCollapsed(true);
    setCampgroundsCollapsed(true);
    // Restore pre-focus map region immediately so viewport bounds expand
    // and all markers reappear without waiting for the animation to complete
    const savedRegion = preFocusRegionRef.current;
    preFocusRegionRef.current = null;
    if (savedRegion) {
      setMapRegion(savedRegion);
      mapRef.current?.animateToRegion(savedRegion, 500);
    }
  }, []);
  const hasFetchedRef = useRef(false);

  // Animate panel slide
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: panelOpen ? 0 : PANEL_WIDTH,
      friction: 10,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [panelOpen, slideAnim]);

  // Fetch trails when panel opens and stateCode is available
  useEffect(() => {
    if (panelOpen && stateCode && !hasFetchedRef.current && trails.length === 0) {
      hasFetchedRef.current = true;
      onFetchTrails();
    }
  }, [panelOpen, stateCode, trails.length, onFetchTrails]);

  // Reset fetch flag when stateCode changes
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [stateCode]);

  // Fit map: park coords first, then user location, then trail markers
  useEffect(() => {
    if (!panelOpen || !mapRef.current) return;

    // 1) Center on park coordinates (national park gateway or state park location)
    if (parkLatitude && parkLongitude) {
      const region = {
        latitude: parkLatitude,
        longitude: parkLongitude,
        latitudeDelta: TEN_MILES_LAT_DELTA,
        longitudeDelta: TEN_MILES_LNG_DELTA,
      };
      setMapRegion(region);
      setTimeout(() => {
        mapRef.current?.animateToRegion(region, 300);
      }, 300);
    } else if (userLatitude && userLongitude) {
      // 2) State park mode / no park coords: use user location
      const region = {
        latitude: userLatitude,
        longitude: userLongitude,
        latitudeDelta: HALF_MILE_LAT_DELTA,
        longitudeDelta: HALF_MILE_LNG_DELTA,
      };
      setMapRegion(region);
      setTimeout(() => {
        mapRef.current?.animateToRegion(region, 300);
      }, 300);
    } else if (trails.length > 0) {
      // 3) No location at all: fit all trail markers
      const coordinates = trails.map(t => ({
        latitude: t.latitude,
        longitude: t.longitude,
      }));
      // Set an approximate region from trail bounds
      const lats = coordinates.map(c => c.latitude);
      const lngs = coordinates.map(c => c.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      setMapRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: Math.max(maxLat - minLat, 0.1) * 1.2,
        longitudeDelta: Math.max(maxLng - minLng, 0.1) * 1.2,
      });
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
          animated: true,
        });
      }, 300);
    } else {
      // 4) Fallback: set a default region so markers can render
      setMapRegion({
        latitude: 39.8283,
        longitude: -98.5795,
        latitudeDelta: 20,
        longitudeDelta: 20,
      });
    }
  }, [trails, panelOpen, parkLatitude, parkLongitude, userLatitude, userLongitude]);

  const handleOpenGoogleMaps = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleOpenAllTrails = useCallback((url: string) => {
    Linking.openURL(url).catch(() => {});
  }, []);

  if (!visible) return null;

  const initialRegion: Region = {
    latitude: parkLatitude || userLatitude || 39.8283,
    longitude: parkLongitude || userLongitude || -98.5795,
    latitudeDelta: parkLatitude ? TEN_MILES_LAT_DELTA : (userLatitude ? HALF_MILE_LAT_DELTA : 20),
    longitudeDelta: parkLongitude ? TEN_MILES_LNG_DELTA : (userLongitude ? HALF_MILE_LNG_DELTA : 20),
  };

  return (
    <>
      {/* Slide-out Panel */}
      <Animated.View
        style={[
          styles.panelContainer,
          {
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Panel Header */}
        <View style={[styles.panelHeader, { borderBottomColor: theme.primaryMedium }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.panelTitle, { color: theme.primary }]}>
              Adventure Map
            </Text>
            {parkName && (
              <Text style={styles.parkNameText} numberOfLines={1}>
                {parkName}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>X</Text>
          </TouchableOpacity>
        </View>

        {/* Interactive filter legend - hidden in focus mode */}
        {!focusCoords && (
          <View style={styles.filterSection}>
          {/* Row 1: Layer toggles */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterItem, !filters.stateParks && styles.filterItemInactive]}
              onPress={() => toggleFilter('stateParks')}
              activeOpacity={0.7}
            >
              <View style={[styles.filterCheckbox, filters.stateParks && { backgroundColor: '#33691E', borderColor: '#33691E' }]}>
                {filters.stateParks && <Text style={styles.filterCheckmark}>{'\u2713'}</Text>}
              </View>
              <View style={[styles.legendBadge, styles.legendBadgeState, { opacity: filters.stateParks ? 1 : 0.3 }]}>
                <Text style={styles.legendBadgeText}>SP</Text>
              </View>
              <Text style={[styles.filterLabel, !filters.stateParks && styles.filterLabelInactive]}>State</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterItem, !filters.nationalParks && styles.filterItemInactive]}
              onPress={() => toggleFilter('nationalParks')}
              activeOpacity={0.7}
            >
              <View style={[styles.filterCheckbox, filters.nationalParks && { backgroundColor: '#4A2C0A', borderColor: '#4A2C0A' }]}>
                {filters.nationalParks && <Text style={styles.filterCheckmark}>{'\u2713'}</Text>}
              </View>
              <View style={[styles.legendBadge, styles.legendBadgeNational, { opacity: filters.nationalParks ? 1 : 0.3 }]}>
                <Text style={styles.legendBadgeText}>NP</Text>
              </View>
              <Text style={[styles.filterLabel, !filters.nationalParks && styles.filterLabelInactive]}>National</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterItem, !filters.campgrounds && styles.filterItemInactive]}
              onPress={() => toggleFilter('campgrounds')}
              activeOpacity={0.7}
            >
              <View style={[styles.filterCheckbox, filters.campgrounds && { backgroundColor: '#E65100', borderColor: '#E65100' }]}>
                {filters.campgrounds && <Text style={styles.filterCheckmark}>{'\u2713'}</Text>}
              </View>
              <View style={[styles.legendTent, { opacity: filters.campgrounds ? 1 : 0.3 }]}>
                <View style={styles.legendTentTop} />
                <View style={styles.legendTentBase} />
              </View>
              <Text style={[styles.filterLabel, !filters.campgrounds && styles.filterLabelInactive]}>Camp</Text>
            </TouchableOpacity>
            
          </View>
          {/* Row 2: Difficulty toggles */}
          <View style={styles.filterRow}>
            {DIFFICULTY_LEGEND.map(({ label, color }) => {
              const key = label.toLowerCase() as keyof typeof filters;
              const isActive = filters[key] !== false;
              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.filterItem, !isActive && styles.filterItemInactive]}
                  onPress={() => toggleFilter(key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.filterCheckbox, isActive && { backgroundColor: color, borderColor: color }]}>
                    {isActive && <Text style={styles.filterCheckmark}>{'\u2713'}</Text>}
                  </View>
                  <View style={[styles.legendPin, { backgroundColor: color, opacity: isActive ? 1 : 0.3 }]} />
                  <Text style={[styles.filterLabel, !isActive && styles.filterLabelInactive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        )}

        {/* Map + loading overlays wrapper */}
        <View style={{ flex: 1 }}>
        <View style={styles.mapContainer}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: theme.buttonBackground }]}
                onPress={onFetchTrails}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={initialRegion}
              mapType="terrain"
              showsUserLocation={true}
              showsMyLocationButton={true}
              scrollEnabled={!loading}
              zoomEnabled={!loading}
              rotateEnabled={!loading}
              onRegionChange={handleRegionChangeStart}
              onRegionChangeComplete={handleRegionChangeComplete}
            >
              {/* Viewport border - shows the exact area where data is rendered */}
              {mapRegion && (
                <Polygon
                  coordinates={[
                    { latitude: mapRegion.latitude + mapRegion.latitudeDelta / 2, longitude: mapRegion.longitude - mapRegion.longitudeDelta / 2 },
                    { latitude: mapRegion.latitude + mapRegion.latitudeDelta / 2, longitude: mapRegion.longitude + mapRegion.longitudeDelta / 2 },
                    { latitude: mapRegion.latitude - mapRegion.latitudeDelta / 2, longitude: mapRegion.longitude + mapRegion.longitudeDelta / 2 },
                    { latitude: mapRegion.latitude - mapRegion.latitudeDelta / 2, longitude: mapRegion.longitude - mapRegion.longitudeDelta / 2 },
                  ]}
                  strokeColor="rgba(59, 130, 246, 0.8)"
                  strokeWidth={2}
                  fillColor="rgba(59, 130, 246, 0.03)"
                />
              )}

              {/* Park markers - sorted so prominent parks (NPs, state parks) render on top */}
              {sortedViewportParks.map((park) => {
                const isSelected = selectedPark?.id === park.id;
                const isVisible = isNationalPark(park) ? filters.nationalParks : filters.stateParks;
                const prominent = isProminentPark(park);
                const isNP = isActualNationalPark(park);
                const isSP = isStatePark(park);
                const parkImage = getParkMarkerImage(isNP, isSP);
                return (
                  <Marker
                    key={`park-${park.id}`}
                    coordinate={{
                      latitude: park.latitude,
                      longitude: park.longitude,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={isSelected}
                    opacity={isVisible ? 1 : 0}
                    tappable={isVisible}
                    zIndex={prominent ? (isNP ? 20 : 15) : 5}
                    image={parkImage}
                    onPress={() => selectPark(park)}
                  >
                    {!parkImage && prominent && (
                      <View style={[
                        styles.npsBadge,
                        isNP ? styles.npsBadgeNational : styles.npsBadgeState,
                        isSelected && styles.npsBadgeSelected,
                      ]} collapsable={false}>
                        <Text style={[
                          styles.npsBadgeText,
                          isSelected && { fontSize: 7 },
                        ]} numberOfLines={1}>
                          {isNP ? 'NP' : 'SP'}
                        </Text>
                      </View>
                    )}
                    {!parkImage && !prominent && (
                      <View style={[
                        styles.otherSiteMarker,
                        isSelected && styles.selectedMarkerGlow,
                      ]} collapsable={false}>
                        <View style={styles.otherSiteDiamond} />
                      </View>
                    )}
                  </Marker>
                );
              })}

              {/* Campground markers - all viewport campgrounds stay mounted; filtered-out ones get opacity=0 */}
              {viewportCampgrounds.map((cg) => {
                const isSelected = selectedCampground?.id === cg.id;
                const isVisible = filters.campgrounds;
                const cgImage = getCampgroundMarkerImage();
                return (
                  <Marker
                    key={`cg-${cg.id}`}
                    coordinate={{
                      latitude: cg.latitude,
                      longitude: cg.longitude,
                    }}
                    anchor={{ x: 0.5, y: 1.0 }}
                    tracksViewChanges={isSelected}
                    opacity={isVisible ? 1 : 0}
                    tappable={isVisible}
                    image={cgImage}
                    onPress={() => selectCampground(cg)}
                  >
                    {!cgImage && (
                      <View style={[
                        styles.tentMarker,
                        isSelected && styles.selectedMarkerGlow,
                      ]} collapsable={false}>
                        <View style={[styles.tentTop, isSelected && { transform: [{ scale: 1.3 }] }]} />
                        <View style={[styles.tentBase, isSelected && { transform: [{ scale: 1.3 }] }]} />
                      </View>
                    )}
                  </Marker>
                );
              })}

              {/* Trail markers - all viewport trails stay mounted; filtered-out ones get opacity=0 */}
              {viewportTrails.map((trail) => {
                const isSelected = selectedTrail?.id === trail.id;
                const norm = normalizeDifficulty(trail.difficulty);
                const isVisible = filters[norm as keyof typeof filters] !== false;
                const color = getDifficultyColor(trail.difficulty);
                const trailImage = getTrailMarkerImage(norm, isSelected);
                return (
                  <Marker
                    key={`trail-${trail.id}`}
                    coordinate={{
                      latitude: trail.latitude,
                      longitude: trail.longitude,
                    }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={isSelected}
                    opacity={isVisible ? 1 : 0}
                    tappable={isVisible}
                    image={trailImage}
                    onPress={() => selectTrail(trail)}
                  >
                    {!trailImage && (
                      <View
                        style={[
                          isSelected ? styles.trailPinSelected : styles.trailPin,
                          {
                            backgroundColor: color,
                            ...(isSelected && focusCoords ? { transform: [{ scale: 0.25 }] } : {}),
                          },
                        ]}
                        collapsable={false}
                      />
                    )}
                  </Marker>
                );
              })}

              {/* Trail polylines - only rendered when a node is clicked */}
              {hasSelection && showTrailLines && trailsWithLines.map((trail) => {
                const isSelected = selectedTrail?.id === trail.id;
                return (
                  <Polyline
                    key={`line-${trail.id}`}
                    coordinates={trail.geometry!}
                    strokeColor={getDifficultyColor(trail.difficulty)}
                    strokeWidth={isSelected ? 8 : 6}
                    tappable={true}
                    onPress={() => selectTrail(trail)}
                  />
                );
              })}
            </MapView>
          )}

          {/* Floating Clear Focus button */}
          {focusCoords && (
            <TouchableOpacity
              style={styles.clearFocusButton}
              onPress={clearSelection}
              activeOpacity={0.8}
            >
              <Text style={styles.clearFocusText}>X Show All</Text>
            </TouchableOpacity>
          )}

        </View>

        {/* Loading overlays rendered OUTSIDE mapContainer so they paint above native MapView */}
        {regionLoading && (
          <View style={styles.mapUpdatingOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.mapUpdatingText}>Loading map data...</Text>
          </View>
        )}

        {loading && (
          <View style={styles.mapLoadingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.mapLoadingText}>Loading map data...</Text>
          </View>
        )}

        </View>

        {/* Selected Trail Detail */}
        {selectedTrail && (
          <View style={[styles.detailPanel, { borderTopColor: theme.primaryMedium }]}>
            <View style={styles.detailHeader}>
              <View style={styles.detailInfo}>
                <Text style={styles.detailName} numberOfLines={2}>
                  {selectedTrail.name}
                </Text>
                <Text style={styles.detailSubtitle} numberOfLines={1}>
                  {selectedTrail.parkName}
                </Text>
              </View>
              <TouchableOpacity onPress={clearSelection} style={styles.detailClose}>
                <Text style={styles.detailCloseText}>X</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailMeta}>
              {selectedTrail.difficulty && (
                <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(selectedTrail.difficulty) + '22' }]}>
                  <View style={[styles.difficultyDot, { backgroundColor: getDifficultyColor(selectedTrail.difficulty) }]} />
                  <Text style={[styles.difficultyText, { color: getDifficultyColor(selectedTrail.difficulty) }]}>
                    {getDifficultyLabel(selectedTrail.difficulty)}{selectedTrail.difficultySource?.startsWith('inferred') ? ' (est.)' : ''}
                  </Text>
                </View>
              )}
              {formatTrailLength(selectedTrail.lengthMiles) && (
                <View style={styles.lengthBadge}>
                  <Text style={styles.lengthText}>
                    {formatTrailLength(selectedTrail.lengthMiles)}
                  </Text>
                </View>
              )}
              {formatDuration(selectedTrail.estimatedMinutes) && (
                <View style={styles.lengthBadge}>
                  <Text style={styles.lengthText}>
                    {formatDuration(selectedTrail.estimatedMinutes)}
                  </Text>
                </View>
              )}
              {selectedTrail.trailType && formatTrailType(selectedTrail.trailType) && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{formatTrailType(selectedTrail.trailType)}</Text>
                </View>
              )}
              {selectedTrail.surfaceType && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{formatSurfaceType(selectedTrail.surfaceType)}</Text>
                </View>
              )}
              {!selectedTrail.difficulty && !formatTrailLength(selectedTrail.lengthMiles) && !selectedTrail.trailType && (
                <Text style={styles.noDataText}>Limited trail data available</Text>
              )}
            </View>

            <Text style={styles.coordText}>
              {selectedTrail.latitude.toFixed(4)}, {selectedTrail.longitude.toFixed(4)}
            </Text>

            <View style={styles.detailActions}>
              {onPlanAdventure && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.planAdventureButton]}
                  onPress={() => {
                    onPlanAdventure(
                      selectedTrail.parkName || selectedTrail.name,
                      stateCode || undefined,
                      'trail',
                    );
                  }}
                >
                  <Text style={styles.actionButtonText}>Plan an Adventure Here</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.buttonBackground }]}
                onPress={() => {
                  const url = selectedTrail.googleMapsUrl ||
                    `https://www.google.com/maps/dir/?api=1&destination=${selectedTrail.latitude},${selectedTrail.longitude}`;
                  handleOpenGoogleMaps(url);
                }}
              >
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>
              {selectedTrail.allTrailsUrl && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.actionButtonSecondary]}
                  onPress={() => handleOpenAllTrails(selectedTrail.allTrailsUrl!)}
                >
                  <Text style={[styles.actionButtonText, styles.actionButtonSecondaryText]}>
                    AllTrails
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Selected Park Detail */}
        {selectedPark && (
          <ScrollView style={[styles.detailPanel, { borderTopColor: '#2196F3', maxHeight: SCREEN_HEIGHT * 0.45 }]}>
            <View style={styles.detailHeader}>
              <View style={styles.detailInfo}>
                <Text style={styles.detailName} numberOfLines={2}>
                  {selectedPark.name}
                </Text>
                <Text style={styles.detailSubtitle} numberOfLines={1}>
                  {selectedPark.designation || selectedPark.category || 'Park'}
                </Text>
              </View>
              <TouchableOpacity onPress={clearSelection} style={styles.detailClose}>
                <Text style={styles.detailCloseText}>X</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailMeta}>
              <View style={styles.parkTypeBadge}>
                <View style={styles.parkBadgeDot} />
                <Text style={styles.parkBadgeText}>
                  {selectedPark.category === 'national' ? 'National' : selectedPark.category === 'state' ? 'State' : 'Park'}
                </Text>
              </View>
              {selectedPark.stateName && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{selectedPark.stateName}</Text>
                </View>
              )}
              {!selectedPark.stateName && selectedPark.stateCode && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{selectedPark.stateCode}</Text>
                </View>
              )}
            </View>

            <Text style={styles.coordText}>
              {selectedPark.latitude.toFixed(4)}, {selectedPark.longitude.toFixed(4)}
            </Text>

            {associatedCampgrounds.length > 0 && (
              <View style={styles.associatedTrailsSection}>
                <TouchableOpacity
                  onPress={() => setCampgroundsCollapsed(!campgroundsCollapsed)}
                  activeOpacity={0.7}
                  style={styles.collapsibleHeader}
                >
                  <Text style={styles.associatedTrailsTitle}>
                    {associatedCampgrounds.length} Campground{associatedCampgrounds.length !== 1 ? 's' : ''} Nearby
                  </Text>
                  <Text style={styles.collapseArrow}>{campgroundsCollapsed ? '\u25B6' : '\u25BC'}</Text>
                </TouchableOpacity>
                {!campgroundsCollapsed && associatedCampgrounds.map((cg: any) => (
                  <TouchableOpacity
                    key={cg.id}
                    style={styles.associatedTrailRow}
                    onPress={() => selectCampground(cg)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.associatedTrailDot, { backgroundColor: '#FF9800' }]} />
                    <View style={styles.associatedTrailInfo}>
                      <Text style={styles.associatedTrailName} numberOfLines={1}>{cg.name}</Text>
                      <View style={styles.associatedTrailMeta}>
                        {cg.distanceMiles != null && (
                          <Text style={styles.associatedTrailMetaText}>{cg.distanceMiles} mi</Text>
                        )}
                        {cg.totalSites != null && cg.totalSites > 0 && (
                          <Text style={styles.associatedTrailMetaText}>{cg.totalSites} sites</Text>
                        )}
                        {cg.openSeason && (
                          <Text style={styles.associatedTrailMetaText}>{cg.openSeason}</Text>
                        )}
                        {cg.priceMin != null && (
                          <Text style={styles.associatedTrailMetaText}>
                            ${cg.priceMin}{cg.priceMax && cg.priceMax !== cg.priceMin ? `–$${cg.priceMax}` : ''}/night
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {associatedTrails.length > 0 ? (
              <View style={styles.associatedTrailsSection}>
                <TouchableOpacity
                  onPress={() => setTrailsCollapsed(!trailsCollapsed)}
                  activeOpacity={0.7}
                  style={styles.collapsibleHeader}
                >
                  <Text style={styles.associatedTrailsTitle}>
                    {associatedTrails.length} Trail{associatedTrails.length !== 1 ? 's' : ''} in this Park
                  </Text>
                  <Text style={styles.collapseArrow}>{trailsCollapsed ? '\u25B6' : '\u25BC'}</Text>
                </TouchableOpacity>
                {!trailsCollapsed && associatedTrails.map((trail) => (
                  <TouchableOpacity
                    key={trail.id}
                    style={styles.associatedTrailRow}
                    onPress={() => selectTrail(trail)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.associatedTrailDot, { backgroundColor: getDifficultyColor(trail.difficulty) }]} />
                    <View style={styles.associatedTrailInfo}>
                      <Text style={styles.associatedTrailName} numberOfLines={1}>{trail.name}</Text>
                      <View style={styles.associatedTrailMeta}>
                        {trail.difficulty && (
                          <Text style={[styles.associatedTrailMetaText, { color: getDifficultyColor(trail.difficulty) }]}>
                            {getDifficultyLabel(trail.difficulty)}{trail.difficultySource?.startsWith('inferred') ? ' (est.)' : ''}
                          </Text>
                        )}
                        {trail.lengthMiles != null && trail.lengthMiles > 0 && (
                          <Text style={styles.associatedTrailMetaText}>{trail.lengthMiles.toFixed(1)} mi</Text>
                        )}
                        {trail.trailType && (
                          <Text style={styles.associatedTrailMetaText}>{trail.trailType}</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>No trail data available for this park</Text>
            )}

            <View style={styles.detailActions}>
              {onPlanAdventure && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.planAdventureButton]}
                  onPress={() => {
                    onPlanAdventure(
                      selectedPark.name,
                      selectedPark.stateName || selectedPark.stateCode,
                      selectedPark.category,
                    );
                  }}
                >
                  <Text style={styles.actionButtonText}>Plan an Adventure Here</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                onPress={() => {
                  handleOpenGoogleMaps(`https://www.google.com/maps/dir/?api=1&destination=${selectedPark.latitude},${selectedPark.longitude}`);
                }}
              >
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* Selected Campground Detail */}
        {selectedCampground && (
          <ScrollView style={[styles.detailPanel, { borderTopColor: '#FF9800', maxHeight: SCREEN_HEIGHT * 0.45 }]}>
            <View style={styles.detailHeader}>
              <View style={styles.detailInfo}>
                <Text style={styles.detailName} numberOfLines={2}>
                  {selectedCampground.name}
                </Text>
                {selectedCampground.parkName && (
                  <Text style={styles.detailSubtitle} numberOfLines={1}>{selectedCampground.parkName}</Text>
                )}
              </View>
              <TouchableOpacity onPress={clearSelection} style={styles.detailClose}>
                <Text style={styles.detailCloseText}>X</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailMeta}>
              <View style={styles.campBadge}>
                <View style={styles.campBadgeDot} />
                <Text style={styles.campBadgeText}>Campground</Text>
              </View>
              {formatTotalSites(selectedCampground.totalSites) && (
                <View style={styles.lengthBadge}>
                  <Text style={styles.lengthText}>{formatTotalSites(selectedCampground.totalSites)}</Text>
                </View>
              )}
              {formatPetFriendly(selectedCampground.petFriendly) && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{formatPetFriendly(selectedCampground.petFriendly)}</Text>
                </View>
              )}
              {selectedCampground.openSeason && formatOpenSeason(selectedCampground.openSeason) && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{formatOpenSeason(selectedCampground.openSeason)}</Text>
                </View>
              )}
              {formatPrice(selectedCampground.priceMin, selectedCampground.priceMax) && (
                <View style={styles.lengthBadge}>
                  <Text style={styles.lengthText}>
                    {formatPrice(selectedCampground.priceMin, selectedCampground.priceMax)}
                  </Text>
                </View>
              )}
            </View>

            {selectedCampground.siteTypes && selectedCampground.siteTypes.length > 0 && (
              <Text style={styles.descriptionText} numberOfLines={1}>
                {formatSiteTypeSummary(selectedCampground.siteTypes)}
              </Text>
            )}

            {selectedCampground.description && (
              <Text style={styles.descriptionText} numberOfLines={3}>
                {selectedCampground.description}
              </Text>
            )}

            {selectedCampground.amenities && selectedCampground.amenities.length > 0 && (
              <Text style={styles.descriptionText} numberOfLines={2}>
                {formatAmenitySummary(selectedCampground.amenities, 5)}
              </Text>
            )}

            {selectedCampground.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedCampground.phone}`).catch(() => {})}>
                <Text style={[styles.coordText, { color: '#64B5F6' }]}>
                  {formatPhone(selectedCampground.phone!)}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.coordText}>
              {selectedCampground.latitude.toFixed(4)}, {selectedCampground.longitude.toFixed(4)}
            </Text>

            {associatedTrails.length > 0 ? (
              <View style={styles.associatedTrailsSection}>
                <TouchableOpacity
                  onPress={() => setTrailsCollapsed(!trailsCollapsed)}
                  activeOpacity={0.7}
                  style={styles.collapsibleHeader}
                >
                  <Text style={styles.associatedTrailsTitle}>
                    {associatedTrails.length} Nearby Trail{associatedTrails.length !== 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.collapseArrow}>{trailsCollapsed ? '\u25B6' : '\u25BC'}</Text>
                </TouchableOpacity>
                {!trailsCollapsed && associatedTrails.map((trail) => (
                  <TouchableOpacity
                    key={trail.id}
                    style={styles.associatedTrailRow}
                    onPress={() => selectTrail(trail)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.associatedTrailDot, { backgroundColor: getDifficultyColor(trail.difficulty) }]} />
                    <View style={styles.associatedTrailInfo}>
                      <Text style={styles.associatedTrailName} numberOfLines={1}>{trail.name}</Text>
                      <View style={styles.associatedTrailMeta}>
                        {trail.difficulty && (
                          <Text style={[styles.associatedTrailMetaText, { color: getDifficultyColor(trail.difficulty) }]}>
                            {getDifficultyLabel(trail.difficulty)}{trail.difficultySource?.startsWith('inferred') ? ' (est.)' : ''}
                          </Text>
                        )}
                        {trail.lengthMiles != null && trail.lengthMiles > 0 && (
                          <Text style={styles.associatedTrailMetaText}>{trail.lengthMiles.toFixed(1)} mi</Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>No trail data available for this campground</Text>
            )}

            <View style={styles.detailActions}>
              {onPlanAdventure && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.planAdventureButton]}
                  onPress={() => {
                    onPlanAdventure(
                      selectedCampground.name,
                      selectedCampground.parkName,
                      'campground',
                    );
                  }}
                >
                  <Text style={styles.actionButtonText}>Plan an Adventure Here</Text>
                </TouchableOpacity>
              )}
              {selectedCampground.reservationUrl && (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#2E7D32' }]}
                  onPress={() => {
                    Linking.openURL(selectedCampground.reservationUrl!).catch(() => {});
                  }}
                >
                  <Text style={styles.actionButtonText}>Reserve</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
                onPress={() => {
                  const url = selectedCampground.googleMapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${selectedCampground.latitude},${selectedCampground.longitude}`;
                  handleOpenGoogleMaps(url);
                }}
              >
                <Text style={styles.actionButtonText}>Directions</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* Trail count footer */}
        {!loading && !error && trails.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {visibleTrails.length} of {trails.length} trails in view
            </Text>
          </View>
        )}
      </Animated.View>
    </>
  );
};

/**
 * Absolutely positioned tab on the right edge of the screen.
 * Vertically draggable so the user can reposition it to avoid
 * obscuring conversation content.
 */
interface TrailMapTabProps {
  visible: boolean;
  panelOpen: boolean;
  tabDismissed: boolean;
  onTogglePanel: () => void;
  onDismiss: () => void;
}

const TAB_DEFAULT_TOP = SCREEN_HEIGHT * 0.45;
const TAB_MIN_TOP = 80;
const TAB_MAX_TOP = SCREEN_HEIGHT - TAB_HEIGHT - 100;

export const TrailMapTab: React.FC<TrailMapTabProps> = ({ visible, panelOpen, tabDismissed, onTogglePanel, onDismiss }) => {
  const { theme } = useParkTheme();
  const slideAnim = useRef(new Animated.Value(60)).current;
  const posY = useRef(new Animated.Value(TAB_DEFAULT_TOP)).current;
  const lastY = useRef(TAB_DEFAULT_TOP);
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        isDragging.current = false;
      },
      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dy) > 5) isDragging.current = true;
        const newY = Math.max(TAB_MIN_TOP, Math.min(TAB_MAX_TOP, lastY.current + gs.dy));
        posY.setValue(newY);
      },
      onPanResponderRelease: (_, gs) => {
        const finalY = Math.max(TAB_MIN_TOP, Math.min(TAB_MAX_TOP, lastY.current + gs.dy));
        lastY.current = finalY;
        Animated.spring(posY, {
          toValue: finalY,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
        // If barely moved, treat as a tap
        if (!isDragging.current) {
          onTogglePanel();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 60,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!visible || panelOpen || tabDismissed) return null;

  return (
    <Animated.View
      style={[
        styles.tabContainer,
        {
          transform: [
            { translateX: slideAnim },
            { translateY: posY },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[styles.tab, { backgroundColor: theme.buttonBackground }]}>
        <TouchableOpacity
          style={styles.tabCloseButton}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.tabCloseText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.tabLabelWrap}>
          <Text style={styles.tabLabel} numberOfLines={1}>Adventure Map</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
    elevation: 100,
  },
  tab: {
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  tabCloseButton: {
    position: 'absolute',
    top: 4,
    left: 2,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  tabCloseText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 8,
    fontWeight: '700',
  },
  tabLabelWrap: {
    width: TAB_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '90deg' }],
  },
  tabLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  panelContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: 'rgba(15, 20, 15, 0.97)',
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  parkNameText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  filterSection: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  filterItemInactive: {
    opacity: 0.4,
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCheckmark: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  filterLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontWeight: '500',
  },
  filterLabelInactive: {
    color: 'rgba(255, 255, 255, 0.3)',
  },
  clearFocusButton: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  clearFocusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  legend: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    flex: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
  },
  legendBadge: {
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendBadgeNational: {
    backgroundColor: '#4A2C0A',
  },
  legendBadgeState: {
    backgroundColor: '#33691E',
  },
  legendBadgeText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
  },
  legendTent: {
    alignItems: 'center' as const,
    width: 10,
    height: 10,
  },
  legendTentTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E65100',
  },
  legendTentBase: {
    width: 10,
    height: 3,
    backgroundColor: '#BF360C',
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  trailLinesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  trailLinesLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
  },
  trailLinesHint: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 9,
    fontStyle: 'italic',
    marginLeft: 8,
  },
  mapContainer: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 20,
  },
  errorText: {
    color: 'rgba(255, 100, 100, 0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  npsBadge: {
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 6,
  },
  npsBadgeNational: {
    backgroundColor: '#4A2C0A',
  },
  npsBadgeState: {
    backgroundColor: '#33691E',
  },
  npsBadgeSelected: {
    transform: [{ scale: 1.4 }],
    borderWidth: 2,
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  npsBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  otherSiteMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 12,
    height: 12,
  },
  otherSiteDiamond: {
    width: 8,
    height: 8,
    backgroundColor: '#78909C',
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  tentMarker: {
    alignItems: 'center',
    width: 12,
    height: 11,
  },
  tentTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E65100',
  },
  tentBase: {
    width: 12,
    height: 3,
    backgroundColor: '#BF360C',
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
  },
  trailPin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  trailPinSelected: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  selectedMarkerGlow: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  legendPin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  detailPanel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  associatedTrailsSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  associatedTrailsTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  collapseArrow: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    marginLeft: 6,
  },
  associatedTrailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  associatedTrailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    marginRight: 8,
  },
  associatedTrailInfo: {
    flex: 1,
  },
  associatedTrailName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  associatedTrailMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  associatedTrailMetaText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 11,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailInfo: {
    flex: 1,
    marginRight: 8,
  },
  detailName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  detailSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  detailClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCloseText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    fontWeight: '600',
  },
  detailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  detailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  descriptionText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  coordText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  noDataText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  
  parkTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  parkBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
  },
  parkBadgeText: {
    color: '#64B5F6',
    fontSize: 12,
    fontWeight: '600',
  },
  campBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  campBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF9800',
  },
  campBadgeText: {
    color: '#FFB74D',
    fontSize: 12,
    fontWeight: '600',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lengthBadge: {
    backgroundColor: 'rgba(33, 150, 243, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lengthText: {
    color: '#64B5F6',
    fontSize: 12,
    fontWeight: '600',
  },
  typeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  planAdventureButton: {
    backgroundColor: '#1565C0',
    flex: 0,
    width: '100%',
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  actionButtonSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 11,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  mapLoadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
  },
  mapUpdatingOverlay: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 10,
    elevation: 10,
    gap: 6,
  },
  mapUpdatingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
});
