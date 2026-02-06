import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import MapView, { Marker, Polyline, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useParkTheme } from '../../hooks/useParkTheme';
import { TrailMapMarker, ParkMapMarker, CampgroundMapMarker } from '../../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.88;
const TAB_WIDTH = 28;
const TAB_HEIGHT = 110;

// 0.5 mile radius in degrees (approximate)
const HALF_MILE_LAT_DELTA = 0.015;  // ~0.5mi north-south
const HALF_MILE_LNG_DELTA = 0.018;  // ~0.5mi east-west (varies by latitude)

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
];

// Normalized display labels
const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Easy', easiest: 'Easy', beginner: 'Easy',
  moderate: 'Moderate', intermediate: 'Moderate',
  hard: 'Hard', difficult: 'Hard', advanced: 'Hard',
  expert: 'Expert', strenuous: 'Expert', very_strenuous: 'Expert',
};

function getDifficultyColor(difficulty?: string): string {
  if (!difficulty) return '#2196F3';
  const key = difficulty.toLowerCase().trim();
  return DIFFICULTY_COLORS[key] || '#2196F3';
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
  onFetchGeometry?: () => void;
  onPlanAdventure?: (parkName: string, parkState?: string, parkCategory?: string) => void;
}

export const TrailMapPanel: React.FC<TrailMapPanelProps> = ({
  visible,
  panelOpen,
  trails = [],
  parks = [],
  campgrounds = [],
  loading,
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
  onFetchGeometry,
  onPlanAdventure,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useParkTheme();
  const slideAnim = useRef(new Animated.Value(PANEL_WIDTH)).current;
  const mapRef = useRef<MapView>(null);
  const [selectedTrail, setSelectedTrail] = useState<TrailMapMarker | null>(null);
  const [selectedPark, setSelectedPark] = useState<ParkMapMarker | null>(null);
  const [selectedCampground, setSelectedCampground] = useState<CampgroundMapMarker | null>(null);
  const [showTrailLines, setShowTrailLines] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [androidMarkersReady, setAndroidMarkersReady] = useState(Platform.OS !== 'android');

  const MAX_TRAILS_FOR_LINES = 15;

  // Compute trails visible in the current map region
  // Wait for mapRegion to be set before rendering any trail markers - prevents
  // Android from choking on thousands of markers before viewport filtering kicks in
  const MAX_VISIBLE_TRAIL_MARKERS = 300;
  const visibleTrails = useMemo(() => {
    if (!mapRegion) return [];
    const { latitude, longitude, latitudeDelta, longitudeDelta } = mapRegion;
    const north = latitude + latitudeDelta / 2;
    const south = latitude - latitudeDelta / 2;
    const east = longitude + longitudeDelta / 2;
    const west = longitude - longitudeDelta / 2;
    const filtered = trails.filter(t =>
      t.latitude >= south && t.latitude <= north &&
      t.longitude >= west && t.longitude <= east
    );
    return filtered.length > MAX_VISIBLE_TRAIL_MARKERS
      ? filtered.slice(0, MAX_VISIBLE_TRAIL_MARKERS)
      : filtered;
  }, [trails, mapRegion]);

  const hasTrailsLoaded = trails.length > 0 && !loading;
  const canRenderTrailLines = visibleTrails.length <= MAX_TRAILS_FOR_LINES;

  // Auto-disable trail lines when too many trails become visible (performance guard)
  useEffect(() => {
    if (showTrailLines && !canRenderTrailLines) {
      setShowTrailLines(false);
    }
  }, [canRenderTrailLines, showTrailLines]);

  // On Android, allow markers to render as bitmaps first, then disable tracking for touch events
  useEffect(() => {
    if (Platform.OS === 'android' && !androidMarkersReady && (trails.length > 0 || parks.length > 0 || campgrounds.length > 0)) {
      const timer = setTimeout(() => setAndroidMarkersReady(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [trails.length, parks.length, campgrounds.length, androidMarkersReady]);

  const handleRegionChange = useCallback((region: Region) => {
    setMapRegion(region);
  }, []);

  const selectTrail = useCallback((trail: TrailMapMarker) => {
    setSelectedTrail(trail);
    setSelectedPark(null);
    setSelectedCampground(null);
  }, []);

  const selectPark = useCallback((park: ParkMapMarker) => {
    setSelectedPark(park);
    setSelectedTrail(null);
    setSelectedCampground(null);
  }, []);

  const selectCampground = useCallback((cg: CampgroundMapMarker) => {
    setSelectedCampground(cg);
    setSelectedTrail(null);
    setSelectedPark(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTrail(null);
    setSelectedPark(null);
    setSelectedCampground(null);
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

    // Fetch trails when panel first opens
    if (panelOpen && !hasFetchedRef.current && trails.length === 0) {
      hasFetchedRef.current = true;
      onFetchTrails();
    }
  }, [panelOpen, slideAnim, onFetchTrails, trails.length]);

  // Reset fetch flag when stateCode changes
  useEffect(() => {
    hasFetchedRef.current = false;
  }, [stateCode]);

  // Fit map: national park coords first, then user location (state parks), then trail markers
  useEffect(() => {
    if (!panelOpen || !mapRef.current) return;

    // 1) National park mode: center on the park's coordinates
    if (parkLatitude && parkLongitude) {
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: parkLatitude,
          longitude: parkLongitude,
          latitudeDelta: 1.5,
          longitudeDelta: 1.5,
        }, 300);
      }, 300);
    } else if (userLatitude && userLongitude) {
      // 2) State park mode / no park coords: use user location
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: userLatitude,
          longitude: userLongitude,
          latitudeDelta: HALF_MILE_LAT_DELTA,
          longitudeDelta: HALF_MILE_LNG_DELTA,
        }, 300);
      }, 300);
    } else if (trails.length > 0) {
      // 3) No location at all: fit all trail markers
      const coordinates = trails.map(t => ({
        latitude: t.latitude,
        longitude: t.longitude,
      }));
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coordinates, {
          edgePadding: { top: 60, right: 40, bottom: 60, left: 40 },
          animated: true,
        });
      }, 300);
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
    latitudeDelta: parkLatitude ? 1.5 : (userLatitude ? HALF_MILE_LAT_DELTA : 20),
    longitudeDelta: parkLongitude ? 1.5 : (userLongitude ? HALF_MILE_LNG_DELTA : 20),
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

        {/* Legend + Show Trail Lines toggle */}
        <View style={styles.legendRow}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.parkDot]} />
              <Text style={styles.legendText}>Park</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={styles.legendTent}>
                <View style={styles.legendTentTop} />
                <View style={styles.legendTentBase} />
              </View>
              <Text style={styles.legendText}>Camp</Text>
            </View>
            {DIFFICULTY_LEGEND.map(({ label, color }) => (
              <View key={label} style={styles.legendItem}>
                <View style={[styles.legendPin, { backgroundColor: color }]} />
                <Text style={styles.legendText}>{label}</Text>
              </View>
            ))}
          </View>
          {hasTrailsLoaded && (
            <TouchableOpacity
              style={styles.trailLinesToggle}
              onPress={() => {
                setShowTrailLines(prev => {
                  if (!prev && onFetchGeometry) onFetchGeometry();
                  return !prev;
                });
              }}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                showTrailLines && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}>
                {showTrailLines && <Text style={styles.checkmark}>{'✓'}</Text>}
              </View>
              <Text style={styles.trailLinesLabel}>Trail Lines</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Map */}
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
              onRegionChangeComplete={handleRegionChange}
            >
              {/* Park markers - bigger blue dots */}
              {parks.map((park) => (
                <Marker
                  key={`park-${park.id}`}
                  coordinate={{
                    latitude: park.latitude,
                    longitude: park.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={!androidMarkersReady}
                  onPress={() => selectPark(park)}
                >
                  <View style={styles.parkMarker} collapsable={false}>
                    <View style={styles.parkMarkerInner} />
                  </View>
                </Marker>
              ))}

              {/* Campground markers - tent badge */}
              {campgrounds.map((cg) => (
                <Marker
                  key={`cg-${cg.id}`}
                  coordinate={{
                    latitude: cg.latitude,
                    longitude: cg.longitude,
                  }}
                  anchor={{ x: 0.5, y: 1.0 }}
                  tracksViewChanges={!androidMarkersReady}
                  onPress={() => selectCampground(cg)}
                >
                  <View style={styles.tentMarker} collapsable={false}>
                    <View style={styles.tentTop} />
                    <View style={styles.tentBase} />
                  </View>
                </Marker>
              ))}

              {/* Trail trailhead markers - colored dots with difficulty colors */}
              {visibleTrails.map((trail, index) => (
                <Marker
                  key={`trail-${trail.id}-${index}`}
                  coordinate={{
                    latitude: trail.latitude,
                    longitude: trail.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={Platform.OS === 'android'}
                  onPress={() => selectTrail(trail)}
                >
                  <View style={[styles.trailPin, { backgroundColor: getDifficultyColor(trail.difficulty) }]} collapsable={false} />
                </Marker>
              ))}

              {/* Trail polylines - only for visible trails when toggled on */}
              {/* White border lines (iOS only - Android skips for performance) */}
              {showTrailLines && canRenderTrailLines && Platform.OS !== 'android' && visibleTrails.map((trail) => {
                if (!trail.geometry || trail.geometry.length < 2) return null;
                return (
                  <Polyline
                    key={`border-${trail.id}`}
                    coordinates={trail.geometry}
                    strokeColor="#FFFFFF"
                    strokeWidth={5}
                    tappable={true}
                    onPress={() => selectTrail(trail)}
                  />
                );
              })}
              {/* Red trail lines */}
              {showTrailLines && canRenderTrailLines && visibleTrails.map((trail) => {
                if (!trail.geometry || trail.geometry.length < 2) return null;
                return (
                  <Polyline
                    key={`line-${trail.id}`}
                    coordinates={trail.geometry}
                    strokeColor="#E53935"
                    strokeWidth={Platform.OS === 'android' ? 4 : 3}
                    tappable={true}
                    onPress={() => selectTrail(trail)}
                  />
                );
              })}
            </MapView>
          )}

          {/* Loading overlay - shown while map data is being fetched */}
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
                    {getDifficultyLabel(selectedTrail.difficulty)}
                  </Text>
                </View>
              )}
              {selectedTrail.lengthMiles != null && selectedTrail.lengthMiles > 0 && (
                <View style={styles.lengthBadge}>
                  <Text style={styles.lengthText}>
                    {selectedTrail.lengthMiles.toFixed(1)} mi
                  </Text>
                </View>
              )}
              {selectedTrail.trailType && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{selectedTrail.trailType}</Text>
                </View>
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
          <View style={[styles.detailPanel, { borderTopColor: '#2196F3' }]}>
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
          </View>
        )}

        {/* Selected Campground Detail */}
        {selectedCampground && (
          <View style={[styles.detailPanel, { borderTopColor: '#FF9800' }]}>
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
              {selectedCampground.totalSites != null && selectedCampground.totalSites > 0 && (
                <View style={styles.lengthBadge}>
                  <Text style={styles.lengthText}>{selectedCampground.totalSites} sites</Text>
                </View>
              )}
            </View>

            {selectedCampground.description && (
              <Text style={styles.descriptionText} numberOfLines={3}>
                {selectedCampground.description}
              </Text>
            )}

            <Text style={styles.coordText}>
              {selectedCampground.latitude.toFixed(4)}, {selectedCampground.longitude.toFixed(4)}
            </Text>

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
          </View>
        )}

        {/* Trail count footer */}
        {!loading && !error && trails.length > 0 && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {trails.length} trail{trails.length !== 1 ? 's' : ''} with trailhead coordinates
            </Text>
          </View>
        )}
      </Animated.View>
    </>
  );
};

