import React, { useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';

const QUICK_PROMPTS = [
  { emoji: '🌴', label: 'Somewhere warm on a budget', template: 'Take me somewhere warm on a budget' },
  { emoji: '🏔️', label: 'Weekend mountain getaway', template: 'Plan a weekend mountain getaway' },
  { emoji: '🏖️', label: 'Beach destination', template: 'Find me a beach destination' },
  { emoji: '🌆', label: 'City break nearby', template: 'Suggest a city break nearby' },
];

const NATIONAL_PARKS = [
  { name: 'Yellowstone National Park', state: 'Wyoming/Montana/Idaho', activities: ['geysers', 'wildlife viewing', 'hiking', 'hot springs'] },
  { name: 'Grand Canyon National Park', state: 'Arizona', activities: ['hiking', 'scenic viewpoints', 'river rafting', 'photography'] },
  { name: 'Yosemite National Park', state: 'California', activities: ['waterfalls', 'rock climbing', 'giant sequoias', 'valley views'] },
  { name: 'Zion National Park', state: 'Utah', activities: ['canyoneering', 'hiking', 'river walks', 'scenic drives'] },
  { name: 'Great Smoky Mountains National Park', state: 'Tennessee/North Carolina', activities: ['mountain views', 'hiking', 'wildlife', 'historic buildings'] },
  { name: 'Rocky Mountain National Park', state: 'Colorado', activities: ['alpine lakes', 'wildlife', 'mountain hiking', 'scenic drives'] },
  { name: 'Acadia National Park', state: 'Maine', activities: ['coastal views', 'hiking', 'bike paths', 'sunrise spots'] },
  { name: 'Arches National Park', state: 'Utah', activities: ['natural arches', 'hiking', 'photography', 'stargazing'] },
  { name: 'Glacier National Park', state: 'Montana', activities: ['glaciers', 'mountain lakes', 'wildlife', 'scenic drives'] },
  { name: 'Olympic National Park', state: 'Washington', activities: ['rainforests', 'beaches', 'mountains', 'hot springs'] },
];

interface WelcomeScreenProps {
  locationLoading: boolean;
  userProfile?: string;
  userLocation?: { city: string; state: string; nearestAirport: string };
  onSetPrompt: (prompt: string) => void;
}

const injectProfileContext = (template: string, profile?: string): string => {
  if (!profile || !profile.trim()) return template;
  
  const profileLower = profile.toLowerCase();
  let additions: string[] = [];
  
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
  
  // Climate preferences
  if (profileLower.includes('warm destination')) {
    additions.push("I prefer warm weather destinations");
  } else if (profileLower.includes('cold destination')) {
    additions.push("I prefer cold weather destinations");
  }
  
  // Travel style
  if (profileLower.includes('avoid crowds')) {
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
  
  // Airline preferences
  if (profileLower.includes('delta')) {
    additions.push("I prefer flying Delta Airlines");
  } else if (profileLower.includes('southwest')) {
    additions.push("I prefer flying Southwest Airlines");
  } else if (profileLower.includes('united')) {
    additions.push("I prefer flying United Airlines");
  } else if (profileLower.includes('american')) {
    additions.push("I prefer flying American Airlines");
  } else if (profileLower.includes('jetblue')) {
    additions.push("I prefer flying JetBlue");
  } else if (profileLower.includes('alaska')) {
    additions.push("I prefer flying Alaska Airlines");
  }
  
  // Car rental preferences
  if (profileLower.includes('hertz')) {
    additions.push("I prefer renting from Hertz");
  } else if (profileLower.includes('enterprise')) {
    additions.push("I prefer renting from Enterprise");
  } else if (profileLower.includes('national')) {
    additions.push("I prefer renting from National");
  } else if (profileLower.includes('budget')) {
    additions.push("I prefer renting from Budget");
  }
  
  // Hotel preferences
  if (profileLower.includes('marriott')) {
    additions.push("I prefer Marriott hotels");
  } else if (profileLower.includes('hilton')) {
    additions.push("I prefer Hilton hotels");
  } else if (profileLower.includes('ihg')) {
    additions.push("I prefer IHG hotels");
  } else if (profileLower.includes('hyatt')) {
    additions.push("I prefer Hyatt hotels");
  } else if (profileLower.includes('airbnb') || profileLower.includes('vrbo')) {
    additions.push("I prefer Airbnb or VRBO rentals");
  }
  
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
  
  return `${template} (My profile: ${additions.join(', ')})`;
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

const generateRandomPrompt = (userLocation?: { city: string; state: string; nearestAirport: string }): string => {
  // Filter parks by proximity to user if location is available
  let availableParks = NATIONAL_PARKS;
  
  if (userLocation) {
    // Simple state-based proximity for now - prioritize parks in same or neighboring states
    const userState = userLocation.state.toLowerCase();
    const stateProximity: { [key: string]: string[] } = {
      'california': ['california', 'nevada', 'arizona', 'oregon'],
      'arizona': ['arizona', 'california', 'nevada', 'utah', 'new mexico'],
      'utah': ['utah', 'arizona', 'colorado', 'new mexico', 'nevada', 'idaho', 'wyoming'],
      'colorado': ['colorado', 'utah', 'wyoming', 'new mexico', 'nebraska', 'kansas', 'oklahoma'],
      'wyoming': ['wyoming', 'colorado', 'utah', 'idaho', 'montana', 'nebraska', 'south dakota'],
      'montana': ['montana', 'wyoming', 'idaho', 'north dakota', 'south dakota'],
      'idaho': ['idaho', 'montana', 'wyoming', 'utah', 'washington', 'oregon', 'nevada'],
      'washington': ['washington', 'oregon', 'idaho', 'montana'],
      'oregon': ['oregon', 'washington', 'california', 'idaho', 'nevada'],
      'nevada': ['nevada', 'california', 'arizona', 'utah', 'idaho', 'oregon'],
      'tennessee': ['tennessee', 'north carolina', 'kentucky', 'virginia', 'georgia', 'alabama', 'mississippi', 'arkansas', 'missouri'],
      'north carolina': ['north carolina', 'tennessee', 'virginia', 'south carolina', 'georgia', 'kentucky'],
      'maine': ['maine', 'new hampshire', 'vermont', 'massachusetts'],
    };
    
    const nearbyStates = stateProximity[userState] || [];
    const nearbyParks = NATIONAL_PARKS.filter(park => 
      nearbyStates.some(state => park.state.toLowerCase().includes(state))
    );
    
    // If we found nearby parks, use them 70% of the time
    if (nearbyParks.length > 0 && Math.random() < 0.7) {
      availableParks = nearbyParks;
    }
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

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  locationLoading, 
  userProfile,
  userLocation,
  onSetPrompt 
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
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
        <Image 
          source={require('../../../assets/icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>where would you like to explore?</Text>
      </Animated.View>
      
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity 
          style={[styles.quickStartButton, expanded && styles.quickStartButtonActive]}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <Text style={styles.quickStartText}>Quick Start</Text>
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
          {userProfile && userProfile.trim().length > 0 && (
            <TouchableOpacity 
              style={[styles.promptChip, styles.profileChip]}
              onPress={() => onSetPrompt(generateProfilePrompt(userProfile))}
            >
              <Text style={styles.promptEmoji}>✨</Text>
              <Text style={styles.promptText}>Trip from my profile</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity 
            style={styles.promptChip}
            onPress={() => onSetPrompt(injectProfileContext(generateRandomPrompt(userLocation), userProfile))}
          >
            <Text style={styles.promptEmoji}>🎲</Text>
            <Text style={styles.promptText}>Surprise me!</Text>
          </TouchableOpacity>
          
          {QUICK_PROMPTS.map((prompt, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.promptChip}
              onPress={() => onSetPrompt(injectProfileContext(prompt.template, userProfile))}
            >
              <Text style={styles.promptEmoji}>{prompt.emoji}</Text>
              <Text style={styles.promptText}>{prompt.label}</Text>
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
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
    borderRadius: 20,
  },
  title: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 0.5,
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
    paddingVertical: 12,
    paddingHorizontal: 24,
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
    gap: 10,
  },
  promptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  profileChip: {
    backgroundColor: 'rgba(22, 101, 52, 0.6)',
    borderColor: 'rgba(22, 101, 52, 0.8)',
  },
  promptEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  promptText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
});
