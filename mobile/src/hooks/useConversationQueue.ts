/**
 * Conversation Queue - Manages per-conversation request state
 * Allows multiple conversations to have in-flight requests simultaneously
 * Responses are routed to the correct conversation regardless of which is active
 */

import { useState, useRef, useCallback } from 'react';
import { sendChatMessageWithStream, ChatMessage, ChatContext, PhotoReference } from '../services/api';

export interface ConversationRequest {
  conversationId: string | null; // null for new conversations
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  loadingMessage: string;
  abortController: AbortController;
}

export interface ConversationResponse {
  conversationId: string | null;
  response: string;
  photos?: PhotoReference[];
  segments?: string[];
  error?: string;
}

interface UseConversationQueueOptions {
  onResponse: (conversationId: string | null, response: ConversationResponse) => void;
  onLoadingChange: (conversationId: string | null, isLoading: boolean, status: string) => void;
}

export const useConversationQueue = (options: UseConversationQueueOptions) => {
  // Track active requests by conversation ID (null key for new conversations)
  const activeRequestsRef = useRef<Map<string | null, ConversationRequest>>(new Map());
  
  // Track loading state for UI updates
  const [loadingConversations, setLoadingConversations] = useState<Set<string | null>>(new Set());

  const updateLoadingState = useCallback((conversationId: string | null, isLoading: boolean) => {
    setLoadingConversations(prev => {
      const next = new Set(prev);
      if (isLoading) {
        next.add(conversationId);
      } else {
        next.delete(conversationId);
      }
      return next;
    });
  }, []);

  const sendRequest = useCallback(async (
    conversationId: string | null,
    messages: ChatMessage[],
    context: ChatContext,
    model: string
  ): Promise<ConversationResponse> => {
    // Create abort controller for this specific request
    const abortController = new AbortController();
    
    // Track this request
    const request: ConversationRequest = {
      conversationId,
      status: 'in_progress',
      loadingMessage: 'Thinking...',
      abortController,
    };
    
    activeRequestsRef.current.set(conversationId, request);
    updateLoadingState(conversationId, true);
    options.onLoadingChange(conversationId, true, 'Thinking...');

    try {
      const response = await sendChatMessageWithStream(
        messages,
        context,
        model,
        (toolStatus) => {
          // Update loading status for this specific conversation
          const req = activeRequestsRef.current.get(conversationId);
          if (req) {
            req.loadingMessage = toolStatus;
            options.onLoadingChange(conversationId, true, toolStatus);
          }
        },
        abortController.signal
      );

      // Request completed successfully
      activeRequestsRef.current.delete(conversationId);
      updateLoadingState(conversationId, false);
      options.onLoadingChange(conversationId, false, '');

      const result: ConversationResponse = {
        conversationId,
        response: response.response,
        photos: response.photos,
        segments: response.segments,
      };

      options.onResponse(conversationId, result);
      return result;

    } catch (error: any) {
      // Clean up request tracking
      activeRequestsRef.current.delete(conversationId);
      updateLoadingState(conversationId, false);
      options.onLoadingChange(conversationId, false, '');

      // Handle abort errors silently
      if (error?.name === 'AbortError') {
        console.log(`[ConversationQueue] Request for ${conversationId} was aborted`);
        throw error;
      }

      // Return error response
      const errorResult: ConversationResponse = {
        conversationId,
        response: '',
        error: error?.message || 'Unknown error',
      };

      options.onResponse(conversationId, errorResult);
      throw error;
    }
  }, [options, updateLoadingState]);

  const abortRequest = useCallback((conversationId: string | null) => {
    const request = activeRequestsRef.current.get(conversationId);
    if (request) {
      request.abortController.abort();
      activeRequestsRef.current.delete(conversationId);
      updateLoadingState(conversationId, false);
      options.onLoadingChange(conversationId, false, '');
    }
  }, [options, updateLoadingState]);

  const abortAllRequests = useCallback(() => {
    activeRequestsRef.current.forEach((request, id) => {
      request.abortController.abort();
    });
    activeRequestsRef.current.clear();
    setLoadingConversations(new Set());
  }, []);

  const isConversationLoading = useCallback((conversationId: string | null): boolean => {
    return loadingConversations.has(conversationId);
  }, [loadingConversations]);

  const getLoadingStatus = useCallback((conversationId: string | null): string => {
    const request = activeRequestsRef.current.get(conversationId);
    return request?.loadingMessage || '';
  }, []);

  const hasActiveRequests = useCallback((): boolean => {
    return activeRequestsRef.current.size > 0;
  }, []);

  return {
    sendRequest,
    abortRequest,
    abortAllRequests,
    isConversationLoading,
    getLoadingStatus,
    hasActiveRequests,
    loadingConversations,
  };
};
