import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'travel_conversations';
const MAX_CONVERSATIONS = 20;

// Authoritative National Parks data for destination detection
// Sorted by key length (descending) to prioritize longer/more specific matches
// e.g., "kenai fjords" should match before "glacier"
const NATIONAL_PARKS_LOOKUP: Array<{ key: string; name: string }> = [
  { key: 'great smoky mountains', name: 'Great Smoky Mountains National Park' },
  { key: 'wrangell st elias', name: 'Wrangell-St. Elias National Park' },
  { key: 'gates of the arctic', name: 'Gates of the Arctic National Park' },
  { key: 'guadalupe mountains', name: 'Guadalupe Mountains National Park' },
  { key: 'carlsbad caverns', name: 'Carlsbad Caverns National Park' },
  { key: 'theodore roosevelt', name: 'Theodore Roosevelt National Park' },
  { key: 'great sand dunes', name: 'Great Sand Dunes National Park' },
  { key: 'petrified forest', name: 'Petrified Forest National Park' },
  { key: 'hawaii volcanoes', name: 'Hawaiʻi Volcanoes National Park' },
  { key: 'cuyahoga valley', name: 'Cuyahoga Valley National Park' },
  { key: 'channel islands', name: 'Channel Islands National Park' },
  { key: 'lassen volcanic', name: 'Lassen Volcanic National Park' },
  { key: 'rocky mountain', name: 'Rocky Mountain National Park' },
  { key: 'north cascades', name: 'North Cascades National Park' },
  { key: 'new river gorge', name: 'New River Gorge National Park' },
  { key: 'indiana dunes', name: 'Indiana Dunes National Park' },
  { key: 'black canyon', name: 'Black Canyon of the Gunnison National Park' },
  { key: 'mount rainier', name: 'Mount Rainier National Park' },
  { key: 'virgin islands', name: 'Virgin Islands National Park' },
  { key: 'kenai fjords', name: 'Kenai Fjords National Park' },
  { key: 'kobuk valley', name: 'Kobuk Valley National Park' },
  { key: 'death valley', name: 'Death Valley National Park' },
  { key: 'crater lake', name: 'Crater Lake National Park' },
  { key: 'bryce canyon', name: 'Bryce Canyon National Park' },
  { key: 'grand canyon', name: 'Grand Canyon National Park' },
  { key: 'joshua tree', name: 'Joshua Tree National Park' },
  { key: 'mammoth cave', name: 'Mammoth Cave National Park' },
  { key: 'isle royale', name: 'Isle Royale National Park' },
  { key: 'dry tortugas', name: 'Dry Tortugas National Park' },
  { key: 'glacier bay', name: 'Glacier Bay National Park' },
  { key: 'grand teton', name: 'Grand Teton National Park' },
  { key: 'great basin', name: 'Great Basin National Park' },
  { key: 'hot springs', name: 'Hot Springs National Park' },
  { key: 'lake clark', name: 'Lake Clark National Park' },
  { key: 'mesa verde', name: 'Mesa Verde National Park' },
  { key: 'white sands', name: 'White Sands National Park' },
  { key: 'capitol reef', name: 'Capitol Reef National Park' },
  { key: 'canyonlands', name: 'Canyonlands National Park' },
  { key: 'great smoky', name: 'Great Smoky Mountains National Park' },
  { key: 'wind cave', name: 'Wind Cave National Park' },
  { key: 'everglades', name: 'Everglades National Park' },
  { key: 'voyageurs', name: 'Voyageurs National Park' },
  { key: 'shenandoah', name: 'Shenandoah National Park' },
  { key: 'yellowstone', name: 'Yellowstone National Park' },
  { key: 'pinnacles', name: 'Pinnacles National Park' },
  { key: 'biscayne', name: 'Biscayne National Park' },
  { key: 'congaree', name: 'Congaree National Park' },
  { key: 'haleakala', name: 'Haleakalā National Park' },
  { key: 'big bend', name: 'Big Bend National Park' },
  { key: 'badlands', name: 'Badlands National Park' },
  { key: 'yosemite', name: 'Yosemite National Park' },
  { key: 'sequoia', name: 'Sequoia National Park' },
  { key: 'olympic', name: 'Olympic National Park' },
  { key: 'saguaro', name: 'Saguaro National Park' },
  { key: 'redwood', name: 'Redwood National Park' },
  { key: 'glacier', name: 'Glacier National Park' },
  { key: 'arches', name: 'Arches National Park' },
  { key: 'acadia', name: 'Acadia National Park' },
  { key: 'katmai', name: 'Katmai National Park' },
  { key: 'denali', name: 'Denali National Park' },
  { key: 'zion', name: 'Zion National Park' },
];

