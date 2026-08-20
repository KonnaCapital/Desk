import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyCardDrop, dropHitFromClosest } from "./board.ts";

type Hit = { dataset: { column?: string } };

function closestFrom(hits: Record<string, Hit | null>) {
  return (selector: string) => hits[selector] ?? null;
}

describe("dropHitFromClosest", () => {
  it("uses a column under the pointer", () => {
    const hit = dropHitFromClosest(
      closestFrom({
        ".col[data-column]": { dataset: { column: "today" } },
      }),
    );
    assert.deepEqual(hit, { column: "today", followNarrow: false });
  });

  it("uses a column-switch button when no column box is under the pointer", () => {
    const hit = dropHitFromClosest(
      closestFrom({
        ".column-switch [data-column]": { dataset: { column: "todo" } },
      }),
    );
    assert.deepEqual(hit, { column: "todo", followNarrow: true });
  });

  it("prefers the column box when both a box and a switch button match", () => {
    const hit = dropHitFromClosest(
      closestFrom({
        ".col[data-column]": { dataset: { column: "done" } },
        ".column-switch [data-column]": { dataset: { column: "inbox" } },
      }),
    );
    assert.deepEqual(hit, { column: "done", followNarrow: false });
  });

  it("ignores an unknown column id", () => {
    const hit = dropHitFromClosest(
      closestFrom({
        ".column-switch [data-column]": { dataset: { column: "archive" } },
      }),
    );
    assert.equal(hit, null);
  });
});

describe("applyCardDrop", () => {
  it("moves the card when the drop column is different", () => {
    assert.deepEqual(applyCardDrop("done", { column: "todo", followNarrow: true }), {
      moveTo: "todo",
      followNarrow: true,
    });
  });

  it("does not move when dropped on the same column", () => {
    assert.deepEqual(applyCardDrop("done", { column: "done", followNarrow: true }), {
      moveTo: null,
      followNarrow: true,
    });
  });

  it("does nothing when there is no drop target", () => {
    assert.deepEqual(applyCardDrop("inbox", null), {
      moveTo: null,
      followNarrow: false,
    });
  });
});
