# Matt's Cursor plugins

Personal [Cursor](https://cursor.com) plugin marketplace, based on the [official plugin template](https://github.com/cursor/plugin-template).

## Plugins

| Plugin | Description |
| --- | --- |
| [`x`](plugins/x) | Read-only X (Twitter) API for searching posts, looking up users, and browsing public content |

## Local install

Symlink a plugin into Cursor's local plugin directory, then reload the window:

```bash
mkdir -p ~/.cursor/plugins/local
ln -sfn "$(pwd)/plugins/x" ~/.cursor/plugins/local/x
```

Then set `X_BEARER_TOKEN` in **Cursor Settings → Plugins → x → Configure**.

## Add another plugin

See [`docs/add-a-plugin.md`](docs/add-a-plugin.md). Validate with:

```bash
node scripts/validate-template.mjs
```
