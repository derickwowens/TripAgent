/**
 * useConversationManager - React hook for the conversation management system
 * 
 * Bridges the modular ConversationManager with React components.
 * Provides a clean, hook-based API for managing multiple concurrent conversations.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getConversationManager,
  ConversationManager,
  ConversationManagerState,
  ConversationLoadingState,
  QueuedResponse,
  RequestContext,
  Message,
  ConversationEvent,
} from '../services/conversation';
import { parseApiResponseWithValidation } from '../utils/responseParser';

interface UseConversationManagerOptions {
  model?: string;
  onMessageAdded?: (conversationId: string | null, message: Message) => void;
  onResponseReceived?: (conversationId: string | null, response: QueuedResponse) => void;
}

interface UseConversationManagerReturn {
  // State
  activeConversationId: string | null;
  hasPendingRequests: boolean;
  
  // Loading state
  getLoadingState: (conversationId: string | null) => ConversationLoadingState;
  isConversationLoading: (conversationId: string | null) => boolean;
  
  // Actions
  sendMessage: (
    conversationId: string | null,
    content: string,
    context: RequestContext,
    existingMessages?: Message[]
  ) => Promise<QueuedResponse>;
  switchConversation: (conversationId: string | null) => void;
  abortRequest: (conversationId: string | null) => boolean;
  abortAllRequests: () => void;
  
  // Request status
  hasPendingRequest: (conversationId: string | null) => boolean;
}

export function useConversationManager(
  options: UseConversationManagerOptions = {}
): UseConversationManagerReturn {
  const { model, onMessageAdded, onResponseReceived } = options;
  
  const managerRef = useRef<ConversationManager | null>(null);
  const [state, setState] = useState<ConversationManagerState>(() => ({
    activeConversationId: null,
    conversations: new Map(),
    loadingStates: new Map(),
    hasPendingRequests: false,
  }));

  // Initialize manager
  useEffect(() => {
    managerRef.current = getConversationManager(model);
    
    // Subscribe to state changes
    const unsubscribeState = managerRef.current.subscribe((newState) => {
      setState(newState);
    });

    // Subscribe to events
    const unsubscribeEvents = managerRef.current.subscribeToEvents((event) => {
      handleEvent(event);
    });

    // Get initial state
    setState(managerRef.current.getState());

    return () => {
      unsubscribeState();
      unsubscribeEvents();
    };
  }, [model]);

  // Handle events from the manager
  const handleEvent = useCallback((event: ConversationEvent) => {
    switch (event.type) {
      case 'MESSAGE_ADDED':
        onMessageAdded?.(event.conversationId, event.message);
        break;
      case 'RESPONSE_RECEIVED':
        onResponseReceived?.(event.conversationId, event.response);
        
        // Trigger async link validation
        if (event.response.response) {
          parseApiResponseWithValidation(event.response.response).then(validated => {
            // Link validation results can be handled here if needed
          });
        }
        break;
    }
  }, [onMessageAdded, onResponseReceived]);

  // Get loading state for a conversation
  const getLoadingState = useCallback((conversationId: string | null): ConversationLoadingState => {
    return state.loadingStates.get(conversationId) || { isLoading: false, status: '' };
  }, [state.loadingStates]);

  // Check if a conversation is loading
  const isConversationLoading = useCallback((conversationId: string | null): boolean => {
    const loadingState = state.loadingStates.get(conversationId);
    return loadingState?.isLoading || false;
  }, [state.loadingStates]);

  // Send a message
  const sendMessage = useCallback(async (
    conversationId: string | null,
    content: string,
    context: RequestContext,
    existingMessages: Message[] = []
  ): Promise<QueuedResponse> => {
    if (!managerRef.current) {
      throw new Error('ConversationManager not initialized');
    }
    return managerRef.current.sendMessage(conversationId, content, context, existingMessages);
  }, []);

  // Switch conversation
  const switchConversation = useCallback((conversationId: string | null) => {
    if (managerRef.current) {
      managerRef.current.switchConversation(conversationId);
    }
  }, []);

  // Abort a request
  const abortRequest = useCallback((conversationId: string | null): boolean => {
    if (managerRef.current) {
      return managerRef.current.abortRequest(conversationId);
    }
    return false;
  }, []);

  // Abort all requests
  const abortAllRequests = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.abortAllRequests();
    }
  }, []);

  // Check for pending request
  const hasPendingRequest = useCallback((conversationId: string | null): boolean => {
    if (managerRef.current) {
      return managerRef.current.hasPendingRequest(conversationId);
    }
    return false;
  }, []);

  return {
    activeConversationId: state.activeConversationId,
    hasPendingRequests: state.hasPendingRequests,
    getLoadingState,
    isConversationLoading,
    sendMessage,
    switchConversation,
    abortRequest,
    abortAllRequests,
    hasPendingRequest,
  };
}