/**
 * Separate tab component that lives in normal layout flow (above ChatInput)
 * so it moves with the input when gallery is dragged.
 */
interface TrailMapTabProps {
  visible: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export const TrailMapTab: React.FC<TrailMapTabProps> = ({ visible, panelOpen, onTogglePanel }) => {
  const { theme } = useParkTheme();
  const tabAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(tabAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(tabAnim, {
        toValue: 60,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, tabAnim]);

  if (!visible || panelOpen) return null;

  return (
    <Animated.View
      style={[
        styles.tabContainer,
        { transform: [{ translateX: tabAnim }] },
      ]}
    >
      <TouchableOpacity
        style={[styles.tab, { backgroundColor: theme.buttonBackground }]}
        onPress={onTogglePanel}
        activeOpacity={0.7}
      >
        <View style={styles.tabLabelWrap}>
          <Text style={styles.tabLabel} numberOfLines={1}>Adventure Map</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  tabContainer: {
    alignSelf: 'flex-end',
    zIndex: 100,
  },
  tab: {
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
  parkDot: {
    backgroundColor: '#2196F3',
    width: 10,
    height: 10,
    borderRadius: 5,
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
  parkMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(33, 150, 243, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  tentMarker: {
    alignItems: 'center',
    width: 20,
    height: 18,
  },
  tentTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#E65100',
  },
  tentBase: {
    width: 20,
    height: 5,
    backgroundColor: '#BF360C',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  trailPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
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
  },
  mapLoadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
  },
});
