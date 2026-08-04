#!/usr/bin/env bash
set -euo pipefail

candidates=()

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  candidates+=("$here/dist/index.js")
fi

candidates+=(
  "$HOME/.cursor/plugins/local/x/server/dist/index.js"
  "$HOME/Developer/git-repos/cursor-plugins/plugins/x/server/dist/index.js"
)

while IFS= read -r snapshot; do
  candidates+=("$snapshot")
done < <(find "$HOME/.cursor/plugins/marketplaces" -path '*/plugins/x/server/dist/index.js' 2>/dev/null | sort)

for bundle in "${candidates[@]}"; do
  if [[ -f "$bundle" ]]; then
    exec node "$bundle"
  fi
done

echo "[x] MCP bundle not found. Tried:" >&2
printf '  %s\n' "${candidates[@]}" >&2
exit 1
