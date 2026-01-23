/**
 * Response processing utilities for chat module
 */
import { PhotoReference } from './types.js';
import { validateLinksInResponse } from '../../utils/linkValidator.js';

/**
 * Clean up formatting artifacts from Claude's response
 * IMPORTANT: Preserves markdown links [text](url) for photo/link functionality
 */
export function cleanResponseFormatting(text: string): string {
  try {
    let cleaned = text;
    
    // Remove underscore dividers (3+ underscores) but NOT inside URLs
    cleaned = cleaned.replace(/(?<!\()_{3,}(?!\))/g, '---');
    
    // Remove asterisks used for bold/italic (but preserve content)
    // Be careful not to match asterisks that might be in URLs
    cleaned = cleaned.replace(/\*\*([^*\n]+)\*\*/g, '$1');
    cleaned = cleaned.replace(/(?<![a-zA-Z])\*([^*\n]+)\*(?![a-zA-Z])/g, '$1');
    
    // Remove hashtag headers at start of lines
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
    
    // Replace asterisk bullets with proper bullets (only at line start)
    cleaned = cleaned.replace(/^\s*\*\s+/gm, '• ');
    
    // Remove inline backticks (preserve content)
    cleaned = cleaned.replace(/`([^`\n]+)`/g, '$1');
    
    // Clean up excessive dashes (more than 5)
    cleaned = cleaned.replace(/-{6,}/g, '---');
    
    // Clean up multiple consecutive blank lines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
  } catch (error) {
    console.warn('[Chat] Error in cleanResponseFormatting, returning original:', error);
    return text;
  }
}

/**
 * Filter and validate photos from tool results
 * Uses DETERMINISTIC rules - no confidence scoring
 */
export function filterPhotos(
  collectedPhotos: PhotoReference[],
  tripDestination: string | undefined,
  searchQuery: string,
  _conversationText: string
): PhotoReference[] {
  // DETERMINISTIC FILTERING:
  // 1. NPS photos: validate URL is from nps.gov OR keyword matches destination
  // 2. Unsplash photos: include all (they're already curated for the destination)
  // 3. Other photos (wildlife, etc.): include all
  
  const npsPhotos = collectedPhotos.filter(p => p.source === 'nps');
  const unsplashPhotos = collectedPhotos.filter(p => p.source === 'unsplash');
  const otherPhotos = collectedPhotos.filter(p => p.source !== 'nps' && p.source !== 'unsplash');
  
  // For NPS photos, validate they're from official NPS source or match destination
  const destLower = (tripDestination || searchQuery || '').toLowerCase();
  const validatedNpsPhotos = npsPhotos.filter(photo => {
    const url = photo.url.toLowerCase();
    const keyword = photo.keyword.toLowerCase();
    
    // Accept if URL is from nps.gov (official source)
    if (url.includes('nps.gov')) return true;
    
    // Accept if keyword matches part of destination
    if (destLower && keyword.length > 2 && destLower.includes(keyword)) return true;
    if (destLower && destLower.length > 2 && keyword.includes(destLower.split(' ')[0])) return true;
    
    return false;
  });
  
  console.log(`[Chat] Photos: ${validatedNpsPhotos.length} NPS, ${unsplashPhotos.length} Unsplash, ${otherPhotos.length} other`);
  
  // Combine all photos - Unsplash and other sources are pre-curated, include them all
  return [...validatedNpsPhotos, ...unsplashPhotos, ...otherPhotos];
}

/**
 * Split a long response into logical segments for better display
 * Splits on major section breaks (double newlines after headers, etc.)
 */
export function splitResponseIntoSegments(response: string): string[] {
  if (!response || response.length < 500) {
    return [response];
  }
  
  const segments: string[] = [];
  
  // Split on double newlines that precede headers or major breaks
  // This pattern matches: content followed by blank line(s) then a header or new section
  const sectionPattern = /\n\n+(?=(?:#{1,4}\s|[A-Z][^a-z]*:|(?:\d+\.|[-•])\s))/g;
  
  const parts = response.split(sectionPattern);
  
  // If we got meaningful splits, use them
  if (parts.length > 1) {
    let currentSegment = '';
    
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (!trimmedPart) continue;
      
      // If adding this part would make segment too long, start new segment
      if (currentSegment && (currentSegment.length + trimmedPart.length > 1500)) {
        segments.push(currentSegment.trim());
        currentSegment = trimmedPart;
      } else if (!currentSegment) {
        currentSegment = trimmedPart;
      } else {
        currentSegment += '\n\n' + trimmedPart;
      }
    }
    
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }
  }
  
  // If no good splits found, return as single segment
  if (segments.length === 0) {
    return [response];
  }
  
  return segments;
}

/**
 * Validate links in the response and return cleaned response
 */
export async function validateAndCleanResponse(
  rawResponse: string,
  collectedPhotos: PhotoReference[],
  detectedDestination: string | undefined,
  originalSearchQuery: string | undefined,
  messages: { content: string }[],
  tripDestination: string | undefined
): Promise<{ response: string; photos?: PhotoReference[]; segments?: string[] }> {
  // Post-process response to clean up formatting artifacts
  const cleanedResponse = cleanResponseFormatting(rawResponse);
  
  // Build context for confidence scoring
  const conversationText = messages.map(m => m.content).join(' ') + ' ' + cleanedResponse;
  const destination = detectedDestination || tripDestination;
  const searchQuery = originalSearchQuery || destination?.toLowerCase().replace(/national park/gi, '').trim() || '';
  
  console.log(`[Chat] Photo filtering with query: "${searchQuery}", destination: "${destination || 'none'}"`);
  console.log(`[Chat] Raw response length: ${rawResponse.length}, Cleaned: ${cleanedResponse.length}`);
  
  const filteredPhotos = filterPhotos(collectedPhotos, destination, searchQuery, conversationText);
  
  if (collectedPhotos.length === 0) {
    console.log('[Chat] No photos collected from tool results');
  }
  
  // Validate and fix any broken links in the response
  try {
    const validatedResponse = await validateLinksInResponse(cleanedResponse);
    const segments = splitResponseIntoSegments(validatedResponse);
    console.log(`[Chat] Returning response with ${filteredPhotos.length} photos, ${segments.length} segments`);
    return { 
      response: validatedResponse, 
      photos: filteredPhotos.length > 0 ? filteredPhotos : undefined,
      segments: segments.length > 1 ? segments : undefined
    };
  } catch (linkError) {
    console.warn('[Chat] Link validation failed, returning cleaned response:', linkError);
    const segments = splitResponseIntoSegments(cleanedResponse);
    return { 
      response: cleanedResponse, 
      photos: filteredPhotos.length > 0 ? filteredPhotos : undefined,
      segments: segments.length > 1 ? segments : undefined
    };
  }
}
