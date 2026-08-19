import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectLocale, setLocale, t } from "./i18n.ts";

describe("detectLocale", () => {
  it("follows the computer language for the bundled locales", () => {
    assert.equal(detectLocale("de-DE"), "de");
    assert.equal(detectLocale("es-MX"), "es");
    assert.equal(detectLocale("fr"), "fr");
    assert.equal(detectLocale("ru-RU"), "ru");
    assert.equal(detectLocale("zh-CN"), "zh");
    assert.equal(detectLocale("zh-Hans"), "zh");
    assert.equal(detectLocale("fi-FI"), "fi");
    assert.equal(detectLocale("FI"), "fi");
  });

  it("uses English when the language is unknown", () => {
    assert.equal(detectLocale("en"), "en");
    assert.equal(detectLocale("en-US"), "en");
    assert.equal(detectLocale("sv-SE"), "en");
    assert.equal(detectLocale("ja-JP"), "en");
    assert.equal(detectLocale(""), "en");
  });
});

describe("messages", () => {
  it("keeps board chrome in the active locale", () => {
    setLocale("fi");
    assert.equal(t("board"), "Taulu");
    assert.equal(t("clock"), "Kello");
    assert.equal(t("capture"), "Kirjaa");
    assert.equal(t("columnEmpty"), "Tyhjä");
    assert.equal(t("archiveDone"), "Arkistoi valmiit");
    assert.equal(
      t("persistenceCloseRegistrationError"),
      "Suojausta suljettaessa ei voitu asentaa.",
    );
    setLocale("de");
    assert.equal(t("clock"), "Uhr");
    setLocale("zh");
    assert.equal(t("pin"), "置顶");
    setLocale("en");
    assert.equal(t("board"), "Board");
    assert.equal(t("clock"), "Clock");
  });
});
