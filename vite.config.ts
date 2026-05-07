// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  // Disable the auto-added Cloudflare Workers plugin — this app deploys to
  // Vercel (Node.js), not Cloudflare. Having both plugins produces conflicting
  // server bundles: the Cloudflare fetch polyfills throw HTTPError when run
  // inside Vercel's Node.js runtime.
  cloudflare: false,
  vite: {
    plugins: [nitro({ preset: "vercel" })],
  },
});
