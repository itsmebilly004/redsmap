import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('trades')
    .select('id, deriv_contract_id, status, stake, payout, profit_loss, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  else console.table(data);
}
check();
