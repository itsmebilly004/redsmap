// src/integrations/supabase/client.server.ts

// Polyfill WebSocket for Node.js 20 environment to prevent Realtime-js crash
if (typeof window === "undefined" && !(global as any).WebSocket) {
  (global as any).WebSocket = class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 3;
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseAdminClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn("[Supabase Admin] Missing keys. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel/Local env.");
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

export const supabaseAdmin = new Proxy({} as any, {
  get(_, prop) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    if (!_supabaseAdmin) {
        // Return a mock that logs but doesn't crash the whole app on import
        return (...args: any[]) => {
            console.error("Supabase Admin Client not configured correctly.");
            return { error: { message: "Admin keys missing" } };
        };
    }
    return _supabaseAdmin[prop];
  },
});