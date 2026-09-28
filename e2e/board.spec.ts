import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { dragCard, openDesk, snap } from "./helpers.ts";

const column = (name: string) => `#board .col[data-column="${name}"]`;

test("capture, drag to Done, archive, and restore a card", async ({ page }, testInfo) => {
  await openDesk(page, { width: 1100, height: 720 });
  const archiveDone = page.locator("#archive-done");
  await expect(archiveDone).toBeDisabled();

  for (const text of ["Write the weekly note", "Call the bank", "Tidy desktop"]) {
    await page.fill("#capture-input", text);
    await page.press("#capture-input", "Enter");
  }
  await expect(page.locator(`${column("inbox")} .card`)).toHaveCount(3);
  await expect(page.locator(`${column("inbox")} .count`)).toHaveText("3");

  await dragCard(page, page.locator(`${column("inbox")} .card`, { hasText: "Tidy desktop" }), page.locator(column("done")));
  await expect(page.locator(`${column("done")} .card`)).toHaveText(["Tidy desktop"]);
  await expect(archiveDone).toBeEnabled();
  await page.locator(`${column("inbox")} .card`).first().hover();
  await snap(page, testInfo, "board-cards");

  await archiveDone.click();
  await page.click("#archive-confirm-ok");
  await expect(page.locator(`${column("done")} .card`)).toHaveCount(0);
  await expect(archiveDone).toBeDisabled();
  await expect(page.locator("#open-archive")).toBeFocused();

  await page.click("#open-archive");
  await expect(page.locator("#archive-list li")).toHaveCount(1);
  await page.click("#archive-list [data-restore-id]");
  await page.keyboard.press("Escape");
  await expect(page.locator(`${column("done")} .card`)).toHaveText(["Tidy desktop"]);
});

test("edit a card in place and focus Capture with /", async ({ page }) => {
  await openDesk(page, { width: 1100, height: 720 });
  await page.fill("#capture-input", "Draft");
  await page.press("#capture-input", "Enter");

  const card = page.locator(`${column("inbox")} .card`);
  await card.dblclick();
  await page.keyboard.type("Final text");
  await page.keyboard.press("Enter");
  await expect(card).toHaveText("Final text");

  await page.keyboard.press("/");
  await expect(page.locator("#capture-input")).toBeFocused();
});

test("a narrow board switches columns and takes drops on the switch", async ({ page }, testInfo) => {
  await openDesk(page, { width: 400, height: 640 });
  await expect(page.locator("#column-switch")).toBeVisible();
  await page.fill("#capture-input", "Move me");
  await page.press("#capture-input", "Enter");
  await dragCard(page, page.locator(".col.active .card"), page.locator('#column-switch [data-column="today"]'));
  await expect(page.locator(".col.active")).toHaveAttribute("data-column", "today");
  await expect(page.locator(".col.active .card")).toHaveText(["Move me"]);
  await snap(page, testInfo, "board-narrow");
});

test("Settings shows the version and says login launch needs the app", async ({ page }, testInfo) => {
  const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };
  await openDesk(page, { width: 1100, height: 720 });
  await page.click("#settings-btn");
  await expect(page.locator("#settings-overlay")).toBeVisible();
  await expect(page.locator("#settings-version")).toHaveText(`Desk ${version}`);
  await expect(page.locator("#autostart-toggle")).toBeDisabled();
  await expect(page.locator("#settings-autostart-status")).toHaveText("Available in the Desk app only.");
  await snap(page, testInfo, "settings");
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings-overlay")).toBeHidden();
  await expect(page.locator("#settings-btn")).toBeFocused();
});
