/**
 * Comprehensive validation of park photo matching for ALL NPS parks
 * Run with: npx tsx src/tests/validate-all-parks.test.ts
 * 
 * This test fetches all parks from NPS API and validates our filter logic
 */

import 'dotenv/config';

const NPS_API_KEY = process.env.NPS_API_KEY;

if (!NPS_API_KEY) {
  console.error('❌ NPS_API_KEY not set in .env');
  process.exit(1);
}

interface NPSPark {
  parkCode: string;
  fullName: string;
  images: { url: string; caption: string; title: string }[];
}

// Our filter function (copied from chat.ts)
function filterRelevantParks(
  parks: Array<{ name: string; parkCode: string }>,
  searchQuery: string
): Array<{ name: string; parkCode: string }> {
  const cleanQuery = searchQuery
    .replace(/national park/gi, '')
    .replace(/national/gi, '')
    .replace(/park/gi, '')
    .trim()
    .toLowerCase();
  
  return parks.filter(park => {
    const parkNameLower = park.name.toLowerCase();
    const parkCodeLower = park.parkCode.toLowerCase();
    
    const coreName = parkNameLower
      .replace(/ national park$/i, '')
      .replace(/ national historical park$/i, '')
      .replace(/ national historic site$/i, '')
      .replace(/ national monument$/i, '')
      .replace(/ national recreation area$/i, '')
      .trim();
    
    if (parkCodeLower === cleanQuery) return true;
    if (coreName === cleanQuery) return true;
    if (cleanQuery.length >= 3 && coreName.includes(cleanQuery)) return true;
    if (coreName.length >= 3 && cleanQuery.includes(coreName)) return true;
    if (cleanQuery.length >= 3 && parkNameLower.includes(cleanQuery)) return true;
    
    const searchWords = cleanQuery.split(/\s+/).filter((w: string) => w.length >= 3);
    if (searchWords.length > 0) {
      const hasMatch = searchWords.some((sw: string) => 
        coreName.includes(sw) || parkNameLower.includes(sw)
      );
      if (hasMatch) return true;
    }
    
    return false;
  });
}

async function fetchAllParks(): Promise<NPSPark[]> {
  const allParks: NPSPark[] = [];
  let start = 0;
  const limit = 50;
  
  console.log('📡 Fetching all parks from NPS API...\n');
  
  while (true) {
    const url = `https://developer.nps.gov/api/v1/parks?limit=${limit}&start=${start}&api_key=${NPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) break;
    
    allParks.push(...data.data.map((p: any) => ({
      parkCode: p.parkCode,
      fullName: p.fullName,
      images: p.images || [],
    })));
    
    start += limit;
    process.stdout.write(`   Fetched ${allParks.length} parks...\r`);
    
    if (data.data.length < limit) break;
  }
  
  console.log(`\n✅ Total parks fetched: ${allParks.length}\n`);
  return allParks;
}

function generateSearchQueries(park: NPSPark): string[] {
  const queries: string[] = [];
  
  // Park code
  queries.push(park.parkCode);
  
  // Full name
  queries.push(park.fullName.toLowerCase());
  
  // Core name (without "National Park" etc)
  const coreName = park.fullName
    .replace(/ National Park$/i, '')
    .replace(/ National Historical Park$/i, '')
    .replace(/ National Historic Site$/i, '')
    .replace(/ National Monument$/i, '')
    .replace(/ National Recreation Area$/i, '')
    .replace(/ National Memorial$/i, '')
    .replace(/ National Seashore$/i, '')
    .replace(/ National Lakeshore$/i, '')
    .replace(/ National Preserve$/i, '')
    .replace(/ National Reserve$/i, '')
    .replace(/ National Battlefield$/i, '')
    .replace(/ National Military Park$/i, '')
    .trim();
  
  if (coreName !== park.fullName) {
    queries.push(coreName.toLowerCase());
  }
  
  // First word if multi-word
  const firstWord = coreName.split(' ')[0].toLowerCase();
  if (firstWord.length >= 4) {
    queries.push(firstWord);
  }
  
  return [...new Set(queries)]; // Remove duplicates
}

async function main() {
  console.log('🧪 NPS Park Photo Matching Validation\n');
  console.log('━'.repeat(60));
  
  const allParks = await fetchAllParks();
  
  // Filter to only "National Park" designated parks for focused testing
  const nationalParks = allParks.filter(p => 
    p.fullName.includes('National Park') && 
    !p.fullName.includes('Historical') &&
    !p.fullName.includes('Historic')
  );
  
  console.log(`\n🏞️ Testing ${nationalParks.length} National Parks:\n`);
  
  const failures: { park: NPSPark; queries: string[]; hasImages: boolean }[] = [];
  const successes: { park: NPSPark; matchedQuery: string; hasImages: boolean }[] = [];
  
  for (const park of nationalParks) {
    const mockParks = [{ name: park.fullName, parkCode: park.parkCode }];
    const queries = generateSearchQueries(park);
    
    let matched = false;
    let matchedQuery = '';
    
    for (const query of queries) {
      const results = filterRelevantParks(mockParks, query);
      if (results.length > 0) {
        matched = true;
        matchedQuery = query;
        break;
      }
    }
    
    const hasImages = park.images.length > 0;
    
    if (matched) {
      successes.push({ park, matchedQuery, hasImages });
    } else {
      failures.push({ park, queries, hasImages });
    }
  }
  
  // Print results
  console.log('✅ PASSED:');
  for (const s of successes) {
    const imgStatus = s.hasImages ? `📸 ${s.park.images.length} images` : '⚠️ No images';
    console.log(`   ${s.park.parkCode.padEnd(6)} ${s.park.fullName.padEnd(45)} [${s.matchedQuery}] ${imgStatus}`);
  }
  
  if (failures.length > 0) {
    console.log('\n❌ FAILED (filter not matching):');
    for (const f of failures) {
      const imgStatus = f.hasImages ? `📸 ${f.park.images.length} images` : '⚠️ No images';
      console.log(`   ${f.park.parkCode.padEnd(6)} ${f.park.fullName.padEnd(45)} ${imgStatus}`);
      console.log(`          Tried: ${f.queries.join(', ')}`);
    }
  }
  
  // Summary
  console.log('\n' + '━'.repeat(60));
  console.log(`\n📊 Results: ${successes.length}/${nationalParks.length} parks matched`);
  
  // Check for parks without images
  const noImages = nationalParks.filter(p => p.images.length === 0);
  if (noImages.length > 0) {
    console.log(`\n⚠️ Parks with NO images in NPS API (${noImages.length}):`);
    for (const p of noImages) {
      console.log(`   ${p.parkCode.padEnd(6)} ${p.fullName}`);
    }
  }
  
  // Parks with images
  const withImages = nationalParks.filter(p => p.images.length > 0);
  console.log(`\n📸 Parks WITH images: ${withImages.length}/${nationalParks.length}`);
  
  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
