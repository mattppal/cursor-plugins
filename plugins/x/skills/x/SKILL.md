---
name: x
description: Search and read public X (Twitter) content via the read-only X plugin. Use when finding posts, looking up accounts, reading timelines, inspecting threads, checking mentions, or quote-posts on X.
---

# X reader

This plugin is **read-only**. Never attempt to post, like, repost, follow, bookmark, or send DMs. Those write paths are intentionally absent.

## Setup

If tools fail with a missing/invalid bearer token:

1. Open [X Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Create or select a Project + App
3. Copy the **Bearer Token** (app-only auth)
4. Set it in **Cursor Settings → Plugins → X → Configure** as `X_BEARER_TOKEN`

Prefer `/x-setup` when the user still needs credentials.

## Which tool to use

| Goal | Tool |
| --- | --- |
| Find posts about a topic / from an account / with operators | `search_posts` |
| Open a specific post URL or ID | `get_posts` |
| Profile / bio / follower counts | `get_user` or `get_users` |
| Latest posts by an account | `get_user_posts` |
| Posts mentioning an account | `get_user_mentions` |
| Full reply thread | `get_thread` |
| Quotes of a post | `get_quote_posts` |
| Live or scheduled Spaces | `search_spaces` |
| Check remaining project quota | `get_api_usage` |

Resolve `@username` first with `get_user` only when you need the numeric ID for a later call. Timeline tools already accept usernames.

## Search operators

Recent search covers **the last 7 days**. Useful query pieces:

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

Prefer `start_time` / `end_time` tool arguments (ISO 8601) over stuffing dates into the query when the user gives an explicit window.

## Usage hygiene

- Call `get_api_usage` before broad exploratory searches if quota might be tight.
- Start with small `max_results` (10–25), then page with `next_token`.
- X API plans vary. If a tool returns 403, tell the user the endpoint is likely outside their tier.
- Return compact summaries in chat: author, timestamp, permalink, key metrics, and a short excerpt. Do not dump every entity/media blob unless asked.
- Include post permalinks (`https://x.com/{user}/status/{id}`) so the user can open source material.

## Out of scope

- Home timeline (requires user-context OAuth)
- Bookmarks, DMs, likes given, followers/following graphs on many plans
- Historical search older than 7 days (`/2/tweets/search/all`, academic/enterprise)
- Any write action
