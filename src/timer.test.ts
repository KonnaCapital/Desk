import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyState } from "./model.ts";
import { Store, createMemoryPersist } from "./store.ts";
import { mountTimer } from "./timer.ts";

test("timer paints on its own second boundary, completes once, and preserves duration edits", async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalNow = Date.now;
  let now = 1_250;
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextId = 0;
  const elements = new Map<string, any>();
  for (const selector of ["#clock-digits", ".clock-hours", ".clock-mins", ".clock-secs",
    "#clock-progress-fill", "#clock-presets", "#custom-duration", "#hours-input",
    "#mins-input", "#clock-duration-status", "#timer-toggle", "#timer-reset"]) {
    elements.set(selector, {
      value: "", dataset: {}, style: {}, textContent: "", hidden: false,
      classList: { toggle() {}, add() {} },
      addEventListener() {}, setAttribute() {}, querySelectorAll() { return []; },
    });
  }
  globalThis.document = {
    body: { dataset: {} }, querySelector: (selector: string) => elements.get(selector),
  } as unknown as Document;
  globalThis.window = {
    setTimeout(callback: () => void, delay: number) {
      timers.set(++nextId, { callback, delay });
      return nextId;
    },
    clearTimeout(id: number) { timers.delete(id); },
  } as unknown as Window & typeof globalThis;
  Date.now = () => now;
  const state = emptyState();
  state.timer = { durationMs: 60_000, remainingMs: 60_000, running: true, endsAt: 61_250 };
  const store = new Store(createMemoryPersist(), state);
  let completed = 0;
  try {
    mountTimer(store, () => completed++);
    assert.equal(timers.size, 1);
    assert.equal([...timers.values()][0].delay, 1_000);
    elements.get("#mins-input").value = "12";
    now = 2_250;
    const tick = [...timers.values()][0];
    timers.clear();
    tick.callback();
    assert.equal(elements.get(".clock-secs").textContent, "59");
    assert.equal(elements.get("#mins-input").value, "12");
    // A delayed wake completes immediately and clears all timer refreshes.
    now = 80_000;
    const finalTick = [...timers.values()][0];
    timers.clear();
    finalTick.callback();
    await store.flush();
    assert.equal(completed, 1);
    assert.equal(store.state.timer.running, false);
    assert.equal(timers.size, 0);
    store.setDuration(7_200_000);
    assert.equal(elements.get("#hours-input").value, "2");
    assert.equal(elements.get("#mins-input").value, "0");
    await store.flush();
    assert.equal(completed, 1);
  } finally {
    await store.flush();
    Date.now = originalNow;
    if (originalDocument === undefined) delete (globalThis as { document?: Document }).document;
    else globalThis.document = originalDocument;
    if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
    else globalThis.window = originalWindow;
  }
});
