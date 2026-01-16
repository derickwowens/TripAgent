/**
 * Type definitions for the chat module
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PhotoReference {
  keyword: string;
  url: string;
  caption?: string;
  confidence?: number;
  source?: 'nps' | 'unsplash' | 'other';
}

export interface ChatContext {
  userLocation?: {
    city: string;
    state: string;
    nearestAirport: string;
  };
  tripContext?: {
    destination?: string;
    parkCode?: string;
    numDays?: number;
    numTravelers?: number;
  };
  userProfile?: string;
}

export interface ChatResponse {
  response: string;
  photos?: PhotoReference[];
}

export interface ToolResult {
  result: any;
  photos?: PhotoReference[];
  destination?: string;
  searchQuery?: string;
}
