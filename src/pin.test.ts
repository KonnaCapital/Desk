import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWindowPin, type PinTarget } from "./pin.ts";

function fakeWindow(): PinTarget & {
  alwaysOnTop: boolean | null;
  resizable: boolean | null;
} {
  const win = {
    alwaysOnTop: null as boolean | null,
    resizable: null as boolean | null,
    async setAlwaysOnTop(flag: boolean) {
      win.alwaysOnTop = flag;
    },
    async setResizable(flag: boolean) {
      win.resizable = flag;
    },
  };
  return win;
}

describe("applyWindowPin", () => {
  it("does nothing when there is no native window", async () => {
    await applyWindowPin(null, true);
  });

  it("locks the window on top and not resizable when pinned", async () => {
    const win = fakeWindow();
    await applyWindowPin(win, true);
    assert.equal(win.alwaysOnTop, true);
    assert.equal(win.resizable, false);
  });

  it("unlocks move and size when unpinned", async () => {
    const win = fakeWindow();
    await applyWindowPin(win, true);
    await applyWindowPin(win, false);
    assert.equal(win.alwaysOnTop, false);
    assert.equal(win.resizable, true);
  });
});
