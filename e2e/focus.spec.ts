import { expect, test, type Page } from "@playwright/test";
import { dragCard, expectDigitsFit, expectPhase, openDesk, snap } from "./helpers.ts";

const column = (name: string) => `#board .col[data-column="${name}"]`;

async function addCards(page: Page, texts: string[]) {
  for (const text of texts) {
    await page.fill("#capture-input", text);
    await page.press("#capture-input", "Enter");
  }
}

test("pick the card the clock is for, keep it in view, and mark it done", async ({ page }, testInfo) => {
  await openDesk(page, { width: 1100, height: 720 });
  await page.click("#view-clock");
  await expect(page.locator(".clock-focus"), "nothing to pick on an empty board").toBeHidden();

  await page.click("#view-board");
  await addCards(page, ["Write the weekly note", "Call the bank"]);
  await dragCard(page, page.locator(`${column("inbox")} .card`, { hasText: "Write the weekly note" }), page.locator(column("today")));
  await page.click("#view-clock");

  const picker = page.locator("#focus-select");
  await expect(picker).toBeVisible();
  await expect(picker.locator("option:checked")).toHaveText("What are you working on?");
  await expect(picker.locator("optgroup")).toHaveCount(2);
  await picker.selectOption({ label: "Write the weekly note" });
  await expect(page.locator("body")).toHaveAttribute("data-current-card", "true");
  await expectDigitsFit(page);
  await snap(page, testInfo, "focus-idle");

  await page.click("#view-board");
  await expect(page.locator("#board .card.is-current")).toHaveText("Write the weekly note");
  await page.click("#view-clock");

  await page.locator("#clock-digits").click();
  await page.clock.runFor(60_000);
  await expectPhase(page, "running");
  await expect(picker).toBeVisible();
  await expect(page.locator("#focus-done")).toBeHidden();
  await expectDigitsFit(page);
  await snap(page, testInfo, "focus-running");

  await page.clock.runFor(25 * 60_000);
  await expectPhase(page, "done");
  const markDone = page.locator("#focus-done");
  await expect(markDone).toBeVisible();
  await snap(page, testInfo, "focus-done");
  await markDone.click();
  await expectPhase(page, "idle");
  await expect(page.locator("body")).toHaveAttribute("data-current-card", "false");
  await expect(markDone).toBeHidden();

  await page.click("#view-board");
  await expect(page.locator(`${column("done")} .card`)).toHaveText(["Write the weekly note"]);
  await expect(page.locator("#board .card.is-current")).toHaveCount(0);
});

test("after a mouse pick, clock keys reach the clock instead of the picker", async ({ page }) => {
  await openDesk(page, { width: 900, height: 600 });
  await addCards(page, ["Reply to Sam", "Read the report"]);
  await page.click("#view-clock");
  const picker = page.locator("#focus-select");
  // What a mouse pick does: focus lands on the picker, then an option is chosen.
  await picker.focus();
  await picker.dispatchEvent("pointerdown");
  await picker.selectOption({ label: "Reply to Sam" });
  await expect(picker).not.toBeFocused();

  await page.keyboard.press("Space");
  await expectPhase(page, "running");
  await page.keyboard.press("r");
  await expectPhase(page, "idle");
  await expect(picker.locator("option:checked")).toHaveText("Reply to Sam");
});

test("the picker makes room in small windows and stays with a pinned clock", async ({ page }, testInfo) => {
  await openDesk(page, { width: 900, height: 600 });
  await addCards(page, ["Stretch"]);
  await page.click("#view-clock");
  await page.locator("#focus-select").selectOption({ label: "Stretch" });
  await page.setViewportSize({ width: 600, height: 220 });
  await expect(page.locator(".clock-focus"), "short and stopped: controls win").toBeHidden();
  await page.locator("#clock-digits").click();
  await expectPhase(page, "running");
  await expect(page.locator(".clock-focus")).toBeVisible();
  await expectDigitsFit(page);
  await snap(page, testInfo, "focus-short-running");

  await page.setViewportSize({ width: 420, height: 240 });
  await page.click("#pin-btn");
  await page.click("#clock-digits", { position: { x: 5, y: 5 } });
  await expect(page.locator("body")).toHaveAttribute("data-clock-solo", "true");
  await expect(page.locator(".clock-focus")).toBeVisible();
  await page.locator("#focus-select").click();
  await expect(page.locator("body"), "picking keeps the chrome hidden").toHaveAttribute("data-clock-solo", "true");
  await expectDigitsFit(page);
  await snap(page, testInfo, "focus-solo");
});
