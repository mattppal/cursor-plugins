---
name: x
description: Search and read X (Twitter) posts, profiles, threads, mentions, quote posts, and Spaces, plus the signed-in user's bookmarks, home timeline, and liked posts. Use when finding tweets or X posts, looking up accounts, reading timelines, checking bookmarks or likes, inspecting threads, or browsing the user's feed. Read-only; do not post, like, follow, or DM.
---

# X

This plugin is read-only. Do not post, like, repost, follow, bookmark, or send DMs. Those tools are not available.

## Setup

Public tools need an app-only bearer token. If a tool fails with a missing or invalid bearer token, run `/x-setup`, or walk the user through:

1. Open the [X Developer Portal](https://developer.x.com/en/portal/dashboard).
2. Create or select a Project and App.
3. Copy the **Bearer Token** (app-only auth).
4. Set it in **Cursor Settings → Plugins → X → Configure** as `X_BEARER_TOKEN`.

Personal tools (`get_bookmarks`, `get_home_timeline`, `get_liked_posts`) need a one-time OAuth login. If one fails asking for login, run the flow from chat:

1. Call `start_login` and show the user the returned `authorize_url` as a clickable link. Ask them to open it and approve access (the link expires after 5 minutes).
2. After they confirm, call `get_auth_status`. When it reports `user_logged_in: true`, retry the personal tool.

`start_login` needs **X OAuth Client ID** and **X OAuth Client Secret** in **Cursor Settings → Plugins → X → Configure** (from the Developer Portal: app type Web App, redirect URI `http://127.0.0.1:8917/callback`). If they are not set, ask the user to add them and reload, or fall back to the terminal flow:

```bash
cd plugins/x/server && npm run login
```

Either flow saves tokens to `~/.cursor/x-plugin/tokens.json`. The server refreshes them automatically afterward.

## Choose a tool

| Goal | Tool |
| --- | --- |
| Find posts by topic, account, or operator | `search_posts` |
| Open a post by URL or ID | `get_posts` |
| Profile, bio, or follower counts | `get_user` or `get_users` |
| Latest posts from an account | `get_user_posts` |
| Posts that mention an account | `get_user_mentions` |
| Full reply thread | `get_thread` |
| Quotes of a post | `get_quote_posts` |
| Live or scheduled Spaces | `search_spaces` |
| The user's saved bookmarks | `get_bookmarks` |
| The user's home feed | `get_home_timeline` |
| Posts the user has liked | `get_liked_posts` |
| Start the one-time account login | `start_login` |
| Check token and login state | `get_auth_status` |
| Remaining project quota | `get_api_usage` |

Timeline tools accept usernames. Resolve `@username` with `get_user` only when a later call needs the numeric ID.

When the user asks about something they saved, bookmarked, or "liked a while back", check `get_bookmarks` or `get_liked_posts` before searching: `search_posts` only covers the last 7 days. To find a specific post, pass `filter` with a keyword or author handle instead of paging manually; the server scans up to 500 recent items per call and returns `next_token` to continue.

## Search operators

`search_posts` covers the last 7 days. Useful query fragments:

```text
from:username
to:username
@username
lang:en
is:reply
is:retweet
is:quote
has:links
has:media
has:images
has:videos
conversation_id:123
url:example.com
"exact phrase"
(openai OR anthropic)
-is:retweet
```

Example: `from:openai -is:retweet lang:en "gpt-5"`

When the user gives an explicit time window, pass it as `start_time` / `end_time` (ISO 8601). Do not put dates in the query string when those arguments can carry them.

## Quota and results

- Call `get_api_usage` before broad exploratory searches when quota may be tight.
- Start with `max_results` of 10-25, then page with `next_token`.
- If a tool returns 403, the endpoint is likely outside the user's X API plan. Tell them that.
- Summarize in chat: author, timestamp, permalink, key metrics, and a short excerpt. Do not dump every entity or media blob unless asked.
- Include permalinks (`https://x.com/{user}/status/{id}`) so the user can open the source.

## Login troubleshooting

Check `get_auth_status` first; it reports both token states and any in-progress login.

- "No X user credentials found": run the login (`start_login`, or `npm run login` in `plugins/x/server`).
- "credentials expired or were revoked": re-run the login; the refresh token was invalidated.
- `start_login` reports missing client credentials: have the user set X OAuth Client ID and Secret in plugin Configure and reload.
- Port 8917 in use: another login is pending, possibly in a different Cursor window. Finish or abandon it first.
- Token exchange fails with `invalid_request`: confirm the app is a confidential (Web App) client and that `http://127.0.0.1:8917/callback` is registered exactly as a redirect URI.
- 403 on `get_home_timeline` only: the endpoint may need an extra scope on some plans. Re-run `start_login` with scopes `tweet.read users.read bookmark.read like.read timeline.read offline.access`.

## Out of scope

- DMs and most followers/following graphs
- Search older than 7 days (`/2/tweets/search/all`, academic/enterprise)
- Any write action, including creating bookmarks or likes