/**
 * Known park combinations that are commonly visited together
 * These take priority over single park matches
 */
const COMBINED_PARKS: Array<{ keys: string[]; name: string }> = [
  { keys: ['sequoia', 'kings canyon'], name: 'Sequoia & Kings Canyon National Parks' },
  { keys: ['yellowstone', 'grand teton'], name: 'Yellowstone & Grand Teton National Parks' },
  { keys: ['death valley', 'joshua tree'], name: 'Death Valley & Joshua Tree National Parks' },
  { keys: ['arches', 'canyonlands'], name: 'Arches & Canyonlands National Parks' },
  { keys: ['zion', 'bryce canyon'], name: 'Zion & Bryce Canyon National Parks' },
  { keys: ['glacier', 'waterton'], name: 'Glacier-Waterton International Peace Park' },
  { keys: ['redwood', 'crater lake'], name: 'Redwood & Crater Lake National Parks' },
  { keys: ['olympic', 'mount rainier'], name: 'Olympic & Mount Rainier National Parks' },
  { keys: ['great smoky', 'shenandoah'], name: 'Great Smoky Mountains & Shenandoah National Parks' },
];

/**
 * Extract destination from text using authoritative park data
 * Prioritizes combined parks, then longer matches to avoid "glacier" matching before "kenai fjords"
 */
function extractNationalParkFromText(text: string): string | null {
  const textLower = text.toLowerCase();
  
  // First check for combined park trips (higher priority)
  for (const combo of COMBINED_PARKS) {
    const allKeysPresent = combo.keys.every(key => textLower.includes(key));
    if (allKeysPresent) {
      return combo.name;
    }
  }
  
  // Then check for multiple parks mentioned (build dynamic string)
  const foundParks: string[] = [];
  for (const park of NATIONAL_PARKS_LOOKUP) {
    if (textLower.includes(park.key)) {
      // Avoid adding parks that are substrings of already-found parks
      const alreadyFound = foundParks.some(found => 
        found.toLowerCase().includes(park.key) || park.name.toLowerCase().includes(found.toLowerCase().replace(' national park', ''))
      );
      if (!alreadyFound) {
        foundParks.push(park.name);
      }
      // Limit to 2 parks for display
      if (foundParks.length >= 2) break;
    }
  }
  
  if (foundParks.length === 2) {
    // Build combined name: "Park A & Park B" (remove "National Park" from first)
    const first = foundParks[0].replace(' National Park', '');
    return `${first} & ${foundParks[1]}`;
  }
  
  if (foundParks.length === 1) {
    return foundParks[0];
  }
  
  return null;
}

export interface PhotoReference {
  keyword: string;
  url: string;
  caption?: string;
  source?: 'nps' | 'unsplash' | 'other';
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  lastUserMessage?: string;
  photos?: PhotoReference[];
}

export interface SavedConversation {
  id: string;
  messages: Message[];
  metadata: {
    title?: string;
    description?: string;
    destination?: string;
    travelers?: number;
    departingFrom?: string;
    travelDates?: string;
    duration?: string;
    summary?: string;
    createdAt: string;
    updatedAt: string;
    favorite?: boolean;
    parkMode?: 'national' | 'state';
  };
}

