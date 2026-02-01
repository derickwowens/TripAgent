import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Linking,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useLocation, MaxTravelDistance } from '../../hooks';
import { ThemedLogo } from './ThemedLogo';
import { APP_NAME } from '../../utils/appName';
import { getWhitelistedParkNames } from '../../utils/parkDistanceFilter';

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
// Each option has: id, label (for UI display), profileText (clear sentence for Claude), and promptText (for initial prompt)
const TRAVEL_STYLES = [
  { id: 'frugal', label: 'Frugal traveler', profileText: 'I am a budget-conscious traveler who prefers affordable options', promptText: 'budget-conscious' },
  { id: 'luxury', label: 'Luxury travel', profileText: 'I prefer luxury travel experiences and upscale accommodations', promptText: 'luxury' },
  { id: 'backpacker', label: 'Backpacker', profileText: 'I am a backpacker who enjoys adventure travel and budget accommodations', promptText: 'backpacker' },
  { id: 'camping', label: 'Love camping', profileText: 'I love camping and prefer campgrounds over hotels when possible', promptText: 'camping enthusiast' },
  { id: 'hotels', label: 'Hotels only', profileText: 'I only stay in hotels, not campgrounds or hostels', promptText: 'hotels-only' },
  { id: 'airbnb', label: 'Airbnb/VRBO', profileText: 'I prefer vacation rentals like Airbnb or VRBO over traditional hotels', promptText: 'vacation rental' },
  { id: 'avoid-crowds', label: 'Avoid crowds', profileText: 'I prefer to avoid crowded tourist areas and seek quieter experiences', promptText: 'crowd-avoiding' },
];

const INTERESTS = [
  { id: 'hiking', label: 'Hiking/outdoors', profileText: 'I am an outdoor enthusiast who loves hiking', promptText: 'hiking and the outdoors' },
  { id: 'photography', label: 'Photography', profileText: 'I am a photography enthusiast interested in scenic viewpoints and photo opportunities', promptText: 'photography' },
  { id: 'wildlife', label: 'Wildlife viewing', profileText: 'I enjoy wildlife viewing and want to see animals in their natural habitat', promptText: 'wildlife viewing' },
  { id: 'foodie', label: 'Foodie', profileText: 'I am a foodie who loves exploring local cuisine and notable restaurants', promptText: 'local food and restaurants' },
  { id: 'water', label: 'Water sports', profileText: 'I enjoy water sports like kayaking, swimming, and water activities', promptText: 'water sports' },
  { id: 'cycling', label: 'Cycling', profileText: 'I enjoy cycling and biking trails', promptText: 'cycling' },
  { id: 'fishing', label: 'Fishing', profileText: 'I enjoy fishing and want fishing spot recommendations', promptText: 'fishing' },
  { id: 'skiing', label: 'Skiing/snowboard', profileText: 'I enjoy skiing and snowboarding', promptText: 'skiing and snowboarding' },
  { id: 'sunrise', label: 'Sunrise/sunset', profileText: 'I love watching sunrises and sunsets and want the best viewpoints', promptText: 'sunrise and sunset viewpoints' },
  { id: 'coffee', label: 'Coffee hound', profileText: 'I am a coffee enthusiast who seeks out local coffee shops and roasters', promptText: 'great coffee spots' },
  { id: 'bookworm', label: 'Book worm', profileText: 'I am a book lover interested in bookshops and literary destinations', promptText: 'bookshops and literary sites' },
  { id: 'historian', label: 'Historian', profileText: 'I am a history enthusiast interested in historical sites and museums', promptText: 'history and museums' },
];

const TRAVEL_WITH = [
  { id: 'solo', label: 'Solo', profileText: 'I am traveling solo', promptText: 'solo' },
  { id: 'partner', label: 'Partner', profileText: 'I am traveling with my partner', promptText: 'with my partner' },
  { id: 'family', label: 'Family', profileText: 'I am traveling with my family', promptText: 'with my family' },
  { id: 'friends', label: 'Friends', profileText: 'I am traveling with friends', promptText: 'with friends' },
  { id: 'dog', label: 'Traveling with dog', profileText: 'I am traveling with my dog and need pet-friendly accommodations and activities', promptText: 'with my dog' },
];

