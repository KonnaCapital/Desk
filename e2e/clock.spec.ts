import { expect, test } from "@playwright/test";
import { expectDigitsFit, expectPhase, openClock, progressVisible, snap } from "./helpers.ts";

const SIZES = [
  { name: "lg", width: 1100, height: 720 },
  { name: "md", width: 700, height: 500 },
  { name: "stack", width: 400, height: 640 },
  { name: "short", width: 600, height: 220 },
  { name: "xs", width: 300, height: 150 },
];

for (const size of SIZES) {
  test(`clock fits and reads clearly through every phase at ${size.name} ${size.width}x${size.height}`, async ({ page }, testInfo) => {
    const { name } = size;
    const sizes: string[] = [];
    const record = async (label: string) => {
      sizes.push(`${label} ${await expectDigitsFit(page)}px`);
      await snap(page, testInfo, `clock-${name}-${label}`);
    };
    await openClock(page, size);
    const digits = page.locator("#clock-digits");
    const actions = page.locator(".clock-actions");

    await expectPhase(page, "idle");
    await expect(actions).toBeVisible();
    expect(await progressVisible(page)).toBe(false);
    await record("idle");

    const custom = page.locator("[data-custom]");
    if (await custom.isVisible()) {
      await custom.click();
      await expect(page.locator("#custom-duration")).toBeVisible();
      await record("custom");
      await custom.click();
      await expect(page.locator("#custom-duration")).toBeHidden();
    }

    await digits.click();
    await page.clock.runFor(95_000);
    await expectPhase(page, "running");
    await expect(actions).toBeHidden();
    await expect.poll(() => progressVisible(page)).toBe(true);
    await expect(digits).toContainText("23");
    await record("running");

    await digits.click();
    await expectPhase(page, "paused");
    await expect(actions).toBeVisible();
    await expect.poll(() => progressVisible(page)).toBe(true);
    await record("paused");

    await digits.click();
    await page.clock.runFor(26 * 60_000);
    await expectPhase(page, "done");
    await expect.poll(() => progressVisible(page)).toBe(false);
    await record("done");

    const hourPreset = page.locator("#clock-presets button", { hasText: "1h" });
    if (await hourPreset.isVisible()) {
      await hourPreset.click();
      await expect(page.locator(".clock-hours")).toBeVisible();
      await record("hour");
    }

    testInfo.annotations.push({ type: "digit sizes", description: sizes.join(", ") });
    console.log(`[${name}] ${sizes.join(", ")}`);
  });
}

test("a pinned clock hides its chrome on click and keeps the time readable", async ({ page }, testInfo) => {
  await openClock(page, { width: 420, height: 220 });
  await page.click("#pin-btn");
  await expect(page.locator("body")).toHaveAttribute("data-pinned", "true");

  await page.click("#clock-digits");
  await expect(page.locator("body")).toHaveAttribute("data-clock-solo", "true");
  await expectPhase(page, "idle");
  await expectDigitsFit(page);
  await snap(page, testInfo, "clock-solo-idle");

  await page.click("#clock-digits");
  await page.clock.runFor(61_000);
  await expectPhase(page, "running");
  const size = await expectDigitsFit(page);
  await snap(page, testInfo, "clock-solo-running");
  console.log(`[solo] running ${size}px`);

  // A click on the empty face brings the chrome back.
  await page.mouse.click(4, 214);
  await expect(page.locator("body")).toHaveAttribute("data-clock-solo", "false");
});
