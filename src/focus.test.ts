import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { choiceLabel, currentChoices } from "./focus.ts";
import { addToInbox, archiveDone, emptyState, moveCard } from "./model.ts";

describe("currentChoices", () => {
  it("offers open cards by column, Today first, and leaves out Done and archived ones", () => {
    let state = addToInbox(emptyState(), "inbox card", 1);
    state = addToInbox(state, "today card", 2);
    state = addToInbox(state, "archived card", 3);
    const [archived, today] = state.cards;
    state = moveCard(state, today.id, "today", 4);
    state = moveCard(state, archived.id, "done", 5);
    state = archiveDone(state, 6);
    state = addToInbox(state, "done card", 7);
    state = moveCard(state, state.cards[0].id, "done", 8);

    assert.deepEqual(
      currentChoices(state).map((group) => [group.label, group.cards.map((card) => card.text)]),
      [
        ["Today", ["today card"]],
        ["Inbox", ["inbox card"]],
      ],
    );
  });

  it("is empty for an empty board", () => {
    assert.deepEqual(currentChoices(emptyState()), []);
  });
});

describe("choiceLabel", () => {
  it("keeps one line and shortens long text", () => {
    assert.equal(choiceLabel("  write\n the  note "), "write the note");
    assert.equal(choiceLabel("abcdefghij", 5), "abcd…");
    assert.equal(choiceLabel("abcde", 5), "abcde");
  });
});
