import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.app') ? { rejectUnauthorized: false } : false,
});

async function analyze() {
  console.log('=== TRAIL DIFFICULTY ANALYSIS ===\n');

  // Total trails
  const totalRes = await pool.query(`SELECT COUNT(*) as total FROM trails`);
  const total = parseInt(totalRes.rows[0].total);
  console.log(`Total trails: ${total}`);

  // Trails with difficulty
  const withDiffRes = await pool.query(`SELECT COUNT(*) as cnt FROM trails WHERE difficulty IS NOT NULL AND difficulty != ''`);
  const withDiff = parseInt(withDiffRes.rows[0].cnt);
  console.log(`With difficulty: ${withDiff} (${(withDiff/total*100).toFixed(1)}%)`);
  console.log(`Without difficulty: ${total - withDiff} (${((total-withDiff)/total*100).toFixed(1)}%)\n`);

  // Difficulty value distribution
  console.log('--- Difficulty Value Distribution ---');
  const distRes = await pool.query(`
    SELECT COALESCE(difficulty, '<NULL>') as diff, COUNT(*) as cnt 
    FROM trails 
    GROUP BY difficulty 
    ORDER BY cnt DESC
  `);
  for (const row of distRes.rows) {
    console.log(`  ${row.diff}: ${row.cnt} (${(parseInt(row.cnt)/total*100).toFixed(1)}%)`);
  }

  // By data source
  console.log('\n--- Difficulty Coverage by Data Source ---');
  const srcRes = await pool.query(`
    SELECT 
      COALESCE(data_source, '<unknown>') as src,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE difficulty IS NOT NULL AND difficulty != '') as with_diff
    FROM trails 
    GROUP BY data_source 
    ORDER BY total DESC
  `);
  for (const row of srcRes.rows) {
    const t = parseInt(row.total);
    const w = parseInt(row.with_diff);
    console.log(`  ${row.src}: ${w}/${t} have difficulty (${(w/t*100).toFixed(1)}%)`);
  }

  // By state
  console.log('\n--- Difficulty Coverage by State (top 10) ---');
  const stateRes = await pool.query(`
    SELECT 
      state_code,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE difficulty IS NOT NULL AND difficulty != '') as with_diff
    FROM trails 
    GROUP BY state_code 
    ORDER BY total DESC
    LIMIT 10
  `);
  for (const row of stateRes.rows) {
    const t = parseInt(row.total);
    const w = parseInt(row.with_diff);
    console.log(`  ${row.state_code}: ${w}/${t} have difficulty (${(w/t*100).toFixed(1)}%)`);
  }

  // Trails with length but no difficulty (candidates for inference)
  console.log('\n--- Enhancement Candidates ---');
  const candidateRes = await pool.query(`
    SELECT COUNT(*) as cnt FROM trails 
    WHERE (difficulty IS NULL OR difficulty = '') 
      AND length_miles IS NOT NULL AND length_miles > 0
  `);
  console.log(`Trails with length but no difficulty: ${candidateRes.rows[0].cnt} (can infer difficulty from length)`);

  const noLenRes = await pool.query(`
    SELECT COUNT(*) as cnt FROM trails 
    WHERE (difficulty IS NULL OR difficulty = '') 
      AND (length_miles IS NULL OR length_miles = 0)
  `);
  console.log(`Trails with neither length nor difficulty: ${noLenRes.rows[0].cnt}`);

  // Length distribution for trails WITH difficulty (to build inference model)
  console.log('\n--- Length Distribution by Known Difficulty ---');
  const lenDistRes = await pool.query(`
    SELECT 
      difficulty,
      COUNT(*) as cnt,
      ROUND(AVG(length_miles)::numeric, 2) as avg_len,
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY length_miles)::numeric, 2) as p25,
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY length_miles)::numeric, 2) as median,
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY length_miles)::numeric, 2) as p75
    FROM trails 
    WHERE difficulty IS NOT NULL AND difficulty != '' 
      AND length_miles IS NOT NULL AND length_miles > 0
    GROUP BY difficulty
    ORDER BY avg_len
  `);
  for (const row of lenDistRes.rows) {
    console.log(`  ${row.difficulty}: n=${row.cnt}, avg=${row.avg_len}mi, median=${row.median}mi, IQR=[${row.p25}, ${row.p75}]`);
  }

  // Check for elevation_gain column (useful for difficulty inference)
  console.log('\n--- Schema Check ---');
  const colRes = await pool.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'trails' 
    ORDER BY ordinal_position
  `);
  console.log('Trail columns:', colRes.rows.map(r => r.column_name).join(', '));

  await pool.end();
}

analyze().catch(err => {
  console.error(err);
  process.exit(1);
});
