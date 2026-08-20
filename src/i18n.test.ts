import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { t } from "./i18n.ts";

describe("messages", () => {
  it("uses English copy", () => {
    assert.equal(t("start"), "Start");
    assert.equal(t("pause"), "Pause");
    assert.equal(t("columnEmpty"), "Empty");
    assert.equal(t("timerDone"), "Timer at zero");
  });
});
