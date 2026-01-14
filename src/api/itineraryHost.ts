/**
 * Ephemeral Itinerary Hosting
 * Stores HTML itineraries temporarily and serves them via unique URLs
 */

interface StoredItinerary {
  id: string;
  html: string;
  destination?: string;
  createdAt: Date;
  expiresAt: Date;
}

// In-memory store for itineraries (expires after 7 days)
const itineraryStore = new Map<string, StoredItinerary>();
const EXPIRY_HOURS = 168; // 7 days

// Clean up expired itineraries periodically
setInterval(() => {
  const now = new Date();
  for (const [id, itinerary] of itineraryStore.entries()) {
    if (itinerary.expiresAt < now) {
      itineraryStore.delete(id);
    }
  }
}, 60 * 60 * 1000); // Check every hour

/**
 * Generate a unique ID for the itinerary
 */
const generateId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

/**
 * Convert markdown to HTML with proper styling
 */
const markdownToHtml = (markdown: string): string => {
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Links - preserve them!
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Lists
    .replace(/^\s*[-•]\s+(.*)$/gim, '<li>$1</li>')
    // Numbered lists
    .replace(/^\s*\d+\.\s+(.*)$/gim, '<li>$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines to breaks
    .replace(/\n/g, '<br>')
    // Wrap in paragraph
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p><br>/g, '<p>')
    // Wrap consecutive li elements in ul
    .replace(/(<li>.*?<\/li>)(?=\s*<li>)/g, '$1')
    .replace(/(<li>.*?<\/li>)+/g, '<ul>$&</ul>');
};

/**
 * Generate beautiful HTML page for itinerary
 */
