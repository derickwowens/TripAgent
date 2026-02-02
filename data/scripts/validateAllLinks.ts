/**
 * Comprehensive Link Validation Script
 * Validates all links across the database:
 * - State park links (FL, WI)
 * - NPS links (validatedNpsLinks.ts)
 * - Trail links (AllTrails URLs)
 * 
 * Usage: npx ts-node data/scripts/validateAllLinks.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LinkResult {
  source: string;
  parkName: string;
  linkType: string;
  url: string;
  status: number | 'error';
  ok: boolean;
  error?: string;
  redirectUrl?: string;
}

interface ValidationReport {
  timestamp: string;
  totalLinks: number;
  validLinks: number;
  brokenLinks: number;
  redirectedLinks: number;
  results: LinkResult[];
}

const TIMEOUT_MS = 10000;
const CONCURRENT_REQUESTS = 5;
const DELAY_BETWEEN_BATCHES = 1000;

async function checkUrl(url: string): Promise<{ status: number | 'error'; ok: boolean; error?: string; redirectUrl?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    clearTimeout(timeoutId);

    // Check for redirects
    const redirectUrl = response.redirected ? response.url : undefined;

    // Some sites return 405 for HEAD, try GET
    if (response.status === 405) {
      const getResponse = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      return {
        status: getResponse.status,
        ok: getResponse.ok,
        redirectUrl: getResponse.redirected ? getResponse.url : undefined,
      };
    }

    return {
      status: response.status,
      ok: response.ok,
      redirectUrl,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { status: 'error', ok: false, error: 'Timeout' };
    }
    return { status: 'error', ok: false, error: error.message || 'Unknown error' };
  }
}

async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>,
  delayMs: number = 0
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    
    if (delayMs > 0 && i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // Progress indicator
    const processed = Math.min(i + batchSize, items.length);
    process.stdout.write(`\rProgress: ${processed}/${items.length} links checked...`);
  }
  console.log('');
  
  return results;
}

interface LinkToCheck {
  source: string;
  parkName: string;
  linkType: string;
  url: string;
}

function collectStateParkLinks(): LinkToCheck[] {
  const links: LinkToCheck[] = [];
  const linksDir = path.join(__dirname, '../sources/links');
  
  if (!fs.existsSync(linksDir)) {
    console.log('No state park links directory found');
    return links;
  }
  
  const files = fs.readdirSync(linksDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(linksDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const state = data._meta?.stateName || file.replace('.json', '');
    
    for (const [parkId, park] of Object.entries(data.parks || {})) {
      const parkData = park as any;
      const parkName = parkData.name || parkId;
      
      for (const [linkType, url] of Object.entries(parkData.links || {})) {
        if (typeof url === 'string' && url.startsWith('http')) {
          links.push({
            source: `State Parks - ${state}`,
            parkName,
            linkType,
            url,
          });
        }
      }
    }
  }
  
  return links;
}

function collectNpsLinks(): LinkToCheck[] {
  const links: LinkToCheck[] = [];
  const npsLinksPath = path.join(__dirname, '../../src/data/validatedNpsLinks.ts');
  
  if (!fs.existsSync(npsLinksPath)) {
    console.log('No NPS links file found');
    return links;
  }
  
  const content = fs.readFileSync(npsLinksPath, 'utf-8');
  
  // Parse the TypeScript file to extract URLs
  // Match pattern: { url: 'https://...', title: '...', type: '...', isValid: true/false }
  const linkPattern = /{\s*url:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"],\s*type:\s*['"]([^'"]+)['"],\s*isValid:\s*(true|false)/g;
  const parkPattern = /parkName:\s*['"]([^'"]+)['"]/g;
  
  // Find all park names first
  const parkNames: string[] = [];
  let parkMatch;
  while ((parkMatch = parkPattern.exec(content)) !== null) {
    parkNames.push(parkMatch[1]);
  }
  
  // Now find all links - associate with parks based on position
  let currentParkIndex = -1;
  let lastIndex = 0;
  
  // Split content by park blocks
  const parkBlocks = content.split(/parkCode:\s*['"][^'"]+['"]/);
  
  for (let i = 1; i < parkBlocks.length && i - 1 < parkNames.length; i++) {
    const block = parkBlocks[i];
    const parkName = parkNames[i - 1];
    
    let linkMatch;
    const blockLinkPattern = /{\s*url:\s*['"]([^'"]+)['"],\s*title:\s*['"]([^'"]+)['"],\s*type:\s*['"]([^'"]+)['"],\s*isValid:\s*(true|false)/g;
    
    while ((linkMatch = blockLinkPattern.exec(block)) !== null) {
      links.push({
        source: 'NPS Links',
        parkName,
        linkType: linkMatch[3],
        url: linkMatch[1],
      });
    }
    
    // Also check image URLs
    const imagePattern = /url:\s*['"]([^'"]+\.(?:jpg|png|gif|webp))['"]/gi;
    let imageMatch;
    while ((imageMatch = imagePattern.exec(block)) !== null) {
      links.push({
        source: 'NPS Images',
        parkName,
        linkType: 'image',
        url: imageMatch[1],
      });
    }
  }
  
  return links;
}

function collectTrailLinks(): LinkToCheck[] {
  const links: LinkToCheck[] = [];
  const trailsDir = path.join(__dirname, '../sources/trails');
  
  if (!fs.existsSync(trailsDir)) {
    console.log('No trails directory found');
    return links;
  }
  
  const files = fs.readdirSync(trailsDir).filter(f => f.endsWith('.json') && !f.includes('COVERAGE'));
  
  for (const file of files) {
    const filePath = path.join(trailsDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    for (const [parkCode, park] of Object.entries(data.parks || {})) {
      const parkData = park as any;
      const parkName = parkData.parkName || parkCode;
      
      for (const trail of parkData.trails || []) {
        if (trail.allTrailsUrl) {
          links.push({
            source: 'Trail Links',
            parkName,
            linkType: 'alltrails',
            url: trail.allTrailsUrl,
          });
        }
        if (trail.npsUrl) {
          links.push({
            source: 'Trail Links',
            parkName,
            linkType: 'nps',
            url: trail.npsUrl,
          });
        }
        if (trail.googleMapsUrl) {
          links.push({
            source: 'Trail Links',
            parkName,
            linkType: 'googleMaps',
            url: trail.googleMapsUrl,
          });
        }
      }
    }
  }
  
  return links;
}

async function main() {
  console.log('============================================================');
  console.log('Comprehensive Link Validation');
  console.log('============================================================\n');

  // Collect all links
  console.log('Collecting links from all sources...');
  
  const stateParkLinks = collectStateParkLinks();
  console.log(`  - State Park links: ${stateParkLinks.length}`);
  
  const npsLinks = collectNpsLinks();
  console.log(`  - NPS links: ${npsLinks.length}`);
  
  const trailLinks = collectTrailLinks();
  console.log(`  - Trail links: ${trailLinks.length}`);
  
  const allLinks = [...stateParkLinks, ...npsLinks, ...trailLinks];
  
  // Deduplicate by URL
  const uniqueLinks = Array.from(
    new Map(allLinks.map(l => [l.url, l])).values()
  );
  
  console.log(`\nTotal unique links to check: ${uniqueLinks.length}\n`);
  
  if (uniqueLinks.length === 0) {
    console.log('No links found to validate.');
    return;
  }

  // Validate links
  console.log('Validating links (this may take a few minutes)...\n');
  
  const results = await processInBatches(
    uniqueLinks,
    CONCURRENT_REQUESTS,
    async (link): Promise<LinkResult> => {
      const result = await checkUrl(link.url);
      return {
        ...link,
        status: result.status,
        ok: result.ok,
        error: result.error,
        redirectUrl: result.redirectUrl,
      };
    },
    DELAY_BETWEEN_BATCHES
  );

  // Generate report
  const brokenLinks = results.filter(r => !r.ok);
  const redirectedLinks = results.filter(r => r.ok && r.redirectUrl);
  const validLinks = results.filter(r => r.ok && !r.redirectUrl);

  const report: ValidationReport = {
    timestamp: new Date().toISOString(),
    totalLinks: results.length,
    validLinks: validLinks.length,
    brokenLinks: brokenLinks.length,
    redirectedLinks: redirectedLinks.length,
    results,
  };

  // Save report
  const reportPath = path.join(__dirname, '../sources/LINK_VALIDATION_REPORT.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  // Print summary
  console.log('\n============================================================');
  console.log('VALIDATION SUMMARY');
  console.log('============================================================\n');
  console.log(`Total links checked: ${results.length}`);
  console.log(`Valid links: ${validLinks.length} (${((validLinks.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`Redirected links: ${redirectedLinks.length}`);
  console.log(`Broken links: ${brokenLinks.length}`);

  if (brokenLinks.length > 0) {
    console.log('\n============================================================');
    console.log('BROKEN LINKS');
    console.log('============================================================\n');
    
    // Group by source
    const bySource = brokenLinks.reduce((acc, link) => {
      if (!acc[link.source]) acc[link.source] = [];
      acc[link.source].push(link);
      return acc;
    }, {} as Record<string, LinkResult[]>);
    
    for (const [source, links] of Object.entries(bySource)) {
      console.log(`\n--- ${source} (${links.length} broken) ---`);
      for (const link of links) {
        console.log(`  ${link.parkName}`);
        console.log(`    Type: ${link.linkType}`);
        console.log(`    URL: ${link.url}`);
        console.log(`    Status: ${link.status}${link.error ? ` (${link.error})` : ''}`);
      }
    }
  }

  if (redirectedLinks.length > 0) {
    console.log('\n============================================================');
    console.log('REDIRECTED LINKS (may need updating)');
    console.log('============================================================\n');
    
    for (const link of redirectedLinks.slice(0, 20)) {
      console.log(`  ${link.parkName} - ${link.linkType}`);
      console.log(`    From: ${link.url}`);
      console.log(`    To: ${link.redirectUrl}`);
    }
    if (redirectedLinks.length > 20) {
      console.log(`  ... and ${redirectedLinks.length - 20} more`);
    }
  }

  console.log(`\nFull report saved to: ${reportPath}`);
}

main().catch(console.error);