// Family sub-options
const FAMILY_OPTIONS = [
  { id: 'toddlers', label: 'Kids 1-3 yrs', profileText: 'I have toddlers (ages 1-3) and need kid-friendly, stroller-accessible options', promptText: 'toddlers (1-3 years)' },
  { id: 'young-kids', label: 'Kids 4-7 yrs', profileText: 'I have young children (ages 4-7) who need engaging but manageable activities', promptText: 'young kids (4-7 years)' },
  { id: 'older-kids', label: 'Kids 8-12 yrs', profileText: 'I have older kids (ages 8-12) who can handle moderate hikes and activities', promptText: 'older kids (8-12 years)' },
  { id: 'teens', label: 'Kids 13+', profileText: 'I have teenagers who can participate in more challenging activities', promptText: 'teenagers' },
  { id: 'seniors', label: 'With seniors', profileText: 'I am traveling with seniors who may need easier trails and accessible facilities', promptText: 'seniors' },
  { id: 'accessibility', label: 'Accessible needs', profileText: 'I have accessibility requirements and need ADA-compliant facilities', promptText: 'accessibility needs' },
  { id: 'limited-mobility', label: 'Limited mobility', profileText: 'Someone in my group has limited mobility and needs easier walking options', promptText: 'limited mobility considerations' },
  { id: 'educational', label: 'Educational trips', profileText: 'I want educational experiences for learning opportunities', promptText: 'educational experiences' },
];

// Climate preferences
const CLIMATE_PREFS = [
  { id: 'warm', label: 'Warm destinations', profileText: 'I prefer warm weather destinations' },
  { id: 'cold', label: 'Cold destinations', profileText: 'I prefer cold weather destinations' },
];

// Vehicle type
const VEHICLE_TYPES = [
  { id: 'gas', label: 'Gas vehicle', profileText: 'I drive a gas-powered vehicle' },
  { id: 'tesla', label: 'Tesla', profileText: 'I drive a Tesla and need Supercharger stations along my route' },
  { id: 'other-ev', label: 'Other EV', profileText: 'I drive an electric vehicle (non-Tesla) and need EV charging stations' },
];

// Preferred airlines
const AIRLINES = [
  { id: 'delta', label: 'Delta', profileText: 'I prefer Delta Air Lines for flights' },
  { id: 'southwest', label: 'Southwest', profileText: 'I prefer Southwest Airlines for flights' },
  { id: 'united', label: 'United', profileText: 'I prefer United Airlines for flights' },
  { id: 'american', label: 'American', profileText: 'I prefer American Airlines for flights' },
  { id: 'jetblue', label: 'JetBlue', profileText: 'I prefer JetBlue Airways for flights' },
  { id: 'alaska', label: 'Alaska', profileText: 'I prefer Alaska Airlines for flights' },
];

// Preferred car rentals
const CAR_RENTALS = [
  { id: 'hertz', label: 'Hertz', profileText: 'I prefer Hertz for car rentals' },
  { id: 'enterprise', label: 'Enterprise', profileText: 'I prefer Enterprise Rent-A-Car' },
  { id: 'national', label: 'National', profileText: 'I prefer National Car Rental' },
  { id: 'budget', label: 'Budget', profileText: 'I prefer Budget Car Rental' },
];

// Preferred hotels
const HOTELS = [
  { id: 'marriott', label: 'Marriott', profileText: 'I prefer Marriott hotels' },
  { id: 'hilton', label: 'Hilton', profileText: 'I prefer Hilton hotels' },
  { id: 'ihg', label: 'IHG', profileText: 'I prefer IHG hotels (Holiday Inn, InterContinental, etc.)' },
  { id: 'hyatt', label: 'Hyatt', profileText: 'I prefer Hyatt hotels' },
];

// Helper to get a random park from the whitelisted parks
const getRandomParkFromList = (parks: string[]): string => {
  if (parks.length === 0) return 'Yellowstone'; // Fallback
  return parks[Math.floor(Math.random() * parks.length)];
};

