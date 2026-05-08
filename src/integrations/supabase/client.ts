import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

const isBrowser = typeof window !== "undefined";

// FIX: Node.js 20 does not have a global WebSocket. 
// Supabase Realtime checks for this even if we don't use it on the server.
if (!isBrowser) {
  // We define a dummy class on the server global object to prevent the library from crashing
  // during the initial module evaluation.
  (global as any).WebSocket = class {
    constructor() {}
    close() {}
    send() {}
    on() {}
  };
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: isBrowser ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isBrowser,
  },
  // We tell Supabase not to attempt a WebSocket connection if we are on the server
  realtime: isBrowser ? {} : {
    worker: false,
    enabled: false
  }
});