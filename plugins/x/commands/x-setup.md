---
name: x-setup
description: Walk through creating an X developer app and configuring the read-only bearer token for this plugin.
---

Help the user get the X plugin working. Keep it read-only — they only need an app-only bearer token.

1. Confirm whether they already have an X developer account and Project/App.
2. If not, send them to https://developer.x.com/en/portal/dashboard and have them:
   - Apply / sign in
   - Create a Project
   - Create an App inside the Project
   - Open **Keys and tokens**
   - Copy the **Bearer Token** (not the API key/secret, not OAuth client secrets)
3. Have them paste the token into **Cursor Settings → Plugins → X → Configure → X Bearer Token**.
   - Do not write the token into the repo, chat history summaries, or `.env` committed files.
4. Reload Cursor or toggle the plugin MCP server if it was already running.
5. Verify with a cheap call: `get_user` for a known public account such as `X` or the user's own handle.
6. If verification fails, inspect the error:
   - 401 → token missing/invalid/revoked
   - 403 → plan or app permissions do not include that endpoint
   - 429 → rate limited; wait or check `get_api_usage`
7. Remind them this plugin can search/read public content only. Writes will come later, if at all, behind a separate auth flow.
