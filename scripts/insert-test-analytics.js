import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE URL or SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function main() {
  const now = Date.now();
  const events = [];
  for (let i = 0; i < 50; i++) {
    const occurred_at = new Date(now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString();
    const anonymous_id = randomUUID();
    const event_type = i % 3 === 0 ? 'view_start' : i % 3 === 1 ? 'play' : 'pause';
    const concurrent_viewers = Math.floor(Math.random() * 800) + 1;
    const duration_ms = Math.random() > 0.6 ? Math.floor(Math.random() * 300_000) : null;
    events.push({
      id: randomUUID(),
      idempotency_key: randomUUID(),
      user_id: null,
      anonymous_id,
      stream_id: null,
      event_type,
      occurred_at,
      duration_ms,
      properties: { concurrent_viewers },
      country_code: null,
      device_type: Math.random() > 0.5 ? 'mobile' : 'desktop',
    });
  }

  const { data, error } = await supabase.from('activity_events').insert(events);
  if (error) {
    console.error('Insert error:', error);
    process.exit(1);
  }
  console.log('Inserted events:', (data || []).length);
}

main().catch((e) => { console.error(e); process.exit(1); });
