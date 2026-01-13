import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'travel_conversations';
const MAX_CONVERSATIONS = 20;

export interface PhotoReference {
  keyword: string;
  url: string;
  caption?: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  lastUserMessage?: string; // For retry functionality
  photos?: PhotoReference[]; // Photos associated with this message
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
  };
}

const PARK_NAMES = ['yosemite', 'yellowstone', 'grand canyon', 'zion', 'glacier', 'acadia', 'rocky mountain', 'joshua tree', 'sequoia', 'death valley', 'olympic', 'arches', 'bryce canyon', 'everglades', 'great smoky', 'mount rainier', 'shenandoah', 'big bend', 'badlands', 'carlsbad', 'crater lake', 'denali', 'hot springs', 'mammoth cave', 'mesa verde', 'petrified forest', 'redwood', 'saguaro', 'theodore roosevelt', 'voyageurs', 'wind cave'];

export const useConversations = (nearestAirport?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      autoSaveConversation();
    }
  }, [messages]);

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
    const allText = msgs.map(m => m.content.toLowerCase()).join(' ');
    const userMessages = msgs.filter(m => m.type === 'user').map(m => m.content.toLowerCase()).join(' ');
    const assistantMessages = msgs.filter(m => m.type === 'assistant').map(m => m.content).join(' ');
    
    let destination: string | undefined;
    for (const park of PARK_NAMES) {
      if (allText.includes(park)) {
        destination = park.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    let travelers: number | undefined;
    const travelerMatch = allText.match(/(\d+)\s*(people|travelers|persons|adults|of us)/);
    if (travelerMatch) {
      travelers = parseInt(travelerMatch[1]);
    } else if (allText.includes('solo') || allText.includes('just me') || allText.includes('myself')) {
      travelers = 1;
    } else if (allText.includes('couple') || allText.includes('two of us') || allText.includes('my partner')) {
      travelers = 2;
    } else if (allText.includes('family')) {
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
    if (messages.length === 0) return;

    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      let conversations: SavedConversation[] = saved ? JSON.parse(saved) : [];

      const metadata = extractMetadata(messages);

      if (currentConversationId) {
        const index = conversations.findIndex(c => c.id === currentConversationId);
        if (index >= 0) {
          conversations[index] = {
            ...conversations[index],
            messages,
            metadata: { ...conversations[index].metadata, ...metadata, updatedAt: new Date().toISOString() },
          };
        }
      } else {
        const newId = Date.now().toString();
        setCurrentConversationId(newId);
        conversations.unshift({
          id: newId,
          messages,
          metadata,
        });
      }

      conversations = conversations.slice(0, MAX_CONVERSATIONS);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      setSavedConversations(conversations);
    } catch (error) {
      console.error('Failed to auto-save:', error);
    }
  };

  const loadConversation = (conversation: SavedConversation) => {
    setMessages(conversation.messages);
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

  return {
    messages,
    setMessages,
    savedConversations,
    currentConversationId,
    loadConversation,
    startNewConversation,
    deleteConversation,
    updateConversation,
    addMessage,
  };
};
