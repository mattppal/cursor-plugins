---
name: x-setup
description: Walk through creating an X developer app and setting the read-only bearer token for this plugin.
---

Help the user get the X plugin working. They only need an app-only bearer token. Do not set up user-context OAuth or write access.

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
7. Remind them this plugin can only search and read public content. It cannot post, like, follow, or send DMs.
