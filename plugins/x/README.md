# X

Read-only [Cursor](https://cursor.com) plugin for the [X API v2](https://developer.x.com/en/docs/twitter-api). Search posts, look up users, read timelines, inspect threads, and read your own bookmarks, home feed, and likes.

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

### Log in for personal reads (optional)

`get_bookmarks`, `get_home_timeline`, and `get_liked_posts` read your own account, which requires OAuth 2.0 user context. One-time portal setup either way:

1. In the [X Developer Portal](https://developer.x.com/en/portal/dashboard), open your app's **User authentication settings**: enable OAuth 2.0, set the type to **Web App** (confidential client), and register the redirect URI `http://127.0.0.1:8917/callback` exactly.
2. Copy the **OAuth 2.0 Client ID and Client Secret** from **Keys and tokens**.

**From chat (recommended):** set the client ID and secret in **Cursor Settings → Plugins → X → Configure**, reload, then ask the agent for your bookmarks. It calls the `start_login` tool, gives you a link to click, and retries once you approve in the browser.

**From a terminal:**

```bash
cd plugins/x/server
npm install
npm run login
```

The script prompts for the client ID and secret (or reads `X_OAUTH_CLIENT_ID` / `X_OAUTH_CLIENT_SECRET`) and opens the browser itself.

Both flows write tokens to `~/.cursor/x-plugin/tokens.json` with mode 0600. The MCP server refreshes them silently from then on; you should not need to log in again unless you revoke access.

If `get_home_timeline` returns 403 on your plan, retry the login with an extra scope (`timeline.read`), either via `start_login`'s `scopes` parameter or `npm run login -- --scopes "tweet.read users.read bookmark.read like.read timeline.read offline.access"`.

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
| `get_bookmarks` | Your bookmarked posts, with a `filter` keyword search (requires login) |
| `get_home_timeline` | Your reverse-chronological home feed (requires login) |
| `get_liked_posts` | Posts you have liked, with a `filter` keyword search (requires login) |
| `start_login` | Start the one-time account login from chat |
| `get_auth_status` | Report token and login state |
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

- Endpoint access and monthly post-read quota depend on your X API plan. Bookmark, timeline, and like reads count as "Owned Reads" on pay-per-use plans.
- Recent search covers a rolling 7-day window.
- DMs, follower graphs, and all write actions are out of scope.
