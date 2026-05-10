// src/integrations/supabase/client.ts
import "../../polyfill";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "placeholder";

const isBrowser = typeof window !== "undefined";

export const supabase = createClient<Database, "public">(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: isBrowser ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    // Deriv OAuth also returns ?code=...&state=..., which Supabase can mistake for
    // its own OAuth callback and clear the app session. Supabase auth here uses
    // generated email/password credentials, so URL callback detection must stay off.
    detectSessionInUrl: false,
  },
});
