/**
 * ResponseQueue - Handles incoming API responses
 * 
 * Responsibilities:
 * - Buffer responses with their conversation ID
 * - Process responses in order
 * - Route to correct conversation
 * - Trigger cache updates via callbacks
 */

import { 
  QueuedResponse, 
  Message,
  EventCallback,
  ConversationEvent 
} from './types';

export interface ResponseProcessor {
  onMessageCreated: (conversationId: string | null, messages: Message[]) => Promise<void>;
  onCacheUpdate?: (conversationId: string | null, response: QueuedResponse) => Promise<void>;
}

export class ResponseQueue {
  private queue: QueuedResponse[] = [];
  private processing: boolean = false;
  private processor: ResponseProcessor | null = null;
  private eventCallbacks: Set<EventCallback> = new Set();

  /**
   * Set the response processor
   */
  setProcessor(processor: ResponseProcessor): void {
    this.processor = processor;
  }

  /**
   * Subscribe to response events
   */
  subscribe(callback: EventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  private emit(event: ConversationEvent): void {
    this.eventCallbacks.forEach(cb => cb(event));
  }

  /**
   * Enqueue a response for processing
   */
  async enqueue(response: QueuedResponse): Promise<void> {
    this.queue.push(response);
    await this.processQueue();
  }

  /**
   * Process queued responses in order
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const response = this.queue.shift();
      if (response) {
        await this.processResponse(response);
      }
    }

    this.processing = false;
  }

  /**
   * Process a single response
   */
  private async processResponse(response: QueuedResponse): Promise<void> {
    const { conversationId, error } = response;

    // Handle error responses
    if (error) {
      const errorMessage = this.createErrorMessage(error, '');
      
      if (this.processor) {
        await this.processor.onMessageCreated(conversationId, [errorMessage]);
      }
      
      this.emit({
        type: 'MESSAGE_ADDED',
        conversationId,
        message: errorMessage
      });
      
      return;
    }

    // Create assistant messages from response
    const messages = this.createAssistantMessages(response);

    // Route to processor
    if (this.processor) {
      await this.processor.onMessageCreated(conversationId, messages);
      
      // Trigger cache update
      if (this.processor.onCacheUpdate) {
        await this.processor.onCacheUpdate(conversationId, response);
      }
    }

    // Emit events for each message
    messages.forEach(message => {
      this.emit({
        type: 'MESSAGE_ADDED',
        conversationId,
        message
      });
    });
  }

  /**
   * Create assistant messages from API response
   */
  private createAssistantMessages(response: QueuedResponse): Message[] {
    const { segments, photos } = response;

    // If segments provided, create multiple messages
    if (segments && segments.length > 1) {
      return segments.map((segment, index) => ({
        id: (Date.now() + index + 1).toString(),
        type: 'assistant' as const,
        content: segment,
        timestamp: new Date(),
        // Only attach photos to the last segment
        photos: index === segments.length - 1 ? photos : undefined,
      }));
    }

    // Single message
    return [{
      id: (Date.now() + 1).toString(),
      type: 'assistant' as const,
      content: response.response,
      timestamp: new Date(),
      photos,
    }];
  }

  /**
   * Create an error message
   */
  private createErrorMessage(error: string, lastUserMessage: string): Message {
    // Generate user-friendly error message
    let userFriendlyMessage = "😕 Something went wrong. Please try again.";
    
    if (error.includes('500') || error.includes('server')) {
      userFriendlyMessage = "I'm having trouble processing that request right now. Try being more specific.";
    } else if (error.includes('503')) {
      userFriendlyMessage = "I'm temporarily unavailable. This usually resolves in a minute or two.";
    } else if (error.includes('429')) {
      userFriendlyMessage = "Let's slow down a bit! Wait a moment and then tap retry.";
    } else if (error.includes('Network') || error.includes('network')) {
      userFriendlyMessage = "I can't reach the server right now. Check your internet connection.";
    }

    return {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: userFriendlyMessage,
      timestamp: new Date(),
      isError: true,
      lastUserMessage,
    };
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Check if currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = [];
  }
}

// Singleton instance
let responseQueueInstance: ResponseQueue | null = null;

export function getResponseQueue(): ResponseQueue {
  if (!responseQueueInstance) {
    responseQueueInstance = new ResponseQueue();
  }
  return responseQueueInstance;
}

export function resetResponseQueue(): void {
  if (responseQueueInstance) {
    responseQueueInstance.clear();
  }
  responseQueueInstance = null;
}