export const generateItineraryHtml = (
  content: string,
  destination?: string,
  photos?: Array<{ url: string; caption?: string; keyword?: string }>,
  links?: Array<{ text: string; url: string }>
): string => {
  const title = destination ? `${destination} Itinerary` : 'My Trip Itinerary';
  const contentHtml = markdownToHtml(content);
  
  // Build photo gallery HTML
  let photoGalleryHtml = '';
  if (photos && photos.length > 0) {
    const photoItems = photos.slice(0, 8).map(photo => `
      <div class="photo-item">
        <img src="${photo.url}" alt="${photo.caption || photo.keyword || 'Trip photo'}" loading="lazy">
        ${photo.caption ? `<span class="photo-caption">${photo.caption}</span>` : ''}
      </div>
    `).join('');
    
    photoGalleryHtml = `
      <section class="photo-gallery">
        <h2>Trip Photos</h2>
        <div class="photo-grid">
          ${photoItems}
        </div>
      </section>
    `;
  }
  
  // Build useful links section
  let linksHtml = '';
  if (links && links.length > 0) {
    const linkItems = links.map(link => `
      <a href="${link.url}" target="_blank" rel="noopener" class="link-card">
        <span class="link-text">${link.text}</span>
        <span class="link-arrow">→</span>
      </a>
    `).join('');
    
    linksHtml = `
      <section class="useful-links">
        <h2>Useful Links</h2>
        <div class="links-grid">
          ${linkItems}
        </div>
      </section>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | TripAgent</title>
  <meta name="description" content="Trip itinerary for ${destination || 'your adventure'}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #0f4624 0%, #1a1a2e 100%);
      min-height: 100vh;
      color: #1f2937;
      line-height: 1.6;
    }
    
    .hero {
      background: linear-gradient(135deg, #166534 0%, #0f4624 100%);
      color: white;
      padding: 60px 20px;
      text-align: center;
    }
    
    .hero h1 {
      font-size: clamp(28px, 5vw, 42px);
      font-weight: 700;
      margin-bottom: 12px;
    }
    
    .hero .subtitle {
      opacity: 0.9;
      font-size: 16px;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    .content-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      margin-bottom: 24px;
    }
    
    .content-card h1, .content-card h2, .content-card h3 {
      color: #166534;
      margin-top: 24px;
      margin-bottom: 12px;
    }
    
    .content-card h1:first-child,
    .content-card h2:first-child,
    .content-card h3:first-child {
      margin-top: 0;
    }
    
    .content-card h2 {
      font-size: 22px;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
    }
    
    .content-card h3 {
      font-size: 18px;
    }
    
    .content-card p {
      margin-bottom: 16px;
      color: #374151;
    }
    
    .content-card ul {
      margin: 16px 0;
      padding-left: 24px;
    }
    
    .content-card li {
      margin-bottom: 8px;
      color: #374151;
    }
    
    .content-card a {
      color: #166534;
      text-decoration: none;
      font-weight: 500;
      border-bottom: 1px solid #16653480;
      transition: border-color 0.2s;
    }
    
    .content-card a:hover {
      border-color: #166534;
    }
    
    .content-card strong {
      color: #1f2937;
    }
    
    .photo-gallery {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      margin-bottom: 24px;
    }
    
    .photo-gallery h2 {
      color: #166534;
      margin-bottom: 20px;
      font-size: 22px;
    }
    
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }
    
    .photo-item {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 4/3;
    }
    
    .photo-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.3s;
    }
    
    .photo-item:hover img {
      transform: scale(1.05);
    }
    
    .photo-caption {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(transparent, rgba(0,0,0,0.7));
      color: white;
      padding: 20px 12px 12px;
      font-size: 13px;
    }
    
    .useful-links {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      margin-bottom: 24px;
    }
    
    .useful-links h2 {
      color: #166534;
      margin-bottom: 20px;
      font-size: 22px;
    }
    
    .links-grid {
      display: grid;
      gap: 12px;
    }
    
    .link-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: #f9fafb;
      border-radius: 10px;
      text-decoration: none;
      color: #1f2937;
      transition: all 0.2s;
      border: 1px solid #e5e7eb;
    }
    
    .link-card:hover {
      background: #166534;
      color: white;
      border-color: #166534;
    }
    
    .link-text {
      font-weight: 500;
    }
    
    .link-arrow {
      font-size: 18px;
      opacity: 0.6;
    }
    
    .footer {
      text-align: center;
      padding: 40px 20px;
      color: rgba(255,255,255,0.7);
    }
    
    .footer a {
      color: white;
      text-decoration: none;
    }
    
    .share-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #166534;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 16px;
      transition: background 0.2s;
    }
    
    .share-button:hover {
      background: #0f4624;
    }
    
    @media print {
      body {
        background: white;
      }
      .hero {
        background: #166534 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .share-button {
        display: none;
      }
    }
  </style>
</head>
<body>
  <header class="hero">
    <h1>${title}</h1>
    <p class="subtitle">Created with TripAgent</p>
  </header>
  
  <main class="container">
    <article class="content-card">
      ${contentHtml}
    </article>
    
    ${photoGalleryHtml}
    ${linksHtml}
  </main>
  
  <footer class="footer">
    <p>Created with <a href="#">TripAgent</a></p>
    <p style="margin-top: 8px; font-size: 14px;">Your AI-powered trip planning assistant</p>
  </footer>
  
  <script>
    // Add copy link functionality
    if (navigator.share) {
      document.querySelectorAll('.share-button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            await navigator.share({
              title: '${title}',
              url: window.location.href
            });
          } catch (err) {
            console.log('Share cancelled');
          }
        });
      });
    }
  </script>
</body>
</html>`;
};

/**
 * Store an itinerary and return its ID
 */
export const storeItinerary = (
  content: string,
  destination?: string,
  photos?: Array<{ url: string; caption?: string; keyword?: string }>,
  links?: Array<{ text: string; url: string }>
): string => {
  const id = generateId();
  const html = generateItineraryHtml(content, destination, photos, links);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_HOURS * 60 * 60 * 1000);
  
  itineraryStore.set(id, {
    id,
    html,
    destination,
    createdAt: now,
    expiresAt,
  });
  
  return id;
};

/**
 * Get a stored itinerary by ID
 */
export const getItinerary = (id: string): StoredItinerary | null => {
  const itinerary = itineraryStore.get(id);
  if (!itinerary) return null;
  
  // Check if expired
  if (itinerary.expiresAt < new Date()) {
    itineraryStore.delete(id);
    return null;
  }
  
  return itinerary;
};

/**
 * Get stats about stored itineraries
 */
export const getItineraryStats = () => ({
  count: itineraryStore.size,
  ids: Array.from(itineraryStore.keys()),
});
