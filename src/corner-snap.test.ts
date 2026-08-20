import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCornerSnapIfNeeded,
  resolveCornerSnap,
  snapThresholdPx,
  snapWindowOrigin,
  workAreaForWindowCenter,
  type CornerSnapHost,
  type MonitorWorkArea,
  type Rect,
} from "./corner-snap.ts";

const primary: Rect = { x: 0, y: 0, width: 1920, height: 1040 };
const secondary: MonitorWorkArea = {
  x: 1920,
  y: 0,
  width: 1920,
  height: 1080,
  scaleFactor: 1,
};

describe("snapWindowOrigin", () => {
  it("snaps a nearby window to the top-left work-area corner", () => {
    const snap = snapWindowOrigin(
      { x: 30, y: 20, width: 200, height: 100 },
      primary,
      120,
    );
    assert.deepEqual(snap, { x: 0, y: 0, corner: "top-left" });
  });

  it("leaves a window in the middle of the work area", () => {
    assert.equal(
      snapWindowOrigin({ x: 400, y: 400, width: 200, height: 100 }, primary, 120),
      null,
    );
  });

  it("snaps to the second monitor top-right, not the primary origin", () => {
    const snap = snapWindowOrigin(
      { x: 3600, y: 30, width: 200, height: 100 },
      secondary,
      120,
    );
    assert.deepEqual(snap, { x: 3640, y: 0, corner: "top-right" });
  });

  it("snaps bottom-right when that corner is nearest", () => {
    const snap = snapWindowOrigin(
      { x: 1680, y: 920, width: 200, height: 100 },
      primary,
      120,
    );
    assert.deepEqual(snap, { x: 1720, y: 940, corner: "bottom-right" });
  });

  it("clamps a window larger than the work area onto the work-area origin", () => {
    const snap = snapWindowOrigin(
      { x: 10, y: 10, width: 1000, height: 2000 },
      { x: 0, y: 0, width: 800, height: 600 },
      120,
    );
    assert.deepEqual(snap, { x: 0, y: 0, corner: "top-left" });
  });

  it("does nothing when the window is already on the corner", () => {
    assert.equal(
      snapWindowOrigin({ x: 0, y: 0, width: 200, height: 100 }, primary, 120),
      null,
    );
  });
});

describe("workAreaForWindowCenter", () => {
  const monitors: MonitorWorkArea[] = [
    { ...primary, height: 1080, scaleFactor: 1 },
    secondary,
  ];

  it("picks the work area that contains the window center", () => {
    const area = workAreaForWindowCenter(monitors, { x: 3700, y: 80 });
    assert.equal(area, secondary);
  });

  it("falls back to the nearest work area when the center is in a gap", () => {
    const area = workAreaForWindowCenter(monitors, { x: 1910, y: 2000 });
    assert.ok(area);
    assert.equal(area.x, 0);
  });

  it("returns null when there are no monitors", () => {
    assert.equal(workAreaForWindowCenter([], { x: 10, y: 10 }), null);
  });
});

describe("resolveCornerSnap", () => {
  it("uses the occupied monitor and its scale factor for the threshold", () => {
    const monitors: MonitorWorkArea[] = [
      { x: 0, y: 0, width: 1920, height: 1080, scaleFactor: 1 },
      secondary,
    ];
    const snap = resolveCornerSnap(
      { x: 3600, y: 30, width: 200, height: 100 },
      monitors,
    );
    assert.deepEqual(snap, { x: 3640, y: 0, corner: "top-right" });
    assert.equal(snapThresholdPx(2), 240);
  });
});

describe("applyCornerSnapIfNeeded", () => {
  it("moves the window only when a corner is in range", async () => {
    const placed: { x: number; y: number }[] = [];
    const host: CornerSnapHost = {
      async outerPosition() {
        return { x: 30, y: 20 };
      },
      async outerSize() {
        return { width: 200, height: 100 };
      },
      async availableMonitors() {
        return [{ x: 0, y: 0, width: 1920, height: 1040, scaleFactor: 1 }];
      },
      async setPosition(x, y) {
        placed.push({ x, y });
      },
    };
    const snap = await applyCornerSnapIfNeeded(host);
    assert.deepEqual(snap, { x: 0, y: 0, corner: "top-left" });
    assert.deepEqual(placed, [{ x: 0, y: 0 }]);
  });

  it("does not call setPosition when the window is far from every corner", async () => {
    let moved = false;
    const host: CornerSnapHost = {
      async outerPosition() {
        return { x: 400, y: 400 };
      },
      async outerSize() {
        return { width: 200, height: 100 };
      },
      async availableMonitors() {
        return [{ x: 0, y: 0, width: 1920, height: 1040, scaleFactor: 1 }];
      },
      async setPosition() {
        moved = true;
      },
    };
    assert.equal(await applyCornerSnapIfNeeded(host), null);
    assert.equal(moved, false);
  });
});
