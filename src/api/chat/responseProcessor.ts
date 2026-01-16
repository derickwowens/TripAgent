/**
 * Response processing utilities for chat module
 */
import { PhotoReference } from './types.js';
import { validateLinksInResponse } from '../../utils/linkValidator.js';
import { filterPhotosByConfidence, PhotoReference as FilterablePhoto, PhotoFilterContext } from '../../utils/photoFilter.js';

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
 */
export function filterPhotos(
  collectedPhotos: PhotoReference[],
  tripDestination: string | undefined,
  searchQuery: string,
  conversationText: string
): PhotoReference[] {
  // IMPROVED FILTERING STRATEGY:
  // - NPS photos: validate park name appears in keyword/caption/URL
  // - Unsplash photos: apply confidence scoring
  const npsPhotos = collectedPhotos.filter(p => p.source === 'nps');
  const unsplashPhotos = collectedPhotos.filter(p => p.source === 'unsplash');
  
  // Validate NPS photos by string matching on park name
  // Require ALL destination words to match (e.g., "joshua" AND "tree")
  const cleanDestWords = (tripDestination || searchQuery || '')
    .toLowerCase()
    .replace(/national park/gi, '')
    .replace(/national/gi, '')
    .split(/\s+/)
    .filter((w: string) => w.length >= 3);
  
  const validatedNpsPhotos = npsPhotos.filter(photo => {
    const keyword = photo.keyword.toLowerCase();
    const caption = (photo.caption || '').toLowerCase();
    const url = photo.url.toLowerCase();
    const combined = `${keyword} ${caption} ${url}`;
    
    // Require ALL destination words to appear (not just any one)
    const allWordsMatch = cleanDestWords.length > 0 && 
      cleanDestWords.every((word: string) => combined.includes(word));
    
    // Also accept if URL is from nps.gov (official source, trusted)
    const isOfficialNps = url.includes('nps.gov');
    
    return allWordsMatch || isOfficialNps;
  });
  
  console.log(`[Chat] NPS validation: kept ${validatedNpsPhotos.length} of ${npsPhotos.length} (all words: "${cleanDestWords.join(' + ')}")`);
  
  let filteredPhotos = [...validatedNpsPhotos];
  
  // Only filter Unsplash photos if we have a search query
  if (unsplashPhotos.length > 0 && searchQuery) {
    const filterContext: PhotoFilterContext = {
      searchQuery: searchQuery,
      destination: tripDestination,
      conversationText: conversationText
    };
    const filteredUnsplash = filterPhotosByConfidence(unsplashPhotos as FilterablePhoto[], filterContext, 50);
    filteredPhotos.push(...filteredUnsplash as PhotoReference[]);
    console.log(`[Chat] Unsplash: kept ${filteredUnsplash.length} of ${unsplashPhotos.length} photos`);
  } else {
    filteredPhotos.push(...unsplashPhotos);
  }
  
  console.log(`[Chat] Final: ${npsPhotos.length} NPS + ${filteredPhotos.length - validatedNpsPhotos.length} Unsplash = ${filteredPhotos.length} photos`);
  
  return filteredPhotos;
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
): Promise<{ response: string; photos?: PhotoReference[] }> {
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
    console.log(`[Chat] Returning response with ${filteredPhotos.length} photos`);
    return { 
      response: validatedResponse, 
      photos: filteredPhotos.length > 0 ? filteredPhotos : undefined 
    };
  } catch (linkError) {
    console.warn('[Chat] Link validation failed, returning cleaned response:', linkError);
    return { 
      response: cleanedResponse, 
      photos: filteredPhotos.length > 0 ? filteredPhotos : undefined 
    };
  }
}
