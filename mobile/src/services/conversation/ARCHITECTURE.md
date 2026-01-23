# Conversation Management Architecture

## Overview

This module provides a modular, deterministic system for managing multiple concurrent conversations. Users can have multiple trips being planned simultaneously, with responses routing to the correct conversation regardless of which one is currently focused.

## Core Principles

1. **Modular** - Each component has a single responsibility
2. **Deterministic** - Same inputs produce same outputs, no hidden state
3. **Non-monolithic** - Small, composable classes/functions
4. **Cache-integrated** - Works with TripContext caching paradigm

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      HomeScreen (View)                       │
│  - Renders active conversation                               │
│  - Dispatches user actions to ConversationManager            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   ConversationManager                        │
│  - Orchestrates request/response flow                        │
│  - Coordinates between queues and stores                     │
│  - Single entry point for conversation operations            │
└──────┬─────────────────────┬─────────────────────┬──────────┘
       │                     │                     │
       ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ RequestQueue │    │ResponseQueue │    │ConversationStore │
│              │    │              │    │                  │
│ - Pending    │    │ - Buffers    │    │ - Messages       │
│   requests   │◄───│   responses  │    │ - Metadata       │
│ - Abort      │    │ - Routes to  │    │ - Loading state  │
│   controllers│    │   correct    │    │ - Persistence    │
│ - Status     │    │   convo      │    │   (AsyncStorage) │
└──────────────┘    └──────────────┘    └──────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  TripContextCache │
                    │  (existing)       │
                    │                   │
                    │  - Park data      │
                    │  - Hikes          │
                    │  - Restaurants    │
                    │  - Links          │
                    └──────────────────┘
```

## Component Responsibilities

### ConversationManager
Central orchestrator. Thin coordination layer, no business logic.
- `sendMessage(conversationId, content)` - Initiates request
- `switchConversation(conversationId)` - Changes focus
- `getActiveConversation()` - Returns current focus
- `subscribe(callback)` - State change notifications

### RequestQueue
Manages outgoing API requests.
- Tracks pending requests by conversation ID
- Provides AbortController per request
- Emits status updates (thinking, searching, etc.)
- One request per conversation at a time

### ResponseQueue  
Handles incoming API responses.
- Buffers responses with their conversation ID
- Processes responses in order
- Routes to ConversationStore
- Triggers TripContext cache updates

### ConversationStore
State management for conversations.
- In-memory state + AsyncStorage persistence
- Messages per conversation
- Loading state per conversation
- Metadata extraction

### TripContextCache (existing)
Already implemented in `useTripContext.ts`.
- Caches structured trip data per conversation
- Extracted from API responses
- Reduces redundant API calls

## Data Flow

### Send Message Flow
```
User Input
    │
    ▼
ConversationManager.sendMessage(conversationId, content)
    │
    ├──► ConversationStore.addMessage(conversationId, userMessage)
    │
    └──► RequestQueue.enqueue({
             conversationId,
             messages,
             context,
             onStatus: (status) => ConversationStore.setLoadingStatus(conversationId, status)
         })
             │
             ▼
         API Call (async)
             │
             ▼
         ResponseQueue.enqueue({
             conversationId,
             response,
             photos,
             segments
         })
```

### Response Processing Flow
```
ResponseQueue.process()
    │
    ├──► ConversationStore.addMessage(conversationId, assistantMessage)
    │
    ├──► TripContextCache.update(conversationId, extractedData)
    │
    └──► ConversationStore.setLoading(conversationId, false)
             │
             ▼
         View re-renders if conversationId === activeConversation
```

## State Shape

```typescript
interface ConversationState {
  conversations: Map<string, Conversation>;
  activeConversationId: string | null;
  pendingRequests: Map<string, PendingRequest>;
}

interface Conversation {
  id: string;
  messages: Message[];
  metadata: ConversationMetadata;
  loadingState: {
    isLoading: boolean;
    status: string;
  };
}

interface PendingRequest {
  conversationId: string;
  abortController: AbortController;
  startedAt: number;
}
```

## File Structure

```
mobile/src/services/conversation/
├── ARCHITECTURE.md          # This file
├── index.ts                  # Public exports
├── ConversationManager.ts    # Orchestrator
├── RequestQueue.ts           # Request management
├── ResponseQueue.ts          # Response handling
├── ConversationStore.ts      # State management
└── types.ts                  # Shared types
```

## Integration with Existing Code

### useTripContext
- Already provides per-conversation caching
- ResponseQueue calls its update methods after processing
- No changes needed to existing hook

### useConversations
- Will be refactored to use ConversationStore internally
- Maintains same public API for backward compatibility
- Reduces duplication

### HomeScreen
- Becomes a thin view layer
- Subscribes to ConversationManager state
- Dispatches actions, doesn't manage state directly

## Migration Path

### Phase 1: Foundation (COMPLETE)
- [x] Create types.ts with shared interfaces
- [x] Create RequestQueue for outgoing request management
- [x] Create ResponseQueue for incoming response handling
- [x] Create ConversationManager as central orchestrator
- [x] Create useConversationManager hook for React integration

### Phase 2: Integration (NEXT)
1. Connect ConversationManager to existing storage (useConversations)
2. Connect to TripContext cache (useTripContext)
3. Create adapter to bridge existing useConversations API

### Phase 3: Migration
1. Update HomeScreen to use useConversationManager
2. Remove inline request handling logic
3. Remove per-conversation loading state from HomeScreen (now in ConversationManager)

### Phase 4: Cleanup
1. Remove deprecated useConversationQueue
2. Consolidate types
3. Update tests

## Usage Example

```typescript
// In HomeScreen or any component
import { useConversationManager } from '../hooks';

function MyComponent() {
  const {
    sendMessage,
    switchConversation,
    getLoadingState,
    isConversationLoading,
    hasPendingRequest,
  } = useConversationManager({
    model: 'claude-3-5-haiku-20241022',
    onMessageAdded: (conversationId, message) => {
      // Handle new message (update UI, etc.)
    },
    onResponseReceived: (conversationId, response) => {
      // Handle response (update cache, etc.)
    },
  });

  const handleSend = async () => {
    const response = await sendMessage(
      currentConversationId,
      inputText,
      { userLocation, userProfile },
      existingMessages
    );
  };

  // Loading state is per-conversation
  const { isLoading, status } = getLoadingState(currentConversationId);
  
  // Switch conversations freely - requests continue in background
  const handleSwitchConversation = (id) => {
    switchConversation(id);
    // Any pending request for the old conversation continues
    // Its response will route to the correct conversation
  };
}
```

## Cache Integration

The ResponseQueue triggers cache updates through the CacheUpdater interface:

```typescript
// In HomeScreen initialization
const manager = getConversationManager();
manager.setCacheUpdater({
  updateFromResponse: async (conversationId, response) => {
    // Parse response and update TripContext cache
    const { links, restaurants, hikes } = parseApiResponse(response.response);
    
    if (links.length > 0) {
      tripContext.addLinks(links);
    }
    if (restaurants.length > 0) {
      tripContext.updateRestaurants(restaurants);
    }
    // etc.
  }
});
```

## Key Benefits

1. **Modular**: Each component is single-purpose and testable
2. **Deterministic**: Request → Queue → Process → Route → Update
3. **Non-monolithic**: Small classes, no god objects
4. **Concurrent**: Multiple conversations can have active requests
5. **Resilient**: Switching conversations doesn't lose responses
