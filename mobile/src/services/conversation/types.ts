/**
 * Conversation Management Types
 * Shared types for the modular conversation system
 */

import { PhotoReference } from '../../hooks/useConversations';

// Message types
export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  lastUserMessage?: string;
  photos?: PhotoReference[];
}

// Conversation metadata
export interface ConversationMetadata {
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
}

// Full conversation object
export interface Conversation {
  id: string;
  messages: Message[];
  metadata: ConversationMetadata;
}

// Loading state per conversation
export interface ConversationLoadingState {
  isLoading: boolean;
  status: string;
}

// Pending request tracking
export interface PendingRequest {
  conversationId: string | null;
  abortController: AbortController;
  startedAt: number;
  status: string;
}

// Request to be queued
export interface QueuedRequest {
  conversationId: string | null;
  messages: ApiMessage[];
  context: RequestContext;
  onStatus?: (status: string) => void;
}

// API message format
export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Request context
export interface RequestContext {
  userLocation?: {
    city: string;
    state: string;
    nearestAirport: string;
  };
  userProfile?: string;
  tripContext?: {
    destination?: string;
    parkCode?: string;
    parkName?: string;
  };
  npsGatewayCity?: {
    city: string;
    state: string;
    parkCode?: string;
    parkName?: string;
  };
}

// Response from API
export interface QueuedResponse {
  conversationId: string | null;
  response: string;
  photos?: PhotoReference[];
  segments?: string[];
  error?: string;
}

// Subscriber callback type
export type StateChangeCallback = (state: ConversationManagerState) => void;

// Manager state exposed to subscribers
export interface ConversationManagerState {
  activeConversationId: string | null;
  conversations: Map<string, Conversation>;
  loadingStates: Map<string | null, ConversationLoadingState>;
  hasPendingRequests: boolean;
}

// Event types for pub/sub
export type ConversationEvent = 
  | { type: 'MESSAGE_ADDED'; conversationId: string | null; message: Message }
  | { type: 'LOADING_CHANGED'; conversationId: string | null; loading: ConversationLoadingState }
  | { type: 'CONVERSATION_SWITCHED'; conversationId: string | null }
  | { type: 'RESPONSE_RECEIVED'; conversationId: string | null; response: QueuedResponse };

export type EventCallback = (event: ConversationEvent) => void;
