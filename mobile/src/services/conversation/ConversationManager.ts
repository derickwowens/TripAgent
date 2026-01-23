/**
 * ConversationManager - Central orchestrator for conversation operations
 * 
 * Responsibilities:
 * - Coordinate between RequestQueue and ResponseQueue
 * - Manage active conversation focus
 * - Provide unified API for conversation operations
 * - Notify subscribers of state changes
 */

import { getRequestQueue, RequestQueue } from './RequestQueue';
import { getResponseQueue, ResponseQueue, ResponseProcessor } from './ResponseQueue';
import {
  Message,
  Conversation,
  ConversationMetadata,
  RequestContext,
  ApiMessage,
  QueuedResponse,
  ConversationManagerState,
  StateChangeCallback,
  EventCallback,
  ConversationEvent,
  ConversationLoadingState,
} from './types';

export interface ConversationStorage {
  loadConversations(): Promise<Conversation[]>;
  saveConversation(conversation: Conversation): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  addMessagesToConversation(conversationId: string | null, messages: Message[]): Promise<string>;
}

export interface CacheUpdater {
  updateFromResponse(conversationId: string | null, response: QueuedResponse): Promise<void>;
}

export class ConversationManager {
  private requestQueue: RequestQueue;
  private responseQueue: ResponseQueue;
  private storage: ConversationStorage | null = null;
  private cacheUpdater: CacheUpdater | null = null;
  
  private activeConversationId: string | null = null;
  private conversations: Map<string, Conversation> = new Map();
  private loadingStates: Map<string | null, ConversationLoadingState> = new Map();
  
  private stateCallbacks: Set<StateChangeCallback> = new Set();
  private eventCallbacks: Set<EventCallback> = new Set();

  constructor(model?: string) {
    this.requestQueue = getRequestQueue(model);
    this.responseQueue = getResponseQueue();
    
    // Set up response processor
    this.responseQueue.setProcessor({
      onMessageCreated: this.handleMessagesCreated.bind(this),
      onCacheUpdate: this.handleCacheUpdate.bind(this),
    });

    // Subscribe to queue events
    this.requestQueue.subscribe(this.handleQueueEvent.bind(this));
    this.responseQueue.subscribe(this.handleQueueEvent.bind(this));
  }

  /**
   * Set the storage adapter
   */
  setStorage(storage: ConversationStorage): void {
    this.storage = storage;
  }

  /**
   * Set the cache updater
   */
  setCacheUpdater(updater: CacheUpdater): void {
    this.cacheUpdater = updater;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents(callback: EventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  private notifyStateChange(): void {
    const state = this.getState();
    this.stateCallbacks.forEach(cb => cb(state));
  }

  private handleQueueEvent(event: ConversationEvent): void {
    // Update loading states from queue events
    if (event.type === 'LOADING_CHANGED') {
      if (event.loading.isLoading) {
        this.loadingStates.set(event.conversationId, event.loading);
      } else {
        this.loadingStates.delete(event.conversationId);
      }
      this.notifyStateChange();
    }

    // Forward events to subscribers
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Get current state
   */
  getState(): ConversationManagerState {
    return {
      activeConversationId: this.activeConversationId,
      conversations: new Map(this.conversations),
      loadingStates: new Map(this.loadingStates),
      hasPendingRequests: this.requestQueue.getPendingConversationIds().length > 0,
    };
  }

  /**
   * Get active conversation ID
   */
  getActiveConversationId(): string | null {
    return this.activeConversationId;
  }

  /**
   * Get loading state for a conversation
   */
  getLoadingState(conversationId: string | null): ConversationLoadingState {
    return this.loadingStates.get(conversationId) || { isLoading: false, status: '' };
  }

  /**
   * Switch to a different conversation
   */
  switchConversation(conversationId: string | null): void {
    this.activeConversationId = conversationId;
    
    this.eventCallbacks.forEach(cb => cb({
      type: 'CONVERSATION_SWITCHED',
      conversationId,
    }));
    
    this.notifyStateChange();
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string | null,
    content: string,
    context: RequestContext,
    existingMessages: Message[] = []
  ): Promise<QueuedResponse> {
    // Create user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Add user message immediately
    await this.handleMessagesCreated(conversationId, [userMessage]);

    // Build API messages from history
    const apiMessages: ApiMessage[] = [
      ...existingMessages.map(m => ({
        role: m.type === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      { role: 'user' as const, content: content.trim() },
    ];

    try {
      // Enqueue the request
      const response = await this.requestQueue.enqueue({
        conversationId,
        messages: apiMessages,
        context,
        onStatus: (status) => {
          // Status updates are handled via events
        },
      });

      // Process the response through the queue
      if (!response.error) {
        await this.responseQueue.enqueue(response);
      } else {
        // Handle error response
        await this.responseQueue.enqueue(response);
      }

      return response;
    } catch (error: any) {
      // Handle abort errors silently
      if (error?.name === 'AbortError') {
        throw error;
      }

      // Create error response
      const errorResponse: QueuedResponse = {
        conversationId,
        response: '',
        error: error?.message || 'Unknown error',
      };

      await this.responseQueue.enqueue(errorResponse);
      return errorResponse;
    }
  }

  /**
   * Abort a conversation's pending request
   */
  abortRequest(conversationId: string | null): boolean {
    return this.requestQueue.abort(conversationId);
  }

  /**
   * Abort all pending requests
   */
  abortAllRequests(): void {
    this.requestQueue.abortAll();
  }

  /**
   * Check if a conversation has a pending request
   */
  hasPendingRequest(conversationId: string | null): boolean {
    return this.requestQueue.hasPendingRequest(conversationId);
  }

  /**
   * Handle messages created (called by ResponseQueue)
   */
  private async handleMessagesCreated(
    conversationId: string | null,
    messages: Message[]
  ): Promise<void> {
    if (this.storage) {
      await this.storage.addMessagesToConversation(conversationId, messages);
    }

    // Emit events
    messages.forEach(message => {
      this.eventCallbacks.forEach(cb => cb({
        type: 'MESSAGE_ADDED',
        conversationId,
        message,
      }));
    });

    this.notifyStateChange();
  }

  /**
   * Handle cache update (called by ResponseQueue)
   */
  private async handleCacheUpdate(
    conversationId: string | null,
    response: QueuedResponse
  ): Promise<void> {
    if (this.cacheUpdater) {
      await this.cacheUpdater.updateFromResponse(conversationId, response);
    }
  }

  /**
   * Load conversations from storage
   */
  async loadFromStorage(): Promise<void> {
    if (!this.storage) return;

    const conversations = await this.storage.loadConversations();
    this.conversations.clear();
    conversations.forEach(conv => {
      this.conversations.set(conv.id, conv);
    });

    this.notifyStateChange();
  }
}

// Singleton instance
let managerInstance: ConversationManager | null = null;

export function getConversationManager(model?: string): ConversationManager {
  if (!managerInstance) {
    managerInstance = new ConversationManager(model);
  }
  return managerInstance;
}

export function resetConversationManager(): void {
  if (managerInstance) {
    managerInstance.abortAllRequests();
  }
  managerInstance = null;
}
