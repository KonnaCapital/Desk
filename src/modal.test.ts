import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createModalController, type ModalKeyEvent } from "./modal.ts";

describe("settings modal focus", () => {
  it("focuses the modal on open, restores the trigger, and closes on Escape", () => {
    const calls: string[] = [];
    const trigger = { focus: () => calls.push("trigger") };
    const inside = { focus: () => calls.push("inside") };
    const states: boolean[] = [];
    const modal = createModalController(trigger, inside, (open) => states.push(open));
    const event: ModalKeyEvent = {
      key: "Escape",
      preventDefault: () => calls.push("prevented"),
    };

    modal.open(inside);
    assert.equal(modal.isOpen(), true);
    assert.deepEqual(states, [true]);
    assert.deepEqual(calls, ["inside"]);

    assert.equal(modal.handleKeyDown(event), true);
    assert.equal(modal.isOpen(), false);
    assert.deepEqual(states, [true, false]);
    assert.deepEqual(calls, ["inside", "prevented", "inside"]);

    modal.open(trigger);
    modal.close();
    assert.deepEqual(calls, ["inside", "prevented", "inside", "inside", "trigger"]);
  });
});
