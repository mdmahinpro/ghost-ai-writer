# Phase 4: Frontend → gaw-api

## Goal
Replace in-browser PGlite + TanStack Start server functions with direct API calls to the Rust backend. This removes the second pipeline entirely — the frontend becomes a pure SPA that talks to `gaw-api` for ALL data and operations.

## Phases

### 4.1: API client foundation
- Create `src/lib/api-client.ts` — fetch wrapper with auth header, error handling, timeout
- Status: ✅

### 4.2: Replace server-store.functions.ts (app state CRUD)
- Rust `state.rs` + migration 0006; store.ts rewired at all 3 call sites
- Status: ✅

### 4.2b: Worker lease routes
- Rust `lease.rs` + migration 0007; `worker-api.ts`; store.ts claim/heartbeat wired
- Status: ✅

### 4.2c: CORS (blocked the whole phase)
- No CorsLayer was mounted; OPTIONS was 401'd by the token gate
- Status: ✅

### 4.3: Ghost integration routes (more)
- Port remaining ghost server functions to Rust: testConnection, syncPosts, publishPost, updatePostHtml, probePublicUrl
- Wire API client
- Status: ⬜

### 4.4: Provider + AI generation routes
- Port testCustomModel, listCustomModels, generateDraft, generateIdeas, getEmbedding
- These call AI providers and return results; key management is already in Rust
- Status: ⬜

### 4.5: Image + web tool routes  
- Port placeImages, readMediaBatch, scrapePage, tavilySearch, firecrawlSearch
- Status: ⬜

### 4.6: Wire components
- Replace ALL server-function imports with API client calls
- Test everything compiles
- Status: ⬜

### 4.7: Remove PGlite
- Drop @electric-sql/pglite from package.json
- Remove db.ts, pglite-dialect.ts
- Remove PGlite init from auth layer
- Status: ⬜

### 4.8: Deploy/static/FTP stub routes
- Add Rust stub routes so the frontend can call them
- These are big features, porting them fully is post-Phase-4
- Status: ⬜

## Key Decisions
- API base: `VITE_GAW_API=https://gaw-api.onrender.com`
- Auth: `GAW_ADMIN_TOKEN` in Authorization header (same as Rust middleware)
- No PGlite fallback — the app requires gaw-api to function

## Errors
(empty)
