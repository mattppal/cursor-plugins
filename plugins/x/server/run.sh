#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bundle="$here/dist/index.js"

if [[ -f "$bundle" ]]; then
  exec node "$bundle"
fi

# Fallbacks if Cursor invoked this script without resolving it from the plugin root.
for candidate in \
  "$HOME/.cursor/plugins/local/x/server/dist/index.js" \
  "$HOME/Developer/git-repos/cursor-plugins/plugins/x/server/dist/index.js"
do
  if [[ -f "$candidate" ]]; then
    exec node "$candidate"
  fi
done

while IFS= read -r snapshot; do
  exec node "$snapshot"
done < <(find "$HOME/.cursor/plugins/marketplaces" -path '*/plugins/x/server/dist/index.js' 2>/dev/null | sort)

echo "[x] MCP bundle not found next to $here/run.sh" >&2
exit 1
