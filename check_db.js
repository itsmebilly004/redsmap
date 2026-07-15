import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("No supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: sessions, error: e1 } = await supabase.from('sessions').select('*');
  console.log('Total sessions count:', sessions?.length, e1);
  if (sessions?.length > 0) {
    console.log('Unique users in sessions:', [...new Set(sessions.map(s => s.user_id))]);
  }
}

check();
