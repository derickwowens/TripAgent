import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  SafeAreaView,
  Image,
  ImageBackground,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocation, MaxTravelDistance } from '../../hooks';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Responsive sizing for tablets
const IS_TABLET = SCREEN_WIDTH >= 768;
const CONTENT_MAX_WIDTH = IS_TABLET ? 500 : SCREEN_WIDTH;
const CONTENT_PADDING = IS_TABLET ? Math.max(24, (SCREEN_WIDTH - CONTENT_MAX_WIDTH) / 2) : 24;

// Background image dimensions for panning effect - extra wide for dramatic panning
const BG_WIDTH = SCREEN_WIDTH * 2.5;
const BG_HEIGHT = SCREEN_HEIGHT * 1.2;

// Distance slider presets (in miles)
const DISTANCE_PRESETS = [
  50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
  600, 700, 800, 900, 1000,
  1500, 2000, 2500, 3000, 4000, 5000,
];

const sliderValueToDistance = (value: number): MaxTravelDistance => {
  if (value >= DISTANCE_PRESETS.length) return null;
  return DISTANCE_PRESETS[Math.round(value)];
};

const distanceToSliderValue = (distance: MaxTravelDistance): number => {
  if (distance === null) return DISTANCE_PRESETS.length;
  const index = DISTANCE_PRESETS.indexOf(distance);
  return index >= 0 ? index : DISTANCE_PRESETS.length;
};

const getDistanceDisplayText = (distance: MaxTravelDistance): string => {
  if (distance === null) return 'Unlimited';
  if (distance >= 1000) return `${(distance / 1000).toFixed(distance % 1000 === 0 ? 0 : 1)}k miles`;
  return `${distance} miles`;
};

// Profile badge options for onboarding
const TRAVEL_STYLES = [
  { id: 'frugal', label: 'Frugal traveler' },
  { id: 'luxury', label: 'Luxury travel' },
  { id: 'backpacker', label: 'Backpacker' },
  { id: 'camping', label: 'Love camping' },
  { id: 'hotels', label: 'Hotels only' },
  { id: 'airbnb', label: 'Airbnb/VRBO' },
  { id: 'avoid-crowds', label: 'Avoid crowds' },
];

const INTERESTS = [
  { id: 'hiking', label: 'Hiking/outdoors' },
  { id: 'photography', label: 'Photography' },
  { id: 'wildlife', label: 'Wildlife viewing' },
  { id: 'foodie', label: 'Foodie' },
  { id: 'water', label: 'Water sports' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'fishing', label: 'Fishing' },
  { id: 'skiing', label: 'Skiing/snowboard' },
  { id: 'sunrise', label: 'Sunrise/sunset' },
  { id: 'coffee', label: 'Coffee hound' },
  { id: 'bookworm', label: 'Book worm' },
  { id: 'historian', label: 'Historian' },
];

const TRAVEL_WITH = [
  { id: 'solo', label: 'Solo' },
  { id: 'partner', label: 'Partner' },
  { id: 'family', label: 'Family' },
  { id: 'friends', label: 'Friends' },
  { id: 'dog', label: 'Traveling with dog' },
];

// Family sub-options
const FAMILY_OPTIONS = [
  { id: 'toddlers', label: 'Kids 1-3 yrs' },
  { id: 'young-kids', label: 'Kids 4-7 yrs' },
  { id: 'older-kids', label: 'Kids 8-12 yrs' },
  { id: 'teens', label: 'Kids 13+' },
  { id: 'seniors', label: 'With seniors' },
  { id: 'accessibility', label: 'Accessible needs' },
  { id: 'limited-mobility', label: 'Limited mobility' },
  { id: 'educational', label: 'Educational trips' },
];

// Climate preferences
const CLIMATE_PREFS = [
  { id: 'warm', label: 'Warm destinations' },
  { id: 'cold', label: 'Cold destinations' },
];

// Vehicle type
const VEHICLE_TYPES = [
  { id: 'gas', label: 'Gas vehicle' },
  { id: 'tesla', label: 'Tesla' },
  { id: 'other-ev', label: 'Other EV' },
];

