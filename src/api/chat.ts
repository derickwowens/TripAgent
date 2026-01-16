/**
 * Chat module - Re-exports from modular structure
 * 
 * This file re-exports the modular chat implementation.
 * All chat logic has been moved to ./chat/ directory for better organization:
 * 
 * - ./chat/types.ts - Type definitions
 * - ./chat/systemPrompt.ts - System prompt and context building
 * - ./chat/toolDefinitions.ts - Claude tool definitions
 * - ./chat/parkFeatures.ts - Park-specific photo features
 * - ./chat/responseProcessor.ts - Response cleaning and photo filtering
 * - ./chat/index.ts - Main orchestrator
 */

export { 
  createChatHandler,
  ChatMessage, 
  ChatContext, 
  ChatResponse, 
  PhotoReference 
} from './chat/index.js';
