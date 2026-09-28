import { expect, test, type Page } from "@playwright/test";
import { expectPhase, openClock, openDesk } from "./helpers.ts";

/** The time as people hear it: the digits' label reads "Start: 1:01:00" or "Pause: 24:57". */
const time = async (page: Page) =>
  ((await page.locator("#clock-digits").getAttribute("aria-label")) ?? "").split(": ")[1];

test("clock shortcuts start, pause, reset, pick presets, and nudge the time", async ({ page }) => {
  await openClock(page, { width: 900, height: 600 });
  await page.mouse.click(10, 580);

  await page.keyboard.press("Space");
  await page.clock.runFor(3_000);
  await expectPhase(page, "running");
  await expect(page).toHaveTitle("24:57 · Desk");

  await page.keyboard.press("Space");
  await expectPhase(page, "paused");
  await expect(page).toHaveTitle("24:57 paused · Desk");

  await page.keyboard.press("r");
  await expectPhase(page, "idle");
  await expect(page).toHaveTitle("Desk");

  await page.keyboard.press("2");
  await expect(page.locator("#clock-presets button.active")).toHaveText("1h");
  await page.keyboard.press("ArrowUp");
  expect(await time(page)).toBe("1:01:00");
  await page.keyboard.press("Shift+ArrowUp");
  expect(await time(page)).toBe("1:05:00");
  await expect(page.locator("#clock-presets button.active")).toHaveText("Custom");
  await page.keyboard.press("1");
  expect(await time(page)).toBe("25:00");
});

test("scrolling over a stopped clock sets the time", async ({ page }) => {
  await openClock(page, { width: 900, height: 600 });
  await page.locator("#clock-digits").hover();
  await page.mouse.wheel(0, -100);
  expect(await time(page)).toBe("26:00");
  await page.mouse.wheel(0, 100);
  await page.mouse.wheel(0, 100);
  expect(await time(page)).toBe("24:00");
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Shift");
  expect(await time(page)).toBe("25:00");
  // Small trackpad deltas add up to whole steps.
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 10);
  expect(await time(page)).toBe("23:00");

  await page.locator("#clock-digits").click();
  await page.mouse.wheel(0, -100);
  await expectPhase(page, "running");
  expect(await time(page)).toBe("23:00");
});

test("shortcuts stay out of the board, text fields, and open dialogs", async ({ page }) => {
  await openDesk(page, { width: 900, height: 600 });
  await page.keyboard.press("Space");
  await page.keyboard.press("r");
  await expectPhase(page, "idle");

  await page.click("#view-clock");
  await page.click("[data-custom]");
  await expect(page.locator("#mins-input")).toBeFocused();
  await page.keyboard.type("7");
  await page.keyboard.press("r");
  await expectPhase(page, "idle");
  await page.keyboard.press("Escape");
  await expect(page.locator("#custom-duration")).toBeHidden();
  await expect(page.locator("[data-custom]")).toBeFocused();

  await page.click("#settings-btn");
  await page.keyboard.press("Space");
  await page.keyboard.press("r");
  await expectPhase(page, "idle");
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-overlay")).toBeHidden();
});

test("the custom time applies, rejects zero, and drops unapplied edits", async ({ page }) => {
  await openClock(page, { width: 900, height: 600 });
  const custom = page.locator("[data-custom]");
  await custom.click();
  await page.fill("#hours-input", "0");
  await page.fill("#mins-input", "0");
  await page.press("#mins-input", "Enter");
  await expect(page.locator("#clock-duration-status")).toHaveText("Minimum is 1 minute.");

  await page.fill("#mins-input", "42");
  await page.press("#mins-input", "Enter");
  await expect(page.locator("#custom-duration")).toBeHidden();
  expect(await time(page)).toBe("42:00");
  await expect(page.locator("#clock-presets button.active")).toHaveText("Custom");

  await custom.click();
  await page.fill("#mins-input", "7");
  await custom.click();
  await custom.click();
  await expect(page.locator("#mins-input")).toHaveValue("42");
});
