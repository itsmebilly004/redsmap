// Minimal CommonStore stub required by api-base.ts.
// The main app's auth is Supabase-based; this stub satisfies type references only.
export default class CommonStore {
  server_time: { unix: () => number } | null = null;
  is_socket_opened = false;
}