// Preferred airlines
const AIRLINES = [
  { id: 'delta', label: 'Delta' },
  { id: 'southwest', label: 'Southwest' },
  { id: 'united', label: 'United' },
  { id: 'american', label: 'American' },
  { id: 'jetblue', label: 'JetBlue' },
  { id: 'alaska', label: 'Alaska' },
];

// Preferred car rentals
const CAR_RENTALS = [
  { id: 'hertz', label: 'Hertz' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'national', label: 'National' },
  { id: 'budget', label: 'Budget' },
];

// Preferred hotels
const HOTELS = [
  { id: 'marriott', label: 'Marriott' },
  { id: 'hilton', label: 'Hilton' },
  { id: 'ihg', label: 'IHG' },
  { id: 'hyatt', label: 'Hyatt' },
];

// Official US National Parks from NPS API
const NATIONAL_PARKS = [
  'Acadia', 'Arches', 'Badlands', 'Big Bend', 'Biscayne',
  'Black Canyon Of The Gunnison', 'Bryce Canyon', 'Canyonlands', 'Capitol Reef', 'Carlsbad Caverns',
  'Channel Islands', 'Congaree', 'Crater Lake', 'Cuyahoga Valley', 'Death Valley',
  'Dry Tortugas', 'Everglades', 'Gateway Arch', 'Glacier', 'Grand Canyon',
  'Grand Teton', 'Great Basin', 'Great Smoky Mountains', 'Guadalupe Mountains', 'Haleakalā',
  'Hawaiʻi Volcanoes', 'Hot Springs', 'Indiana Dunes', 'Isle Royale', 'Joshua Tree',
  'Kenai Fjords', 'Kobuk Valley', 'Lassen Volcanic', 'Mammoth Cave', 'Mesa Verde',
  'Mount Rainier', 'North Cascades', 'Olympic', 'Petrified Forest', 'Pinnacles',
  'Rocky Mountain', 'Saguaro', 'Shenandoah', 'Theodore Roosevelt', 'Virgin Islands',
  'Voyageurs', 'White Sands', 'Wind Cave', 'Yellowstone', 'Yosemite', 'Zion',
];

const getRandomPark = () => NATIONAL_PARKS[Math.floor(Math.random() * NATIONAL_PARKS.length)];

const QUICK_TRIP_IDEAS = [
  { id: 'national-park', label: 'Plan a national park trip', getPrompt: () => `Help me plan a trip to ${getRandomPark()} National Park` },
  { id: 'weekend', label: 'Weekend getaway', getPrompt: () => 'Help me plan a weekend getaway somewhere nearby' },
  { id: 'road-trip', label: 'Road trip adventure', getPrompt: () => 'Help me plan a road trip adventure' },
  { id: 'beach', label: 'Beach vacation', getPrompt: () => 'Help me find a great beach destination' },
  { id: 'custom', label: 'I have something specific in mind', getPrompt: () => '' },
];

interface OnboardingFlowProps {
  onComplete: (profile: string, firstPrompt?: string, maxTravelDistance?: MaxTravelDistance) => void;
  onSkip: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState(0);
  const stepRef = useRef(step);
  
  // Keep stepRef in sync with step state
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  
  // Animated value for horizontal background panning
  const panX = useRef(new Animated.Value(0)).current;
  
