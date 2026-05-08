import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Prevent crash in auth middleware
if (typeof window === 'undefined' && !(global as any).WebSocket) {
  (global as any).WebSocket = class {};
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error("[Supabase Middleware] Keys missing in environment.");
      return next({ context: { supabase: null as any, userId: null, claims: null } });
    }
    
    const request = getRequest();
    const authHeader = request?.headers?.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Response('Unauthorized: Missing token', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
      },
      realtime: { enabled: false }
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw new Response('Unauthorized: Invalid token', { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: data.user,
      },
    })
  }
)