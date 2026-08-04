#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = join(here, "dist", "index.js");

if (!existsSync(bundle)) {
  console.error(`[x] MCP bundle missing at ${bundle}. Run: cd plugins/x/server && npm run build`);
  process.exit(1);
}

await import(pathToFileURL(bundle).href);
