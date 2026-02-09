/**
 * Trail Difficulty Enrichment Script
 * 
 * Three phases:
 * 1. NORMALIZE: Convert variant difficulty values to canonical forms (easy/moderate/hard/expert)
 * 2. INFER FROM LENGTH: For trails with length but no difficulty, assign based on distance thresholds
 * 3. INFER FROM NAME: For remaining trails, use keyword patterns in trail names
 * 
 * Inferred values are marked with data_source suffix so we can distinguish them from original data.
 * 
 * Usage: npx tsx data/scripts/enrichDifficulty.ts [--dry-run]
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.app') ? { rejectUnauthorized: false } : false,
});

// ============================================
// Phase 0: Add difficulty_source column
// ============================================
async function phaseAddColumn(): Promise<void> {
  console.log('\n=== Phase 0: Ensure difficulty_source column exists ===');
  if (DRY_RUN) {
    console.log('  (dry run - would add column)');
    return;
  }
  await pool.query(`
    ALTER TABLE trails ADD COLUMN IF NOT EXISTS difficulty_source TEXT
  `);
  // Mark all existing non-null difficulties as 'original'
  const res = await pool.query(`
    UPDATE trails SET difficulty_source = 'original'
    WHERE difficulty IS NOT NULL AND difficulty != ''
      AND (difficulty_source IS NULL OR difficulty_source = '')
  `);
  console.log(`  Column added. Marked ${res.rowCount} existing difficulty values as 'original'`);
}

// ============================================
// Phase 1: Normalize existing difficulty values
// ============================================
const NORMALIZE_MAP: Record<string, string> = {
  // Already canonical
  easy: 'easy',
  moderate: 'moderate',
  hard: 'hard',
  expert: 'expert',
  // Variants -> canonical
  easiest: 'easy',
  beginner: 'easy',
  intermediate: 'moderate',
  difficult: 'hard',
  advanced: 'hard',
  strenuous: 'expert',
  very_strenuous: 'expert',
};

async function phaseNormalize(): Promise<number> {
  console.log('\n=== Phase 1: Normalize existing difficulty values ===');
  let totalUpdated = 0;

  for (const [from, to] of Object.entries(NORMALIZE_MAP)) {
    if (from === to) continue; // Skip already-canonical values

    const countRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM trails WHERE difficulty = $1`, [from]
    );
    const count = parseInt(countRes.rows[0].cnt);
    if (count === 0) continue;

    console.log(`  ${from} -> ${to}: ${count} trails`);
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE trails SET difficulty = $1, difficulty_source = 'normalized' WHERE difficulty = $2`,
        [to, from]
      );
    }
    totalUpdated += count;
  }

  console.log(`  Total normalized: ${totalUpdated}`);
  return totalUpdated;
}

// ============================================
// Phase 2: Infer from trail length
// ============================================
// Thresholds calibrated to standard hiking difficulty scales:
//   Easy:     < 3 miles (casual walk, family-friendly)
//   Moderate: 3-7 miles (half-day hike)
//   Hard:     7-15 miles (full-day hike, strenuous)
//   Expert:   > 15 miles (very long, multi-day, extreme)
const LENGTH_THRESHOLDS = {
  easy: 3,
  moderate: 7,
  hard: 15,
  // Above 15 = expert
};

function difficultyFromLength(miles: number): string {
  if (miles <= LENGTH_THRESHOLDS.easy) return 'easy';
  if (miles <= LENGTH_THRESHOLDS.moderate) return 'moderate';
  if (miles <= LENGTH_THRESHOLDS.hard) return 'hard';
  return 'expert';
}

async function phaseInferFromLength(): Promise<number> {
  console.log('\n=== Phase 2: Infer difficulty from trail length ===');

  // Get all trails with length but no difficulty
  const { rows } = await pool.query(`
    SELECT id, length_miles FROM trails
    WHERE (difficulty IS NULL OR difficulty = '')
      AND length_miles IS NOT NULL AND length_miles > 0
  `);

  console.log(`  Candidates: ${rows.length} trails with length but no difficulty`);

  // Batch by inferred difficulty for efficient updates
  const batches: Record<string, string[]> = { easy: [], moderate: [], hard: [], expert: [] };
  for (const row of rows) {
    const diff = difficultyFromLength(row.length_miles);
    batches[diff].push(row.id);
  }

  let totalUpdated = 0;
  for (const [diff, ids] of Object.entries(batches)) {
    console.log(`  ${diff}: ${ids.length} trails`);
    if (ids.length === 0) continue;

    if (!DRY_RUN) {
      // Update in chunks of 5000 to avoid query size limits
      const CHUNK = 5000;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const placeholders = chunk.map((_, idx) => `$${idx + 2}`).join(',');
        await pool.query(
          `UPDATE trails SET difficulty = $1, difficulty_source = 'inferred_length' WHERE id IN (${placeholders})`,
          [diff, ...chunk]
        );
      }
    }
    totalUpdated += ids.length;
  }

  console.log(`  Total inferred from length: ${totalUpdated}`);
  return totalUpdated;
}

// ============================================
// Phase 3: Infer from trail name keywords
// ============================================
const NAME_PATTERNS: Array<{ pattern: RegExp; difficulty: string }> = [
  // Expert indicators
  { pattern: /\b(scramble|mountaineer|glacier|technical|backcountry route)\b/i, difficulty: 'expert' },
  // Hard indicators
  { pattern: /\b(summit|peak|ridge|butte|saddle|pass|canyon rim|overlook trail)\b/i, difficulty: 'hard' },
  // Easy indicators
  { pattern: /\b(nature (walk|trail)|accessible|interpretive|boardwalk|paved|wheelchair|ada |sensory|discovery|visitor center)\b/i, difficulty: 'easy' },
  // Moderate indicators (generic hiking terms)
  { pattern: /\b(loop trail|creek trail|lake trail|falls trail|river trail|forest trail)\b/i, difficulty: 'moderate' },
];

async function phaseInferFromName(): Promise<number> {
  console.log('\n=== Phase 3: Infer difficulty from trail name keywords ===');

  const { rows } = await pool.query(`
    SELECT id, name FROM trails
    WHERE (difficulty IS NULL OR difficulty = '')
  `);

  console.log(`  Remaining trails without difficulty: ${rows.length}`);

  const updates: Record<string, string[]> = { easy: [], moderate: [], hard: [], expert: [] };
  let matched = 0;

  for (const row of rows) {
    for (const { pattern, difficulty } of NAME_PATTERNS) {
      if (pattern.test(row.name)) {
        updates[difficulty].push(row.id);
        matched++;
        break; // First match wins
      }
    }
  }

  let totalUpdated = 0;
  for (const [diff, ids] of Object.entries(updates)) {
    if (ids.length === 0) continue;
    console.log(`  ${diff}: ${ids.length} trails (name match)`);

    if (!DRY_RUN) {
      const CHUNK = 5000;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const placeholders = chunk.map((_, idx) => `$${idx + 2}`).join(',');
        await pool.query(
          `UPDATE trails SET difficulty = $1, difficulty_source = 'inferred_name' WHERE id IN (${placeholders})`,
          [diff, ...chunk]
        );
      }
    }
    totalUpdated += ids.length;
  }

  console.log(`  Total inferred from name: ${totalUpdated}`);
  return totalUpdated;
}

// ============================================
// Main
// ============================================
async function main() {
  console.log(`=== Trail Difficulty Enrichment ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===`);

  // Before stats
  const beforeRes = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE difficulty IS NOT NULL AND difficulty != '') as with_diff
    FROM trails
  `);
  const total = parseInt(beforeRes.rows[0].total);
  const beforeDiff = parseInt(beforeRes.rows[0].with_diff);
  console.log(`\nBefore: ${beforeDiff}/${total} trails have difficulty (${(beforeDiff/total*100).toFixed(1)}%)`);

  await phaseAddColumn();
  const normalized = await phaseNormalize();
  const inferredLength = await phaseInferFromLength();
  const inferredName = await phaseInferFromName();

  // After stats
  if (!DRY_RUN) {
    const afterRes = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE difficulty IS NOT NULL AND difficulty != '') as with_diff
      FROM trails
    `);
    const afterDiff = parseInt(afterRes.rows[0].with_diff);
    console.log(`\n=== Results ===`);
    console.log(`Before: ${beforeDiff}/${total} (${(beforeDiff/total*100).toFixed(1)}%)`);
    console.log(`After:  ${afterDiff}/${total} (${(afterDiff/total*100).toFixed(1)}%)`);
    console.log(`Improvement: +${afterDiff - beforeDiff} trails`);

    // New distribution
    console.log('\n--- New Difficulty Distribution ---');
    const distRes = await pool.query(`
      SELECT COALESCE(difficulty, '<NULL>') as diff, COUNT(*) as cnt 
      FROM trails GROUP BY difficulty ORDER BY cnt DESC
    `);
    for (const row of distRes.rows) {
      console.log(`  ${row.diff}: ${row.cnt} (${(parseInt(row.cnt)/total*100).toFixed(1)}%)`);
    }

    // Source distribution
    console.log('\n--- Difficulty Source Distribution ---');
    const srcRes = await pool.query(`
      SELECT COALESCE(difficulty_source, '<none>') as src, COUNT(*) as cnt 
      FROM trails GROUP BY difficulty_source ORDER BY cnt DESC
    `);
    for (const row of srcRes.rows) {
      console.log(`  ${row.src}: ${row.cnt} (${(parseInt(row.cnt)/total*100).toFixed(1)}%)`);
    }
  } else {
    console.log(`\n=== Dry Run Summary ===`);
    console.log(`Would normalize: ${normalized} trails`);
    console.log(`Would infer from length: ${inferredLength} trails`);
    console.log(`Would infer from name: ${inferredName} trails`);
    console.log(`Estimated new coverage: ${((beforeDiff + inferredLength + inferredName) / total * 100).toFixed(1)}%`);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
