import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  buildAuthorizeUrl,
  codeChallengeS256,
  generateCodeVerifier,
  getUserAccessToken,
  readTokenFile,
  writeTokenFile,
  type StoredTokens,
} from "./auth.ts";

const tempDirs: string[] = [];

async function tempTokenPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "x-auth-test-"));
  tempDirs.push(dir);
  return join(dir, "tokens.json");
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function makeTokens(overrides: Partial<StoredTokens> = {}): StoredTokens {
  return {
    access_token: "access-1",
    refresh_token: "refresh-1",
    expires_at: Date.now() + 3600_000,
    user_id: "42",
    client_id: "client-id",
    client_secret: "client-secret",
    scopes: ["tweet.read", "bookmark.read", "offline.access"],
    ...overrides,
  };
}

function tokenResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("PKCE", () => {
  it("computes the RFC 7636 appendix B challenge", () => {
    // Known vector from RFC 7636 appendix B.
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    assert.equal(codeChallengeS256(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates base64url verifiers of sufficient length", () => {
    const verifier = generateCodeVerifier();
    assert.match(verifier, /^[A-Za-z0-9_-]{43,128}$/);
    assert.notEqual(verifier, generateCodeVerifier());
  });

  it("builds the authorize URL with S256 parameters", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "cid",
        redirectUri: "http://127.0.0.1:8917/callback",
        scopes: ["tweet.read", "offline.access"],
        state: "st4te",
        codeChallenge: "ch4llenge",
      })
    );
    assert.equal(url.origin + url.pathname, "https://x.com/i/oauth2/authorize");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "cid");
    assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:8917/callback");
    assert.equal(url.searchParams.get("scope"), "tweet.read offline.access");
    assert.equal(url.searchParams.get("state"), "st4te");
    assert.equal(url.searchParams.get("code_challenge"), "ch4llenge");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  });
});

describe("token store", () => {
  it("round-trips tokens through the file with 0600 permissions", async () => {
    const filePath = await tempTokenPath();
    const tokens = makeTokens();
    await writeTokenFile(tokens, filePath);

    const loaded = await readTokenFile(filePath);
    assert.deepEqual(loaded, tokens);

    if (process.platform !== "win32") {
      const mode = (await stat(filePath)).mode & 0o777;
      assert.equal(mode, 0o600);
    }
  });

  it("points to the login script when the file is missing", async () => {
    const filePath = await tempTokenPath();
    await assert.rejects(() => readTokenFile(filePath), /npm run login/);
  });

  it("rejects files missing required fields", async () => {
    const filePath = await tempTokenPath();
    await writeTokenFile({ ...makeTokens(), refresh_token: undefined as unknown as string }, filePath);
    await assert.rejects(() => readTokenFile(filePath), /missing required fields/);
  });
});

describe("getUserAccessToken", () => {
  it("returns the stored token while it is fresh, without any network call", async () => {
    const filePath = await tempTokenPath();
    await writeTokenFile(makeTokens(), filePath);

    const auth = await getUserAccessToken({
      filePath,
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
    });
    assert.equal(auth.accessToken, "access-1");
    assert.equal(auth.userId, "42");
  });

  it("refreshes an expired token and persists the rotated pair", async () => {
    const filePath = await tempTokenPath();
    await writeTokenFile(makeTokens({ expires_at: Date.now() - 1000 }), filePath);

    const requests: Array<{ url: string; body: string; authorization: string }> = [];
    const auth = await getUserAccessToken({
      filePath,
      fetchImpl: async (input, init) => {
        requests.push({
          url: String(input),
          body: String(init?.body),
          authorization: new Headers(init?.headers).get("authorization") ?? "",
        });
        return tokenResponse({
          access_token: "access-2",
          refresh_token: "refresh-2",
          expires_in: 7200,
          scope: "tweet.read bookmark.read offline.access",
        });
      },
    });

    assert.equal(auth.accessToken, "access-2");
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.url, "https://api.x.com/2/oauth2/token");
    assert.match(requests[0]!.body, /grant_type=refresh_token/);
    assert.match(requests[0]!.body, /refresh_token=refresh-1/);
    assert.equal(requests[0]!.authorization, `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`);

    const stored = await readTokenFile(filePath);
    assert.equal(stored.access_token, "access-2");
    assert.equal(stored.refresh_token, "refresh-2");
    assert.ok(stored.expires_at > Date.now() + 3600_000);
    const raw = JSON.parse(await readFile(filePath, "utf8")) as StoredTokens;
    assert.equal(raw.refresh_token, "refresh-2");
  });

  it("keeps the old refresh token when the response omits a new one", async () => {
    const filePath = await tempTokenPath();
    await writeTokenFile(makeTokens({ expires_at: Date.now() - 1000 }), filePath);

    await getUserAccessToken({
      filePath,
      fetchImpl: async () => tokenResponse({ access_token: "access-2", expires_in: 7200 }),
    });

    const stored = await readTokenFile(filePath);
    assert.equal(stored.refresh_token, "refresh-1");
  });

  it("recovers when another instance rotated the refresh token first", async () => {
    const filePath = await tempTokenPath();
    const stale = makeTokens({ expires_at: Date.now() - 1000 });
    await writeTokenFile(stale, filePath);

    let refreshCalls = 0;
    const auth = await getUserAccessToken({
      filePath,
      fetchImpl: async () => {
        refreshCalls += 1;
        // Simulate a sibling server instance winning the refresh race: our
        // refresh token is now invalid, and the file holds the rotated pair.
        await writeTokenFile(
          makeTokens({ access_token: "access-3", refresh_token: "refresh-3", expires_at: Date.now() + 3600_000 }),
          filePath
        );
        return tokenResponse({ error: "invalid_request", error_description: "refresh token invalid" }, 401);
      },
    });

    assert.equal(refreshCalls, 1);
    assert.equal(auth.accessToken, "access-3");
  });

  it("asks for a new login when refresh fails and no rotation happened", async () => {
    const filePath = await tempTokenPath();
    await writeTokenFile(makeTokens({ expires_at: Date.now() - 1000 }), filePath);

    await assert.rejects(
      () =>
        getUserAccessToken({
          filePath,
          fetchImpl: async () => tokenResponse({ error: "invalid_request" }, 400),
        }),
      /npm run login/
    );
  });
});