  // Pan background horizontally when step changes
  useEffect(() => {
    // Each step moves the background to the left - dramatic pan
    const xOffset = step * -100;
    
    Animated.spring(panX, {
      toValue: xOffset,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  }, [step]);
  
  // Start location detection immediately when onboarding begins
  const { userLocation, locationLoading } = useLocation();
  const [selectedTravelWith, setSelectedTravelWith] = useState<string[]>([]);
  const [selectedFamilyOptions, setSelectedFamilyOptions] = useState<string[]>([]);
  const [selectedClimate, setSelectedClimate] = useState<string[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string[]>([]);
  const [selectedAirline, setSelectedAirline] = useState<string[]>([]);
  const [selectedCarRental, setSelectedCarRental] = useState<string[]>([]);
  const [selectedHotel, setSelectedHotel] = useState<string[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [maxTravelDistance, setMaxTravelDistance] = useState<MaxTravelDistance>(null); // null = unlimited

  const toggleSelection = (
    id: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  // Single-select toggle for mutually exclusive groups (climate, vehicle, airline, car rental, hotel)
  const toggleExclusiveSelection = (
    id: string,
    selected: string[],
    setSelected: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (selected.includes(id)) {
      // Deselect if already selected
      setSelected([]);
    } else {
      // Replace with new selection (only one allowed)
      setSelected([id]);
    }
  };

  const buildProfile = (): string => {
    const parts: string[] = [];
    
    // Add travel styles
    TRAVEL_STYLES.forEach(style => {
      if (selectedStyles.includes(style.id)) {
        parts.push(style.label);
      }
    });
    
    // Add climate preferences
    CLIMATE_PREFS.forEach(climate => {
      if (selectedClimate.includes(climate.id)) {
        parts.push(climate.label);
      }
    });
    
    // Add interests
    INTERESTS.forEach(interest => {
      if (selectedInterests.includes(interest.id)) {
        parts.push(interest.label);
      }
    });
    
    // Add travel companions
    TRAVEL_WITH.forEach(tw => {
      if (selectedTravelWith.includes(tw.id)) {
        parts.push(tw.label);
      }
    });
    
    // Add family options
    FAMILY_OPTIONS.forEach(fo => {
      if (selectedFamilyOptions.includes(fo.id)) {
        parts.push(fo.label);
      }
    });
    
    // NOTE: Booking-specific preferences (vehicle, airline, car rental, hotel) are NOT included
    // in the profile string. They are stored separately in 'defaults' for programmatic access
    // when actually performing booking searches. This prevents them from cluttering location queries.
    
    return parts.join(', ');
  };

  const getFirstPrompt = (): string | undefined => {
    // If user typed a custom prompt, use that
    if (selectedTrip === 'custom' && customPrompt.trim()) {
      return customPrompt.trim();
    }
    
    // Build a comprehensive prompt from all selected preferences
    const promptParts: string[] = [];
    
    // Get trip type prompt
    const trip = QUICK_TRIP_IDEAS.find(t => t.id === selectedTrip);
    if (trip && trip.id !== 'custom') {
      promptParts.push(trip.getPrompt());
    }
    
    // Add context from selected preferences
    const contextParts: string[] = [];
    
    // Travel style context
    if (selectedStyles.length > 0) {
      const styles = TRAVEL_STYLES.filter(s => selectedStyles.includes(s.id)).map(s => s.label.toLowerCase());
      if (styles.length > 0) {
        contextParts.push(`I'm a ${styles.join(', ')} type of traveler`);
      }
    }
    
    // Interests context
    if (selectedInterests.length > 0) {
      const interests = INTERESTS.filter(i => selectedInterests.includes(i.id)).map(i => i.label.toLowerCase());
      if (interests.length > 0) {
        contextParts.push(`interested in ${interests.join(', ')}`);
      }
    }
    
    // Travel companions context
    if (selectedTravelWith.length > 0) {
      const companions = TRAVEL_WITH.filter(t => selectedTravelWith.includes(t.id)).map(t => t.label.toLowerCase());
      if (companions.length > 0) {
        contextParts.push(`traveling ${companions.join(' and ')}`);
      }
    }
    
    // Family details context
    if (selectedFamilyOptions.length > 0) {
      const familyDetails = FAMILY_OPTIONS.filter(f => selectedFamilyOptions.includes(f.id)).map(f => f.label.toLowerCase());
      if (familyDetails.length > 0) {
        contextParts.push(`with ${familyDetails.join(', ')}`);
      }
    }
    
    // Combine into a natural prompt
    if (promptParts.length > 0 && contextParts.length > 0) {
      return `${promptParts[0]}. ${contextParts.join(', ')}.`;
    } else if (promptParts.length > 0) {
      return promptParts[0];
    } else if (contextParts.length > 0) {
      return `Help me plan a trip. ${contextParts.join(', ')}.`;
    }
    
    return undefined;
  };

  const handleNext = () => {
    if (step === 0) {
      // From intro, "Setup Traveler Profile" goes to step 1
      setStep(1);
    } else if (step === 1) {
      // From profile setup, go to step 2
      setStep(2);
    } else if (step === 2) {
      // From companions/preferences, go to step 3
      setStep(3);
    } else {
      // Step 3 - complete onboarding
      onComplete(buildProfile(), getFirstPrompt(), maxTravelDistance);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      // From profile setup, go back to intro
      setStep(0);
    } else if (step === 2) {
      // From companions, go back to profile setup
      setStep(1);
    } else if (step === 3) {
      // From trip ideas, go back to companions
      setStep(2);
    }
  };

  const canProceed = () => {
    // All steps are now optional - user can freely navigate
    return true;
  };

  // Swipe gesture handler - use stepRef.current to get current step value
  const swipeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const SWIPE_THRESHOLD = 50;
        const currentStep = stepRef.current;
        
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left - go to next step (wraps from 3 to 0)
          if (currentStep === 3) {
            setStep(0);
          } else {
            setStep(currentStep + 1);
          }
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right - go to previous step (wraps from 0 to 3)
          if (currentStep === 0) {
            setStep(3);
          } else {
            setStep(currentStep - 1);
          }
        }
      },
    })
  ).current;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../../assets/icon.png')} 
                style={styles.logo} 
              />
            </View>
            <Text style={styles.welcomeTitle}>TripAgent</Text>
            <Text style={styles.welcomeSubtitle}>
              AI-powered travel planning
            </Text>
            <View style={styles.featureList}>
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>• National parks & destinations</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>• Flights, hotels & restaurants</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>• Hikes, campgrounds & events</Text>
              </View>
              <View style={styles.featureRow}>
                <Text style={styles.featureText}>• Complete itineraries in minutes</Text>
              </View>
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>how do you like to travel?</Text>
            <Text style={styles.stepSubtitle}>select all that apply</Text>
            
