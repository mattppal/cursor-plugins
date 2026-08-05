import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { XApiError, XClient } from "./client.ts";
import { formatPostList } from "./format.ts";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("XClient", () => {
  it("searches recent posts with default fields and formats authors", async () => {
    const calls: string[] = [];
    const client = new XClient({
      bearerToken: "test-token",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return jsonResponse(200, {
          data: [
            {
              id: "1",
              text: "Hello",
              author_id: "9",
              created_at: "2026-08-04T00:00:00.000Z",
              public_metrics: { like_count: 3, retweet_count: 1, reply_count: 0, quote_count: 0 },
            },
          ],
          includes: {
            users: [{ id: "9", name: "Ada", username: "ada" }],
          },
          meta: { result_count: 1, next_token: "abc" },
        });
      },
    });

    const result = formatPostList(await client.searchPosts({ query: "from:ada", maxResults: 10 }));
    assert.match(calls[0]!, /\/tweets\/search\/recent\?/);
    assert.match(calls[0]!, /query=from%3Aada/);
    assert.equal(result.data[0]?.author?.username, "ada");
    assert.equal(result.data[0]?.url, "https://x.com/ada/status/1");
    assert.equal(result.data[0]?.metrics?.likes, 3);
    assert.equal(result.meta?.next_token, "abc");
  });

  it("sends the bearer token on every request", async () => {
    let authorization = "";
    const client = new XClient({
      bearerToken: "secret-token",
      fetchImpl: async (_input, init) => {
        authorization = new Headers(init?.headers).get("authorization") ?? "";
        return jsonResponse(200, { data: { id: "9", username: "ada", name: "Ada" } });
      },
    });

    await client.getUserByUsername("ada");
    assert.equal(authorization, "Bearer secret-token");
  });

  it("surfaces rate-limit errors clearly", async () => {
    const client = new XClient({
      bearerToken: "token",
      fetchImpl: async () =>
        jsonResponse(
          429,
          { title: "Too Many Requests", detail: "Rate limit exceeded" },
          { "x-rate-limit-reset": "1785860000" }
        ),
    });

    await assert.rejects(
      () => client.searchPosts({ query: "ai" }),
      (error: unknown) => {
        assert(error instanceof XApiError);
        assert.equal(error.status, 429);
        assert.match(error.message, /Rate limited/);
        assert.equal(error.rateLimit?.reset, "1785860000");
        return true;
      }
    );
  });

  it("requests user-context endpoints with the expected paths", async () => {
    const urls: string[] = [];
    const client = new XClient({
      bearerToken: "user-access-token",
      fetchImpl: async (input) => {
        urls.push(String(input));
        return jsonResponse(200, { data: [] });
      },
    });

    await client.getBookmarks("42", { maxResults: 5, nextToken: "tok" });
    await client.getHomeTimeline("42", { maxResults: 20, exclude: ["replies"] });
    await client.getLikedPosts("42");

    assert.match(urls[0]!, /\/users\/42\/bookmarks\?/);
    assert.match(urls[0]!, /max_results=5/);
    assert.match(urls[0]!, /pagination_token=tok/);
    assert.match(urls[1]!, /\/users\/42\/timelines\/reverse_chronological\?/);
    assert.match(urls[1]!, /exclude=replies/);
    assert.match(urls[2]!, /\/users\/42\/liked_tweets\?/);
  });

  it("looks up posts by comma-separated IDs", async () => {
    let url = "";
    const client = new XClient({
      bearerToken: "token",
      fetchImpl: async (input) => {
        url = String(input);
        return jsonResponse(200, { data: [] });
      },
    });

    await client.getPosts(["11", "22"]);
    assert.match(url, /\/tweets\?/);
    assert.match(url, /ids=11%2C22/);
  });
});
