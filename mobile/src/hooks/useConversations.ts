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
 * Extract destination from text using authoritative park data
 * Prioritizes longer matches to avoid "glacier" matching before "kenai fjords"
 */
function extractDestinationFromText(text: string): string | null {
  const textLower = text.toLowerCase();
  
  // NATIONAL_PARKS_LOOKUP is already sorted by key length (longest first)
  for (const park of NATIONAL_PARKS_LOOKUP) {
    if (textLower.includes(park.key)) {
      return park.name;
    }
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
  };
}

export const useConversations = (nearestAirport?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Refs for debouncing and preventing race conditions
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  
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
  const debouncedAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      if (!isSavingRef.current) {
        autoSaveConversation();
      }
    }, 500); // 500ms debounce
  }, [nearestAirport]);

  useEffect(() => {
    if (messages.length > 0) {
      debouncedAutoSave();
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

  const extractMetadata = (msgs: Message[]): SavedConversation['metadata'] => {
    const allText = msgs.map(m => m.content).join(' ');
    const userMessages = msgs.filter(m => m.type === 'user').map(m => m.content.toLowerCase()).join(' ');
    const assistantMessages = msgs.filter(m => m.type === 'assistant').map(m => m.content).join(' ');
    
    // Use authoritative park data with priority for longer/more specific matches
    const destination = extractDestinationFromText(allText) || undefined;

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
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthMatch = userMessages.match(new RegExp(`(${monthNames.join('|')})\\s*(\\d{1,2})?`, 'i'));
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

    let summary: string | undefined;
    if (destination) {
      const parts = [];
      if (duration) parts.push(duration);
      if (travelDates) parts.push(`in ${travelDates}`);
      if (travelers) parts.push(`${travelers} ${travelers === 1 ? 'traveler' : 'travelers'}`);
      summary = parts.length > 0 ? parts.join(' • ') : undefined;
    } else {
      const firstUserMsg = msgs.find(m => m.type === 'user')?.content || '';
      summary = firstUserMsg.length > 60 ? firstUserMsg.substring(0, 57) + '...' : firstUserMsg;
    }

    return {
      destination,
      travelers,
      departingFrom: nearestAirport,
      travelDates,
      duration,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const autoSaveConversation = async () => {
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

      const metadata = extractMetadata(currentMessages);
      
      // Deep clone messages to prevent mutation bugs
      const clonedMessages = JSON.parse(JSON.stringify(currentMessages));

      if (currentId) {
        const index = conversations.findIndex(c => c.id === currentId);
        if (index >= 0) {
          conversations[index] = {
            ...conversations[index],
            messages: clonedMessages,
            metadata: { ...conversations[index].metadata, ...metadata, updatedAt: new Date().toISOString() },
          };
        }
      } else {
        const newId = Date.now().toString();
        setCurrentConversationId(newId);
        currentConversationIdRef.current = newId; // Update ref immediately
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
    // Deep clone to prevent mutation of stored conversation
    const clonedMessages: Message[] = JSON.parse(JSON.stringify(conversation.messages));
    setMessages(clonedMessages);
    setCurrentConversationId(conversation.id);
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
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
        const metadata = extractMetadata(newMessages);
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

  return {
    messages,
    setMessages,
    savedConversations,
    currentConversationId,
    loadConversation,
    startNewConversation,
    deleteConversation,
    updateConversation,
    toggleFavorite,
    addMessage,
    addMessagesToConversation,
  };
};
