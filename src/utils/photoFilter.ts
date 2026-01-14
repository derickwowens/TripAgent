/**
 * Photo Filtering Utility
 * Provides confidence scoring and filtering for photos from any source (NPS, Unsplash, etc.)
 */

export interface PhotoReference {
  keyword: string;
  url: string;
  caption?: string;
  confidence?: number;
  source?: 'nps' | 'unsplash' | 'other';
}

export interface PhotoFilterContext {
  searchQuery: string;        // Original search query (e.g., "grand canyon")
  destination?: string;       // Full destination name (e.g., "Grand Canyon National Park")
  conversationText?: string;  // Full conversation for context matching
}

/**
 * Calculate confidence score for a photo based on how well it matches the context
 * Score ranges from 0-100
 */
export function calculatePhotoConfidence(
  photo: PhotoReference,
  context: PhotoFilterContext
): number {
  let score = 0;
  const keyword = photo.keyword.toLowerCase();
  const caption = (photo.caption || '').toLowerCase();
  const url = photo.url.toLowerCase();
  
  // Clean the search query and destination for matching
  const cleanQuery = cleanSearchTerm(context.searchQuery);
  const cleanDest = context.destination ? cleanSearchTerm(context.destination) : cleanQuery;
  const conversation = (context.conversationText || '').toLowerCase();
  
  // PRIMARY CHECK: Photo must relate to the search query
  // This is the most important filter
  const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 3);
  const hasQueryMatch = queryWords.length > 0 && queryWords.some(word => 
    keyword.includes(word) || caption.includes(word)
  );
  
  if (hasQueryMatch) {
    score += 50; // Strong base for matching the search query
  }
  
  // SECONDARY: Check destination match (may be more specific than query)
  if (cleanDest !== cleanQuery) {
    const destWords = cleanDest.split(/\s+/).filter(w => w.length >= 3);
    const hasDestMatch = destWords.some(word => 
      keyword.includes(word) || caption.includes(word)
    );
    if (hasDestMatch) {
      score += 15;
    }
  }
  
  // BONUS: Trusted source (NPS, official sites)
  const isTrustedSource = url.includes('nps.gov') || 
                          url.includes('recreation.gov') ||
                          url.includes('nationalpark');
  if (isTrustedSource) {
    score += 10;
  }
  
  // BONUS: Unsplash photos that match query get a small boost (quality source)
  if (url.includes('unsplash') && hasQueryMatch) {
    score += 5;
  }
  
  // BONUS: Keyword appears in conversation context
  const keywordWords = keyword.split(' ').filter(w => w.length > 4);
  const keywordInConversation = keywordWords.some(w => conversation.includes(w));
  if (keywordInConversation) {
    score += 15;
  }
  
  // BONUS: Caption mentions destination
  if (caption && cleanDest.length > 2 && caption.includes(cleanDest)) {
    score += 10;
  }
  
  return Math.min(100, score);
}

/**
 * Filter photos by confidence threshold
 */
export function filterPhotosByConfidence(
  photos: PhotoReference[],
  context: PhotoFilterContext,
  threshold: number = 70
): PhotoReference[] {
  const scored = photos.map(photo => ({
    ...photo,
    confidence: calculatePhotoConfidence(photo, context)
  }));
  
  // Log for debugging
  if (scored.length > 0) {
    console.log('[PhotoFilter] Confidence scores:', scored.map(p => ({
      keyword: p.keyword.substring(0, 30),
      source: p.source || 'unknown',
      confidence: p.confidence,
      included: (p.confidence || 0) >= threshold
    })));
  }
  
  return scored.filter(p => (p.confidence || 0) >= threshold);
}

/**
 * Clean a search term by removing common suffixes and normalizing
 */
export function cleanSearchTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/national park/gi, '')
    .replace(/national monument/gi, '')
    .replace(/national recreation area/gi, '')
    .replace(/national historic site/gi, '')
    .replace(/national/gi, '')
    .replace(/park/gi, '')
    .trim();
}

/**
 * Check if a photo matches a search query (quick check without full scoring)
 */
export function photoMatchesQuery(photo: PhotoReference, searchQuery: string): boolean {
  const cleanQuery = cleanSearchTerm(searchQuery);
  const queryWords = cleanQuery.split(/\s+/).filter(w => w.length >= 3);
  
  if (queryWords.length === 0) return false;
  
  const keyword = photo.keyword.toLowerCase();
  const caption = (photo.caption || '').toLowerCase();
  
  return queryWords.some(word => keyword.includes(word) || caption.includes(word));
}
