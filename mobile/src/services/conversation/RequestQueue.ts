/**
 * RequestQueue - Manages outgoing API requests
 * 
 * Responsibilities:
 * - Track pending requests by conversation ID
 * - Provide AbortController per request
 * - Emit status updates
 * - Ensure one request per conversation at a time
 */

import { sendChatMessageWithStream, ChatMessage, ChatContext } from '../api';
import { 
  PendingRequest, 
  QueuedRequest, 
  QueuedResponse,
  EventCallback,
  ConversationEvent 
} from './types';

export class RequestQueue {
  private pendingRequests: Map<string | null, PendingRequest> = new Map();
  private eventCallbacks: Set<EventCallback> = new Set();
  private model: string;

  constructor(model: string = 'claude-3-5-haiku-20241022') {
    this.model = model;
  }

  /**
   * Subscribe to request events
   */
  subscribe(callback: EventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  private emit(event: ConversationEvent): void {
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Check if a conversation has a pending request
   */
  hasPendingRequest(conversationId: string | null): boolean {
    return this.pendingRequests.has(conversationId);
  }

  /**
   * Get pending request for a conversation
   */
  getPendingRequest(conversationId: string | null): PendingRequest | undefined {
    return this.pendingRequests.get(conversationId);
  }

  /**
   * Get all pending request conversation IDs
   */
  getPendingConversationIds(): Array<string | null> {
    return Array.from(this.pendingRequests.keys());
  }

  /**
   * Abort a specific conversation's request
   */
  abort(conversationId: string | null): boolean {
    const request = this.pendingRequests.get(conversationId);
    if (request) {
      request.abortController.abort();
      this.pendingRequests.delete(conversationId);
      this.emit({
        type: 'LOADING_CHANGED',
        conversationId,
        loading: { isLoading: false, status: '' }
      });
      return true;
    }
    return false;
  }

  /**
   * Abort all pending requests
   */
  abortAll(): void {
    this.pendingRequests.forEach((request, conversationId) => {
      request.abortController.abort();
      this.emit({
        type: 'LOADING_CHANGED',
        conversationId,
        loading: { isLoading: false, status: '' }
      });
    });
    this.pendingRequests.clear();
  }

  /**
   * Enqueue and execute a request
   * Returns the response or throws on error
   */
  async enqueue(request: QueuedRequest): Promise<QueuedResponse> {
    const { conversationId, messages, context, onStatus } = request;

    // Abort any existing request for this conversation
    this.abort(conversationId);

    // Create new abort controller
    const abortController = new AbortController();
    
    // Track the pending request
    const pendingRequest: PendingRequest = {
      conversationId,
      abortController,
      startedAt: Date.now(),
      status: 'Thinking...'
    };
    this.pendingRequests.set(conversationId, pendingRequest);

    // Emit loading started
    this.emit({
      type: 'LOADING_CHANGED',
      conversationId,
      loading: { isLoading: true, status: 'Thinking...' }
    });

    try {
      // Convert to API format
      const apiMessages: ChatMessage[] = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const apiContext: ChatContext = {
        userLocation: context.userLocation,
        userProfile: context.userProfile,
        tripContext: context.tripContext,
        npsGatewayCity: context.npsGatewayCity,
      };

      // Make the API call with status updates
      const response = await sendChatMessageWithStream(
        apiMessages,
        apiContext,
        this.model,
        (status) => {
          // Update pending request status
          const req = this.pendingRequests.get(conversationId);
          if (req) {
            req.status = status;
          }
          
          // Emit status change
          this.emit({
            type: 'LOADING_CHANGED',
            conversationId,
            loading: { isLoading: true, status }
          });
          
          // Call optional callback
          onStatus?.(status);
        },
        abortController.signal
      );

      // Remove from pending
      this.pendingRequests.delete(conversationId);

      // Emit loading complete
      this.emit({
        type: 'LOADING_CHANGED',
        conversationId,
        loading: { isLoading: false, status: '' }
      });

      // Return queued response
      const queuedResponse: QueuedResponse = {
        conversationId,
        response: response.response,
        photos: response.photos,
        segments: response.segments
      };

      this.emit({
        type: 'RESPONSE_RECEIVED',
        conversationId,
        response: queuedResponse
      });

      return queuedResponse;

    } catch (error: any) {
      // Remove from pending
      this.pendingRequests.delete(conversationId);

      // Emit loading complete
      this.emit({
        type: 'LOADING_CHANGED',
        conversationId,
        loading: { isLoading: false, status: '' }
      });

      // Handle abort errors
      if (error?.name === 'AbortError') {
        throw error;
      }

      // Return error response
      const errorResponse: QueuedResponse = {
        conversationId,
        response: '',
        error: error?.message || 'Unknown error'
      };

      return errorResponse;
    }
  }

  /**
   * Get current loading status for a conversation
   */
  getLoadingStatus(conversationId: string | null): { isLoading: boolean; status: string } {
    const request = this.pendingRequests.get(conversationId);
    if (request) {
      return { isLoading: true, status: request.status };
    }
    return { isLoading: false, status: '' };
  }
}

// Singleton instance
let requestQueueInstance: RequestQueue | null = null;

export function getRequestQueue(model?: string): RequestQueue {
  if (!requestQueueInstance) {
    requestQueueInstance = new RequestQueue(model);
  }
  return requestQueueInstance;
}

export function resetRequestQueue(): void {
  if (requestQueueInstance) {
    requestQueueInstance.abortAll();
  }
  requestQueueInstance = null;
}
