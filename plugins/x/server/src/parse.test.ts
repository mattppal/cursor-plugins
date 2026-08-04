import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeUserId, parsePostId, parsePostIds, parseUsername } from "./parse.ts";

describe("parsePostId", () => {
  it("accepts bare numeric IDs", () => {
    assert.equal(parsePostId("1234567890123456789"), "1234567890123456789");
  });

  it("parses x.com and twitter.com status URLs", () => {
    assert.equal(parsePostId("https://x.com/openai/status/12345"), "12345");
    assert.equal(parsePostId("https://twitter.com/openai/status/12345?s=20"), "12345");
    assert.equal(parsePostId("https://x.com/i/web/status/999"), "999");
    assert.equal(parsePostId("https://mobile.twitter.com/foo/statuses/42"), "42");
  });

  it("rejects unrelated strings", () => {
    assert.throws(() => parsePostId("not-a-post"), /Could not parse a post ID/);
  });
});

describe("parsePostIds", () => {
  it("deduplicates IDs", () => {
    assert.deepEqual(parsePostIds(["1", "https://x.com/a/status/1", "2"]), ["1", "2"]);
  });
});

describe("parseUsername", () => {
  it("strips leading @", () => {
    assert.equal(parseUsername("@OpenAI"), "OpenAI");
  });

  it("rejects invalid handles", () => {
    assert.throws(() => parseUsername("bad handle"), /Invalid username/);
  });
});

describe("looksLikeUserId", () => {
  it("detects numeric IDs only", () => {
    assert.equal(looksLikeUserId("123456"), true);
    assert.equal(looksLikeUserId("openai"), false);
  });
});
