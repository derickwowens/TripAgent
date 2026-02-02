/**
 * Fix Broken NPS Links Script
 * Updates validatedNpsLinks.ts to mark broken links as invalid and provide alternatives
 * 
 * Usage: npx ts-node data/scripts/fixBrokenNpsLinks.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Broken links from validation report (404 errors)
const BROKEN_LINKS: Array<{parkCode: string; type: string; url: string}> = [
  // Badlands
  { parkCode: 'badl', type: 'camping', url: 'https://www.nps.gov/badl/planyourvisit/camping.htm' },
  { parkCode: 'badl', type: 'hiking', url: 'https://www.nps.gov/badl/planyourvisit/hiking.htm' },
  // Big Bend
  { parkCode: 'bibe', type: 'camping', url: 'https://www.nps.gov/bibe/planyourvisit/camping.htm' },
  { parkCode: 'bibe', type: 'hiking', url: 'https://www.nps.gov/bibe/planyourvisit/hiking.htm' },
  // Biscayne
  { parkCode: 'bisc', type: 'camping', url: 'https://www.nps.gov/bisc/planyourvisit/camping.htm' },
  { parkCode: 'bisc', type: 'hiking', url: 'https://www.nps.gov/bisc/planyourvisit/hiking.htm' },
  // Black Canyon
  { parkCode: 'blca', type: 'camping', url: 'https://www.nps.gov/blca/planyourvisit/camping.htm' },
  // Bryce Canyon
  { parkCode: 'brca', type: 'camping', url: 'https://www.nps.gov/brca/planyourvisit/camping.htm' },
  // Canyonlands
  { parkCode: 'cany', type: 'camping', url: 'https://www.nps.gov/cany/planyourvisit/camping.htm' },
  // Capitol Reef
  { parkCode: 'care', type: 'camping', url: 'https://www.nps.gov/care/planyourvisit/camping.htm' },
  // Channel Islands
  { parkCode: 'chis', type: 'hours', url: 'https://www.nps.gov/chis/planyourvisit/hours.htm' },
  { parkCode: 'chis', type: 'camping', url: 'https://www.nps.gov/chis/planyourvisit/camping.htm' },
  // Congaree
  { parkCode: 'cong', type: 'camping', url: 'https://www.nps.gov/cong/planyourvisit/camping.htm' },
  // Crater Lake
  { parkCode: 'crla', type: 'camping', url: 'https://www.nps.gov/crla/planyourvisit/camping.htm' },
  // Cuyahoga Valley
  { parkCode: 'cuva', type: 'camping', url: 'https://www.nps.gov/cuva/planyourvisit/camping.htm' },
  { parkCode: 'cuva', type: 'hiking', url: 'https://www.nps.gov/cuva/planyourvisit/hiking.htm' },
  // Death Valley
  { parkCode: 'deva', type: 'camping', url: 'https://www.nps.gov/deva/planyourvisit/camping.htm' },
  // Denali
  { parkCode: 'dena', type: 'camping', url: 'https://www.nps.gov/dena/planyourvisit/camping.htm' },
  // Dry Tortugas
  { parkCode: 'drto', type: 'camping', url: 'https://www.nps.gov/drto/planyourvisit/camping.htm' },
  // Everglades
  { parkCode: 'ever', type: 'camping', url: 'https://www.nps.gov/ever/planyourvisit/camping.htm' },
  // Gates of the Arctic
  { parkCode: 'gaar', type: 'camping', url: 'https://www.nps.gov/gaar/planyourvisit/camping.htm' },
  { parkCode: 'gaar', type: 'hiking', url: 'https://www.nps.gov/gaar/planyourvisit/hiking.htm' },
  // Gateway Arch
  { parkCode: 'jeff', type: 'camping', url: 'https://www.nps.gov/jeff/planyourvisit/camping.htm' },
  { parkCode: 'jeff', type: 'hiking', url: 'https://www.nps.gov/jeff/planyourvisit/hiking.htm' },
  // Glacier
  { parkCode: 'glac', type: 'camping', url: 'https://www.nps.gov/glac/planyourvisit/camping.htm' },
  // Glacier Bay
  { parkCode: 'glba', type: 'camping', url: 'https://www.nps.gov/glba/planyourvisit/camping.htm' },
  { parkCode: 'glba', type: 'hiking', url: 'https://www.nps.gov/glba/planyourvisit/hiking.htm' },
  // Grand Canyon
  { parkCode: 'grca', type: 'camping', url: 'https://www.nps.gov/grca/planyourvisit/camping.htm' },
  // Grand Teton
  { parkCode: 'grte', type: 'camping', url: 'https://www.nps.gov/grte/planyourvisit/camping.htm' },
  { parkCode: 'grte', type: 'hiking', url: 'https://www.nps.gov/grte/planyourvisit/hiking.htm' },
  // Great Basin
  { parkCode: 'grba', type: 'hiking', url: 'https://www.nps.gov/grba/planyourvisit/hiking.htm' },
  // Great Smoky Mountains
  { parkCode: 'grsm', type: 'camping', url: 'https://www.nps.gov/grsm/planyourvisit/camping.htm' },
  // Haleakala
  { parkCode: 'hale', type: 'hours', url: 'https://www.nps.gov/hale/planyourvisit/hours.htm' },
  // Hawaii Volcanoes
  { parkCode: 'havo', type: 'camping', url: 'https://www.nps.gov/havo/planyourvisit/camping.htm' },
  { parkCode: 'havo', type: 'hiking', url: 'https://www.nps.gov/havo/planyourvisit/hiking.htm' },
  // Hot Springs
  { parkCode: 'hosp', type: 'hours', url: 'https://www.nps.gov/hosp/planyourvisit/hours.htm' },
  { parkCode: 'hosp', type: 'hiking', url: 'https://www.nps.gov/hosp/planyourvisit/hiking.htm' },
  // Indiana Dunes
  { parkCode: 'indu', type: 'camping', url: 'https://www.nps.gov/indu/planyourvisit/camping.htm' },
  // Isle Royale
  { parkCode: 'isro', type: 'hiking', url: 'https://www.nps.gov/isro/planyourvisit/hiking.htm' },
  // Joshua Tree
  { parkCode: 'jotr', type: 'camping', url: 'https://www.nps.gov/jotr/planyourvisit/camping.htm' },
  // Katmai
  { parkCode: 'katm', type: 'camping', url: 'https://www.nps.gov/katm/planyourvisit/camping.htm' },
  { parkCode: 'katm', type: 'hiking', url: 'https://www.nps.gov/katm/planyourvisit/hiking.htm' },
  // Kobuk Valley
  { parkCode: 'kova', type: 'camping', url: 'https://www.nps.gov/kova/planyourvisit/camping.htm' },
  { parkCode: 'kova', type: 'hiking', url: 'https://www.nps.gov/kova/planyourvisit/hiking.htm' },
  // Lake Clark
  { parkCode: 'lacl', type: 'camping', url: 'https://www.nps.gov/lacl/planyourvisit/camping.htm' },
  { parkCode: 'lacl', type: 'hiking', url: 'https://www.nps.gov/lacl/planyourvisit/hiking.htm' },
  // Lassen Volcanic
  { parkCode: 'lavo', type: 'camping', url: 'https://www.nps.gov/lavo/planyourvisit/camping.htm' },
  { parkCode: 'lavo', type: 'hiking', url: 'https://www.nps.gov/lavo/planyourvisit/hiking.htm' },
  // Mammoth Cave
  { parkCode: 'maca', type: 'hours', url: 'https://www.nps.gov/maca/planyourvisit/hours.htm' },
  // Mount Rainier
  { parkCode: 'mora', type: 'camping', url: 'https://www.nps.gov/mora/planyourvisit/camping.htm' },
  { parkCode: 'mora', type: 'hiking', url: 'https://www.nps.gov/mora/planyourvisit/hiking.htm' },
  // Olympic
  { parkCode: 'olym', type: 'hiking', url: 'https://www.nps.gov/olym/planyourvisit/hiking.htm' },
  // Pinnacles
  { parkCode: 'pinn', type: 'camping', url: 'https://www.nps.gov/pinn/planyourvisit/camping.htm' },
  { parkCode: 'pinn', type: 'hiking', url: 'https://www.nps.gov/pinn/planyourvisit/hiking.htm' },
  // Saguaro
  { parkCode: 'sagu', type: 'hiking', url: 'https://www.nps.gov/sagu/planyourvisit/hiking.htm' },
  // Sequoia & Kings Canyon
  { parkCode: 'seki', type: 'camping', url: 'https://www.nps.gov/seki/planyourvisit/camping.htm' },
  { parkCode: 'seki', type: 'hiking', url: 'https://www.nps.gov/seki/planyourvisit/hiking.htm' },
  // Theodore Roosevelt
  { parkCode: 'thro', type: 'hiking', url: 'https://www.nps.gov/thro/planyourvisit/hiking.htm' },
  // Virgin Islands
  { parkCode: 'viis', type: 'hiking', url: 'https://www.nps.gov/viis/planyourvisit/hiking.htm' },
  // Voyageurs
  { parkCode: 'voya', type: 'hiking', url: 'https://www.nps.gov/voya/planyourvisit/hiking.htm' },
  // White Sands
  { parkCode: 'whsa', type: 'camping', url: 'https://www.nps.gov/whsa/planyourvisit/camping.htm' },
  { parkCode: 'whsa', type: 'hiking', url: 'https://www.nps.gov/whsa/planyourvisit/hiking.htm' },
  // Wind Cave
  { parkCode: 'wica', type: 'camping', url: 'https://www.nps.gov/wica/planyourvisit/camping.htm' },
  // Wrangell-St Elias
  { parkCode: 'wrst', type: 'camping', url: 'https://www.nps.gov/wrst/planyourvisit/camping.htm' },
  { parkCode: 'wrst', type: 'hiking', url: 'https://www.nps.gov/wrst/planyourvisit/hiking.htm' },
  // Yellowstone
  { parkCode: 'yell', type: 'hours', url: 'https://www.nps.gov/yell/planyourvisit/hours.htm' },
  { parkCode: 'yell', type: 'camping', url: 'https://www.nps.gov/yell/planyourvisit/camping.htm' },
  // Zion
  { parkCode: 'zion', type: 'camping', url: 'https://www.nps.gov/zion/planyourvisit/camping.htm' },
  { parkCode: 'zion', type: 'hiking', url: 'https://www.nps.gov/zion/planyourvisit/hiking.htm' },
];

// Broken images
const BROKEN_IMAGES = [
  'https://www.nps.gov/common/uploads/structured_data/6C2F94EA-A9A0-0894-81AB05E006326A87.jpg',
  'https://www.nps.gov/common/uploads/structured_data/6C44DA9F-0C59-F60F-254F02C5692FE7A4.jpg',
];

// Alternative URLs for different link types
function getAlternateUrl(parkCode: string, type: string, parkName: string): { url: string; source: string } | null {
  const encodedName = encodeURIComponent(parkName);
  
  switch (type) {
    case 'camping':
      return {
        url: `https://www.recreation.gov/search?q=${encodedName}`,
        source: 'Recreation.gov'
      };
    case 'hiking':
      return {
        url: `https://www.alltrails.com/search?q=${encodedName}`,
        source: 'AllTrails'
      };
    case 'hours':
      // Use the main park page for hours info
      return {
        url: `https://www.nps.gov/${parkCode}/planyourvisit/index.htm`,
        source: 'NPS Plan Your Visit'
      };
    default:
      return null;
  }
}

// Park names for generating alternate URLs
const PARK_NAMES: Record<string, string> = {
  'badl': 'Badlands National Park',
  'bibe': 'Big Bend National Park',
  'bisc': 'Biscayne National Park',
  'blca': 'Black Canyon of the Gunnison National Park',
  'brca': 'Bryce Canyon National Park',
  'cany': 'Canyonlands National Park',
  'care': 'Capitol Reef National Park',
  'chis': 'Channel Islands National Park',
  'cong': 'Congaree National Park',
  'crla': 'Crater Lake National Park',
  'cuva': 'Cuyahoga Valley National Park',
  'deva': 'Death Valley National Park',
  'dena': 'Denali National Park',
  'drto': 'Dry Tortugas National Park',
  'ever': 'Everglades National Park',
  'gaar': 'Gates of the Arctic National Park',
  'jeff': 'Gateway Arch National Park',
  'glac': 'Glacier National Park',
  'glba': 'Glacier Bay National Park',
  'grca': 'Grand Canyon National Park',
  'grte': 'Grand Teton National Park',
  'grba': 'Great Basin National Park',
  'grsm': 'Great Smoky Mountains National Park',
  'hale': 'Haleakala National Park',
  'havo': 'Hawaii Volcanoes National Park',
  'hosp': 'Hot Springs National Park',
  'indu': 'Indiana Dunes National Park',
  'isro': 'Isle Royale National Park',
  'jotr': 'Joshua Tree National Park',
  'katm': 'Katmai National Park',
  'kova': 'Kobuk Valley National Park',
  'lacl': 'Lake Clark National Park',
  'lavo': 'Lassen Volcanic National Park',
  'maca': 'Mammoth Cave National Park',
  'mora': 'Mount Rainier National Park',
  'olym': 'Olympic National Park',
  'pinn': 'Pinnacles National Park',
  'sagu': 'Saguaro National Park',
  'seki': 'Sequoia Kings Canyon National Park',
  'thro': 'Theodore Roosevelt National Park',
  'viis': 'Virgin Islands National Park',
  'voya': 'Voyageurs National Park',
  'whsa': 'White Sands National Park',
  'wica': 'Wind Cave National Park',
  'wrst': 'Wrangell St Elias National Park',
  'yell': 'Yellowstone National Park',
  'zion': 'Zion National Park',
};

async function main() {
  console.log('============================================================');
  console.log('Fixing Broken NPS Links');
  console.log('============================================================\n');

  const npsLinksPath = path.join(__dirname, '../../src/data/validatedNpsLinks.ts');
  
  if (!fs.existsSync(npsLinksPath)) {
    console.error('NPS links file not found:', npsLinksPath);
    process.exit(1);
  }

  let content = fs.readFileSync(npsLinksPath, 'utf-8');
  let fixedCount = 0;

  // Fix each broken link
  for (const broken of BROKEN_LINKS) {
    const parkName = PARK_NAMES[broken.parkCode] || broken.parkCode;
    const alternate = getAlternateUrl(broken.parkCode, broken.type, parkName);
    
    // Find and replace the link entry
    // Pattern: { url: 'URL', title: 'TITLE', type: 'TYPE', isValid: true }
    const urlEscaped = broken.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(\\{\\s*url:\\s*['"]${urlEscaped}['"],\\s*title:\\s*['"][^'"]+['"],\\s*type:\\s*['"]${broken.type}['"],\\s*isValid:\\s*)true(\\s*\\})`,
      'g'
    );
    
    if (alternate) {
      // Replace with isValid: false and add alternateUrl
      const replacement = `$1false, alternateUrl: '${alternate.url}', alternateSource: '${alternate.source}'$2`;
      const newContent = content.replace(pattern, replacement);
      
      if (newContent !== content) {
        content = newContent;
        fixedCount++;
        console.log(`Fixed: ${parkName} - ${broken.type}`);
      }
    } else {
      // Just mark as invalid
      const replacement = `$1false$2`;
      const newContent = content.replace(pattern, replacement);
      
      if (newContent !== content) {
        content = newContent;
        fixedCount++;
        console.log(`Marked invalid: ${parkName} - ${broken.type}`);
      }
    }
  }

  // Fix broken images by removing them or marking them
  for (const imageUrl of BROKEN_IMAGES) {
    const urlEscaped = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Remove the broken image entry entirely
    const imagePattern = new RegExp(
      `\\s*\\{\\s*url:\\s*['"]${urlEscaped}['"],\\s*caption:\\s*['"][^'"]*['"]\\s*\\},?`,
      'g'
    );
    const newContent = content.replace(imagePattern, '');
    if (newContent !== content) {
      content = newContent;
      console.log(`Removed broken image: ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
    }
  }

  // Update the generation timestamp
  const now = new Date().toISOString();
  content = content.replace(
    /Generated: \d{4}-\d{2}-\d{2}T[^\n]+/,
    `Generated: ${now}`
  );

  // Write back the fixed content
  fs.writeFileSync(npsLinksPath, content);

  console.log(`\n============================================================`);
  console.log(`Fixed ${fixedCount} broken links`);
  console.log(`File updated: ${npsLinksPath}`);
  console.log(`============================================================`);
}

main().catch(console.error);
