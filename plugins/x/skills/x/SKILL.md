---
name: x
description: Search and read public X (Twitter) posts, profiles, threads, mentions, quote posts, and Spaces. Use when finding tweets or X posts, looking up accounts, reading timelines, inspecting threads, checking mentions, quote-posts, or live Spaces. Read-only; do not post, like, follow, or DM.
---

# X

This plugin is read-only. Do not post, like, repost, follow, bookmark, or send DMs. Those tools are not available.

## Setup

If a tool fails with a missing or invalid bearer token, run `/x-setup`, or walk the user through:

1. Open the [X Developer Portal](https://developer.x.com/en/portal/dashboard).
2. Create or select a Project and App.
3. Copy the **Bearer Token** (app-only auth).
4. Set it in **Cursor Settings → Plugins → X → Configure** as `X_BEARER_TOKEN`.

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
| Remaining project quota | `get_api_usage` |

Timeline tools accept usernames. Resolve `@username` with `get_user` only when a later call needs the numeric ID.

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

## Out of scope

- Home timeline (needs user-context OAuth)
- Bookmarks, DMs, likes given, and most followers/following graphs
- Search older than 7 days (`/2/tweets/search/all`, academic/enterprise)
- Any write action
