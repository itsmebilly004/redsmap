// src/integrations/supabase/client.server.ts
import '../../polyfill';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn("[Supabase Admin] Environment variables missing. Check Vercel settings.");
    return null;
  }

  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
        enabled: false 
    }
  });
}

let _supabaseAdmin: any = null;

// The Proxy prevents a crash if the client is imported but keys are missing
export const supabaseAdmin = new Proxy({} as any, {
  get(_, prop) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    if (!_supabaseAdmin) {
        return () => { throw new Error("Supabase Admin keys missing in Vercel environment."); };
    }
    return _supabaseAdmin[prop];
  },
});