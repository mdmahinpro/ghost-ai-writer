import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error JS plugin alongside the TS vite config
import { grokPwaPlugin } from "./scripts/grok-pwa-plugin.mjs";
// @ts-expect-error JS plugin alongside the TS vite config
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";





// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
// The dev server starts once `src/router.tsx` and `src/routes/` exist — see
// AGENTS.md § "First scaffold".
export default defineConfig(() => ({
  server: {
    hmr: { overlay: false },
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    // Runtime artifacts are written INSIDE the project root by the app itself:
    // `.data/appstate.json` (server state, every save), `data/media` +
    // `public/media` (downloaded photos) and `.vercel`/build output. Vite's
    // watcher sees those writes and answers with a full-reload, the reloaded
    // client saves again, and the page reloads forever. Never watch them.
    watch: {
      ignored: ["**/.data/**", "**/data/**", "**/public/media/**", "**/.vercel/**", "**/dist/**", "**/.output/**"],
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 8081,
    strictPort: true,
  },
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    exclude: ["ssh2", "cpu-features"],
  },
  plugins: [
    // Before tanstackStart so /auth/popup never falls through to the SPA.
    // Dev-only /__app-env, read by scripts/check-auth-invariant.mjs.
    appEnvPlugin(),
    // PWA head + ?install=1 tutorial page; runs before Start/Nitro.
    grokPwaPlugin(),
    // Dev-only in-memory author-portrait proxy (/__grok/avatar).
    tailwindcss(),
    // Static SPA: the Rust API is the only backend, so there is no server bundle.
    tanstackStart({
      spa: {
        enabled: true,
        maskPath: "",
        prerender: { enabled: true, outputPath: "/index.html", crawlLinks: false, retryCount: 0 },
      },
    }),
    viteReact(),
  ],
}));
