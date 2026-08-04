#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bundle="$here/dist/index.js"

if [[ ! -f "$bundle" ]]; then
  echo "[x] MCP bundle missing at $bundle" >&2
  exit 1
fi

exec node "$bundle"
