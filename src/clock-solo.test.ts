import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clockSoloTarget,
  nextClockSolo,
  shouldBlockTimerToggle,
} from "./clock-solo.ts";

function fakeTarget(kind: "digits" | "face" | "control"): EventTarget {
  return {
    closest(selector: string) {
      if (kind === "control" && selector.includes(".clock-actions")) return this;
      if (kind === "digits" && selector.includes("#clock-digits")) return this;
      return null;
    },
  } as unknown as Element;
}

describe("nextClockSolo", () => {
  it("does nothing unless the clock is pinned", () => {
    assert.equal(nextClockSolo(false, "clock", false, "face"), false);
    assert.equal(nextClockSolo(true, "board", false, "face"), false);
  });

  it("enters solo from the time or the empty face", () => {
    assert.equal(nextClockSolo(true, "clock", false, "digits"), true);
    assert.equal(nextClockSolo(true, "clock", false, "face"), true);
  });

  it("leaves Start and presets alone", () => {
    assert.equal(nextClockSolo(true, "clock", false, "control"), false);
    assert.equal(nextClockSolo(true, "clock", true, "control"), true);
  });

  it("exits when the empty face is clicked again, not when the time is", () => {
    assert.equal(nextClockSolo(true, "clock", true, "face"), false);
    assert.equal(nextClockSolo(true, "clock", true, "digits"), true);
  });
});

describe("shouldBlockTimerToggle", () => {
  it("blocks the first pinned click so hide-chrome does not also start the timer", () => {
    assert.equal(shouldBlockTimerToggle(true, "clock", false, "digits"), true);
    assert.equal(shouldBlockTimerToggle(true, "clock", true, "digits"), false);
  });
});

describe("clockSoloTarget", () => {
  it("classifies digits, face, and controls", () => {
    assert.equal(clockSoloTarget(fakeTarget("digits")), "digits");
    assert.equal(clockSoloTarget(fakeTarget("control")), "control");
    assert.equal(clockSoloTarget(fakeTarget("face")), "face");
  });
});
