import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyState, type BoardState } from "./model.ts";
import { Store, createMemoryPersist } from "./store.ts";
import { WHEEL_NOTCH, mountTimer, wheelStep, type TimerHooks } from "./timer.ts";

/** Every element mountTimer looks up. Add a selector here when it starts using a new one. */
const TIMER_SELECTORS = [
  "#clock-digits",
  ".clock-hours",
  ".clock-mins",
  ".clock-secs",
  "#clock-progress-fill",
  "#clock-presets",
  "#custom-duration",
  "#hours-input",
  "#mins-input",
  "#clock-duration-status",
  "#timer-toggle",
  "#timer-reset",
];

type FakeElement = Record<string, any>;

/** Just enough of the clock's DOM and timers for mountTimer to wire itself and paint. */
function fakeClockHost() {
  const elements = new Map<string, FakeElement>();
  for (const selector of TIMER_SELECTORS) {
    elements.set(selector, {
      value: "",
      innerHTML: "",
      textContent: "",
      title: "",
      hidden: false,
      dataset: {},
      style: {},
      classList: { toggle() {}, add() {}, remove() {} },
      addEventListener() {},
      setAttribute() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    });
  }
  const body = { dataset: {} as Record<string, string> };
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 0;
  let intervals = 0;
  return {
    elements,
    body,
    timers,
    intervals: () => intervals,
    document: { body, querySelector: (selector: string) => elements.get(selector) },
    window: {
      setTimeout(callback: () => void, delay: number) {
        timers.set(++nextId, { callback, delay });
        return nextId;
      },
      clearTimeout(id: number) {
        timers.delete(id);
      },
      setInterval() {
        intervals += 1;
        return 0;
      },
      clearInterval() {},
    },
  };
}

type ClockHost = ReturnType<typeof fakeClockHost>;

/** Mount the timer against a fake host and restore the real globals afterwards. */
async function withMountedTimer(
  state: BoardState,
  hooks: TimerHooks,
  run: (host: ClockHost, store: Store, setNow: (ms: number) => void) => Promise<void> | void,
  startAt = 0,
) {
  const g = globalThis as { document?: unknown; window?: unknown };
  const originalDocument = g.document;
  const originalWindow = g.window;
  const originalNow = Date.now;
  let now = startAt;
  const host = fakeClockHost();
  g.document = host.document;
  g.window = host.window;
  Date.now = () => now;
  const store = new Store(createMemoryPersist(), state);
  try {
    mountTimer(store, hooks);
    await run(host, store, (ms) => {
      now = ms;
    });
  } finally {
    await store.flush();
    Date.now = originalNow;
    if (originalDocument === undefined) delete g.document;
    else g.document = originalDocument;
    if (originalWindow === undefined) delete g.window;
    else g.window = originalWindow;
  }
}

function takeOnlyTimer(host: ClockHost) {
  assert.equal(host.timers.size, 1);
  const [timer] = host.timers.values();
  host.timers.clear();
  return timer;
}

describe("mountTimer", () => {
  it("paints on its own second boundary, completes once, and preserves duration edits", async () => {
    const state = emptyState();
    state.timer = { durationMs: 60_000, remainingMs: 60_000, running: true, endsAt: 61_250 };
    let completed = 0;
    await withMountedTimer(state, { onComplete: () => completed++ }, async (host, store, setNow) => {
      assert.equal([...host.timers.values()][0].delay, 1_000);
      host.elements.get("#mins-input")!.value = "12";
      setNow(2_250);
      takeOnlyTimer(host).callback();
      assert.equal(host.elements.get(".clock-secs")!.textContent, "59");
      assert.equal(host.elements.get("#mins-input")!.value, "12");
      // A delayed wake completes immediately and clears all timer refreshes.
      setNow(80_000);
      takeOnlyTimer(host).callback();
      await store.flush();
      assert.equal(completed, 1);
      assert.equal(store.state.timer.running, false);
      assert.equal(host.timers.size, 0);
      store.setDuration(7_200_000);
      assert.equal(host.elements.get("#hours-input")!.value, "2");
      assert.equal(host.elements.get("#mins-input")!.value, "0");
      await store.flush();
      assert.equal(completed, 1);
    }, 1_250);
  });

  it("does not schedule a refresh while stopped", async () => {
    await withMountedTimer(emptyState(), {}, (host) => {
      assert.equal(host.timers.size, 0);
      assert.equal(host.intervals(), 0);
    });
  });

  it("publishes the phase, the hour layout, and the window title", async () => {
    const state = emptyState();
    state.timer = { durationMs: 7_200_000, remainingMs: 7_200_000, running: false, endsAt: null };
    const titles: string[] = [];
    await withMountedTimer(state, { onTitle: (title) => titles.push(title), appName: "Desk Dev" }, (host, store) => {
      assert.equal(host.body.dataset.timer, "idle");
      assert.equal(host.body.dataset.clockHours, "true");
      assert.deepEqual(titles, ["Desk Dev"]);
      store.toggleTimer();
      assert.equal(host.body.dataset.timer, "running");
      assert.equal(titles.at(-1), "2:00:00 · Desk Dev");
      store.setDuration(25 * 60_000);
      assert.equal(host.body.dataset.clockHours, "false");
    });
  });
});

describe("wheelStep", () => {
  it("steps once per notch, up for more time and down for less", () => {
    assert.deepEqual(wheelStep(0, -100), { total: 0, step: 1 });
    assert.deepEqual(wheelStep(0, 100), { total: 0, step: -1 });
  });

  it("adds small trackpad deltas until they make a notch", () => {
    let total = 0;
    const steps: number[] = [];
    for (let i = 0; i < 8; i++) {
      const result = wheelStep(total, 10);
      total = result.total;
      steps.push(result.step);
    }
    assert.deepEqual(steps, [0, 0, 0, -1, 0, 0, 0, -1]);
  });

  it("starts over when the direction flips or nothing moved", () => {
    assert.deepEqual(wheelStep(30, -10), { total: -10, step: 0 });
    assert.deepEqual(wheelStep(30, 0), { total: 30, step: 0 });
  });

  it("reads line and page deltas as whole notches", () => {
    assert.equal(wheelStep(0, -3, 1).step, 1);
    assert.equal(wheelStep(0, 1, 2).step, -1);
    assert.ok(WHEEL_NOTCH > 16);
  });
});
