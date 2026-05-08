import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Polyfill WebSocket for Node.js 20 environment to prevent Realtime-js crash
if (typeof window === "undefined" && !(global as any).WebSocket) {
  (global as any).WebSocket = class {
    constructor() {}
    close() {}
    send() {}
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn("[Supabase Admin] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    return null;
  }

  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
        enabled: false // Admin client never needs realtime
    }
  });
}

let _supabaseAdmin: any = null;

// Proxy allows imports to happen even if keys are missing, only crashing when a call is made
export const supabaseAdmin = new Proxy({} as any, {
  get(_, prop) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    if (!_supabaseAdmin) {
        throw new Error("Supabase Admin Client not configured. Check your environment variables.");
    }
    return _supabaseAdmin[prop];
  },
});