import React, { useState, useRef, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Animated, Dimensions } from 'react-native';
import { NATIONAL_PARKS, getParksByStateProximity, NationalParkInfo, PARK_DETECTION_PATTERNS } from '../../data/nationalParks';
import { useParkTheme } from '../../hooks';
import { ThemedLogo } from './ThemedLogo';
import { StateParkSummary } from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive sizing for tablets
const IS_TABLET = SCREEN_WIDTH >= 768;
const CONTENT_MAX_WIDTH = IS_TABLET ? 450 : SCREEN_WIDTH - 32;

const NATIONAL_PARK_PROMPTS = [
  { label: 'Somewhere warm on a budget', template: 'Take me somewhere warm on a budget' },
  { label: 'Weekend mountain getaway', template: 'Plan a weekend mountain getaway' },
  { label: 'Beach destination', template: 'Find me a beach destination' },
  { label: 'City break nearby', template: 'Suggest a city break nearby' },
];

const STATE_PARK_PROMPTS = [
  { label: 'Plan a camping trip', template: 'Plan a camping trip to {PARK_NAME}. Include campground recommendations, hiking trails, things to do, and a day-by-day itinerary' },
  { label: 'Find day hikes', template: 'Find the best day hikes at {PARK_NAME}. Include trail details, difficulty levels, distances, and what to bring' },
  { label: 'Weekend getaway', template: 'Plan a weekend getaway to {PARK_NAME}. Include must-see spots, hiking recommendations, camping or lodging options, and a 2-day itinerary' },
  { label: 'Find campgrounds', template: 'Find campgrounds at or near {PARK_NAME}. Include site availability, amenities, reservation links, and nearby trails' },
];

type ParkMode = 'national' | 'state';

interface WelcomeScreenProps {
  locationLoading: boolean;
  userProfile?: string;
  userLocation?: { city: string; state: string; nearestAirport: string };
  onSetPrompt: (prompt: string) => void;
  blacklistedParkCodes?: string[];
  parkMode?: ParkMode;
  // State parks near the user (filtered by distance) for state park mode prompts
  nearbyStateParks?: StateParkSummary[];
}

