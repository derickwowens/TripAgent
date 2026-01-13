import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'travel_conversations';
const MAX_CONVERSATIONS = 20;

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  lastUserMessage?: string; // For retry functionality
}

export interface SavedConversation {
  id: string;
  messages: Message[];
  metadata: {
    destination?: string;
    travelers?: number;
    departingFrom?: string;
    createdAt: string;
    updatedAt: string;
  };
}

const PARK_NAMES = ['yosemite', 'yellowstone', 'grand canyon', 'zion', 'glacier', 'acadia', 'rocky mountain', 'joshua tree', 'sequoia', 'death valley'];

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
    
    let destination: string | undefined;
    for (const park of PARK_NAMES) {
      if (allText.includes(park)) {
        destination = park.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    let travelers: number | undefined;
    const travelerMatch = allText.match(/(\d+)\s*(people|travelers|persons|adults)/);
    if (travelerMatch) {
      travelers = parseInt(travelerMatch[1]);
    } else if (allText.includes('solo') || allText.includes('just me')) {
      travelers = 1;
    } else if (allText.includes('couple')) {
      travelers = 2;
    }

    return {
      destination,
      travelers,
      departingFrom: nearestAirport,
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
    addMessage,
  };
};
