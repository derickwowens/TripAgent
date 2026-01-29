/**
 * Test cases for prompt string building logic
 * Run with: npx jest promptBuilder.test.ts
 */

// Replicate the data structures from OnboardingFlow
const TRAVEL_STYLES = [
  { id: 'frugal', promptText: 'budget-conscious' },
  { id: 'luxury', promptText: 'luxury' },
  { id: 'backpacker', promptText: 'backpacker' },
  { id: 'camping', promptText: 'camping enthusiast' },
  { id: 'hotels', promptText: 'hotels-only' },
  { id: 'airbnb', promptText: 'vacation rental' },
  { id: 'avoid-crowds', promptText: 'crowd-avoiding' },
];

const INTERESTS = [
  { id: 'hiking', promptText: 'hiking and the outdoors' },
  { id: 'photography', promptText: 'photography' },
  { id: 'wildlife', promptText: 'wildlife viewing' },
  { id: 'foodie', promptText: 'local food and restaurants' },
  { id: 'water', promptText: 'water sports' },
  { id: 'cycling', promptText: 'cycling' },
  { id: 'fishing', promptText: 'fishing' },
  { id: 'skiing', promptText: 'skiing and snowboarding' },
  { id: 'sunrise', promptText: 'sunrise and sunset viewpoints' },
  { id: 'coffee', promptText: 'great coffee spots' },
  { id: 'bookworm', promptText: 'bookshops and literary sites' },
  { id: 'historian', promptText: 'history and museums' },
];

const TRAVEL_WITH = [
  { id: 'solo', promptText: 'solo' },
  { id: 'partner', promptText: 'with my partner' },
  { id: 'family', promptText: 'with my family' },
  { id: 'friends', promptText: 'with friends' },
  { id: 'dog', promptText: 'with my dog' },
];

const FAMILY_OPTIONS = [
  { id: 'toddlers', promptText: 'toddlers (1-3 years)' },
  { id: 'young-kids', promptText: 'young kids (4-7 years)' },
  { id: 'older-kids', promptText: 'older kids (8-12 years)' },
  { id: 'teens', promptText: 'teenagers' },
  { id: 'seniors', promptText: 'seniors' },
  { id: 'accessibility', promptText: 'accessibility needs' },
  { id: 'limited-mobility', promptText: 'limited mobility considerations' },
  { id: 'educational', promptText: 'educational experiences' },
];