const injectProfileContext = (template: string, profile?: string): string => {
  if (!profile || !profile.trim()) return template;
  
  const profileLower = profile.toLowerCase();
  const templateLower = template.toLowerCase();
  let additions: string[] = [];
  
  // Check if a specific destination is already mentioned in the template
  // If so, skip destination-preference injections (climate, crowd preferences)
  const hasSpecificDestination = 
    templateLower.includes('trip to ') ||
    templateLower.includes('visiting ') ||
    templateLower.includes('national park') ||
    templateLower.includes('yellowstone') ||
    templateLower.includes('yosemite') ||
    templateLower.includes('grand canyon') ||
    templateLower.includes('zion') ||
    templateLower.includes('acadia') ||
    templateLower.includes('glacier') ||
    templateLower.includes('everglades');
  
  // Kids age groups
  if (profileLower.includes('kids 1-3') || profileLower.includes('toddler')) {
    additions.push("I'm traveling with toddlers (1-3 years old)");
  }
  if (profileLower.includes('kids 4-7') || profileLower.includes('young kids')) {
    additions.push("I'm traveling with young children (4-7 years old)");
  }
  if (profileLower.includes('kids 8-12') || profileLower.includes('older kids')) {
    additions.push("I'm traveling with kids (8-12 years old)");
  }
  if (profileLower.includes('kids 13+') || profileLower.includes('teenagers') || profileLower.includes('teens')) {
    additions.push("I'm traveling with teenagers");
  }
  
  // Vehicle type - important for road trips and charging
  if (profileLower.includes('tesla')) {
    additions.push("I drive a Tesla and need Supercharger access for road trips");
  } else if (profileLower.includes('other ev') || profileLower.includes('electric vehicle')) {
    additions.push("I drive an electric vehicle and need EV charging stations");
  } else if (profileLower.includes('gas vehicle')) {
    additions.push("I drive a gas vehicle");
  }
  
  // Climate preferences - only inject if no specific destination chosen
  if (!hasSpecificDestination) {
    if (profileLower.includes('warm destination')) {
      additions.push("I prefer warm weather destinations");
    } else if (profileLower.includes('cold destination')) {
      additions.push("I prefer cold weather destinations");
    }
  }
  
  // Travel style - "avoid crowds" is destination-selection preference
  if (!hasSpecificDestination && profileLower.includes('avoid crowds')) {
    additions.push("I prefer less crowded, off-the-beaten-path destinations");
  }
  if (profileLower.includes('frugal traveler')) {
    additions.push("I'm a frugal traveler looking for value");
  }
  if (profileLower.includes('luxury travel')) {
    additions.push("I prefer luxury travel experiences");
  }
  if (profileLower.includes('backpacker')) {
    additions.push("I'm a backpacker looking for affordable adventures");
  }
  if (profileLower.includes('love camping')) {
    additions.push("I love camping and outdoor accommodations");
  }
  if (profileLower.includes('hotels only')) {
    additions.push("I prefer staying in hotels");
  }
  
  // Activities and interests
  if (profileLower.includes('hiking/outdoor') || profileLower.includes('hiking')) {
    additions.push("I enjoy hiking and outdoor activities");
  }
  if (profileLower.includes('photography')) {
    additions.push("I love photography and scenic photo spots");
  }
  if (profileLower.includes('wildlife viewing') || profileLower.includes('wildlife')) {
    additions.push("I'm interested in wildlife viewing opportunities");
  }
  if (profileLower.includes('cycling')) {
    additions.push("I enjoy cycling and bike-friendly destinations");
  }
  if (profileLower.includes('fishing')) {
    additions.push("I enjoy fishing");
  }
  if (profileLower.includes('skiing') || profileLower.includes('snowboard')) {
    additions.push("I enjoy skiing and snowboarding");
  }
  if (profileLower.includes('water sports')) {
    additions.push("I enjoy water sports and aquatic activities");
  }
  if (profileLower.includes('sunrise') || profileLower.includes('sunset')) {
    additions.push("I love catching sunrise and sunset views");
  }
  if (profileLower.includes('foodie')) {
    let foodieDetails: string[] = ["I'm a foodie"];
    
    // Add specific foodie preferences
    if (profileLower.includes('local cuisine lover')) foodieDetails.push('love local cuisine');
    if (profileLower.includes('fine dining')) foodieDetails.push('enjoy fine dining');
    if (profileLower.includes('casual eats')) foodieDetails.push('prefer casual eats');
    if (profileLower.includes('street food fan')) foodieDetails.push('love street food');
    if (profileLower.includes('farm-to-table')) foodieDetails.push('prefer farm-to-table');
    if (profileLower.includes('vegetarian')) foodieDetails.push('am vegetarian');
    if (profileLower.includes('vegan')) foodieDetails.push('am vegan');
    if (profileLower.includes('gluten-free')) foodieDetails.push('need gluten-free options');
    if (profileLower.includes('breakfast enthusiast')) foodieDetails.push('love great breakfasts');
    if (profileLower.includes('brunch lover')) foodieDetails.push('enjoy brunch spots');
    if (profileLower.includes('dinner reservations')) foodieDetails.push('want dinner reservations');
    if (profileLower.includes('food tours')) foodieDetails.push('interested in food tours');
    if (profileLower.includes('cooking classes')) foodieDetails.push('want cooking classes');
    if (profileLower.includes('wine/beer tastings')) foodieDetails.push('enjoy wine/beer tastings');
    if (profileLower.includes('budget eats')) foodieDetails.push('looking for budget eats');
    if (profileLower.includes('splurge-worthy meals')) foodieDetails.push('want splurge-worthy meals');
    if (profileLower.includes('hidden gems')) foodieDetails.push('love hidden gem restaurants');
    if (profileLower.includes('scenic dining')) foodieDetails.push('want scenic dining views');
    if (profileLower.includes('instagram-worthy')) foodieDetails.push('want Instagram-worthy spots');
    if (profileLower.includes('historic restaurants')) foodieDetails.push('love historic restaurants');
    
    additions.push(foodieDetails.join(', '));
  }
  
  // Coffee hound preferences
  if (profileLower.includes('coffee hound')) {
    let coffeeDetails: string[] = ["I'm a coffee enthusiast"];
    
    if (profileLower.includes('local roasters')) coffeeDetails.push('love local roasters');
    if (profileLower.includes('specialty coffee')) coffeeDetails.push('seek specialty coffee');
    if (profileLower.includes('cozy cafe vibes')) coffeeDetails.push('enjoy cozy cafe vibes');
    if (profileLower.includes('coffee with a view')) coffeeDetails.push('want coffee spots with views');
    if (profileLower.includes('early morning coffee')) coffeeDetails.push('need early morning coffee spots');
    if (profileLower.includes('espresso lover')) coffeeDetails.push('am an espresso lover');
    if (profileLower.includes('cold brew fan')) coffeeDetails.push('love cold brew');
    if (profileLower.includes('coffee shop workspaces')) coffeeDetails.push('like working from coffee shops');
    
    additions.push(coffeeDetails.join(', '));
  }
  
  // Book worm preferences
  if (profileLower.includes('book worm')) {
    let bookDetails: string[] = ["I'm a book lover"];
    
    if (profileLower.includes('independent bookshops')) bookDetails.push('love independent bookshops');
    if (profileLower.includes('used bookstores')) bookDetails.push('enjoy used bookstores');
    if (profileLower.includes('library visits')) bookDetails.push('like visiting libraries');
    if (profileLower.includes('literary landmarks')) bookDetails.push('want to see literary landmarks');
    if (profileLower.includes('author home tours')) bookDetails.push('interested in author home tours');
    if (profileLower.includes('reading cafes')) bookDetails.push('love reading cafes');
    if (profileLower.includes('book festivals')) bookDetails.push('interested in book festivals');
    if (profileLower.includes('quiet reading spots')) bookDetails.push('seek quiet reading spots');
    
    additions.push(bookDetails.join(', '));
  }
  
  // Historian preferences
  if (profileLower.includes('historian')) {
    let historyDetails: string[] = ["I'm a history enthusiast"];
    
    if (profileLower.includes('battlefields')) historyDetails.push('love visiting battlefields and monuments');
    if (profileLower.includes('historic homes')) historyDetails.push('enjoy historic homes and estates');
    if (profileLower.includes('museums')) historyDetails.push('want to visit museums and exhibits');
    if (profileLower.includes('archaeological')) historyDetails.push('interested in archaeological sites');
    if (profileLower.includes('historic districts')) historyDetails.push('love exploring historic districts');
    if (profileLower.includes('ghost towns')) historyDetails.push('want to see ghost towns');
    if (profileLower.includes('native american')) historyDetails.push('interested in Native American heritage');
    if (profileLower.includes('colonial')) historyDetails.push('interested in colonial history');
    if (profileLower.includes('civil war')) historyDetails.push('want to visit Civil War sites');
    if (profileLower.includes('pioneer') || profileLower.includes('frontier')) historyDetails.push('interested in pioneer and frontier history');
    if (profileLower.includes('industrial')) historyDetails.push('interested in industrial heritage');
    if (profileLower.includes('maritime')) historyDetails.push('interested in maritime history');
    
    additions.push(historyDetails.join(', '));
  }
  
  // Accessibility and special needs
  if (profileLower.includes('traveling with dog') || profileLower.includes('with dog')) {
    additions.push("I'm traveling with my dog and need pet-friendly options");
  }
  if (profileLower.includes('accessible needs') || profileLower.includes('accessibility')) {
    additions.push("I need accessible accommodations and facilities");
  }
  if (profileLower.includes('limited mobility')) {
    additions.push("I have limited mobility and need easy-access options");
  }
  if (profileLower.includes('with seniors') || profileLower.includes('elderly')) {
    additions.push("I'm traveling with seniors");
  }
  if (profileLower.includes('educational trip')) {
    additions.push("I'm looking for educational travel experiences");
  }
  
  // NOTE: Booking-specific preferences (airline, car rental, hotel) are NOT injected here.
  // These are only relevant when actually searching for flights, cars, or hotels - not for
  // destination/location queries. They are stored in the user profile for programmatic access.
  
  // Gender (for solo travel safety considerations)
  if (profileLower.includes('female') && !profileLower.includes('male')) {
    additions.push("I'm a female traveler");
  } else if (profileLower.includes('male') && !profileLower.includes('female')) {
    additions.push("I'm a male traveler");
  }
  
  // If we couldn't extract specific preferences, use the full profile
  if (additions.length === 0) {
    return `About me: ${profile}. ${template}`;
  }
  
  // Build natural language prompt with preferences woven in
  return `${additions.join('. ')}. ${template}`;
};

