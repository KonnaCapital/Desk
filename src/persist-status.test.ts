import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { persistChromeCopy } from "./persist-status.ts";

describe("persistChromeCopy", () => {
  it("shows Saving while a write is in flight", () => {
    assert.deepEqual(persistChromeCopy("saving", null, "board.json", false), {
      text: "Saving…",
      hideAfterMs: 0,
    });
  });

  it("flashes Saved only after a save, not on first load", () => {
    assert.deepEqual(persistChromeCopy("saved", null, "board.json", false), {
      text: null,
      hideAfterMs: 0,
    });
    assert.deepEqual(persistChromeCopy("saved", null, "board.json", true), {
      text: "Saved",
      hideAfterMs: 700,
    });
  });

  it("keeps close-protection copy over the save flash", () => {
    const copy = persistChromeCopy("saved", "Save timed out; closing now.", "board.json", true);
    assert.equal(copy.text, "Save timed out; closing now.");
    assert.equal(copy.hideAfterMs, 0);
  });
});
