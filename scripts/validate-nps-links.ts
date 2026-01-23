#!/usr/bin/env npx ts-node
/**
 * NPS Link Validator Script
 * 
 * Queries the NPS API for all parks and validates their links.
 * Outputs a data structure of validated links to be used at runtime.
 * 
 * Usage:
 *   npx ts-node scripts/validate-nps-links.ts
 *   npm run validate-links
 * 
 * Environment:
 *   NPS_API_KEY - Required NPS API key
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NPS_API_KEY = process.env.NPS_API_KEY;
const NPS_API_BASE = 'https://developer.nps.gov/api/v1';
const OUTPUT_FILE = path.join(__dirname, '../src/data/validatedNpsLinks.ts');
const MOBILE_OUTPUT_FILE = path.join(__dirname, '../mobile/src/data/validatedNpsLinks.ts');

interface NpsPark {
  parkCode: string;
  fullName: string;
  url: string;
  activities: Array<{ id: string; name: string }>;
  topics: Array<{ id: string; name: string }>;
  operatingHours: Array<{
    description: string;
    standardHours: Record<string, string>;
    name: string;
  }>;
  entranceFees: Array<{
    cost: string;
    description: string;
    title: string;
  }>;
  contacts: {
    phoneNumbers: Array<{ phoneNumber: string; type: string }>;
    emailAddresses: Array<{ emailAddress: string }>;
  };
  images: Array<{
    url: string;
    title: string;
    caption: string;
    altText: string;
  }>;
}

interface ValidatedLink {
  url: string;
  title: string;
  type: 'main' | 'planyourvisit' | 'fees' | 'hours' | 'camping' | 'hiking' | 'alerts' | 'other';
  lastValidated: string;
  isValid: boolean;
  alternateUrl?: string;  // Fallback URL when NPS page doesn't exist
  alternateSource?: string;  // Name of alternate source (e.g., "Recreation.gov", "AllTrails")
}

interface ParkLinks {
  parkCode: string;
  parkName: string;
  mainUrl: string;
  validatedLinks: ValidatedLink[];
  images: Array<{ url: string; caption: string }>;
}

// Common NPS subpage patterns to check
const SUBPAGES_TO_CHECK = [
  { path: 'index.htm', type: 'main' as const, title: 'Park Information' },
  { path: 'planyourvisit/index.htm', type: 'planyourvisit' as const, title: 'Plan Your Visit' },
  { path: 'planyourvisit/fees.htm', type: 'fees' as const, title: 'Fees & Passes' },
  { path: 'planyourvisit/hours.htm', type: 'hours' as const, title: 'Hours & Seasons' },
  { path: 'planyourvisit/camping.htm', type: 'camping' as const, title: 'Camping' },
  { path: 'planyourvisit/hiking.htm', type: 'hiking' as const, title: 'Hiking' },
  { path: 'planyourvisit/basicinfo.htm', type: 'other' as const, title: 'Basic Information' },
  { path: 'planyourvisit/conditions.htm', type: 'alerts' as const, title: 'Current Conditions' },
];

/**
 * Alternate link sources for when NPS pages don't exist
 * These are reliable third-party sources for park information
 */
