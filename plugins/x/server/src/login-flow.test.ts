import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { readTokenFile } from "./auth.ts";
import { normalizeScopes, startLoginFlow } from "./login-flow.ts";

const tempDirs: string[] = [];

async function tempTokenPath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "x-login-test-"));
  tempDirs.push(dir);
  return join(dir, "tokens.json");
}

after(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function mockXFetch(): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    if (url === "https://api.x.com/2/oauth2/token") {
      const body = String(init?.body);
      assert.match(body, /grant_type=authorization_code/);
      assert.match(body, /code=test-code/);
      assert.match(body, /code_verifier=/);
      return new Response(
        JSON.stringify({
          access_token: "user-access",
          refresh_token: "user-refresh",
          expires_in: 7200,
          scope: "tweet.read bookmark.read offline.access",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (url === "https://api.x.com/2/users/me") {
      return new Response(JSON.stringify({ data: { id: "42", username: "matt" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }) as typeof fetch;
}

describe("startLoginFlow", () => {
  it("returns the authorize URL immediately and completes on callback", async () => {
    const filePath = await tempTokenPath();
    const flow = await startLoginFlow({
      clientId: "cid",
      clientSecret: "csecret",
      port: 0,
      filePath,
      fetchImpl: mockXFetch(),
    });

    const authorize = new URL(flow.authorizeUrl);
    assert.equal(authorize.searchParams.get("client_id"), "cid");
    assert.equal(authorize.searchParams.get("redirect_uri"), flow.redirectUri);
    const state = authorize.searchParams.get("state")!;

    const callback = await fetch(`${flow.redirectUri}?state=${encodeURIComponent(state)}&code=test-code`);
    assert.equal(callback.status, 200);

    const stored = await flow.completion;
    assert.equal(stored.access_token, "user-access");
    assert.equal(stored.user_id, "42");
    assert.equal(stored.username, "matt");

    const persisted = await readTokenFile(filePath);
    assert.equal(persisted.refresh_token, "user-refresh");
    assert.equal(persisted.client_id, "cid");
  });

  it("rejects a callback with the wrong state", async () => {
    const filePath = await tempTokenPath();
    const flow = await startLoginFlow({
      clientId: "cid",
      clientSecret: "csecret",
      port: 0,
      filePath,
      fetchImpl: mockXFetch(),
    });

    const callback = await fetch(`${flow.redirectUri}?state=forged&code=test-code`);
    assert.equal(callback.status, 400);
    await assert.rejects(() => flow.completion, /state mismatch/i);
    await assert.rejects(() => readTokenFile(filePath), /npm run login/);
  });

  it("rejects when the authorization is denied", async () => {
    const flow = await startLoginFlow({
      clientId: "cid",
      clientSecret: "csecret",
      port: 0,
      filePath: await tempTokenPath(),
      fetchImpl: mockXFetch(),
    });

    const callback = await fetch(`${flow.redirectUri}?error=access_denied`);
    assert.equal(callback.status, 400);
    await assert.rejects(() => flow.completion, /denied/);
  });

  it("normalizes scopes to always include offline.access", () => {
    assert.deepEqual(normalizeScopes(["tweet.read"]), ["tweet.read", "offline.access"]);
    assert.ok(normalizeScopes(undefined).includes("offline.access"));
    assert.ok(normalizeScopes(undefined).includes("bookmark.read"));
  });
});
