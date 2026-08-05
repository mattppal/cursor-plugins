import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postMatchesFilter } from "./format.ts";
import type { FormattedPost } from "./types.ts";

function post(overrides: Partial<FormattedPost>): FormattedPost {
  return { id: "1", text: "", ...overrides };
}

describe("postMatchesFilter", () => {
  it("matches post text case-insensitively", () => {
    const p = post({ text: "img2threejs v1.3 is now available" });
    assert.equal(postMatchesFilter(p, "IMG2ThreeJS"), true);
    assert.equal(postMatchesFilter(p, "blender"), false);
  });

  it("matches author handle and display name", () => {
    const p = post({ text: "One photo to procedural code", author: { id: "9", username: "NickDevFE", name: "Nick" } });
    assert.equal(postMatchesFilter(p, "nickdevfe"), true);
    assert.equal(postMatchesFilter(p, "nick"), true);
    assert.equal(postMatchesFilter(p, "ada"), false);
  });

  it("handles posts with no author", () => {
    assert.equal(postMatchesFilter(post({ text: "hello" }), "hello"), true);
    assert.equal(postMatchesFilter(post({ text: "hello" }), "world"), false);
  });
});
