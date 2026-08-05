import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  DEFAULT_SCOPES,
  buildAuthorizeUrl,
  codeChallengeS256,
  exchangeCodeForTokens,
  generateCodeVerifier,
  generateState,
  writeTokenFile,
  type StoredTokens,
} from "./auth.ts";

export const LOOPBACK_PORT = 8917;
const LOGIN_TIMEOUT_MS = 5 * 60_000;

export interface LoginFlowOptions {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  /** Loopback port. Defaults to 8917; pass 0 for an ephemeral port in tests. */
  port?: number;
  /** Token file destination. Defaults to ~/.cursor/x-plugin/tokens.json. */
  filePath?: string;
  fetchImpl?: typeof fetch;
  openBrowser?: boolean;
  timeoutMs?: number;
}

export interface LoginFlow {
  authorizeUrl: string;
  redirectUri: string;
  /** Resolves once the browser callback arrives and tokens are saved. */
  completion: Promise<StoredTokens>;
  close(): void;
}

export function normalizeScopes(scopes: string[] | undefined): string[] {
  const list = scopes?.length ? [...scopes] : [...DEFAULT_SCOPES];
  if (!list.includes("offline.access")) {
    list.push("offline.access");
  }
  return list;
}

/**
 * Starts the loopback listener and returns the authorize URL without blocking.
 * The returned completion promise settles when the callback is handled (or on
 * timeout), so callers can either await it (CLI) or poll it later (MCP tool).
 */
export function startLoginFlow(options: LoginFlowOptions): Promise<LoginFlow> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const scopes = normalizeScopes(options.scopes);
  const timeoutMs = options.timeoutMs ?? LOGIN_TIMEOUT_MS;
  const codeVerifier = generateCodeVerifier();
  const state = generateState();

  return new Promise((resolveFlow, rejectFlow) => {
    let redirectUri = "";
    let settleCallback: { resolve: (code: string) => void; reject: (error: Error) => void } | null = null;
    const callbackCode = new Promise<string>((resolve, reject) => {
      settleCallback = { resolve, reject };
    });

    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? "/", redirectUri);
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
        fail(new Error(`Authorization was denied or failed: ${error}`));
        return;
      }
      if (url.searchParams.get("state") !== state) {
        finish(400, "State mismatch. Try running the login again.");
        fail(new Error("OAuth state mismatch: the callback did not match this login attempt."));
        return;
      }
      const code = url.searchParams.get("code");
      if (!code) {
        finish(400, "Missing authorization code.");
        fail(new Error("The callback did not include an authorization code."));
        return;
      }

      finish(200, "X login complete.");
      clearTimeout(timeout);
      server.close();
      settleCallback!.resolve(code);
    });

    const timeout = setTimeout(() => {
      fail(new Error(`Timed out after ${Math.round(timeoutMs / 60_000)} minutes waiting for the browser callback.`));
    }, timeoutMs);

    function fail(error: Error) {
      clearTimeout(timeout);
      server.close();
      settleCallback!.reject(error);
    }

    server.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (error.code === "EADDRINUSE") {
        rejectFlow(
          new Error(
            `Port ${options.port ?? LOOPBACK_PORT} is already in use. Another login may be pending in a different window; finish or cancel it first.`
          )
        );
      } else {
        rejectFlow(error);
      }
    });

    server.listen(options.port ?? LOOPBACK_PORT, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : LOOPBACK_PORT;
      redirectUri = `http://127.0.0.1:${port}/callback`;
      const authorizeUrl = buildAuthorizeUrl({
        clientId: options.clientId,
        redirectUri,
        scopes,
        state,
        codeChallenge: codeChallengeS256(codeVerifier),
      });

      const completion = callbackCode.then(async (code) => {
        const tokens = await exchangeCodeForTokens({
          clientId: options.clientId,
          clientSecret: options.clientSecret,
          code,
          redirectUri,
          codeVerifier,
          fetchImpl,
        });
        if (!tokens.refresh_token) {
          throw new Error("X did not return a refresh token. Make sure offline.access is in the requested scopes.");
        }
        const user = await fetchAuthenticatedUser(tokens.access_token, fetchImpl);
        const stored: StoredTokens = {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: Date.now() + tokens.expires_in * 1000,
          user_id: user.id,
          username: user.username,
          client_id: options.clientId,
          client_secret: options.clientSecret,
          scopes: tokens.scope ? tokens.scope.split(" ") : scopes,
        };
        await writeTokenFile(stored, options.filePath);
        return stored;
      });

      // Callers may attach handlers after the callback settles; keep late
      // rejections from surfacing as unhandled without swallowing them.
      completion.catch(() => {});

      if (options.openBrowser) {
        openBrowser(authorizeUrl);
      }

      resolveFlow({
        authorizeUrl,
        redirectUri,
        completion,
        close: () => fail(new Error("Login cancelled.")),
      });
    });
  });
}

async function fetchAuthenticatedUser(
  accessToken: string,
  fetchImpl: typeof fetch
): Promise<{ id: string; username?: string }> {
  const response = await fetchImpl("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { data?: { id?: string; username?: string }; detail?: string };
  if (!response.ok || !body.data?.id) {
    throw new Error(`Could not resolve the authenticated user (${response.status}): ${body.detail ?? "unknown error"}`);
  }
  return { id: body.data.id, username: body.data.username };
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  const child = spawn(command, [url], { stdio: "ignore", detached: true, shell: process.platform === "win32" });
  child.on("error", () => {
    /* The URL is printed either way; a failed launch just means the user opens it by hand. */
  });
  child.unref();
}
