---
name: x-setup
description: Walk through creating an X developer app, setting the read-only bearer token, and optionally logging in for bookmarks and personal feeds.
---

Help the user get the X plugin working. Public tools need an app-only bearer token. Personal tools (`get_bookmarks`, `get_home_timeline`, `get_liked_posts`) additionally need a one-time OAuth login. Do not set up write access.

## Bearer token (required)

1. Ask whether they already have an X developer account with a Project and App.
2. If not, send them to https://developer.x.com/en/portal/dashboard and have them:
   - Sign in or apply for a developer account
   - Create a Project
   - Create an App in that Project
   - Open **Keys and tokens**
   - Copy the **Bearer Token** (not the API key/secret, and not OAuth client secrets)
3. Have them paste the token into **Cursor Settings → Plugins → X → Configure → X Bearer Token**.
   - Do not write the token into the repo, chat history summaries, or committed `.env` files.
4. Reload Cursor, or toggle the plugin MCP server if it is already running.
5. Verify with a cheap call: `get_user` for a known public account such as `X` or the user's own handle.
6. If verification fails, map the error:
   - 401: token missing, invalid, or revoked
   - 403: the plan or app permissions do not include that endpoint
   - 429: rate limited; wait or check `get_api_usage`

## User login (optional, for bookmarks and personal feeds)

Only walk through this if the user wants `get_bookmarks`, `get_home_timeline`, or `get_liked_posts`.

1. In the app's **User authentication settings** in the Developer Portal, have them:
   - Enable OAuth 2.0
   - Set the app type to **Web App** (confidential client)
   - Register the redirect URI `http://127.0.0.1:8917/callback` exactly
   - Copy the **OAuth 2.0 Client ID and Client Secret**
2. Have them run the login script in a terminal (not in Cursor chat):

```bash
cd plugins/x/server && npm run login
```

3. The script prompts for the client ID and secret, opens a browser to authorize, and saves tokens to `~/.cursor/x-plugin/tokens.json`. Refresh is automatic afterward.
4. Verify with `get_bookmarks`.
5. If verification fails, map the error:
   - "No X user credentials found": the login script has not been run or did not finish
   - `invalid_request` during login: the app is not a confidential Web App client, or the redirect URI does not match exactly
   - 403 on `get_home_timeline` only: re-run login adding the `timeline.read` scope via `npm run login -- --scopes "tweet.read users.read bookmark.read like.read timeline.read offline.access"`

Remind them this plugin can only read. It cannot post, like, follow, bookmark, or send DMs.
