// Lightweight Supabase connectivity test
// Usage:
//  SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/test-supabase-connection.js

try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL. Set SUPABASE_URL env var and retry.');
  process.exit(2);
}

async function run() {
  if (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('No SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY found in env. This test will likely fail.');
  }

  const keyToUse = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(SUPABASE_URL, keyToUse);

  console.log('Testing Supabase REST access to `initiatives` (select id limit 1)...');
  try {
    const { data, error, status } = await client
      .from('initiatives')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Query error:', error);
      process.exit(1);
    }

    console.log('Query OK. Status:', status);
    console.log('Sample row:', data && data.length ? data[0] : 'no rows');
  } catch (err) {
    console.error('Unexpected error while querying Supabase:', err);
    process.exit(1);
  }

  // Try auth health endpoint if fetch is available
  if (typeof fetch === 'function') {
    try {
      const anon = SUPABASE_ANON_KEY || '';
      const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/health`, {
        headers: { apikey: anon, Authorization: `Bearer ${anon}` },
      });
      const body = await res.text();
      console.log('/auth/v1/health ->', res.status, body);
    } catch (e) {
      console.warn('Could not fetch auth health endpoint (fetch error):', e.message || e);
    }
  } else {
    console.log('Skipping auth health check (global fetch not available in this Node).');
  }

  console.log('Supabase connectivity test completed successfully.');
  process.exit(0);
}

run();
