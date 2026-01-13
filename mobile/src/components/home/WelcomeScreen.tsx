import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Image } from 'react-native';

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
  
  // Extract traveler type
  if (profileLower.includes('solo')) additions.push("I'm a solo traveler");
  else if (profileLower.includes('couple')) additions.push("I'm traveling as a couple");
  else if (profileLower.includes('family')) additions.push("I'm traveling with family");
  else if (profileLower.includes('group') || profileLower.includes('friends')) additions.push("I'm traveling with a group");
  
  // Extract climate preferences
  if (profileLower.includes('warm') || profileLower.includes('beach') || profileLower.includes('tropical') || profileLower.includes('sun')) {
    additions.push("I prefer warm climates");
  } else if (profileLower.includes('cold') || profileLower.includes('snow') || profileLower.includes('winter') || profileLower.includes('mountain')) {
    additions.push("I enjoy cold climates and mountains");
  }
  
  // Extract budget preferences
  if (profileLower.includes('budget') || profileLower.includes('cheap') || profileLower.includes('affordable')) {
    additions.push("I'm looking for budget-friendly options");
  } else if (profileLower.includes('luxury') || profileLower.includes('premium') || profileLower.includes('high-end')) {
    additions.push("I prefer luxury experiences");
  } else if (profileLower.includes('mid-range') || profileLower.includes('moderate')) {
    additions.push("I'm comfortable with mid-range pricing");
  }
  
  // Extract activity preferences
  if (profileLower.includes('adventure') || profileLower.includes('hiking') || profileLower.includes('outdoor') || profileLower.includes('sports')) {
    additions.push("I enjoy outdoor adventures and activities");
  }
  if (profileLower.includes('relax') || profileLower.includes('spa') || profileLower.includes('rest') || profileLower.includes('chill')) {
    additions.push("I prefer relaxing and peaceful experiences");
  }
  if (profileLower.includes('food') || profileLower.includes('culinary') || profileLower.includes('cuisine') || profileLower.includes('dining')) {
    additions.push("I love exploring local food and dining experiences");
  }
  if (profileLower.includes('culture') || profileLower.includes('history') || profileLower.includes('museum') || profileLower.includes('art')) {
    additions.push("I'm interested in cultural and historical sites");
  }
  if (profileLower.includes('nightlife') || profileLower.includes('party') || profileLower.includes('bars') || profileLower.includes('entertainment')) {
    additions.push("I enjoy nightlife and entertainment");
  }
  if (profileLower.includes('nature') || profileLower.includes('wildlife') || profileLower.includes('scenery') || profileLower.includes('landscape')) {
    additions.push("I love nature and scenic landscapes");
  }
  if (profileLower.includes('shopping') || profileLower.includes('markets') || profileLower.includes('souvenirs')) {
    additions.push("I enjoy shopping and local markets");
  }
  
  // Extract accommodation preferences
  if (profileLower.includes('camping') || profileLower.includes('camp')) {
    additions.push("I prefer camping accommodations");
  } else if (profileLower.includes('hotel') || profileLower.includes('resort')) {
    additions.push("I prefer hotels or resorts");
  } else if (profileLower.includes('hostel') || profileLower.includes('budget lodging')) {
    additions.push("I'm open to hostels and budget lodging");
  } else if (profileLower.includes('airbnb') || profileLower.includes('vacation rental')) {
    additions.push("I prefer vacation rentals like Airbnb");
  }
  if (profileLower.includes('accessible') || profileLower.includes('accessibility') || profileLower.includes('wheelchair') || profileLower.includes('disabled')) {
    additions.push("I need accessible accommodations");
  }
  
  // Extract transportation preferences
  if (profileLower.includes('road trip') || profileLower.includes('driving') || profileLower.includes('car')) {
    additions.push("I enjoy road trips and driving");
  } else if (profileLower.includes('flying') || profileLower.includes('plane') || profileLower.includes('air travel')) {
    additions.push("I prefer flying to destinations");
  } else if (profileLower.includes('train') || profileLower.includes('rail') || profileLower.includes('public transport')) {
    additions.push("I enjoy train travel and public transportation");
  }
  
  // Extract duration preferences
  if (profileLower.includes('weekend') || profileLower.includes('2-3 days')) {
    additions.push("I'm planning for a weekend trip");
  } else if (profileLower.includes('week') || profileLower.includes('7 days')) {
    additions.push("I'm planning for a week-long trip");
  } else if (profileLower.includes('day trip') || profileLower.includes('1 day')) {
    additions.push("I'm looking for a day trip");
  }
  
  // Extract specific interests
  if (profileLower.includes('photography') || profileLower.includes('photos')) {
    additions.push("I love photography and scenic photo opportunities");
  }
  if (profileLower.includes('beach') || profileLower.includes('ocean') || profileLower.includes('sea')) {
    additions.push("I love beaches and ocean activities");
  }
  if (profileLower.includes('city') || profileLower.includes('urban')) {
    additions.push("I enjoy city experiences and urban exploration");
  }
  if (profileLower.includes('countryside') || profileLower.includes('rural')) {
    additions.push("I prefer countryside and rural experiences");
  }
  
  // Extract pet/travel companion preferences
  if (profileLower.includes('dog') || profileLower.includes('pet') || profileLower.includes('animal') || profileLower.includes('furry')) {
    additions.push("I'm traveling with a dog and need pet-friendly options");
  } else if (profileLower.includes('cat') || profileLower.includes('kitten')) {
    additions.push("I'm traveling with a cat and need pet-friendly options");
  }
  
  // If we couldn't extract specific preferences, use the full profile
  if (additions.length === 0) {
    return `About me: ${profile}. ${template}`;
  }
  
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
      <Image 
        source={require('../../../assets/icon.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Where would you like to explore?</Text>
      
      <Text style={styles.sectionLabel}>Quick Start</Text>
      <View style={styles.promptContainer}>
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
          onPress={() => onSetPrompt(injectProfileContext(generateRandomPrompt(), userProfile))}
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
      </View>
    </View>
  );
};

export const ConsiderationsHint: React.FC = () => (
  <Text style={styles.considerationsHint}>
    💡 Consider: duration • budget • lodging type • transportation
  </Text>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    borderRadius: 16,
  },
  title: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '300',
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    fontWeight: '300',
  },
  sectionLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
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
  considerationsHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
});
