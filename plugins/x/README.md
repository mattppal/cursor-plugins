# X

Read-only [Cursor](https://cursor.com) plugin for the [X API v2](https://developer.x.com/en/docs/twitter-api). Search posts, look up users, read timelines, and inspect threads.

Write actions (post, like, follow, DM, bookmark) are not included.

## Install locally

From the repository root:

```bash
mkdir -p ~/.cursor/plugins/local
ln -sfn "$(pwd)/plugins/x" ~/.cursor/plugins/local/x
```

Reload Cursor, then set **X Bearer Token** under **Settings → Plugins → X → Configure**.

Create the token in the [X Developer Portal](https://developer.x.com/en/portal/dashboard) (**Keys and tokens → Bearer Token**). App-only auth is enough for these tools.

You can also run `/x-setup` in chat.

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

`mcp.json` starts `~/.cursor/plugins/local/x/server/run.sh`, which resolves the bundle next to itself. That keeps MCP independent of whichever workspace is open. Rebuild after server changes.

## Limits

Availability and monthly post-read quota depend on your X API plan. Recent search is a rolling 7-day window. Home timeline and bookmarks need user-context OAuth and are out of scope for this version.