            <Text style={styles.sectionLabel}>travel style</Text>
            <View style={styles.optionsGrid}>
              {TRAVEL_STYLES.map(style => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    styles.optionChip,
                    selectedStyles.includes(style.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleSelection(style.id, selectedStyles, setSelectedStyles)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedStyles.includes(style.id) && styles.optionLabelSelected
                  ]}>{style.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>climate preference</Text>
            <View style={styles.optionsGrid}>
              {CLIMATE_PREFS.map(climate => (
                <TouchableOpacity
                  key={climate.id}
                  style={[
                    styles.optionChip,
                    selectedClimate.includes(climate.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleExclusiveSelection(climate.id, selectedClimate, setSelectedClimate)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedClimate.includes(climate.id) && styles.optionLabelSelected
                  ]}>{climate.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>interests</Text>
            <View style={styles.optionsGrid}>
              {INTERESTS.map(interest => (
                <TouchableOpacity
                  key={interest.id}
                  style={[
                    styles.optionChip,
                    selectedInterests.includes(interest.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleSelection(interest.id, selectedInterests, setSelectedInterests)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedInterests.includes(interest.id) && styles.optionLabelSelected
                  ]}>{interest.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>max travel distance</Text>
            <View style={styles.distanceContainer}>
              <View style={styles.distanceHeader}>
                <Text style={styles.distanceLabelText}>How far are you willing to travel?</Text>
                <Text style={styles.distanceValue}>{getDistanceDisplayText(maxTravelDistance)}</Text>
              </View>
              <Slider
                style={styles.distanceSlider}
                minimumValue={0}
                maximumValue={DISTANCE_PRESETS.length}
                step={1}
                value={distanceToSliderValue(maxTravelDistance)}
                onValueChange={(value) => setMaxTravelDistance(sliderValueToDistance(value))}
                minimumTrackTintColor="#22C55E"
                maximumTrackTintColor="rgba(255,255,255,0.2)"
                thumbTintColor="#22C55E"
              />
              <View style={styles.distanceLabelsRow}>
                <Text style={styles.distanceLabelSmall}>50 mi</Text>
                <Text style={styles.distanceLabelSmall}>Unlimited</Text>
              </View>
            </View>
          </View>
        );

      case 2:
        const showFamilyOptions = selectedTravelWith.includes('family');
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>how do you like to travel?</Text>
            <Text style={styles.stepSubtitle}>select all that apply</Text>
            
            <Text style={styles.sectionLabel}>who are you traveling with?</Text>
            
            <View style={styles.optionsGrid}>
              {TRAVEL_WITH.map(tw => (
                <TouchableOpacity
                  key={tw.id}
                  style={[
                    styles.optionChip,
                    selectedTravelWith.includes(tw.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleSelection(tw.id, selectedTravelWith, setSelectedTravelWith)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedTravelWith.includes(tw.id) && styles.optionLabelSelected
                  ]}>{tw.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showFamilyOptions && (
              <>
                <Text style={styles.sectionLabel}>family details</Text>
                <View style={styles.optionsGrid}>
                  {FAMILY_OPTIONS.map(fo => (
                    <TouchableOpacity
                      key={fo.id}
                      style={[
                        styles.optionChipSmall,
                        selectedFamilyOptions.includes(fo.id) && styles.optionChipSelected
                      ]}
                      onPress={() => toggleSelection(fo.id, selectedFamilyOptions, setSelectedFamilyOptions)}
                    >
                      <Text style={[
                        styles.optionLabelSmall,
                        selectedFamilyOptions.includes(fo.id) && styles.optionLabelSelected
                      ]}>{fo.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionLabel}>vehicle type</Text>
            <View style={styles.optionsGrid}>
              {VEHICLE_TYPES.map(vehicle => (
                <TouchableOpacity
                  key={vehicle.id}
                  style={[
                    styles.optionChip,
                    selectedVehicle.includes(vehicle.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleExclusiveSelection(vehicle.id, selectedVehicle, setSelectedVehicle)}
                >
                  <Text style={[
                    styles.optionLabel,
                    selectedVehicle.includes(vehicle.id) && styles.optionLabelSelected
                  ]}>{vehicle.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>preferred airline</Text>
            <View style={styles.optionsGrid}>
              {AIRLINES.map(airline => (
                <TouchableOpacity
                  key={airline.id}
                  style={[
                    styles.optionChipSmall,
                    selectedAirline.includes(airline.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleExclusiveSelection(airline.id, selectedAirline, setSelectedAirline)}
                >
                  <Text style={[
                    styles.optionLabelSmall,
                    selectedAirline.includes(airline.id) && styles.optionLabelSelected
                  ]}>{airline.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>preferred car rental</Text>
            <View style={styles.optionsGrid}>
              {CAR_RENTALS.map(rental => (
                <TouchableOpacity
                  key={rental.id}
                  style={[
                    styles.optionChipSmall,
                    selectedCarRental.includes(rental.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleExclusiveSelection(rental.id, selectedCarRental, setSelectedCarRental)}
                >
                  <Text style={[
                    styles.optionLabelSmall,
                    selectedCarRental.includes(rental.id) && styles.optionLabelSelected
                  ]}>{rental.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>preferred hotel brand</Text>
            <View style={styles.optionsGrid}>
              {HOTELS.map(hotel => (
                <TouchableOpacity
                  key={hotel.id}
                  style={[
                    styles.optionChipSmall,
                    selectedHotel.includes(hotel.id) && styles.optionChipSelected
                  ]}
                  onPress={() => toggleExclusiveSelection(hotel.id, selectedHotel, setSelectedHotel)}
                >
                  <Text style={[
                    styles.optionLabelSmall,
                    selectedHotel.includes(hotel.id) && styles.optionLabelSelected
                  ]}>{hotel.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>ready to plan your first trip?</Text>
            <Text style={styles.stepSubtitle}>choose a starting point</Text>
            
            <View style={styles.tripOptions}>
              {QUICK_TRIP_IDEAS.map(trip => (
                <TouchableOpacity
                  key={trip.id}
                  style={[
                    styles.tripOption,
                    selectedTrip === trip.id && styles.tripOptionSelected
                  ]}
                  onPress={() => setSelectedTrip(trip.id)}
                >
                  <Text style={[
                    styles.tripOptionText,
                    selectedTrip === trip.id && styles.tripOptionTextSelected
                  ]}>{trip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedTrip === 'custom' && (
              <TextInput
                style={styles.customInput}
                placeholder="What kind of trip are you dreaming of?"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={customPrompt}
                onChangeText={setCustomPrompt}
                multiline
              />
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.background}>
      <Animated.Image
        source={require('../../../assets/backgrounds/bg-10-canyon.jpg')}
        style={[
          styles.backgroundImage,
          {
            transform: [
              { translateX: panX },
            ],
          },
        ]}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Progress indicator - only show on steps 1, 2, 3 (not landing page) */}
          {step > 0 && (
            <View style={styles.progressContainer}>
              {[1, 2, 3].map((stepNum) => (
                <View
                  key={stepNum}
                  style={[
                    styles.progressDot,
                    step === stepNum && styles.progressDotActive
                  ]}
                />
              ))}
            </View>
          )}


          <View style={styles.swipeContainer} {...swipeResponder.panHandlers}>
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              indicatorStyle="white"
              nestedScrollEnabled={true}
            >
              {renderStep()}
            </ScrollView>
          </View>

          {/* Skip button at very bottom */}
          <TouchableOpacity style={styles.skipButtonBottom} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    width: BG_WIDTH,
    height: BG_HEIGHT,
    top: -(BG_HEIGHT - SCREEN_HEIGHT) / 2,
    left: -(BG_WIDTH - SCREEN_WIDTH) / 2,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  container: {
    flex: 1,
  },
  swipeContainer: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: '#22C55E',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
  },
  skipText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: IS_TABLET ? 60 : 40,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stepContent: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignItems: 'center',
    alignSelf: 'center',
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#22C55E',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  featureList: {
    backgroundColor: 'rgba(22, 101, 52, 0.2)',
    borderRadius: 16,
    padding: IS_TABLET ? 20 : 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    width: '100%',
    maxWidth: IS_TABLET ? 400 : '100%',
    alignSelf: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  featureItem: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: 22,
  },
  stepHint: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: IS_TABLET ? 24 : 20,
    fontWeight: '500',
    color: '#22C55E',
    marginBottom: 4,
    letterSpacing: 0.3,
    textAlign: 'center',
    width: '100%',
  },
  stepSubtitle: {
    fontSize: IS_TABLET ? 15 : 13,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 16,
    letterSpacing: 0.2,
    textAlign: 'center',
    width: '100%',
  },
  sectionLabel: {
    fontSize: IS_TABLET ? 12 : 11,
    color: 'rgba(34, 197, 94, 0.9)',
    fontWeight: '500',
    marginBottom: 10,
    marginTop: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    width: '100%',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%',
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  optionChipSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.7)',
    borderColor: '#22C55E',
  },
  optionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  optionLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  optionChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  optionIconSmall: {
    fontSize: 14,
    marginRight: 4,
  },
  optionLabelSmall: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tripOptions: {
    gap: 12,
    width: '100%',
    maxWidth: IS_TABLET ? 400 : '100%',
    alignSelf: 'center',
  },
  tripOption: {
    backgroundColor: 'rgba(22, 101, 52, 0.35)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  tripOptionSelected: {
    backgroundColor: 'rgba(22, 101, 52, 0.7)',
    borderColor: '#22C55E',
  },
  tripOptionText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },
  tripOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customInput: {
    backgroundColor: 'rgba(22, 101, 52, 0.2)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  navButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
    marginTop: 0,
    gap: 12,
    maxWidth: IS_TABLET ? CONTENT_MAX_WIDTH : undefined,
    alignSelf: 'center',
    width: IS_TABLET ? CONTENT_MAX_WIDTH : '100%',
  },
  backButton: {
    flex: 1,
    backgroundColor: 'rgba(22, 101, 52, 0.25)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  backButtonText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '600',
  },
  nextButton: {
    width: IS_TABLET ? 200 : '50%',
    backgroundColor: '#166534',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: 'rgba(22, 101, 52, 0.3)',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  skipOnboarding: {
    alignItems: 'center',
    paddingBottom: 74,
  },
  skipOnboardingCentered: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 144,
  },
  skipOnboardingText: {
    color: 'rgba(34, 197, 94, 0.6)',
    fontSize: 14,
  },
  distanceContainer: {
    marginTop: 16,
    paddingHorizontal: 8,
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    width: '100%',
  },
  distanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  distanceLabelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
  },
  distanceValue: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
  },
  distanceSlider: {
    width: '100%',
    height: 40,
  },
  distanceLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  distanceLabelSmall: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
  },
  skipButtonBottom: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
});

export default OnboardingFlow;
