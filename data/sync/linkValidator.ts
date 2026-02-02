/**
 * Link Validator
 * 
 * Validates that all curated links in our database are working.
 * Part of our commitment: No broken links - we are the authoritative source!
 */

import type { OfficialLink, NormalizedPark } from '../schema/park.schema.js';

export interface LinkValidationResult {
  url: string;
  parkId?: string;
  parkName?: string;
  linkType?: string;
  status: 'ok' | 'redirect' | 'broken' | 'timeout' | 'error' | 'browser_only';
  httpStatus?: number;
  redirectUrl?: string;
  responseTime?: number;
  error?: string;
  lastChecked: string;
}

// Sites that block automated requests but work in browsers
const BROWSER_ONLY_DOMAINS = [
  'wisconsin.goingtocamp.com',
  'goingtocamp.com',
  'reserveamerica.com',
];

export interface ValidationReport {
  timestamp: string;
  totalLinks: number;
  validLinks: number;
  brokenLinks: number;
  redirects: number;
  browserOnly: number;
  timeouts: number;
  errors: number;
  results: LinkValidationResult[];
  summary: {
    byStatus: Record<string, number>;
    byLinkType: Record<string, { total: number; broken: number }>;
    brokenByPark: Array<{ parkId: string; parkName: string; brokenCount: number }>;
  };
}

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const RATE_LIMIT_DELAY = 200;  // 200ms between requests

/**
 * Validate a single URL
 */
export async function validateUrl(
  url: string,
  timeout = DEFAULT_TIMEOUT
): Promise<LinkValidationResult> {
  const startTime = Date.now();
  const result: LinkValidationResult = {
    url,
    status: 'error',
    lastChecked: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading full page
      redirect: 'manual', // Don't follow redirects automatically
      signal: controller.signal,
      headers: {
        'User-Agent': 'TripAgent-LinkValidator/1.0 (link verification)',
      },
    });

    clearTimeout(timeoutId);
    result.responseTime = Date.now() - startTime;
    result.httpStatus = response.status;

    if (response.status >= 200 && response.status < 300) {
      result.status = 'ok';
    } else if (response.status >= 300 && response.status < 400) {
      result.status = 'redirect';
      result.redirectUrl = response.headers.get('location') || undefined;
    } else if (response.status === 403) {
      // Check if this is a known browser-only site
      const urlObj = new URL(url);
      const isBrowserOnly = BROWSER_ONLY_DOMAINS.some(domain => 
        urlObj.hostname.includes(domain)
      );
      
      if (isBrowserOnly) {
        // Mark as browser_only - works in browser but blocks automated requests
        result.status = 'browser_only';
      } else {
        // Try GET request for other 403s
        try {
          const getResponse = await fetch(url, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; TripAgent/1.0)',
            },
          });
          result.httpStatus = getResponse.status;
          result.status = getResponse.ok ? 'ok' : 'broken';
        } catch {
          result.status = 'broken';
        }
      }
    } else {
      result.status = 'broken';
    }
  } catch (error: any) {
    result.responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      result.status = 'timeout';
      result.error = `Request timed out after ${timeout}ms`;
    } else {
      result.status = 'error';
      result.error = error.message;
    }
  }

  return result;
}

/**
 * Validate all links for a park
 */
export async function validateParkLinks(park: NormalizedPark): Promise<LinkValidationResult[]> {
  const results: LinkValidationResult[] = [];

  if (!park.officialLinks || park.officialLinks.length === 0) {
    return results;
  }

  for (const link of park.officialLinks) {
    const result = await validateUrl(link.url);
    result.parkId = park.id;
    result.parkName = park.name;
    result.linkType = link.type;
    results.push(result);
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
  }

  return results;
}

/**
 * Validate all links in a list of parks
 */
