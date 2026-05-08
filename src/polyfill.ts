// src/polyfill.ts
import WebSocket from 'ws';

if (typeof window === "undefined" && !(global as any).WebSocket) {
  (global as any).WebSocket = WebSocket;
}
export {};