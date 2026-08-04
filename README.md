# Matt's Cursor plugins

Personal [Cursor](https://cursor.com) plugin marketplace, based on the [official plugin template](https://github.com/cursor/plugin-template).

## Plugins

| Plugin | Description |
| --- | --- |
| [`x`](plugins/x) | Read-only X (Twitter) API: search posts, look up users, and browse public content |

## Install

### Add this repo as a local marketplace

In **Customize**, open the marketplace source dropdown → **Add Marketplace** → **Import from Disk**. Select this repository root: the folder that contains `.cursor-plugin/marketplace.json`. Do not select `plugins/x`.

Then **Add** each plugin you want. For **X**, also keep the local symlink below. Cursor starts plugin MCP servers from the active workspace cwd, so the X server is launched through `~/.cursor/plugins/local/x`, not a relative path inside the snapshot.

### Symlink the plugin for MCP launch

```bash
mkdir -p ~/.cursor/plugins/local
ln -sfn "$(pwd)/plugins/x" ~/.cursor/plugins/local/x
```

Reload the window (**Developer: Reload Window**). Set **X Bearer Token** under **Cursor Settings → Plugins → X → Configure**. See [`plugins/x/README.md`](plugins/x/README.md) for X details.

## Add another plugin

See [`docs/add-a-plugin.md`](docs/add-a-plugin.md). Validate with:

```bash
node scripts/validate-template.mjs
```