const generateProfilePrompt = (profile: string): string => {
  // Use the comprehensive injectProfileContext function to extract all profile details
  const contextPrompt = injectProfileContext('Suggest a destination and create an itinerary for me.', profile);
  
  // If injectProfileContext couldn't extract anything, use the full profile
  if (contextPrompt === 'Suggest a destination and create an itinerary for me.') {
    return `About me: ${profile}. Suggest a destination and create an itinerary for me.`;
  }
  
  return contextPrompt;
};

const generateRandomPrompt = (
  userLocation?: { city: string; state: string; nearestAirport: string },
  blacklistedParkCodes?: string[]
): string => {
  // Filter parks by proximity to user if location is available
  let availableParks: NationalParkInfo[] = NATIONAL_PARKS;
  
  // Filter out blacklisted parks (outside user's travel distance)
  if (blacklistedParkCodes && blacklistedParkCodes.length > 0) {
    availableParks = availableParks.filter(park => {
      // Find the park code from PARK_DETECTION_PATTERNS
      const pattern = PARK_DETECTION_PATTERNS.find(p => p.name === park.name);
      if (!pattern) return true; // Keep parks we can't identify
      return !blacklistedParkCodes.includes(pattern.code);
    });
  }
  
  if (userLocation) {
    const nearbyParks = getParksByStateProximity(userLocation.state);
    
    // Filter nearby parks by blacklist too
    let filteredNearbyParks = nearbyParks;
    if (blacklistedParkCodes && blacklistedParkCodes.length > 0) {
      filteredNearbyParks = nearbyParks.filter(park => {
        const pattern = PARK_DETECTION_PATTERNS.find(p => p.name === park.name);
        if (!pattern) return true;
        return !blacklistedParkCodes.includes(pattern.code);
      });
    }
    
    // If we found nearby parks, use them 70% of the time
    if (filteredNearbyParks.length > 0 && Math.random() < 0.7) {
      availableParks = filteredNearbyParks;
    }
  }
  
  // Fallback if all parks are blacklisted
  if (availableParks.length === 0) {
    availableParks = NATIONAL_PARKS;
  }
  
  const park = availableParks[Math.floor(Math.random() * availableParks.length)];
  const durations = ['weekend', '3-day', '5-day', 'week-long'];
  const duration = durations[Math.floor(Math.random() * durations.length)];
  const activities = park.activities.slice(0, 3).join(', ');
  
  let prompt = `Plan a ${duration} trip to ${park.name} in ${park.state}. I want to experience ${activities}. Include must-see attractions, hiking recommendations, camping/lodging options, and a day-by-day itinerary.`;
  
  // Add location context if available
  if (userLocation) {
    prompt += ` I'm currently located in ${userLocation.city}, ${userLocation.state}.`;
  }
  
  return prompt;
};

