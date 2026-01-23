/**
 * Conversation Management Module
 * 
 * Provides a modular, deterministic system for managing multiple concurrent conversations.
 * Users can have multiple trips being planned simultaneously.
 */

// Types
export type {
  Message,
  ConversationMetadata,
  Conversation,
  ConversationLoadingState,
  PendingRequest,
  QueuedRequest,
  QueuedResponse,
  ApiMessage,
  RequestContext,
  ConversationManagerState,
  StateChangeCallback,
  EventCallback,
  ConversationEvent,
} from './types';

// RequestQueue
export { 
  RequestQueue, 
  getRequestQueue, 
  resetRequestQueue 
} from './RequestQueue';

// ResponseQueue
export { 
  ResponseQueue, 
  getResponseQueue, 
  resetResponseQueue,
} from './ResponseQueue';
export type { ResponseProcessor } from './ResponseQueue';

// ConversationManager
export { 
  ConversationManager, 
  getConversationManager, 
  resetConversationManager 
} from './ConversationManager';
export type { ConversationStorage, CacheUpdater } from './ConversationManager';
