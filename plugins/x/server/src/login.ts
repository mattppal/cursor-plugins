import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createInterface } from "node:readline/promises";
import {
  DEFAULT_SCOPES,
  buildAuthorizeUrl,
  codeChallengeS256,
  defaultTokenFilePath,
  exchangeCodeForTokens,
  generateCodeVerifier,
  generateState,
  writeTokenFile,
  type StoredTokens,
} from "./auth.ts";

const LOOPBACK_PORT = 8917;
const REDIRECT_URI = `http://127.0.0.1:${LOOPBACK_PORT}/callback`;
const LOGIN_TIMEOUT_MS = 5 * 60_000;

interface CliOptions {
  scopes: string[];
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { scopes: DEFAULT_SCOPES };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scopes") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--scopes requires a value, e.g. --scopes "tweet.read users.read bookmark.read offline.access"');
      }
      options.scopes = value.split(/[\s,]+/).filter(Boolean);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run login [-- --scopes \"scope1 scope2 ...\"]");
      console.log(`Default scopes: ${DEFAULT_SCOPES.join(" ")}`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.scopes.includes("offline.access")) {
    options.scopes = [...options.scopes, "offline.access"];
  }
  return options;
}

async function promptForCredentials(): Promise<{ clientId: string; clientSecret: string }> {
  const envId = process.env.X_OAUTH_CLIENT_ID?.trim();
  const envSecret = process.env.X_OAUTH_CLIENT_SECRET?.trim();
  if (envId && envSecret) {
    console.log("Using client credentials from X_OAUTH_CLIENT_ID / X_OAUTH_CLIENT_SECRET.");
    return { clientId: envId, clientSecret: envSecret };
  }

  console.log("Enter the OAuth 2.0 credentials from your X app (Developer Portal → your app → Keys and tokens).");
  console.log(`The app must be a confidential (Web App) client with redirect URI ${REDIRECT_URI} registered.`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const clientId = envId || (await rl.question("OAuth 2.0 Client ID: ")).trim();
    const clientSecret = envSecret || (await rl.question("OAuth 2.0 Client Secret: ")).trim();
    if (!clientId || !clientSecret) {
      throw new Error("Both the client ID and client secret are required.");
    }
    return { clientId, clientSecret };
  } finally {
    rl.close();
  }
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(command, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" });
  child.on("error", () => {
    /* The URL is printed either way; a failed launch just means the user opens it by hand. */
  });
  child.unref();
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/callback") {
        response.writeHead(404).end("Not found");
        return;
      }

      const finish = (status: number, message: string) => {
        response.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
        response.end(`<html><body><p>${message}</p><p>You can close this tab.</p></body></html>`);
      };

      const error = url.searchParams.get("error");
      if (error) {
        finish(400, `Authorization failed: ${error}`);
        cleanup(new Error(`Authorization was denied or failed: ${error}`));
        return;
      }

      const state = url.searchParams.get("state");
      if (state !== expectedState) {
        finish(400, "State mismatch. Try running the login again.");
        cleanup(new Error("OAuth state mismatch: the callback did not match this login attempt."));
        return;
      }

      const code = url.searchParams.get("code");
      if (!code) {
        finish(400, "Missing authorization code.");
        cleanup(new Error("The callback did not include an authorization code."));
        return;
      }

      finish(200, "X login complete.");
      cleanup(undefined, code);
    });

    const timeout = setTimeout(() => {
      cleanup(new Error(`Timed out after ${LOGIN_TIMEOUT_MS / 60_000} minutes waiting for the browser callback.`));
    }, LOGIN_TIMEOUT_MS);

    function cleanup(error?: Error, code?: string) {
      clearTimeout(timeout);
      server.close();
      if (error) {
        reject(error);
      } else {
        resolve(code!);
      }
    }

    server.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (error.code === "EADDRINUSE") {
        reject(new Error(`Port ${LOOPBACK_PORT} is already in use. Close whatever is bound to it and retry.`));
      } else {
        reject(error);
      }
    });

    server.listen(LOOPBACK_PORT, "127.0.0.1");
  });
}

async function fetchAuthenticatedUser(accessToken: string): Promise<{ id: string; username?: string }> {
  const response = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { data?: { id?: string; username?: string }; detail?: string };
  if (!response.ok || !body.data?.id) {
    throw new Error(`Could not resolve the authenticated user (${response.status}): ${body.detail ?? "unknown error"}`);
  }
  return { id: body.data.id, username: body.data.username };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { clientId, clientSecret } = await promptForCredentials();

  const codeVerifier = generateCodeVerifier();
  const state = generateState();
  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri: REDIRECT_URI,
    scopes: options.scopes,
    state,
    codeChallenge: codeChallengeS256(codeVerifier),
  });

  console.log(`\nRequesting scopes: ${options.scopes.join(" ")}`);
  console.log("Opening your browser to authorize. If it does not open, visit:");
  console.log(`\n  ${authorizeUrl}\n`);

  const callbackPromise = waitForCallback(state);
  openBrowser(authorizeUrl);
  const code = await callbackPromise;

  console.log("Authorization code received. Exchanging for tokens...");
  const tokens = await exchangeCodeForTokens({
    clientId,
    clientSecret,
    code,
    redirectUri: REDIRECT_URI,
    codeVerifier,
  });
  if (!tokens.refresh_token) {
    throw new Error("X did not return a refresh token. Make sure offline.access is in the requested scopes.");
  }

  const user = await fetchAuthenticatedUser(tokens.access_token);
  const stored: StoredTokens = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
    user_id: user.id,
    username: user.username,
    client_id: clientId,
    client_secret: clientSecret,
    scopes: tokens.scope ? tokens.scope.split(" ") : options.scopes,
  };
  await writeTokenFile(stored);

  console.log(`\nLogged in as @${user.username ?? user.id}.`);
  console.log(`Tokens saved to ${defaultTokenFilePath()} (mode 0600).`);
  console.log("The MCP server refreshes these automatically. get_bookmarks, get_home_timeline, and get_liked_posts are ready.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
