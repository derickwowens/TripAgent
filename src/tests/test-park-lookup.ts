import { findParkCode } from '../utils/parkCodeLookup.js';

const tests = [
  'great smoky mountains',
  'smoky mountains', 
  'smokies',
  'glacier national park',
  'glacier',
  'yellowstone',
  'yosemite national park',
  'grand canyon',
  'zion',
  'olympic national park',
  'arches',
  'rocky mountain',
  'denali',
  'acadia',
];

console.log('Park Code Lookup Tests:');
let passed = 0;
let failed = 0;

tests.forEach(q => {
  const code = findParkCode(q);
  if (code) {
    console.log(`  ✅ "${q}" -> ${code}`);
    passed++;
  } else {
    console.log(`  ❌ "${q}" -> NOT FOUND`);
    failed++;
  }
});

console.log(`\nResults: ${passed}/${tests.length} passed`);
