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
2. Have them set both values in **Cursor Settings → Plugins → X → Configure** (X OAuth Client ID, X OAuth Client Secret), then reload.
3. Call `start_login` and give them the returned `authorize_url` as a clickable link. Ask them to open it and approve access.
4. Confirm with `get_auth_status`, then verify with `get_bookmarks`.
5. If they prefer not to store the credentials in Configure, the terminal flow works instead: `cd plugins/x/server && npm run login` (prompts for the credentials, opens the browser itself).
6. If verification fails, map the error:
   - "No X user credentials found": no login has completed yet
   - `start_login` reports missing client credentials: the Configure values are not set or the window was not reloaded
   - Port 8917 in use: another login is pending, possibly in another Cursor window
   - `invalid_request` during login: the app is not a confidential Web App client, or the redirect URI does not match exactly
   - 403 on `get_home_timeline` only: re-run `start_login` adding the `timeline.read` scope

Remind them this plugin can only read. It cannot post, like, follow, bookmark, or send DMs.
