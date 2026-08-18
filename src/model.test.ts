import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addToInbox,
  archiveDone,
  COLUMNS,
  emptyState,
  isFinished,
  moveCard,
  pauseTimer,
  remainingMs,
  resetTimer,
  startTimer,
  visibleCards,
} from "./model.ts";
import { Store, createMemoryPersist } from "./store.ts";

describe("addToInbox", () => {
  it("creates a card in inbox", () => {
    const next = addToInbox(emptyState(), "  buy milk  ", 1000);
    assert.equal(next.cards.length, 1);
    assert.equal(next.cards[0].text, "buy milk");
    assert.equal(next.cards[0].column, "inbox");
    assert.equal(next.cards[0].archivedAt, null);
    assert.equal(next.cards[0].createdAt, 1000);
  });

  it("ignores blank capture", () => {
    const next = addToInbox(emptyState(), "   ");
    assert.equal(next.cards.length, 0);
  });
});

describe("moveCard", () => {
  it("moves a card between columns", () => {
    const withCard = addToInbox(emptyState(), "task", 1);
    const id = withCard.cards[0].id;
    const moved = moveCard(withCard, id, "today", 2);
    assert.equal(moved.cards[0].column, "today");
    assert.equal(moved.cards[0].updatedAt, 2);
  });
});

describe("timer", () => {
  it("remaining is endsAt minus now while running", () => {
    const started = startTimer(emptyState(), 10_000);
    assert.equal(started.timer.running, true);
    assert.equal(started.timer.endsAt, 10_000 + 25 * 60 * 1000);
    assert.equal(remainingMs(started.timer, 10_000 + 5_000), 25 * 60 * 1000 - 5_000);
  });

  it("pause and resume keep remaining time", () => {
    let state = startTimer(emptyState(), 0);
    state = pauseTimer(state, 10_000);
    assert.equal(state.timer.running, false);
    assert.equal(state.timer.endsAt, null);
    assert.equal(state.timer.remainingMs, 25 * 60 * 1000 - 10_000);
    state = startTimer(state, 50_000);
    assert.equal(state.timer.endsAt, 50_000 + (25 * 60 * 1000 - 10_000));
  });

  it("reset restores duration", () => {
    let state = startTimer(emptyState(), 0);
    state = resetTimer(state);
    assert.equal(state.timer.running, false);
    assert.equal(state.timer.remainingMs, 25 * 60 * 1000);
  });

  it("is finished when endsAt has passed", () => {
    const started = startTimer(emptyState(), 0);
    assert.equal(isFinished(started.timer, started.timer.endsAt! + 1), true);
    assert.equal(isFinished(started.timer, 1), false);
  });
});

describe("archive", () => {
  it("hides done cards from the board", () => {
    let state = addToInbox(emptyState(), "done thing", 1);
    const id = state.cards[0].id;
    state = moveCard(state, id, "done", 2);
    assert.equal(visibleCards(state, "done").length, 1);
    state = archiveDone(state, 3);
    assert.equal(visibleCards(state, "done").length, 0);
    assert.equal(state.cards[0].archivedAt, 3);
  });
});

describe("columns", () => {
  it("keeps board labels in English", () => {
    assert.deepEqual(
      COLUMNS.map((col) => col.label),
      ["Inbox", "Today", "To Do", "Done"],
    );
  });
});

describe("Store", () => {
  it("persists inbox cards through flush and reload", async () => {
    const persist = createMemoryPersist();
    const store = await Store.load(persist);
    store.addToInbox("remember this");
    await store.flush();
    const reloaded = await Store.load(persist);
    assert.equal(reloaded.state.cards.length, 1);
    assert.equal(reloaded.state.cards[0].text, "remember this");
    assert.equal(reloaded.state.cards[0].column, "inbox");
  });
});
