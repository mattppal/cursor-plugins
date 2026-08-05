# AGENTS.md

## Cursor Cloud specific instructions

This repo is a personal Cursor plugin marketplace. The only buildable product is the **`x` MCP server** (read-only X/Twitter API v2), a Node 20+ / TypeScript stdio server. There is **no root `package.json`** — all dependencies and scripts live in `plugins/x/server`. Standard commands are documented in `plugins/x/README.md` ("Develop the MCP server"); this section only records the non-obvious bits.

### Where to run things
- Server package: `plugins/x/server`. Lint/test/build/run all happen there.
- Test: `npm test` (node's built-in runner via `tsx`).
- Lint-equivalent: there is no lint script; use `npx tsc --noEmit` (strict `tsconfig.json`) as the type-check gate.
- Build: `npm run build` (esbuild bundles `src/index.ts` → `dist/index.js`). Note `dist/index.js` is committed and kept in sync; rebuild and commit it after changing server source. esbuild does **not** type-check, so run `tsc --noEmit` separately.
- Dev run: `npm run dev` (`tsx src/index.ts`).
- Repo-level manifest check: `node scripts/validate.mjs` (no dependencies needed). A "no hooks/hooks.json" warning is expected and harmless.

### Running the server (important gotcha)
The server is a **stdio MCP server**, not an HTTP service — it binds no port. `npm run dev` / `npm start` just wait for a client and will appear to "hang"; that is normal. Drive it by writing newline-delimited JSON-RPC to stdin (`initialize` → `notifications/initialized` → `tools/list` / `tools/call`). In normal use Cursor launches it via `plugins/x/mcp.json` → `~/.cursor/plugins/local/x/server/launch.mjs`, which requires `dist/index.js` to exist (run `npm run build`).

### Secrets / live API
- The MCP handshake works with no secrets.
- Live tools (`search_posts`, `get_user`, etc.) need `X_BEARER_TOKEN` in the environment (plugin Configure → X Bearer Token).

