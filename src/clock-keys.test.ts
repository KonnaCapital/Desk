import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clockKeyAction,
  clockKeyTarget,
  type ClockKeyContext,
  type ClockKeyInput,
} from "./clock-keys.ts";

function key(value: string, extra: Partial<ClockKeyInput> = {}): ClockKeyInput {
  return {
    key: value,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    ...extra,
  };
}

const idle: ClockKeyContext = { view: "clock", running: false, overlayOpen: false, target: "other" };
const running: ClockKeyContext = { ...idle, running: true };

describe("clockKeyAction", () => {
  it("starts, pauses, and resets from the clock view", () => {
    assert.deepEqual(clockKeyAction(key(" "), idle), { kind: "toggle" });
    assert.deepEqual(clockKeyAction(key(" "), running), { kind: "toggle" });
    assert.deepEqual(clockKeyAction(key("r"), running), { kind: "reset" });
    assert.deepEqual(clockKeyAction(key("R", { shiftKey: true }), idle), { kind: "reset" });
  });

  it("picks presets and nudges the time only while stopped", () => {
    assert.deepEqual(clockKeyAction(key("2"), idle), { kind: "preset", index: 1 });
    assert.equal(clockKeyAction(key("4"), idle), null);
    assert.equal(clockKeyAction(key("1"), running), null);
    assert.deepEqual(clockKeyAction(key("ArrowUp"), idle), { kind: "nudge", minutes: 1 });
    assert.deepEqual(
      clockKeyAction(key("ArrowDown", { shiftKey: true }), idle),
      { kind: "nudge", minutes: -5 },
    );
    assert.equal(clockKeyAction(key("ArrowUp"), running), null);
  });

  it("stays out of the board, open dialogs, text fields, and shortcuts", () => {
    assert.equal(clockKeyAction(key(" "), { ...idle, view: "board" }), null);
    assert.equal(clockKeyAction(key(" "), { ...idle, overlayOpen: true }), null);
    assert.equal(clockKeyAction(key("r"), { ...idle, target: "text" }), null);
    assert.equal(clockKeyAction(key("r", { ctrlKey: true }), idle), null);
    assert.equal(clockKeyAction(key("1", { metaKey: true }), idle), null);
  });

  it("lets a focused button answer Space and ignores held keys except arrows", () => {
    assert.equal(clockKeyAction(key(" "), { ...idle, target: "button" }), null);
    assert.deepEqual(clockKeyAction(key("r"), { ...idle, target: "button" }), { kind: "reset" });
    assert.equal(clockKeyAction(key(" ", { repeat: true }), idle), null);
    assert.deepEqual(
      clockKeyAction(key("ArrowUp", { repeat: true }), idle),
      { kind: "nudge", minutes: 1 },
    );
  });
});

describe("clockKeyTarget", () => {
  it("sorts focus into text, button, or other", () => {
    assert.equal(clockKeyTarget({ tagName: "INPUT" } as unknown as EventTarget), "text");
    assert.equal(
      clockKeyTarget({ tagName: "ARTICLE", isContentEditable: true } as unknown as EventTarget),
      "text",
    );
    assert.equal(clockKeyTarget({ tagName: "BUTTON" } as unknown as EventTarget), "button");
    assert.equal(clockKeyTarget({ tagName: "BODY" } as unknown as EventTarget), "other");
    assert.equal(clockKeyTarget(null), "other");
  });
});
