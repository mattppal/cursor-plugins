import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const TOKEN_URL = "https://api.x.com/2/oauth2/token";
export const DEFAULT_SCOPES = ["tweet.read", "users.read", "bookmark.read", "like.read", "offline.access"];
export const LOGIN_HINT =
  "Log in first: call the start_login tool and open the returned link (requires X OAuth Client ID and Secret in plugin Configure), or run `cd plugins/x/server && npm run login` in a terminal.";

/** Refresh when the access token expires within this window. */
const EXPIRY_SKEW_MS = 60_000;

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  /** Unix epoch milliseconds. */
  expires_at: number;
  user_id: string;
  username?: string;
  client_id: string;
  client_secret: string;
  scopes: string[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export interface UserAuth {
  accessToken: string;
  userId: string;
}

export class OAuthError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, options: { status: number; body?: unknown }) {
    super(message);
    this.name = "OAuthError";
    this.status = options.status;
    this.body = options.body;
  }
}

export function defaultTokenFilePath(): string {
  return join(homedir(), ".cursor", "x-plugin", "tokens.json");
}

// PKCE (RFC 7636)

export function generateCodeVerifier(): string {
  return base64Url(randomBytes(32));
}

export function codeChallengeS256(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier, "ascii").digest());
}

export function generateState(): string {
  return base64Url(randomBytes(16));
}

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface AuthorizeUrlParams {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
}

export function buildAuthorizeUrl(params: AuthorizeUrlParams): string {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scopes.join(" "),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${query}`;
}

// Token endpoint (confidential client: HTTP Basic auth with client ID + secret)

export interface ExchangeCodeParams {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
}

export function exchangeCodeForTokens(params: ExchangeCodeParams): Promise<TokenResponse> {
  return postTokenRequest(
    {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      code_verifier: params.codeVerifier,
    },
    params.clientId,
    params.clientSecret,
    params.fetchImpl ?? fetch
  );
}

export interface RefreshTokensParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}

export function refreshAccessToken(params: RefreshTokensParams): Promise<TokenResponse> {
  return postTokenRequest(
    {
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
    },
    params.clientId,
    params.clientSecret,
    params.fetchImpl ?? fetch
  );
}

async function postTokenRequest(
  body: Record<string, string>,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch
): Promise<TokenResponse> {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : undefined;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const detail =
      typeof parsed === "object" && parsed
        ? [(parsed as Record<string, unknown>).error, (parsed as Record<string, unknown>).error_description]
            .filter(Boolean)
            .join(": ")
        : String(parsed ?? "");
    throw new OAuthError(`X OAuth token request failed (${response.status})${detail ? ` — ${detail}` : ""}`, {
      status: response.status,
      body: parsed,
    });
  }

  return parsed as TokenResponse;
}

// Token store: single JSON file, 0600, atomic writes (temp file + rename).

export async function readTokenFile(filePath = defaultTokenFilePath()): Promise<StoredTokens> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`No X user credentials found at ${filePath}. ${LOGIN_HINT}`);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`X token file at ${filePath} is not valid JSON. ${LOGIN_HINT}`);
  }

  const tokens = parsed as Partial<StoredTokens>;
  if (
    !tokens ||
    typeof tokens.access_token !== "string" ||
    typeof tokens.refresh_token !== "string" ||
    typeof tokens.expires_at !== "number" ||
    typeof tokens.user_id !== "string" ||
    typeof tokens.client_id !== "string" ||
    typeof tokens.client_secret !== "string"
  ) {
    throw new Error(`X token file at ${filePath} is missing required fields. ${LOGIN_HINT}`);
  }
  return { scopes: [], ...tokens } as StoredTokens;
}

export async function writeTokenFile(tokens: StoredTokens, filePath = defaultTokenFilePath()): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(tokens, null, 2)}\n`, { mode: 0o600 });
  await rename(tempPath, filePath);
}

// Runtime access: return a fresh user access token, refreshing (and rotating) when needed.

export interface GetUserAccessTokenOptions {
  filePath?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export async function getUserAccessToken(options: GetUserAccessTokenOptions = {}): Promise<UserAuth> {
  const filePath = options.filePath ?? defaultTokenFilePath();
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;

  const stored = await readTokenFile(filePath);
  if (isFresh(stored, now())) {
    return { accessToken: stored.access_token, userId: stored.user_id };
  }

  // Cursor can spawn several server instances against the same token file, and X
  // rotates the refresh token on every use. Re-read just before refreshing in case
  // another instance already rotated, and on auth failure check the file once more.
  const latest = await readTokenFile(filePath);
  if (isFresh(latest, now())) {
    return { accessToken: latest.access_token, userId: latest.user_id };
  }

  try {
    const refreshed = await refreshAccessToken({
      clientId: latest.client_id,
      clientSecret: latest.client_secret,
      refreshToken: latest.refresh_token,
      fetchImpl,
    });
    const next: StoredTokens = {
      ...latest,
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? latest.refresh_token,
      expires_at: now() + refreshed.expires_in * 1000,
      scopes: refreshed.scope ? refreshed.scope.split(" ") : latest.scopes,
    };
    await writeTokenFile(next, filePath);
    return { accessToken: next.access_token, userId: next.user_id };
  } catch (error) {
    if (error instanceof OAuthError && (error.status === 400 || error.status === 401)) {
      const rereadTokens = await readTokenFile(filePath);
      if (rereadTokens.refresh_token !== latest.refresh_token && isFresh(rereadTokens, now())) {
        return { accessToken: rereadTokens.access_token, userId: rereadTokens.user_id };
      }
      throw new Error(`X user credentials expired or were revoked (${error.message}). ${LOGIN_HINT}`);
    }
    throw error;
  }
}

function isFresh(tokens: StoredTokens, nowMs: number): boolean {
  return tokens.expires_at - EXPIRY_SKEW_MS > nowMs;
}
