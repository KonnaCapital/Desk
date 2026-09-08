import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyWindowPin, WindowPinController, type PinTarget } from "./pin.ts";

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

describe("WindowPinController", () => {
  it("serializes opposing requests and skips redundant native writes", async () => {
    const calls: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const controller = new WindowPinController({
      async setAlwaysOnTop(flag) { calls.push(`top:${flag}`); if (flag) await gate; },
      async setResizable(flag) { calls.push(`resize:${flag}`); },
    });
    const pinned = controller.apply(true);
    const duplicate = controller.apply(true);
    const unpinned = controller.apply(false);
    await Promise.resolve();
    assert.deepEqual(calls, ["top:true", "resize:false"]);
    release();
    await Promise.all([pinned, duplicate, unpinned]);
    assert.deepEqual(calls, ["top:true", "resize:false", "top:false", "resize:true"]);
  });

  it("waits for both operations after a failure before restoring the previous state", async () => {
    const calls: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const controller = new WindowPinController({
      async setAlwaysOnTop(flag) { calls.push(`top:${flag}`); if (flag) throw Error("denied"); },
      async setResizable(flag) { calls.push(`resize:${flag}`); if (!flag) await gate; },
    });
    await controller.apply(false);
    calls.length = 0;
    const failed = assert.rejects(controller.apply(true), /denied/);
    const restore = controller.apply(false);
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(calls, ["top:true", "resize:false"]);
    release();
    await Promise.all([failed, restore]);
    assert.deepEqual(calls, ["top:true", "resize:false", "top:false", "resize:true"]);
  });
});