export async function validateAllLinks(
  parks: NormalizedPark[],
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<ValidationReport> {
  const allResults: LinkValidationResult[] = [];
  let totalLinks = 0;

  // Count total links
  for (const park of parks) {
    totalLinks += park.officialLinks?.length || 0;
  }

  let completed = 0;

  for (const park of parks) {
    if (park.officialLinks) {
      for (const link of park.officialLinks) {
        if (onProgress) {
          onProgress(completed, totalLinks, `${park.name}: ${link.type}`);
        }

        const result = await validateUrl(link.url);
        result.parkId = park.id;
        result.parkName = park.name;
        result.linkType = link.type;
        allResults.push(result);

        completed++;
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    }
  }

  return generateReport(allResults);
}

/**
 * Generate a validation report from results
 */
function generateReport(results: LinkValidationResult[]): ValidationReport {
  const byStatus: Record<string, number> = {};
  const byLinkType: Record<string, { total: number; broken: number }> = {};
  const brokenByParkMap = new Map<string, { parkId: string; parkName: string; count: number }>();

  for (const result of results) {
    // Count by status
    byStatus[result.status] = (byStatus[result.status] || 0) + 1;

    // Count by link type
    if (result.linkType) {
      if (!byLinkType[result.linkType]) {
        byLinkType[result.linkType] = { total: 0, broken: 0 };
      }
      byLinkType[result.linkType].total++;
      if (result.status === 'broken' || result.status === 'error') {
        byLinkType[result.linkType].broken++;
      }
    }

    // Track broken links by park
    if ((result.status === 'broken' || result.status === 'error') && result.parkId) {
      const existing = brokenByParkMap.get(result.parkId);
      if (existing) {
        existing.count++;
      } else {
        brokenByParkMap.set(result.parkId, {
          parkId: result.parkId,
          parkName: result.parkName || result.parkId,
          count: 1,
        });
      }
    }
  }

  const brokenByPark = Array.from(brokenByParkMap.values())
    .map(p => ({ parkId: p.parkId, parkName: p.parkName, brokenCount: p.count }))
    .sort((a, b) => b.brokenCount - a.brokenCount);

  return {
    timestamp: new Date().toISOString(),
    totalLinks: results.length,
    validLinks: (byStatus['ok'] || 0) + (byStatus['browser_only'] || 0),
    brokenLinks: byStatus['broken'] || 0,
    redirects: byStatus['redirect'] || 0,
    browserOnly: byStatus['browser_only'] || 0,
    timeouts: byStatus['timeout'] || 0,
    errors: byStatus['error'] || 0,
    results,
    summary: {
      byStatus,
      byLinkType,
      brokenByPark,
    },
  };
}

/**
 * Print a validation report to console
 */
export function printReport(report: ValidationReport): void {
  console.log('\n' + '='.repeat(60));
  console.log('LINK VALIDATION REPORT');
  console.log('='.repeat(60));
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total Links: ${report.totalLinks}`);
  console.log('');
  console.log('STATUS SUMMARY:');
  console.log(`  Valid:    ${report.validLinks} (${((report.validLinks / report.totalLinks) * 100).toFixed(1)}%)`);
  console.log(`  Broken:   ${report.brokenLinks}`);
  console.log(`  Redirect: ${report.redirects}`);
  console.log(`  Timeout:  ${report.timeouts}`);
  console.log(`  Error:    ${report.errors}`);

  if (report.brokenLinks > 0 || report.errors > 0) {
    console.log('\nBROKEN LINKS:');
    for (const result of report.results) {
      if (result.status === 'broken' || result.status === 'error') {
        console.log(`  [${result.httpStatus || 'ERR'}] ${result.parkName || 'Unknown'}`);
        console.log(`        ${result.url}`);
        if (result.error) {
          console.log(`        Error: ${result.error}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Validate links from a curated links file
 */
export async function validateCuratedLinks(
  linksFile: Record<string, Record<string, string>>
): Promise<ValidationReport> {
  const results: LinkValidationResult[] = [];

  for (const [parkId, links] of Object.entries(linksFile)) {
    for (const [linkType, url] of Object.entries(links)) {
      console.log(`Validating: ${parkId} - ${linkType}`);
      const result = await validateUrl(url);
      result.parkId = parkId;
      result.linkType = linkType;
      results.push(result);
      
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
    }
  }

  return generateReport(results);
}
