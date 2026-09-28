import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export type Phase = "idle" | "running" | "paused" | "done";

/** Load Desk with a controllable clock so timer tests never wait in real time. */
export async function openDesk(page: Page, size?: { width: number; height: number }) {
  if (size) await page.setViewportSize(size);
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#board .col")).toHaveCount(4);
}

export async function openClock(page: Page, size?: { width: number; height: number }) {
  await openDesk(page, size);
  await page.click("#view-clock");
  await expect(page.locator("body")).toHaveAttribute("data-view", "clock");
}

export async function expectPhase(page: Page, phase: Phase) {
  await expect(page.locator("body")).toHaveAttribute("data-timer", phase);
}

/** Screenshot into shots/ for people to look at, and attach it to the HTML report. */
export async function snap(page: Page, testInfo: TestInfo, name: string) {
  const path = `shots/${name}.png`;
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  expect(box, "element should be rendered").not.toBeNull();
  return box!;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/**
 * The time must be fully visible: inside the window, below the title bar when it
 * shows, clear of every visible control, and at least 20px tall.
 */
export async function expectDigitsFit(page: Page) {
  const digits = page.locator("#clock-digits");
  const box = await boxOf(digits);
  const viewport = page.viewportSize()!;
  const bounds = `${JSON.stringify(box)} in ${viewport.width}x${viewport.height}`;
  expect(box.x, `digits left edge ${bounds}`).toBeGreaterThanOrEqual(0);
  expect(box.y, `digits top edge ${bounds}`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `digits right edge ${bounds}`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height, `digits bottom edge ${bounds}`).toBeLessThanOrEqual(viewport.height + 0.5);

  const chromeVisible = await page.evaluate(
    () => Number(getComputedStyle(document.querySelector(".chrome")!).opacity) > 0,
  );
  if (chromeVisible) {
    expect(overlaps(box, await boxOf(page.locator(".chrome"))), "digits overlap the title bar").toBe(false);
  }
  for (const selector of ["#clock-presets", "#custom-duration", ".clock-actions"]) {
    const control = page.locator(selector);
    if (!(await control.isVisible())) continue;
    expect(overlaps(box, await boxOf(control)), `digits overlap ${selector}`).toBe(false);
  }

  const fontSize = await digits.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(20);
  return fontSize;
}

export async function progressVisible(page: Page): Promise<boolean> {
  return page.evaluate(
    () => Number(getComputedStyle(document.querySelector(".clock-progress")!).opacity) > 0,
  );
}

/** Drag a card with real pointer moves, the way a person would. */
export async function dragCard(page: Page, card: Locator, target: Locator) {
  const from = await boxOf(card);
  const to = await boxOf(target);
  await page.mouse.move(from.x + 12, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 120), { steps: 12 });
  await page.mouse.up();
}