// Replicate the prompt building logic
function buildPrompt(
  tripPrompt: string | null,
  selectedStyles: string[],
  selectedInterests: string[],
  selectedTravelWith: string[],
  selectedFamilyOptions: string[]
): string | undefined {
  const promptParts: string[] = [];
  
  if (tripPrompt) {
    promptParts.push(tripPrompt);
  }
  
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
    
    const companions = TRAVEL_WITH.filter(t => selectedTravelWith.includes(t.id));
    const familyDetails = FAMILY_OPTIONS.filter(f => selectedFamilyOptions.includes(f.id));
    
    // Handle solo specially
    if (companions.some(c => c.id === 'solo')) {
      companionParts.push("I'm traveling solo");
    } else if (companions.length > 0) {
      const companionTexts = companions.map(c => {
        return c.promptText.replace(/^with /, '');
      });
      companionParts.push(`I'm traveling with ${companionTexts.join(' and ')}`);
    }
    
    // Add family details if present (and not solo)
    if (familyDetails.length > 0 && !companions.some(c => c.id === 'solo')) {
      const familyTexts = familyDetails.map(f => f.promptText);
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
}

// Test cases
const testCases = [
  // Basic single selections
  {
    name: 'Solo traveler only',
    trip: 'Help me plan a trip to Yellowstone',
    styles: [],
    interests: [],
    travelWith: ['solo'],
    familyOptions: [],
    expected: "Help me plan a trip to Yellowstone. I'm traveling solo."
  },
  {
    name: 'Partner only',
    trip: 'Help me plan a trip to Zion',
    styles: [],
    interests: [],
    travelWith: ['partner'],
    familyOptions: [],
    expected: "Help me plan a trip to Zion. I'm traveling with my partner."
  },
  {
    name: 'Family only',
    trip: 'Help me plan a trip to Grand Canyon',
    styles: [],
    interests: [],
    travelWith: ['family'],
    familyOptions: [],
    expected: "Help me plan a trip to Grand Canyon. I'm traveling with my family."
  },
  
  // Multiple companions
  {
    name: 'Partner + Dog',
    trip: 'Help me plan a trip to Acadia',
    styles: [],
    interests: [],
    travelWith: ['partner', 'dog'],
    familyOptions: [],
    expected: "Help me plan a trip to Acadia. I'm traveling with my partner and my dog."
  },
  {
    name: 'Family + Dog',
    trip: 'Help me plan a trip to Olympic',
    styles: [],
    interests: [],
    travelWith: ['family', 'dog'],
    familyOptions: [],
    expected: "Help me plan a trip to Olympic. I'm traveling with my family and my dog."
  },
  {
    name: 'Friends + Dog',
    trip: 'Help me plan a trip to Joshua Tree',
    styles: [],
    interests: [],
    travelWith: ['friends', 'dog'],
    familyOptions: [],
    expected: "Help me plan a trip to Joshua Tree. I'm traveling with friends and my dog."
  },
  
  // Family with details
  {
    name: 'Family + Toddlers',
    trip: 'Help me plan a trip to Glacier',
    styles: [],
    interests: [],
    travelWith: ['family'],
    familyOptions: ['toddlers'],
    expected: "Help me plan a trip to Glacier. I'm traveling with my family, including toddlers (1-3 years)."
  },
  {
    name: 'Family + Multiple Kids',
    trip: 'Help me plan a trip to Yellowstone',
    styles: [],
    interests: [],
    travelWith: ['family'],
    familyOptions: ['toddlers', 'older-kids'],
    expected: "Help me plan a trip to Yellowstone. I'm traveling with my family, including toddlers (1-3 years), older kids (8-12 years)."
  },
  {
    name: 'Family + Kids + Seniors',
    trip: 'Help me plan a trip to Sequoia',
    styles: [],
    interests: [],
    travelWith: ['family'],
    familyOptions: ['young-kids', 'seniors'],
    expected: "Help me plan a trip to Sequoia. I'm traveling with my family, including young kids (4-7 years), seniors."
  },
  
  // Just family options (no companion selected)
  {
    name: 'Just accessibility needs',
    trip: 'Help me plan a trip to Arches',
    styles: [],
    interests: [],
    travelWith: [],
    familyOptions: ['accessibility'],
    expected: "Help me plan a trip to Arches. our group includes accessibility needs."
  },
  {
    name: 'Just seniors + limited mobility',
    trip: 'Help me plan a trip to Bryce',
    styles: [],
    interests: [],
    travelWith: [],
    familyOptions: ['seniors', 'limited-mobility'],
    expected: "Help me plan a trip to Bryce. our group includes seniors, limited mobility considerations."
  },
  
  // Full combinations
  {
    name: 'Full profile: Budget + Photography + Solo',
    trip: 'Help me plan a trip to Mesa Verde',
    styles: ['frugal'],
    interests: ['photography'],
    travelWith: ['solo'],
    familyOptions: [],
    expected: "Help me plan a trip to Mesa Verde. I'm a budget-conscious traveler. interested in photography. I'm traveling solo."
  },
  {
    name: 'Full profile: Luxury + Foodie + Partner',
    trip: 'Help me plan a trip to Yosemite',
    styles: ['luxury'],
    interests: ['foodie'],
    travelWith: ['partner'],
    familyOptions: [],
    expected: "Help me plan a trip to Yosemite. I'm a luxury traveler. interested in local food and restaurants. I'm traveling with my partner."
  },
  {
    name: 'Full profile: Camping + Hiking + Family + Toddlers',
    trip: 'Help me plan a trip to Rocky Mountain',
    styles: ['camping'],
    interests: ['hiking'],
    travelWith: ['family'],
    familyOptions: ['toddlers'],
    expected: "Help me plan a trip to Rocky Mountain. I'm a camping enthusiast traveler. interested in hiking and the outdoors. I'm traveling with my family, including toddlers (1-3 years)."
  },
  {
    name: 'Full profile: Multiple styles + Multiple interests + Partner + Dog',
    trip: 'Help me plan a trip to Shenandoah',
    styles: ['frugal', 'avoid-crowds'],
    interests: ['hiking', 'photography', 'wildlife'],
    travelWith: ['partner', 'dog'],
    familyOptions: [],
    expected: "Help me plan a trip to Shenandoah. I'm a budget-conscious and crowd-avoiding traveler. interested in hiking and the outdoors, photography, wildlife viewing. I'm traveling with my partner and my dog."
  },
  
  // No trip prompt
  {
    name: 'No trip, just preferences',
    trip: null,
    styles: ['luxury'],
    interests: ['foodie', 'coffee'],
    travelWith: ['partner'],
    familyOptions: [],
    expected: "Help me plan a trip. I'm a luxury traveler. interested in local food and restaurants, great coffee spots. I'm traveling with my partner."
  },
  
  // Edge cases
  {
    name: 'Nothing selected',
    trip: 'Help me plan a trip',
    styles: [],
    interests: [],
    travelWith: [],
    familyOptions: [],
    expected: "Help me plan a trip"
  },
];

// Run tests
console.log('🧪 Testing Prompt Builder Permutations\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((tc, index) => {
  const result = buildPrompt(tc.trip, tc.styles, tc.interests, tc.travelWith, tc.familyOptions);
  const success = result === tc.expected;
  
  if (success) {
    passed++;
    console.log(`✅ ${index + 1}. ${tc.name}`);
  } else {
    failed++;
    console.log(`❌ ${index + 1}. ${tc.name}`);
    console.log(`   Expected: "${tc.expected}"`);
    console.log(`   Got:      "${result}"`);
  }
});

console.log('\n' + '='.repeat(80));
console.log(`Results: ${passed} passed, ${failed} failed`);

export { buildPrompt, testCases };