export const useConversations = (nearestAirport?: string, parkMode: 'national' | 'state' = 'national', userState?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Refs for debouncing and preventing race conditions
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  
  // Flag to track if we're loading a conversation (to prevent updatedAt changes on view)
  const isLoadingConversationRef = useRef(false);
  
  // Refs to always have current values in async operations (prevents stale closures)
  const messagesRef = useRef(messages);
  const currentConversationIdRef = useRef(currentConversationId);
  
  // Keep refs in sync with state
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { currentConversationIdRef.current = currentConversationId; }, [currentConversationId]);

  useEffect(() => {
    loadConversations();
  }, []);

  // Debounced auto-save to prevent race conditions
  const debouncedAutoSave = useCallback((skipTimestampUpdate: boolean = false) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (!isSavingRef.current) {
        autoSaveConversation(skipTimestampUpdate);
      }
    }, 500); // 500ms debounce
  }, [nearestAirport, parkMode, userState]);

  useEffect(() => {
    if (messages.length > 0) {
      // Check if we're just loading a conversation (don't update timestamp)
      const skipTimestamp = isLoadingConversationRef.current;
      debouncedAutoSave(skipTimestamp);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, debouncedAutoSave]);

  const loadConversations = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSavedConversations(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const extractMetadata = (msgs: Message[], userState?: string, parkModeOverride?: 'national' | 'state'): SavedConversation['metadata'] => {
    const allText = msgs.map(m => m.content).join(' ');
    const userMessages = msgs.filter(m => m.type === 'user').map(m => m.content.toLowerCase()).join(' ');
    
    // Use the override parkMode if provided (for existing conversations), otherwise use current global parkMode
    const effectiveParkMode = parkModeOverride ?? parkMode;
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // For National Parks: use the existing park extraction logic
    // For State Parks: use simple date-based naming (users expected to edit)
    let destination: string | undefined;
    let title: string | undefined;
    let summary: string | undefined;
    
    if (effectiveParkMode === 'national') {
      // Keep full National Park extraction logic
      destination = extractNationalParkFromText(allText) || undefined;
      
      let travelers: number | undefined;
      const allTextLower = allText.toLowerCase();
      const travelerMatch = allTextLower.match(/(\d+)\s*(people|travelers|persons|adults|of us)/);
      if (travelerMatch) {
        travelers = parseInt(travelerMatch[1]);
      } else if (allTextLower.includes('solo') || allTextLower.includes('just me') || allTextLower.includes('myself')) {
        travelers = 1;
      } else if (allTextLower.includes('couple') || allTextLower.includes('two of us') || allTextLower.includes('my partner')) {
        travelers = 2;
      } else if (allTextLower.includes('family')) {
        travelers = 4;
      }

      let travelDates: string | undefined;
      const monthNamesLower = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const monthMatch = userMessages.match(new RegExp(`(${monthNamesLower.join('|')})\\s*(\\d{1,2})?`, 'i'));
      if (monthMatch) {
        const month = monthMatch[1].charAt(0).toUpperCase() + monthMatch[1].slice(1);
        travelDates = monthMatch[2] ? `${month} ${monthMatch[2]}` : month;
      }

      let duration: string | undefined;
      const durationMatch = userMessages.match(/(\d+)\s*(day|night|week)/i);
      if (durationMatch) {
        const num = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        if (unit === 'week') {
          duration = num === 1 ? '1 week' : `${num} weeks`;
        } else {
          duration = num === 1 ? '1 day' : `${num} days`;
        }
      }

      if (destination) {
        title = destination;
        const parts = [];
        if (duration) parts.push(duration);
        if (travelDates) parts.push(`in ${travelDates}`);
        if (travelers) parts.push(`${travelers} ${travelers === 1 ? 'traveler' : 'travelers'}`);
        summary = parts.length > 0 ? parts.join(' - ') : undefined;
      } else {
        const firstUserMsg = msgs.find(m => m.type === 'user')?.content || '';
        summary = firstUserMsg.length > 60 ? firstUserMsg.substring(0, 57) + '...' : firstUserMsg;
      }

      return {
        title,
        destination,
        travelers,
        departingFrom: nearestAirport,
        travelDates,
        duration,
        summary,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        parkMode: effectiveParkMode,
      };
    } else {
      // State Parks: Extract park name from the first user message for trip title
      const firstUserMsg = msgs.find(m => m.type === 'user')?.content || '';
      
      // Try to extract park name from common patterns in our quick start prompts
      // Patterns: "Plan a camping trip to {PARK_NAME}.", "Find the best day hikes at {PARK_NAME}.", etc.
      const parkNamePatterns = [
        /(?:trip to|getaway to|hikes at|campgrounds at or near)\s+([^.]+?)(?:\s+in\s+[A-Z][a-z]+)?\.?\s*(?:Include|I'm|$)/i,
        /(?:trip to|getaway to|hikes at|campgrounds at)\s+([^.]+?)(?:\s+in\s+[A-Z][a-z]+)?\.?\s*(?:Include|I'm|$)/i,
      ];
      
      // Generic fallback phrases that should NOT be used as trip names
      const genericPhrases = [
        'a nearby state park',
        'a state park',
        'nearby state park',
        'state park near me',
        'a park',
        'nearby park',
      ];
      
      let extractedParkName: string | null = null;
      for (const pattern of parkNamePatterns) {
        const match = firstUserMsg.match(pattern);
        if (match && match[1]) {
          const candidate = match[1].trim().replace(/\s+in\s+[A-Z][a-z]+\s*$/, '').trim();
          // Only use if it's not a generic fallback phrase
          if (!genericPhrases.some(g => candidate.toLowerCase() === g.toLowerCase())) {
            extractedParkName = candidate;
          }
          break;
        }
      }
      
      // Only set title from park name if we found a real park name
      // Otherwise scan AI responses for location mentions
      if (extractedParkName && extractedParkName.length > 3) {
        title = extractedParkName;
      } else {
        // Scan assistant messages for specific location mentions
        // Look for patterns like "**Park Name State Park**" or "I recommend Park Name"
        const assistantMsgs = msgs.filter(m => m.type === 'assistant');
        let foundLocation: string | null = null;
        
        for (const msg of assistantMsgs) {
          // Pattern 1: Bold park names like **Devil's Lake State Park**
          const boldParkMatch = msg.content.match(/\*\*([^*]+(?:State Park|State Forest|State Recreation Area|State Natural Area|County Park|Regional Park|State Trail|National Forest))\*\*/i);
          if (boldParkMatch) {
            foundLocation = boldParkMatch[1].trim();
            break;
          }
          
          // Pattern 2: "I recommend [Park Name]" or "Let's explore [Park Name]"
          const recommendMatch = msg.content.match(/(?:I recommend|Let's explore|Let me tell you about|heading to|visit)\s+(?:\*\*)?([A-Z][^.,!?*]+(?:State Park|State Forest|Recreation Area|County Park|Trail))(?:\*\*)?/i);
          if (recommendMatch) {
            foundLocation = recommendMatch[1].trim();
            break;
          }
          
          // Pattern 3: Campground names like "**Campground Name Campground**"
          const campgroundMatch = msg.content.match(/\*\*([^*]+Campground)\*\*/i);
          if (campgroundMatch && !foundLocation) {
            foundLocation = campgroundMatch[1].trim();
            break;
          }
        }
        
        if (foundLocation && foundLocation.length > 3) {
          title = foundLocation;
          extractedParkName = foundLocation;
        } else {
          title = `New Trip - ${monthNames[now.getMonth()]} ${now.getDate()}`;
        }
      }
      
      summary = firstUserMsg.length > 60 ? firstUserMsg.substring(0, 57) + '...' : firstUserMsg;

      return {
        title,
        destination: extractedParkName || undefined,
        summary,
        departingFrom: nearestAirport,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        parkMode: effectiveParkMode,
      };
    }
  };

  const autoSaveConversation = async (skipTimestampUpdate: boolean = false) => {
    // Use refs to get current values (prevents stale closure issues)
    const currentMessages = messagesRef.current;
    const currentId = currentConversationIdRef.current;
    
    if (currentMessages.length === 0) return;
    
    // Mutex lock to prevent concurrent saves
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      let conversations: SavedConversation[] = saved ? JSON.parse(saved) : [];

      // Deep clone messages to prevent mutation bugs
      const clonedMessages = JSON.parse(JSON.stringify(currentMessages));

      if (currentId) {
        const index = conversations.findIndex(c => c.id === currentId);
        if (index >= 0) {
          // Update existing conversation
          // Use the stored parkMode from the conversation to preserve correct title extraction
          const storedParkMode = conversations[index].metadata.parkMode;
          const metadata = extractMetadata(currentMessages, userState, storedParkMode);
          
          // Only update timestamp if this is a real user interaction, not just viewing
          // Preserve original createdAt and conditionally preserve updatedAt
          const originalCreatedAt = conversations[index].metadata.createdAt;
          const originalUpdatedAt = conversations[index].metadata.updatedAt;
          const updatedMetadata = {
            ...conversations[index].metadata,
            ...metadata,
            createdAt: originalCreatedAt, // Always preserve original createdAt
            updatedAt: skipTimestampUpdate ? originalUpdatedAt : new Date().toISOString(),
          };
          conversations[index] = {
            ...conversations[index],
            messages: clonedMessages,
            metadata: updatedMetadata,
          };
        } else {
          // ID exists but conversation not in list - add it (ensureConversationId case)
          const metadata = extractMetadata(currentMessages, userState);
          conversations.unshift({
            id: currentId,
            messages: clonedMessages,
            metadata,
          });
        }
      } else {
        // No ID yet - generate one and add conversation
        const metadata = extractMetadata(currentMessages, userState);
        const newId = Date.now().toString();
        setCurrentConversationId(newId);
        currentConversationIdRef.current = newId;
        conversations.unshift({
          id: newId,
          messages: clonedMessages,
          metadata,
        });
      }

      conversations = conversations.slice(0, MAX_CONVERSATIONS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      setSavedConversations(conversations);
    } catch (error) {
      console.error('Failed to auto-save:', error);
    } finally {
      isSavingRef.current = false;
    }
  };

  const loadConversation = (conversation: SavedConversation) => {
    // Set flag to prevent auto-save from updating updatedAt when just viewing
    isLoadingConversationRef.current = true;
    
    // Clear any pending save timeout to prevent stale saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    // Deep clone to prevent mutation of stored conversation
    const clonedMessages: Message[] = JSON.parse(JSON.stringify(conversation.messages));
    setMessages(clonedMessages);
    setCurrentConversationId(conversation.id);
    
    // Reset flag after a longer delay to ensure the debounced save completes with skipTimestamp=true
    setTimeout(() => {
      isLoadingConversationRef.current = false;
    }, 1200); // Much longer than the 500ms debounce + save time
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  /**
   * Ensures the current conversation has an ID.
   * If null, generates and sets one immediately.
   * Returns the guaranteed non-null conversation ID.
   * CRITICAL: Call this before sending a message to prevent race conditions
   * when user switches conversations while requests are in-flight.
   */
  const ensureConversationId = (): string => {
    if (currentConversationIdRef.current) {
      return currentConversationIdRef.current;
    }
    const newId = Date.now().toString();
    setCurrentConversationId(newId);
    currentConversationIdRef.current = newId;
    return newId;
  };

  const deleteConversation = async (id: string) => {
    try {
      const updated = savedConversations.filter(c => c.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedConversations(updated);
      if (currentConversationId === id) {
        setMessages([]);
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const updateConversation = async (id: string, updates: { title?: string; description?: string }) => {
    try {
      const updated = savedConversations.map(c => {
        if (c.id === id) {
          return {
            ...c,
            metadata: {
              ...c.metadata,
              ...updates,
              updatedAt: new Date().toISOString(),
            },
          };
        }
        return c;
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedConversations(updated);
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  };

  const addMessage = (message: Message) => {
    setMessages(prev => [...prev, message]);
  };

  /**
   * Add messages to a specific conversation by ID
   * Used by the conversation queue to route responses to the correct conversation
   * If conversationId matches current, updates live state. Otherwise updates storage.
   */
  const addMessagesToConversation = async (
    conversationId: string | null,
    newMessages: Message[]
  ): Promise<string> => {
    // If this is for the current conversation, update live state
    if (conversationId === currentConversationIdRef.current) {
      setMessages(prev => [...prev, ...newMessages]);
      return conversationId || '';
    }
    
    // Otherwise, update the saved conversation in storage
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      let conversations: SavedConversation[] = saved ? JSON.parse(saved) : [];
      
      if (conversationId) {
        // Find and update existing conversation
        const index = conversations.findIndex(c => c.id === conversationId);
        if (index >= 0) {
          conversations[index].messages = [...conversations[index].messages, ...newMessages];
          conversations[index].metadata.updatedAt = new Date().toISOString();
        }
      } else {
        // Create new conversation for null ID case
        const newId = Date.now().toString();
        const metadata = extractMetadata(newMessages, userState);
        conversations.unshift({
          id: newId,
          messages: newMessages,
          metadata,
        });
        conversations = conversations.slice(0, MAX_CONVERSATIONS);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
        setSavedConversations(conversations);
        return newId;
      }
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      setSavedConversations(conversations);
      return conversationId || '';
    } catch (error) {
      console.error('Failed to add messages to conversation:', error);
      return '';
    }
  };

  const toggleFavorite = async (id: string) => {
    try {
      const updated = savedConversations.map(c => {
        if (c.id === id) {
          return {
            ...c,
            metadata: {
              ...c.metadata,
              favorite: !c.metadata.favorite,
            },
          };
        }
        return c;
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSavedConversations(updated);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  // Filter conversations by current parkMode (legacy conversations without parkMode show in national)
  const filteredConversations = savedConversations.filter(c => 
    (c.metadata.parkMode || 'national') === parkMode
  );

  return {
    messages,
    setMessages,
    savedConversations,
    filteredConversations,
    currentConversationId,
    loadConversation,
    startNewConversation,
    deleteConversation,
    updateConversation,
    toggleFavorite,
    addMessage,
    addMessagesToConversation,
    ensureConversationId,
  };
};
