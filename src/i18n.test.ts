import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectLocale, setLocale, t } from "./i18n.ts";

describe("detectLocale", () => {
  it("uses Finnish when the language tag starts with fi", () => {
    assert.equal(detectLocale("fi"), "fi");
    assert.equal(detectLocale("fi-FI"), "fi");
    assert.equal(detectLocale("FI"), "fi");
  });

  it("uses English for every other language", () => {
    assert.equal(detectLocale("en"), "en");
    assert.equal(detectLocale("en-US"), "en");
    assert.equal(detectLocale("sv-SE"), "en");
    assert.equal(detectLocale(""), "en");
  });
});

describe("messages", () => {
  it("keeps board chrome in the active locale", () => {
    setLocale("fi");
    assert.equal(t("board"), "Taulu");
    assert.equal(t("clock"), "Kello");
    setLocale("en");
    assert.equal(t("board"), "Board");
    assert.equal(t("clock"), "Clock");
  });
});
