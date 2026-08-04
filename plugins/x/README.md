# X

Read-only [Cursor](https://cursor.com) plugin for the [X API v2](https://developer.x.com/en/docs/twitter-api). Search posts, look up users, read timelines, and inspect threads.

This plugin does not post, like, follow, DM, or bookmark.

## Install

From the repository root:

```bash
mkdir -p ~/.cursor/plugins/local
ln -sfn "$(pwd)/plugins/x" ~/.cursor/plugins/local/x
```

Reload the window (**Developer: Reload Window**).

To install from the marketplace catalog instead, see the [repository README](../../README.md#install).

### Configure the token

1. Create an app-only **Bearer Token** in the [X Developer Portal](https://developer.x.com/en/portal/dashboard) under **Keys and tokens**.
2. Set it in **Cursor Settings → Plugins → X → Configure → X Bearer Token**.

In chat, `/x-setup` walks through the same steps.

## Tools

| Tool | Description |
| --- | --- |
| `search_posts` | Recent search (last 7 days), including query operators |
| `get_posts` | Lookup posts by ID or status URL |
| `get_user` / `get_users` | User lookup |
| `get_user_posts` | User timeline |
| `get_user_mentions` | Mention timeline |
| `get_thread` | Conversation around a post |
| `get_quote_posts` | Quotes of a post |
| `search_spaces` | Search Spaces |
| `get_api_usage` | Project post-read usage |

## Develop the MCP server

```bash
cd plugins/x/server
npm install
npm test
npm run build
```

Cursor starts plugin MCP servers with the active workspace as cwd, so `mcp.json` launches `~/.cursor/plugins/local/x/server/launch.mjs` instead of a relative `./server/dist/index.js`. Keep the local symlink in place. Rebuild after server changes, then reload the window.

## Limits

- Endpoint access and monthly post-read quota depend on your X API plan.
- Recent search covers a rolling 7-day window.
- Home timeline and bookmarks need user-context OAuth and are out of scope.
