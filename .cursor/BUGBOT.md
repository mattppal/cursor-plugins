# Review guidelines

Personal Cursor plugin marketplace. The only buildable code is the X MCP server in `plugins/x/server` (strict TypeScript, Node 20+, stdio transport).

## Secrets and tokens

- No credential values may appear in tracked files: bearer tokens, OAuth client secrets, access or refresh tokens. Manifests may reference variable names and `${VAR}` placeholders only.
- Token files must be written with mode 0600 and atomic temp-file + rename writes (see `writeTokenFile` in `plugins/x/server/src/auth.ts`).
- Never log token or secret values, including in error messages and test fixtures.

## Server invariants

- `plugins/x/server/dist/index.js` is committed on purpose. If server source under `src/` changes, the bundle must be rebuilt in the same PR (`npm run build`).
- Refresh tokens rotate on every use. Any change to token refresh must preserve the rotation-race recovery in `getUserAccessToken` and its tests.
- New MCP tools must use the shared `handle()` wrapper in `src/index.ts`, not inline try/catch.
- The version constant in `src/version.ts` must match `package.json` and `.cursor-plugin/plugin.json` when any of them changes.

## Manifests and docs

- Paths in `plugin.json`, `marketplace.json`, and `mcp.json` must be plugin-relative; no `..` or absolute paths.
- Flag PRs that change tool names, parameters, or login flows without updating `plugins/x/skills/x/SKILL.md`, `plugins/x/README.md`, and `plugins/x/commands/x-setup.md` to match.