function getAlternateLink(type: string, parkName: string, parkCode: string): { url: string; source: string } | null {
  const encodedFullName = encodeURIComponent(parkName);
  
  switch (type) {
    case 'camping':
      // Recreation.gov is the official reservation system for NPS campgrounds
      return {
        url: `https://www.recreation.gov/search?q=${encodedFullName}`,
        source: 'Recreation.gov'
      };
    
    case 'hiking':
      // AllTrails is the most comprehensive hiking resource
      return {
        url: `https://www.alltrails.com/search?q=${encodedFullName}`,
        source: 'AllTrails'
      };
    
    case 'fees':
      // Link to NPS fees overview page (always exists)
      return {
        url: `https://www.nps.gov/aboutus/fees-and-passes.htm`,
        source: 'NPS Fees Overview'
      };
    
    case 'hours':
      // Google search for park hours (reliable fallback)
      return {
        url: `https://www.google.com/search?q=${encodedFullName}+hours+seasons`,
        source: 'Google Search'
      };
    
    case 'alerts':
      // NPS alerts API endpoint or general page
      return {
        url: `https://www.nps.gov/${parkCode}/planyourvisit/conditions.htm`,
        source: 'NPS Conditions'
      };
    
    case 'planyourvisit':
      // TripAdvisor has good planning info
      return {
        url: `https://www.tripadvisor.com/Search?q=${encodedFullName}`,
        source: 'TripAdvisor'
      };
    
    case 'other':
      // Wikipedia as general fallback
      return {
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(parkName.replace(/ /g, '_'))}`,
        source: 'Wikipedia'
      };
    
    default:
      return null;
  }
}

/**
 * Validate a URL by making a HEAD request
 */
async function validateUrl(url: string, timeout = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'TripAgent-LinkValidator/1.0 (Link validation for mobile app)',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    
    clearTimeout(timeoutId);
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

/**
 * Fetch all parks from NPS API
 */
async function fetchAllParks(): Promise<NpsPark[]> {
  if (!NPS_API_KEY) {
    throw new Error('NPS_API_KEY environment variable is required');
  }

  const parks: NpsPark[] = [];
  let start = 0;
  const limit = 50;
  
  console.log('📡 Fetching all NPS sites from API...');
  console.log('   (includes monuments, historic sites, battlefields, etc.)');
  
  while (true) {
    const url = `${NPS_API_BASE}/parks?limit=${limit}&start=${start}&api_key=${NPS_API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NPS API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    parks.push(...data.data);
    
    process.stdout.write(`\r  Fetched ${parks.length} NPS sites...`);
    
    if (data.data.length < limit) {
      break;
    }
    start += limit;
    
    // Rate limiting - be nice to the API
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('\n');
  return parks;
}

/**
 * Validate links for a single park
 */
async function validateParkLinks(park: NpsPark): Promise<ParkLinks> {
  const baseUrl = `https://www.nps.gov/${park.parkCode}`;
  const validatedLinks: ValidatedLink[] = [];
  const now = new Date().toISOString();
  
  // Validate each subpage
  for (const subpage of SUBPAGES_TO_CHECK) {
    const url = `${baseUrl}/${subpage.path}`;
    const isValid = await validateUrl(url);
    
    // Get alternate link if NPS page is invalid
    const alternate = !isValid ? getAlternateLink(subpage.type, park.fullName, park.parkCode) : null;
    
    validatedLinks.push({
      url,
      title: subpage.title,
      type: subpage.type,
      lastValidated: now,
      isValid,
      ...(alternate && { alternateUrl: alternate.url, alternateSource: alternate.source }),
    });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Validate image URLs (first 3)
  const validImages: Array<{ url: string; caption: string }> = [];
  for (const image of park.images.slice(0, 3)) {
    const isValid = await validateUrl(image.url);
    if (isValid) {
      validImages.push({
        url: image.url,
        caption: image.caption || image.title || park.fullName,
      });
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  return {
    parkCode: park.parkCode,
    parkName: park.fullName,
    mainUrl: `${baseUrl}/index.htm`,
    validatedLinks,
    images: validImages,
  };
}

/**
 * Generate TypeScript data file
 */
function generateOutputFile(parkLinks: ParkLinks[]): string {
  const timestamp = new Date().toISOString();
  
  // Count stats
  const totalLinks = parkLinks.reduce((sum, p) => sum + p.validatedLinks.length, 0);
  const validLinks = parkLinks.reduce(
    (sum, p) => sum + p.validatedLinks.filter(l => l.isValid).length,
    0
  );
  const linksWithAlternates = parkLinks.reduce(
    (sum, p) => sum + p.validatedLinks.filter(l => !l.isValid && l.alternateUrl).length,
    0
  );
  
  const output = `/**
 * Validated NPS Links
 * Auto-generated by scripts/validate-nps-links.ts
 * 
 * Generated: ${timestamp}
 * Total Parks: ${parkLinks.length}
 * Total Links Checked: ${totalLinks}
 * Valid NPS Links: ${validLinks} (${((validLinks / totalLinks) * 100).toFixed(1)}%)
 * Invalid with Alternates: ${linksWithAlternates}
 * 
 * DO NOT EDIT MANUALLY - Run 'npm run validate-links' to regenerate
 */

export interface ValidatedNpsLink {
  url: string;
  title: string;
  type: 'main' | 'planyourvisit' | 'fees' | 'hours' | 'camping' | 'hiking' | 'alerts' | 'other';
  isValid: boolean;
  alternateUrl?: string;
  alternateSource?: string;
}

export interface ParkLinkData {
  parkCode: string;
  parkName: string;
  mainUrl: string;
  links: ValidatedNpsLink[];
  images: Array<{ url: string; caption: string }>;
}

export const VALIDATED_NPS_LINKS: Record<string, ParkLinkData> = {
${parkLinks.map(park => `  '${park.parkCode}': {
    parkCode: '${park.parkCode}',
    parkName: '${park.parkName.replace(/'/g, "\\'")}',
    mainUrl: '${park.mainUrl}',
    links: [
${park.validatedLinks.map(link => {
  if (link.isValid) {
    return `      { url: '${link.url}', title: '${link.title}', type: '${link.type}', isValid: true }`;
  } else if (link.alternateUrl) {
    return `      { url: '${link.url}', title: '${link.title}', type: '${link.type}', isValid: false, alternateUrl: '${link.alternateUrl}', alternateSource: '${link.alternateSource}' }`;
  } else {
    return `      { url: '${link.url}', title: '${link.title}', type: '${link.type}', isValid: false }`;
  }
}).join(',\n')}
    ],
    images: [
${park.images.map(img => `      { url: '${img.url}', caption: '${img.caption.replace(/'/g, "\\'")}' }`).join(',\n')}
    ],
  }`).join(',\n')}
};

/**
 * Get validated links for a park
 */
export function getParkLinks(parkCode: string): ParkLinkData | undefined {
  return VALIDATED_NPS_LINKS[parkCode.toLowerCase()];
}

/**
 * Get a specific type of link for a park (returns valid NPS link or alternate)
 */
export function getParkLink(parkCode: string, type: ValidatedNpsLink['type']): { url: string; source: string } | undefined {
  const park = VALIDATED_NPS_LINKS[parkCode.toLowerCase()];
  if (!park) return undefined;
  
  const link = park.links.find(l => l.type === type);
  if (!link) return undefined;
  
  // Return valid NPS link or alternate
  if (link.isValid) {
    return { url: link.url, source: 'NPS' };
  } else if (link.alternateUrl) {
    return { url: link.alternateUrl, source: link.alternateSource || 'Alternate' };
  }
  return undefined;
}

/**
 * Get the main park URL (always returns something)
 */
export function getMainParkUrl(parkCode: string): string {
  const park = VALIDATED_NPS_LINKS[parkCode.toLowerCase()];
  return park?.mainUrl || \`https://www.nps.gov/\${parkCode.toLowerCase()}/index.htm\`;
}

/**
 * Check if we have validated links data
 */
export function hasValidatedLinks(): boolean {
  return Object.keys(VALIDATED_NPS_LINKS).length > 0;
}

export const LINK_VALIDATION_TIMESTAMP = '${timestamp}';
`;

  return output;
}

/**
 * Main execution
 */
async function main() {
  console.log('🔗 NPS Link Validator');
  console.log('====================\n');
  
  if (!NPS_API_KEY) {
    console.error('❌ Error: NPS_API_KEY environment variable is required');
    console.error('   Get a free API key at: https://www.nps.gov/subjects/developer/get-started.htm');
    process.exit(1);
  }
  
  try {
    // Fetch all parks
    const parks = await fetchAllParks();
    console.log(`✅ Found ${parks.length} total NPS sites`);
    
    // Filter to only national parks (not monuments, historic sites, etc.)
    const nationalParks = parks.filter(p => 
      p.fullName.toLowerCase().includes('national park') ||
      p.fullName.toLowerCase().includes('national and state parks')
    );
    console.log(`📍 Filtered to ${nationalParks.length} National Parks (excluding monuments, historic sites, etc.)\n`);
    
    // Validate links for each park
    const validatedParks: ParkLinks[] = [];
    let processed = 0;
    
    for (const park of nationalParks) {
      process.stdout.write(`\r  Validating ${park.parkCode.padEnd(4)} (${++processed}/${nationalParks.length})...`);
      const parkLinks = await validateParkLinks(park);
      validatedParks.push(parkLinks);
    }
    
    console.log('\n\n✅ Validation complete!\n');
    
    // Generate output
    const output = generateOutputFile(validatedParks);
    
    // Write to both locations
    fs.writeFileSync(OUTPUT_FILE, output);
    console.log(`📝 Written to: ${OUTPUT_FILE}`);
    
    fs.writeFileSync(MOBILE_OUTPUT_FILE, output);
    console.log(`📝 Written to: ${MOBILE_OUTPUT_FILE}`);
    
    // Summary
    const totalValid = validatedParks.reduce(
      (sum, p) => sum + p.validatedLinks.filter(l => l.isValid).length,
      0
    );
    const totalChecked = validatedParks.reduce(
      (sum, p) => sum + p.validatedLinks.length,
      0
    );
    const withAlternates = validatedParks.reduce(
      (sum, p) => sum + p.validatedLinks.filter(l => !l.isValid && l.alternateUrl).length,
      0
    );
    
    console.log(`\n📊 Summary:`);
    console.log(`   Parks processed: ${validatedParks.length}`);
    console.log(`   Links validated: ${totalChecked}`);
    console.log(`   Valid NPS links: ${totalValid} (${((totalValid / totalChecked) * 100).toFixed(1)}%)`);
    console.log(`   Invalid NPS links: ${totalChecked - totalValid}`);
    console.log(`   ↳ With alternates: ${withAlternates} (${((withAlternates / (totalChecked - totalValid)) * 100).toFixed(1)}%)`);
    console.log(`   Total usable links: ${totalValid + withAlternates} (${(((totalValid + withAlternates) / totalChecked) * 100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
