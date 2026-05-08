// src/polyfill.ts
/**
 * Polyfill for environments without native WebSocket support (like Node < 22).
 * This prevents Supabase/Realtime from crashing during Server-Side Rendering or Building.
 */
if (typeof window === "undefined" && !(global as any).WebSocket) {
  (global as any).WebSocket = class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 3; // Default to CLOSED
    constructor() {}
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
  };
}
export {};