// Quick trip idea definitions - getPrompt is called with whitelisted parks
const QUICK_TRIP_IDEAS = [
  { id: 'national-park', label: 'Plan a national park trip', getPrompt: (parks: string[]) => `Help me plan a trip to ${getRandomParkFromList(parks)} National Park` },
  { id: 'weekend', label: 'Weekend getaway', getPrompt: (_parks: string[]) => 'Help me plan a weekend getaway somewhere nearby' },
  { id: 'road-trip', label: 'Road trip adventure', getPrompt: (_parks: string[]) => 'Help me plan a road trip adventure' },
  { id: 'beach', label: 'Beach vacation', getPrompt: (_parks: string[]) => 'Help me find a great beach destination' },
  { id: 'custom', label: 'I have something specific in mind', getPrompt: (_parks: string[]) => '' },
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
  // Preview value for slider during drag (avoids recalculating parks on every tick)
  const [sliderPreview, setSliderPreview] = useState<MaxTravelDistance | null>(null);

  // Calculate whitelisted parks based on user location and max travel distance
  // Only recalculates when actual maxTravelDistance changes (not during drag)
  const whitelistedParks = useMemo(() => {
    return getWhitelistedParkNames(userLocation?.lat, userLocation?.lng, maxTravelDistance);
  }, [userLocation?.lat, userLocation?.lng, maxTravelDistance]);
  
  // Display value shows preview during drag, actual value otherwise
  const displayDistance = sliderPreview !== null ? sliderPreview : maxTravelDistance;

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
    const sentences: string[] = [];
    
    // Add travel styles (using profileText for clear context)
    TRAVEL_STYLES.forEach(style => {
      if (selectedStyles.includes(style.id)) {
        sentences.push(style.profileText);
      }
    });
    
    // Add climate preferences
    CLIMATE_PREFS.forEach(climate => {
      if (selectedClimate.includes(climate.id)) {
        sentences.push(climate.profileText);
      }
    });
    
    // Add interests
    INTERESTS.forEach(interest => {
      if (selectedInterests.includes(interest.id)) {
        sentences.push(interest.profileText);
      }
    });
    
    // Add travel companions
    TRAVEL_WITH.forEach(tw => {
      if (selectedTravelWith.includes(tw.id)) {
        sentences.push(tw.profileText);
      }
    });
    
    // Add family options
    FAMILY_OPTIONS.forEach(fo => {
      if (selectedFamilyOptions.includes(fo.id)) {
        sentences.push(fo.profileText);
      }
    });
    
    // Add vehicle type
    VEHICLE_TYPES.forEach(vehicle => {
      if (selectedVehicle.includes(vehicle.id)) {
        sentences.push(vehicle.profileText);
      }
    });
    
    // Add airline preference
    AIRLINES.forEach(airline => {
      if (selectedAirline.includes(airline.id)) {
        sentences.push(airline.profileText);
      }
    });
    
    // Add car rental preference
    CAR_RENTALS.forEach(rental => {
      if (selectedCarRental.includes(rental.id)) {
        sentences.push(rental.profileText);
      }
    });
    
    // Add hotel preference
    HOTELS.forEach(hotel => {
      if (selectedHotel.includes(hotel.id)) {
        sentences.push(hotel.profileText);
      }
    });
    
    // Join with periods for clear sentence separation
    return sentences.join('. ') + (sentences.length > 0 ? '.' : '');
  };

  const getFirstPrompt = (): string | undefined => {
    // If user typed a custom prompt, use that
    if (selectedTrip === 'custom' && customPrompt.trim()) {
      return customPrompt.trim();
    }
    
    // Build a comprehensive prompt from all selected preferences
    const promptParts: string[] = [];
    
    // Get trip type prompt - pass whitelisted parks for national park trip
    const trip = QUICK_TRIP_IDEAS.find(t => t.id === selectedTrip);
    if (trip && trip.id !== 'custom') {
      promptParts.push(trip.getPrompt(whitelistedParks));
    }
    
    // Add context from selected preferences
    const contextParts: string[] = [];
    
    // Travel style context
    if (selectedStyles.length > 0) {
      const styles = TRAVEL_STYLES.filter(s => selectedStyles.includes(s.id)).map(s => s.promptText);
      if (styles.length > 0) {
        contextParts.push(`I'm a ${styles.join(' and ')} traveler`);
      }
    }
    
    // Interests context
    if (selectedInterests.length > 0) {
      const interests = INTERESTS.filter(i => selectedInterests.includes(i.id)).map(i => i.promptText);
      if (interests.length > 0) {
        contextParts.push(`interested in ${interests.join(', ')}`);
      }
    }
    
    // Travel companions context - build a natural sentence
    if (selectedTravelWith.length > 0 || selectedFamilyOptions.length > 0) {
      const companionParts: string[] = [];
      
      // Get base companion info
      const companions = TRAVEL_WITH.filter(t => selectedTravelWith.includes(t.id));
      const familyDetails = FAMILY_OPTIONS.filter(f => selectedFamilyOptions.includes(f.id));
      
      // Handle solo specially
      if (companions.some(c => c.id === 'solo')) {
        companionParts.push("I'm traveling solo");
      } else if (companions.length > 0) {
        // Build companion string without duplicate "with"
        const companionTexts = companions.map(c => {
          // Remove leading "with " if present, we'll add it once
          return c.promptText.replace(/^with /, '');
        });
        companionParts.push(`I'm traveling with ${companionTexts.join(' and ')}`);
      }
      
      // Add family details if present (and not solo)
      if (familyDetails.length > 0 && !companions.some(c => c.id === 'solo')) {
        const familyTexts = familyDetails.map(f => f.promptText);
        // If we already have companions, use "including"
        if (companionParts.length > 0) {
          companionParts[0] += `, including ${familyTexts.join(', ')}`;
        } else {
          companionParts.push(`our group includes ${familyTexts.join(', ')}`);
        }
      }
      
      if (companionParts.length > 0) {
        contextParts.push(companionParts[0]);
      }
    }
    
    // Combine into a natural prompt
    if (promptParts.length > 0 && contextParts.length > 0) {
      return `${promptParts[0]}. ${contextParts.join('. ')}.`;
    } else if (promptParts.length > 0) {
      return promptParts[0];
    } else if (contextParts.length > 0) {
      return `Help me plan a trip. ${contextParts.join('. ')}.`;
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
              <ThemedLogo size={IS_TABLET ? 120 : 100} />
            </View>
            <Text style={styles.welcomeTitle}>{APP_NAME}</Text>
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
                <Text style={styles.distanceValue}>{getDistanceDisplayText(displayDistance)}</Text>
              </View>
              <Slider
                style={styles.distanceSlider}
                minimumValue={0}
                maximumValue={DISTANCE_PRESETS.length}
                step={1}
                value={distanceToSliderValue(maxTravelDistance)}
                onValueChange={(value) => setSliderPreview(sliderValueToDistance(value))}
                onSlidingComplete={(value) => {
                  setSliderPreview(null);
                  setMaxTravelDistance(sliderValueToDistance(value));
                }}
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

            {/* Complete button */}
            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => onComplete(buildProfile(), getFirstPrompt(), maxTravelDistance)}
            >
              <Text style={styles.completeButtonText}>Complete Setup</Text>
            </TouchableOpacity>
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

          {/* Why link and Skip button at bottom */}
          <View style={styles.bottomButtons}>
            <TouchableOpacity 
              style={styles.whyLink} 
              onPress={() => Linking.openURL('https://travel-buddy-api-production.up.railway.app/public/why.html')}
            >
              <Text style={styles.whyLinkText}>Why {APP_NAME}?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
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
  bottomButtons: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  whyLink: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  whyLinkText: {
    color: 'rgba(34, 197, 94, 0.8)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  completeButton: {
    marginTop: 24,
    backgroundColor: '#22C55E',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    maxWidth: IS_TABLET ? 300 : '100%',
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default OnboardingFlow;