// Generate a state park prompt with a specific park name injected
const generateStateParkPrompt = (
  template: string,
  nearbyStateParks?: StateParkSummary[],
  userLocation?: { city: string; state: string; nearestAirport: string },
  userProfile?: string
): string => {
  let prompt = template;
  
  // Always inject a specific park name for state park prompts
  if (template.includes('{PARK_NAME}')) {
    let parkName: string;
    let stateName: string;
    
    if (nearbyStateParks && nearbyStateParks.length > 0) {
      const randomPark = nearbyStateParks[Math.floor(Math.random() * nearbyStateParks.length)];
      parkName = randomPark.name;
      stateName = randomPark.stateFullName || randomPark.state;
    } else if (userLocation?.state) {
      parkName = `a state park`;
      stateName = userLocation.state;
    } else {
      parkName = 'a nearby state park';
      stateName = '';
    }
    
    const fullParkName = stateName ? `${parkName} in ${stateName}` : parkName;
    prompt = template.replace('{PARK_NAME}', fullParkName);
  }
  
  // Add location context
  if (userLocation) {
    prompt += ` I'm currently located in ${userLocation.city}, ${userLocation.state}.`;
  }
  
  // Inject profile context (vehicle type, travel companions, preferences, etc.)
  return injectProfileContext(prompt, userProfile);
};

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  locationLoading, 
  userProfile,
  userLocation,
  onSetPrompt,
  blacklistedParkCodes,
  parkMode = 'national',
  nearbyStateParks,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  // Get theme colors from context
  const { theme } = useParkTheme();
  
  const isStateMode = parkMode === 'state';
  
  // Select prompts based on park mode
  const quickPrompts = isStateMode ? STATE_PARK_PROMPTS : NATIONAL_PARK_PROMPTS;
  
  // Animation values
  const headerScale = useRef(new Animated.Value(1)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslate = useRef(new Animated.Value(30)).current;
  
  const toggleExpanded = () => {
    if (!expanded) {
      // First show the options container, then animate
      setShowOptions(true);
      setExpanded(true);
      
      // Small delay to ensure render, then animate
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(headerScale, {
            toValue: 0.7,
            useNativeDriver: true,
            friction: 8,
          }),
          Animated.spring(buttonScale, {
            toValue: 0.85,
            useNativeDriver: true,
            friction: 8,
          }),
          Animated.timing(headerOpacity, {
            toValue: 0.5,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.spring(optionsOpacity, {
            toValue: 1,
            useNativeDriver: true,
            friction: 8,
          }),
          Animated.spring(optionsTranslate, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }),
        ]).start();
      }, 10);
    } else {
      // Collapse: animate first, then hide
      setExpanded(false);
      
      Animated.parallel([
        Animated.spring(headerScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
        }),
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(optionsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(optionsTranslate, {
          toValue: 30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Hide options after animation completes
        setShowOptions(false);
      });
    }
  };
  
  if (locationLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.headerSection,
        {
          transform: [{ scale: headerScale }],
          opacity: headerOpacity,
        }
      ]}>
        <ThemedLogo size={IS_TABLET ? 100 : 80} style={styles.logo} />
        <Text style={styles.title}>where would you like to explore?</Text>
      </Animated.View>
      
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity 
          style={[
            styles.quickStartButton, 
            expanded && styles.quickStartButtonActive,
            { borderColor: theme.primary },
            expanded && { backgroundColor: theme.primaryLight }
          ]}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <Text style={[styles.quickStartText, { color: theme.primary }]}>Quick Start</Text>
        </TouchableOpacity>
      </Animated.View>
      
      {showOptions && (
        <Animated.View style={[
          styles.promptContainer,
          {
            opacity: optionsOpacity,
            transform: [{ translateY: optionsTranslate }],
          }
        ]}>
          {/* Trip from my profile - National Parks mode only */}
          {!isStateMode && userProfile && userProfile.trim().length > 0 && (
            <TouchableOpacity 
              style={[
                styles.promptChip, 
                styles.profileChip,
                { borderColor: theme.chipBorder, backgroundColor: theme.chipBackground }
              ]}
              onPress={() => onSetPrompt(generateProfilePrompt(userProfile))}
            >
              <Text style={[styles.promptText, { color: theme.chipText }]}>Trip from my profile</Text>
            </TouchableOpacity>
          )}
          
          {/* Surprise me! - both modes */}
          <TouchableOpacity 
            style={[
              styles.promptChip,
              { borderColor: theme.chipBorder, backgroundColor: theme.chipBackground }
            ]}
            onPress={() => {
              if (isStateMode) {
                // State parks: pick a random nearby park
                const prompt = generateStateParkPrompt('Plan a trip to {PARK_NAME}. Include hiking trails, camping or lodging options, things to do, and a day-by-day itinerary', nearbyStateParks, userLocation, userProfile);
                onSetPrompt(prompt);
              } else {
                onSetPrompt(injectProfileContext(generateRandomPrompt(userLocation, blacklistedParkCodes), userProfile));
              }
            }}
          >
            <Text style={[styles.promptText, { color: theme.chipText }]}>Surprise me!</Text>
          </TouchableOpacity>
          
          {quickPrompts.map((prompt, index) => (
            <TouchableOpacity 
              key={index}
              style={[
                styles.promptChip,
                { borderColor: theme.chipBorder, backgroundColor: theme.chipBackground }
              ]}
              onPress={() => {
                // In State Parks mode, use state park prefills; in National Parks mode, use profile injection
                const finalPrompt = isStateMode
                  ? generateStateParkPrompt(prompt.template, nearbyStateParks, userLocation, userProfile)
                  : injectProfileContext(prompt.template, userProfile);
                onSetPrompt(finalPrompt);
              }}
            >
              <Text style={[styles.promptText, { color: theme.chipText }]}>{prompt.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: IS_TABLET ? 60 : 40,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: IS_TABLET ? CONTENT_MAX_WIDTH + 32 : undefined,
    alignSelf: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  logo: {
    width: IS_TABLET ? 120 : 100,
    height: IS_TABLET ? 120 : 100,
    marginBottom: 16,
    borderRadius: IS_TABLET ? 24 : 20,
  },
  title: {
    fontSize: IS_TABLET ? 30 : 26,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 0.5,
    maxWidth: CONTENT_MAX_WIDTH,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    fontWeight: '400',
    marginTop: 8,
    letterSpacing: 0.3,
  },
  loadingText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  quickStartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: IS_TABLET ? 14 : 12,
    paddingHorizontal: IS_TABLET ? 32 : 24,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginBottom: 20,
    gap: 6,
  },
  quickStartButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  quickStartText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  promptContainer: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    gap: 10,
    alignSelf: 'center',
    alignItems: 'center',
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
  },
  profileChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  promptText: {
    color: '#FFFFFF',
    fontSize: IS_TABLET ? 16 : 15,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
});
