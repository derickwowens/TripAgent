/**
 * Link Validation Test
 * 
 * Validates all curated links in our authoritative database.
 * Run this regularly to ensure NO BROKEN LINKS!
 * 
 * Usage:
 *   npx tsx data/tests/validateLinks.test.ts [state]
 *   npx tsx data/tests/validateLinks.test.ts WI
 *   npx tsx data/tests/validateLinks.test.ts FL
 *   npx tsx data/tests/validateLinks.test.ts all
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { validateUrl, printReport, type LinkValidationResult, type ValidationReport } from '../sync/linkValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CuratedLinksFile {
  _meta: {
    state: string;
    stateName: string;
    lastUpdated: string;
    lastValidated: string | null;
  };
  parks: Record<string, {
    name: string;
    links: Record<string, string>;
  }>;
}

async function loadLinksFile(stateCode: string): Promise<CuratedLinksFile> {
  const filePath = join(__dirname, '../sources/links', `${stateCode.toUpperCase()}.json`);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function getAvailableStates(): Promise<string[]> {
  const linksDir = join(__dirname, '../sources/links');
  try {
    const files = await readdir(linksDir);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

async function validateStateLinks(stateCode: string): Promise<ValidationReport> {
  console.log(`\nValidating ${stateCode} links...`);
  console.log('-'.repeat(40));

  const linksFile = await loadLinksFile(stateCode);
  const results: LinkValidationResult[] = [];
  
  const parks = Object.entries(linksFile.parks);
  let completed = 0;
  const total = parks.reduce((sum, [, park]) => sum + Object.keys(park.links).length, 0);

  for (const [parkId, park] of parks) {
    console.log(`\n${park.name}:`);
    
    for (const [linkType, url] of Object.entries(park.links)) {
      completed++;
      process.stdout.write(`  [${completed}/${total}] ${linkType}... `);
      
      const result = await validateUrl(url);
      result.parkId = parkId;
      result.parkName = park.name;
      result.linkType = linkType;
      results.push(result);

      // Print status
      if (result.status === 'ok') {
        console.log(`OK (${result.responseTime}ms)`);
      } else if (result.status === 'browser_only') {
        console.log(`BROWSER-ONLY (works in browser, blocks automated requests)`);
      } else if (result.status === 'redirect') {
        console.log(`REDIRECT -> ${result.redirectUrl?.substring(0, 50)}...`);
      } else {
        console.log(`BROKEN [${result.httpStatus || 'ERR'}] ${result.error || ''}`);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Generate report
  const report = generateReport(results, stateCode, linksFile._meta.stateName);
  
  // Update lastValidated in the links file
  linksFile._meta.lastValidated = new Date().toISOString();
  const filePath = join(__dirname, '../sources/links', `${stateCode.toUpperCase()}.json`);
  await writeFile(filePath, JSON.stringify(linksFile, null, 2));

  return report;
}

function generateReport(
  results: LinkValidationResult[], 
  stateCode: string,
  stateName: string
): ValidationReport {
  const byStatus: Record<string, number> = {};
  const byLinkType: Record<string, { total: number; broken: number }> = {};
  const brokenByParkMap = new Map<string, { parkId: string; parkName: string; count: number }>();

  for (const result of results) {
    byStatus[result.status] = (byStatus[result.status] || 0) + 1;

    if (result.linkType) {
      if (!byLinkType[result.linkType]) {
        byLinkType[result.linkType] = { total: 0, broken: 0 };
      }
      byLinkType[result.linkType].total++;
      if (result.status === 'broken' || result.status === 'error') {
        byLinkType[result.linkType].broken++;
      }
    }

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
      brokenByPark: Array.from(brokenByParkMap.values())
        .map(p => ({ parkId: p.parkId, parkName: p.parkName, brokenCount: p.count })),
    },
  };
}

function printFinalReport(reports: Map<string, ValidationReport>): void {
  console.log('\n' + '='.repeat(60));
  console.log('FINAL LINK VALIDATION REPORT');
  console.log('='.repeat(60));

  let totalLinks = 0;
  let totalValid = 0;
  let totalBroken = 0;

  for (const [state, report] of reports) {
    console.log(`\n${state}:`);
    const browserOnlyNote = report.browserOnly > 0 ? ` (${report.browserOnly} browser-only)` : '';
    console.log(`  Total: ${report.totalLinks} | Valid: ${report.validLinks}${browserOnlyNote} | Broken: ${report.brokenLinks + report.errors}`);
    
    totalLinks += report.totalLinks;
    totalValid += report.validLinks;
    totalBroken += report.brokenLinks + report.errors;

    // List broken links
    const broken = report.results.filter(r => r.status === 'broken' || r.status === 'error');
    if (broken.length > 0) {
      console.log('  Broken:');
      for (const b of broken) {
        console.log(`    - ${b.parkName}: ${b.linkType} (${b.httpStatus || 'ERR'})`);
        console.log(`      ${b.url}`);
      }
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('TOTALS:');
  console.log(`  Links Checked: ${totalLinks}`);
  console.log(`  Valid:         ${totalValid} (${((totalValid / totalLinks) * 100).toFixed(1)}%)`);
  console.log(`  Broken:        ${totalBroken}`);
  
  if (totalBroken === 0) {
    console.log('\n  STATUS: ALL LINKS VALID');
  } else {
    console.log(`\n  STATUS: ${totalBroken} BROKEN LINKS NEED ATTENTION`);
  }
  console.log('='.repeat(60));
}

async function main() {
  const args = process.argv.slice(2);
  const target = args[0]?.toUpperCase() || 'ALL';

  console.log('='.repeat(60));
  console.log('TRIPAGENT LINK VALIDATION');
  console.log('Ensuring our authoritative database has NO broken links!');
  console.log('='.repeat(60));

  const reports = new Map<string, ValidationReport>();

  if (target === 'ALL') {
    const states = await getAvailableStates();
    console.log(`\nValidating all states: ${states.join(', ')}`);
    
    for (const state of states) {
      const report = await validateStateLinks(state);
      reports.set(state, report);
    }
  } else {
    const report = await validateStateLinks(target);
    reports.set(target, report);
  }

  printFinalReport(reports);

  // Exit with error code if any broken links
  const hasBroken = Array.from(reports.values()).some(r => r.brokenLinks > 0 || r.errors > 0);
  process.exit(hasBroken ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
